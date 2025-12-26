import { Hono } from "hono";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to check if user is authenticated
const authOnly = async (c: any, next: any) => {
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

  c.set("user", user);
  await next();
};

// Admin only middleware
const adminOnly = async (c: any, next: any) => {
  const db = c.env.DB;
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1")
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: "Unauthorized - Admin only" }, 403);
  }

  c.set("user", user);
  await next();
};



// Get all teams for filter dropdown (accessible to all authenticated users)
app.get("/api/company/filter-teams", authOnly, async (c) => {
  const db = c.env.DB;

  try {
    const teams = await db
      .prepare("SELECT id, name, team_code FROM app_teams WHERE is_active = 1 ORDER BY name")
      .all();

    return c.json(teams.results || []);
  } catch (error) {
    console.error("Error fetching teams for filters:", error);
    return c.json({ error: "Failed to fetch teams" }, 500);
  }
});

// Get all clients for filter dropdown (accessible to all authenticated users)
app.get("/api/company/filter-clients", authOnly, async (c) => {
  const db = c.env.DB;

  try {
    const clients = await db
      .prepare("SELECT id, name, client_code FROM clients WHERE is_active = 1 ORDER BY name")
      .all();

    return c.json(clients.results || []);
  } catch (error) {
    console.error("Error fetching clients for filters:", error);
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
});

// Get company page visibility setting
app.get("/api/company/settings", authOnly, async (c) => {
  const db = c.env.DB;

  try {
    const setting = await db
      .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'show_company_page'")
      .first();

    return c.json({ 
      show_company_page: setting ? (setting as any).setting_value === 'true' : true 
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

// Update company page visibility (admin only)
app.put("/api/company/settings", adminOnly, async (c) => {
  const db = c.env.DB;
  const { show_company_page } = await c.req.json();

  try {
    await db
      .prepare("UPDATE app_settings SET setting_value = ?, updated_at = datetime('now') WHERE setting_key = 'show_company_page'")
      .bind(show_company_page ? 'true' : 'false')
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating company settings:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// OPTIMIZED: Get all company data in one call
app.get("/api/company/data", authOnly, async (c) => {
  const db = c.env.DB;
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const teamId = c.req.query("team_id");
  const clientId = c.req.query("client_id");

  try {
    // Base counts (fast, no filters needed)
    const [
      totalTeams,
      totalClients,
      totalRecruiters,
      totalAMs,
      totalRMs
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM app_teams WHERE is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM clients WHERE is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'recruiter' AND is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'account_manager' AND is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'recruitment_manager' AND is_active = 1").first()
    ]);

    // Build filtered queries
    let rolesWhere = "1=1";
    const rolesParams: any[] = [];
    if (teamId) {
      rolesWhere += " AND team_id = ?";
      rolesParams.push(parseInt(teamId));
    }
    if (clientId) {
      rolesWhere += " AND client_id = ?";
      rolesParams.push(parseInt(clientId));
    }
    if (startDate && endDate) {
      rolesWhere += " AND created_at BETWEEN ? AND ?";
      rolesParams.push(startDate, endDate);
    }

    let submissionsWhere = "1=1";
    const submissionsParams: any[] = [];
    if (teamId) {
      submissionsWhere += " AND team_id = ?";
      submissionsParams.push(parseInt(teamId));
    }
    if (clientId) {
      submissionsWhere += " AND client_id = ?";
      submissionsParams.push(parseInt(clientId));
    }
    if (startDate && endDate) {
      submissionsWhere += " AND submission_date BETWEEN ? AND ?";
      submissionsParams.push(startDate, endDate);
    }

    // Get role stats
    const roles = await db
      .prepare(`SELECT status FROM am_roles WHERE ${rolesWhere}`)
      .bind(...rolesParams)
      .all();

    const totalActiveRoles = (roles.results || []).filter((r: any) => r.status === 'active').length;
    const totalNonActiveRoles = (roles.results || []).filter((r: any) => r.status !== 'active').length;

    // Get submission stats
    const submissions = await db
      .prepare(`SELECT entry_type FROM recruiter_submissions WHERE ${submissionsWhere}`)
      .bind(...submissionsParams)
      .all();

    const totalSubmissions = (submissions.results || []).filter((s: any) => s.entry_type === 'submission').length;
    const totalInterviews = (submissions.results || []).filter((s: any) => s.entry_type === 'interview').length;
    const totalDeals = (submissions.results || []).filter((s: any) => s.entry_type === 'deal').length;
    const totalDropouts = (submissions.results || []).filter((s: any) => s.entry_type === 'dropout').length;

    // Get top 5 recruiters (optimized - limit results)
    const topRecruiters = await db
      .prepare(`
        SELECT 
          u.name,
          u.user_code,
          COUNT(CASE WHEN rs.entry_type = 'deal' THEN 1 END) as deals,
          COUNT(CASE WHEN rs.entry_type = 'submission' THEN 1 END) as submissions
        FROM users u
        LEFT JOIN recruiter_submissions rs ON u.id = rs.recruiter_user_id
          ${startDate && endDate ? `AND rs.submission_date BETWEEN '${startDate}' AND '${endDate}'` : ''}
          ${teamId ? `AND rs.team_id = ${teamId}` : ''}
          ${clientId ? `AND rs.client_id = ${clientId}` : ''}
        WHERE u.role = 'recruiter' AND u.is_active = 1
        GROUP BY u.id, u.name, u.user_code
        ORDER BY deals DESC, submissions DESC
        LIMIT 5
      `)
      .all();

    // Get top 5 AMs (optimized - limit results)
    const topAMs = await db
      .prepare(`
        SELECT 
          u.name,
          u.user_code,
          COUNT(DISTINCT r.id) as total_roles,
          COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_roles
        FROM users u
        LEFT JOIN am_roles r ON u.id = r.account_manager_id
          ${teamId ? `AND r.team_id = ${teamId}` : ''}
          ${clientId ? `AND r.client_id = ${clientId}` : ''}
        WHERE u.role = 'account_manager' AND u.is_active = 1
        GROUP BY u.id, u.name, u.user_code
        ORDER BY active_roles DESC, total_roles DESC
        LIMIT 5
      `)
      .all();

    // Get top 5 RMs (optimized - limit results)
    const topRMs = await db
      .prepare(`
        SELECT 
          u.name,
          u.user_code,
          COUNT(DISTINCT ta.team_id) as teams_managed
        FROM users u
        LEFT JOIN team_assignments ta ON u.id = ta.user_id
        WHERE u.role = 'recruitment_manager' AND u.is_active = 1
        GROUP BY u.id, u.name, u.user_code
        ORDER BY teams_managed DESC
        LIMIT 5
      `)
      .all();

    return c.json({
      overview: {
        total_teams: (totalTeams as any)?.count || 0,
        total_clients: (totalClients as any)?.count || 0,
        total_recruiters: (totalRecruiters as any)?.count || 0,
        total_account_managers: (totalAMs as any)?.count || 0,
        total_recruitment_managers: (totalRMs as any)?.count || 0,
        total_active_roles: totalActiveRoles,
        total_non_active_roles: totalNonActiveRoles,
        total_interviews: totalInterviews,
        total_deals: totalDeals,
        total_submissions: totalSubmissions,
        total_dropouts: totalDropouts
      },
      topPerformers: {
        recruiters: (topRecruiters.results || []).map((r: any) => {
          const rawScore = r.deals * 10 + r.submissions;
          return {
            name: r.name,
            user_code: r.user_code,
            deals: r.deals,
            submissions: r.submissions,
            score: Math.min(100, rawScore) // Cap at 100
          };
        }),
        account_managers: (topAMs.results || []).map((a: any) => {
          const rawScore = a.active_roles * 10 + a.total_roles;
          return {
            name: a.name,
            user_code: a.user_code,
            active_roles: a.active_roles,
            total_roles: a.total_roles,
            score: Math.min(100, rawScore) // Cap at 100
          };
        }),
        recruitment_managers: (topRMs.results || []).map((r: any) => {
          const rawScore = r.teams_managed * 10;
          return {
            name: r.name,
            user_code: r.user_code,
            teams_managed: r.teams_managed,
            score: Math.min(100, rawScore) // Cap at 100
          };
        })
      }
    });
  } catch (error) {
    console.error("Error fetching company data:", error);
    return c.json({ error: "Failed to fetch company data" }, 500);
  }
});

// Get company overview stats (kept for backward compatibility)
app.get("/api/company/overview", authOnly, async (c) => {
  const db = c.env.DB;
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const teamId = c.req.query("team_id");
  const clientId = c.req.query("client_id");

  try {
    const [
      totalTeams,
      totalClients,
      totalRecruiters,
      totalAMs,
      totalRMs
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM app_teams WHERE is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM clients WHERE is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'recruiter' AND is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'account_manager' AND is_active = 1").first(),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'recruitment_manager' AND is_active = 1").first()
    ]);

    let rolesWhere = "1=1";
    const rolesParams: any[] = [];
    if (teamId) {
      rolesWhere += " AND team_id = ?";
      rolesParams.push(parseInt(teamId));
    }
    if (clientId) {
      rolesWhere += " AND client_id = ?";
      rolesParams.push(parseInt(clientId));
    }
    if (startDate && endDate) {
      rolesWhere += " AND created_at BETWEEN ? AND ?";
      rolesParams.push(startDate, endDate);
    }

    const roles = await db.prepare(`SELECT status FROM am_roles WHERE ${rolesWhere}`).bind(...rolesParams).all();
    const totalActiveRoles = (roles.results || []).filter((r: any) => r.status === 'active').length;
    const totalNonActiveRoles = (roles.results || []).filter((r: any) => r.status !== 'active').length;

    let submissionsWhere = "1=1";
    const submissionsParams: any[] = [];
    if (teamId) {
      submissionsWhere += " AND team_id = ?";
      submissionsParams.push(parseInt(teamId));
    }
    if (clientId) {
      submissionsWhere += " AND client_id = ?";
      submissionsParams.push(parseInt(clientId));
    }
    if (startDate && endDate) {
      submissionsWhere += " AND submission_date BETWEEN ? AND ?";
      submissionsParams.push(startDate, endDate);
    }

    const submissions = await db.prepare(`SELECT entry_type FROM recruiter_submissions WHERE ${submissionsWhere}`).bind(...submissionsParams).all();
    const totalSubmissions = (submissions.results || []).filter((s: any) => s.entry_type === 'submission').length;
    const totalInterviews = (submissions.results || []).filter((s: any) => s.entry_type === 'interview').length;
    const totalDeals = (submissions.results || []).filter((s: any) => s.entry_type === 'deal').length;
    const totalDropouts = (submissions.results || []).filter((s: any) => s.entry_type === 'dropout').length;

    return c.json({
      total_teams: (totalTeams as any)?.count || 0,
      total_clients: (totalClients as any)?.count || 0,
      total_recruiters: (totalRecruiters as any)?.count || 0,
      total_account_managers: (totalAMs as any)?.count || 0,
      total_recruitment_managers: (totalRMs as any)?.count || 0,
      total_active_roles: totalActiveRoles,
      total_non_active_roles: totalNonActiveRoles,
      total_interviews: totalInterviews,
      total_deals: totalDeals,
      total_submissions: totalSubmissions,
      total_dropouts: totalDropouts
    });
  } catch (error) {
    console.error("Error fetching company overview:", error);
    return c.json({ error: "Failed to fetch overview" }, 500);
  }
});

// Kept for backward compatibility but not used in optimized version
app.get("/api/company/leaderboards", authOnly, async (c) => {
  return c.json({
    recruiters: [],
    account_managers: [],
    recruitment_managers: []
  });
});

app.get("/api/company/teams", authOnly, async (c) => {
  return c.json([]);
});

app.get("/api/company/clients", authOnly, async (c) => {
  return c.json([]);
});

export default app;
