import { Hono } from "hono";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to verify authenticated user (any role except admin)
const authenticatedUser = async (c: any, next: any) => {
  const db = c.env.DB;
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ? AND is_active = 1")
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  c.set("currentUser", user);
  await next();
};

// Get employee profile visibility settings
app.get("/api/employees/settings", authenticatedUser, async (c) => {
  const db = c.env.DB;

  try {
    const settings = await db
      .prepare(`
        SELECT setting_key, setting_value
        FROM app_settings
        WHERE setting_key IN (
          'show_employee_profiles',
          'show_recruiter_stats',
          'show_rm_stats',
          'show_am_stats',
          'show_client_stats',
          'show_team_stats'
        )
      `)
      .all();

    const settingsMap: any = {
      show_employee_profiles: true,
      show_recruiter_stats: true,
      show_rm_stats: true,
      show_am_stats: true,
      show_client_stats: true,
      show_team_stats: true,
    };

    for (const setting of settings.results || []) {
      const data = setting as any;
      // Handle different value formats: '1', 'true', 1, true
      const value = data.setting_value;
      settingsMap[data.setting_key] = value === 'true' || value === '1' || value === 1 || value === true;
    }

    return c.json(settingsMap);
  } catch (error) {
    console.error("Error fetching employee settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

// Get all employee profiles (excludes admins)
app.get("/api/employees/profiles", authenticatedUser, async (c) => {
  const db = c.env.DB;
  // const currentUser = c.get("currentUser");
  const searchQuery = c.req.query("search");
  const roleFilter = c.req.query("role");

  try {
    // Get visibility settings
    const settingsResult = await db
      .prepare(`
        SELECT setting_key, setting_value
        FROM app_settings
        WHERE setting_key IN (
          'show_employee_profiles',
          'show_recruiter_stats',
          'show_rm_stats',
          'show_am_stats',
          'show_client_stats',
          'show_team_stats'
        )
      `)
      .all();

    const settings: any = {
      show_employee_profiles: true,
      show_recruiter_stats: true,
      show_rm_stats: true,
      show_am_stats: true,
      show_client_stats: true,
      show_team_stats: true,
    };

    for (const setting of settingsResult.results || []) {
      const data = setting as any;
      // Handle different value formats: '1', 'true', 1, true
      const value = data.setting_value;
      settings[data.setting_key] = value === 'true' || value === '1' || value === 1 || value === true;
    }

    // Check if profiles are enabled
    if (!settings.show_employee_profiles) {
      return c.json({ profiles: [], settings });
    }

    // Get all users except admins and current user
    let query = "SELECT * FROM users WHERE role != 'admin' AND is_active = 1";
    const params: any[] = [];

    if (searchQuery) {
      query += " AND (name LIKE ? OR email LIKE ? OR user_code LIKE ?)";
      const searchTerm = `%${searchQuery}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (roleFilter && roleFilter !== "all") {
      query += " AND role = ?";
      params.push(roleFilter);
    }

    query += " ORDER BY role, name";

    const usersResult = await db.prepare(query).bind(...params).all();
    const users = usersResult.results || [];

    const profiles = [];

    for (const user of users) {
      const userData = user as any;

      const profile: any = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        user_code: userData.user_code,
        role: userData.role,
        created_at: userData.created_at,
      };

      // Get teams if enabled
      if (settings.show_team_stats) {
        const teamsResult = await db
          .prepare(`
            SELECT t.id, t.name, t.team_code
            FROM app_teams t
            INNER JOIN team_assignments ta ON t.id = ta.team_id
            WHERE ta.user_id = ?
          `)
          .bind(userData.id)
          .all();
        profile.teams = teamsResult.results || [];
      }

      // Get clients if enabled
      if (settings.show_client_stats) {
        const clientsResult = await db
          .prepare(`
            SELECT c.id, c.name, c.client_code
            FROM clients c
            INNER JOIN client_assignments ca ON c.id = ca.client_id
            WHERE ca.user_id = ?
          `)
          .bind(userData.id)
          .all();
        profile.clients = clientsResult.results || [];
      }

      // Get role-specific stats
      if (userData.role === "recruiter" && settings.show_recruiter_stats) {
        const submissionsResult = await db
          .prepare(`
            SELECT
              COUNT(CASE WHEN entry_type = 'submission' THEN 1 END) as total_submissions,
              COUNT(CASE WHEN entry_type = 'interview' THEN 1 END) as total_interviews,
              COUNT(CASE WHEN entry_type = 'deal' THEN 1 END) as total_deals,
              COUNT(CASE WHEN entry_type = 'dropout' THEN 1 END) as total_dropouts
            FROM recruiter_submissions
            WHERE recruiter_user_id = ?
          `)
          .bind(userData.id)
          .first();

        const stats = submissionsResult as any;
        profile.stats = {
          total_submissions: stats?.total_submissions || 0,
          total_interviews: stats?.total_interviews || 0,
          total_deals: stats?.total_deals || 0,
          total_dropouts: stats?.total_dropouts || 0,
        };

        // Calculate EBES score
        const dropoutsResult = await db
          .prepare(`
            SELECT COUNT(CASE WHEN entry_type = 'dropout' THEN 1 END) as total_dropouts
            FROM recruiter_submissions
            WHERE recruiter_user_id = ?
          `)
          .bind(userData.id)
          .first();
        const totalDropouts = (dropoutsResult as any)?.total_dropouts || 0;

        const lostRolesResult = await db
          .prepare(`
            SELECT COUNT(DISTINCT r.id) as count
            FROM am_roles r
            INNER JOIN recruiter_client_assignments rca ON r.client_id = rca.client_id
            WHERE rca.recruiter_user_id = ? AND r.status = 'lost'
          `)
          .bind(userData.id)
          .first();
        const lostRoles = (lostRolesResult as any)?.count || 0;

        const table1Points = (stats?.total_submissions || 0) * 1.5 + 
                            (stats?.total_interviews || 0) * 3.0 + 
                            (stats?.total_deals || 0) * 7.0 - 
                            ((lostRoles + totalDropouts) * 3.0);

        const activeRolesResult = await db
          .prepare(`
            SELECT COUNT(DISTINCT r.id) as count
            FROM am_roles r
            INNER JOIN recruiter_client_assignments rca ON r.client_id = rca.client_id
            WHERE rca.recruiter_user_id = ? AND r.status = 'active'
          `)
          .bind(userData.id)
          .first();
        const activeRoles = (activeRolesResult as any)?.count || 0;

        const table2Points = activeRoles * 4.0;
        const ebesScore = table2Points > 0 ? (table1Points / table2Points) * 100 : 0;

        profile.stats.ebes_score = Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10));
        profile.stats.active_roles = activeRoles;
      } else if (userData.role === "recruitment_manager" && settings.show_rm_stats) {
        const teamsResult = await db
          .prepare(`
            SELECT COUNT(DISTINCT ta.team_id) as count
            FROM team_assignments ta
            WHERE ta.user_id = ?
          `)
          .bind(userData.id)
          .first();
        const managedTeams = (teamsResult as any)?.count || 0;

        const recruitersResult = await db
          .prepare(`
            SELECT COUNT(DISTINCT rta.recruiter_user_id) as count
            FROM recruiter_team_assignments rta
            INNER JOIN team_assignments ta ON rta.team_id = ta.team_id
            WHERE ta.user_id = ?
          `)
          .bind(userData.id)
          .first();
        const totalRecruiters = (recruitersResult as any)?.count || 0;

        const rolesResult = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM am_roles r
            INNER JOIN client_assignments ca ON r.client_id = ca.client_id
            WHERE ca.user_id = ?
          `)
          .bind(userData.id)
          .first();
        const totalRoles = (rolesResult as any)?.count || 0;

        const activeRolesResult = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM am_roles r
            INNER JOIN client_assignments ca ON r.client_id = ca.client_id
            WHERE ca.user_id = ? AND r.status = 'active'
          `)
          .bind(userData.id)
          .first();
        const activeRoles = (activeRolesResult as any)?.count || 0;

        const dealsResult = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM recruiter_submissions rs
            INNER JOIN recruiter_team_assignments rta ON rs.recruiter_user_id = rta.recruiter_user_id
            INNER JOIN team_assignments ta ON rta.team_id = ta.team_id
            WHERE ta.user_id = ? AND rs.entry_type = 'deal'
          `)
          .bind(userData.id)
          .first();
        const totalDeals = (dealsResult as any)?.count || 0;

        profile.stats = {
          managed_teams: managedTeams,
          total_recruiters: totalRecruiters,
          total_roles: totalRoles,
          active_roles: activeRoles,
          total_deals: totalDeals,
        };

        // Calculate EBES score
        const table1Points = totalDeals * 7.0 + activeRoles * 2.0;
        const table2Points = totalRecruiters * 5.0 + managedTeams * 3.0;
        const ebesScore = table2Points > 0 ? (table1Points / table2Points) * 100 : 0;

        profile.stats.ebes_score = Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10));
      } else if (userData.role === "account_manager" && settings.show_am_stats) {
        const rolesResult = await db
          .prepare(`
            SELECT
              COUNT(*) as total_roles,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_roles,
              COUNT(CASE WHEN status = 'deal' THEN 1 END) as deals_closed
            FROM am_roles
            WHERE account_manager_id = ?
          `)
          .bind(userData.id)
          .first();

        const interviewsResult = await db
          .prepare(`
            SELECT SUM(interview_count) as count
            FROM am_role_interviews
            WHERE role_id IN (SELECT id FROM am_roles WHERE account_manager_id = ?)
          `)
          .bind(userData.id)
          .first();

        const stats = rolesResult as any;
        profile.stats = {
          total_roles: stats?.total_roles || 0,
          active_roles: stats?.active_roles || 0,
          deals_closed: stats?.deals_closed || 0,
          total_interviews: (interviewsResult as any)?.count || 0,
        };

        // Calculate EBES score
        const table1Points = (stats?.active_roles || 0) * 3.0 + 
                            (stats?.deals_closed || 0) * 7.0 + 
                            ((interviewsResult as any)?.count || 0) * 2.0;
        const table2Raw = (stats?.active_roles || 0) * 4.0;
        const table2Points = Math.min(table2Raw, 20);
        const effectiveT2 = Math.max(table2Points, 1);
        const ebesScore = (table1Points / effectiveT2) * 100;

        profile.stats.ebes_score = Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10));
      }

      profiles.push(profile);
    }

    return c.json({ profiles, settings });
  } catch (error) {
    console.error("Error fetching employee profiles:", error);
    return c.json({ error: "Failed to fetch employee profiles" }, 500);
  }
});

// Get single employee profile by ID
app.get("/api/employees/profiles/:id", authenticatedUser, async (c) => {
  const db = c.env.DB;
  const employeeId = c.req.param("id");

  try {
    // Get visibility settings
    const settingsResult = await db
      .prepare(`
        SELECT setting_key, setting_value
        FROM app_settings
        WHERE setting_key IN (
          'show_employee_profiles',
          'show_recruiter_stats',
          'show_rm_stats',
          'show_am_stats',
          'show_client_stats',
          'show_team_stats'
        )
      `)
      .all();

    const settings: any = {
      show_employee_profiles: true,
      show_recruiter_stats: true,
      show_rm_stats: true,
      show_am_stats: true,
      show_client_stats: true,
      show_team_stats: true,
    };

    for (const setting of settingsResult.results || []) {
      const data = setting as any;
      // Handle different value formats: '1', 'true', 1, true
      const value = data.setting_value;
      settings[data.setting_key] = value === 'true' || value === '1' || value === 1 || value === true;
    }

    if (!settings.show_employee_profiles) {
      return c.json({ error: "Employee profiles are disabled" }, 403);
    }

    // Get user (must not be admin)
    const user = await db
      .prepare("SELECT * FROM users WHERE id = ? AND role != 'admin' AND is_active = 1")
      .bind(employeeId)
      .first();

    if (!user) {
      return c.json({ error: "Employee not found" }, 404);
    }

    const userData = user as any;
    const profile: any = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      user_code: userData.user_code,
      role: userData.role,
      created_at: userData.created_at,
    };

    // Get teams if enabled
    if (settings.show_team_stats) {
      const teamsResult = await db
        .prepare(`
          SELECT t.id, t.name, t.team_code
          FROM app_teams t
          INNER JOIN team_assignments ta ON t.id = ta.team_id
          WHERE ta.user_id = ?
        `)
        .bind(userData.id)
        .all();
      profile.teams = teamsResult.results || [];
    }

    // Get clients if enabled
    if (settings.show_client_stats) {
      const clientsResult = await db
        .prepare(`
          SELECT c.id, c.name, c.client_code
          FROM clients c
          INNER JOIN client_assignments ca ON c.id = ca.client_id
          WHERE ca.user_id = ?
        `)
        .bind(userData.id)
        .all();
      profile.clients = clientsResult.results || [];
    }

    // Get role-specific detailed stats
    if (userData.role === "recruiter" && settings.show_recruiter_stats) {
      // Get recent submissions
      const recentSubmissionsResult = await db
        .prepare(`
          SELECT rs.*, r.title as role_title, r.role_code
          FROM recruiter_submissions rs
          LEFT JOIN am_roles r ON rs.role_id = r.id
          WHERE rs.recruiter_user_id = ?
          ORDER BY rs.created_at DESC
          LIMIT 10
        `)
        .bind(userData.id)
        .all();

      profile.recent_activity = recentSubmissionsResult.results || [];

      // Get monthly stats
      const monthlyStatsResult = await db
        .prepare(`
          SELECT
            strftime('%Y-%m', submission_date) as month,
            COUNT(CASE WHEN entry_type = 'submission' THEN 1 END) as submissions,
            COUNT(CASE WHEN entry_type = 'interview' THEN 1 END) as interviews,
            COUNT(CASE WHEN entry_type = 'deal' THEN 1 END) as deals
          FROM recruiter_submissions
          WHERE recruiter_user_id = ?
          GROUP BY month
          ORDER BY month DESC
          LIMIT 6
        `)
        .bind(userData.id)
        .all();

      profile.monthly_stats = monthlyStatsResult.results || [];
    }

    return c.json({ profile, settings });
  } catch (error) {
    console.error("Error fetching employee profile:", error);
    return c.json({ error: "Failed to fetch employee profile" }, 500);
  }
});

export default app;
