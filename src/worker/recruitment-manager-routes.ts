import { Hono } from "hono";
import { calculateRecruiterEBES, type RecruiterEBESData } from "./ebes-calculator";
import { createNotification } from "./notification-routes";
import { calculateRecruitmentManagerEBES, type RecruitmentManagerEBESData } from "./ebes-calculator";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to check if user is a recruitment manager
const rmOnly = async (c: any, next: any) => {
  const db = c.env.DB;
  
  try {
    // Get user from request header
    const userId = c.req.header('x-user-id');
    
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const rmUser = await db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'recruitment_manager' AND is_active = 1")
      .bind(userId)
      .first();

    if (!rmUser) {
      return c.json({ error: "Unauthorized - Recruitment Manager access required" }, 403);
    }

    c.set("rmUser", rmUser);
    await next();
  } catch (error) {
    return c.json({ error: "Unauthorized" }, 401);
  }
};

// Pending submissions count for RM
app.get("/api/rm/pending-submissions-count", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  try {
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => t.id);
    const clientIds = (clientRows.results || []).map((c2: any) => c2.id);

    if (teamIds.length === 0 && clientIds.length === 0) {
      return c.json({ count: 0 });
    }

    let where = `cra.status = 'rm_evaluation' AND cra.is_discarded = 0`;
    const filters: string[] = [];
    if (teamIds.length > 0) filters.push(`r.team_id IN (${teamIds.join(",")})`);
    if (clientIds.length > 0) filters.push(`r.client_id IN (${clientIds.join(",")})`);
    if (filters.length > 0) where += ` AND (${filters.join(" OR ")})`;

    const row = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM candidate_role_associations cra
        INNER JOIN am_roles r ON r.id = cra.role_id
        WHERE ${where}
      `)
      .first();
    return c.json({ count: (row as any)?.count || 0 });
  } catch (error) {
    return c.json({ error: "Failed to fetch pending submissions count" }, 500);
  }
});

// Pending submissions list for RM
app.get("/api/rm/pending-submissions", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  try {
    const qLimit = Number(c.req.query('limit') || '100');
    const limit = Math.max(1, Math.min(qLimit, 500));
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teamRows.results || []).map((t: any) => t.id);
    const clientIds = (clientRows.results || []).map((c2: any) => c2.id);

    if (teamIds.length === 0 && clientIds.length === 0) {
      return c.json([]);
    }

    let filter = "";
    if (teamIds.length > 0 && clientIds.length > 0) {
      filter = `AND (r.team_id IN (${teamIds.join(",")}) OR r.client_id IN (${clientIds.join(",")}))`;
    } else if (teamIds.length > 0) {
      filter = `AND r.team_id IN (${teamIds.join(",")})`;
    } else if (clientIds.length > 0) {
      filter = `AND r.client_id IN (${clientIds.join(",")})`;
    }

    const rows = await db
      .prepare(`
        SELECT 
          cra.role_id,
          r.title as role_title,
          r.role_code,
          cl.name as client_name,
          cra.candidate_id,
          c.name as candidate_name,
          c.email as candidate_email,
          c.phone as candidate_phone,
          cra.submission_date
        FROM candidate_role_associations cra
        INNER JOIN am_roles r ON r.id = cra.role_id
        INNER JOIN clients cl ON cl.id = r.client_id
        INNER JOIN candidates c ON c.id = cra.candidate_id
        WHERE cra.status = 'rm_evaluation' AND cra.is_discarded = 0
        ${filter}
        ORDER BY cra.submission_date DESC
        LIMIT ${limit}
      `)
      .all();

    return c.json(rows.results || []);
  } catch (error) {
    console.error("Error fetching pending submissions:", error);
    return c.json({ error: "Failed to fetch pending submissions" }, 500);
  }
});

// Get assigned teams
app.get("/api/rm/teams", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");

  try {
    const teams = await db
      .prepare(`
        SELECT t.* FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    return c.json(teams.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch teams" }, 500);
  }
});

// Get assigned clients
app.get("/api/rm/clients", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");

  try {
    const clients = await db
      .prepare(`
        SELECT c.* FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    return c.json(clients.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
});

// Create a new role
app.post("/api/rm/roles", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const { client_id, team_ids, title, description, account_manager_id } = await c.req.json();

  if (!client_id || !team_ids || team_ids.length === 0 || !title || !account_manager_id) {
    return c.json({ error: "Client, at least one team, title, and account manager are required" }, 400);
  }

  try {
    // Verify RM has access to the client
    const clientAccess = await db
      .prepare("SELECT * FROM client_assignments WHERE user_id = ? AND client_id = ?")
      .bind((rmUser as any).id, client_id)
      .first();

    if (!clientAccess) {
      return c.json({ error: "You don't have access to this client" }, 403);
    }

    // Verify RM has access to all teams
    for (const team_id of team_ids) {
      const teamAccess = await db
        .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
        .bind((rmUser as any).id, team_id)
        .first();

      if (!teamAccess) {
        return c.json({ error: `You don't have access to team ${team_id}` }, 403);
      }
    }

    // Generate role code
    const codeCounter = await db
      .prepare("SELECT next_number FROM code_counters WHERE category = 'role'")
      .first();

    let nextNumber = 1;
    if (codeCounter) {
      nextNumber = (codeCounter as any).next_number;
      await db
        .prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'role'")
        .run();
    } else {
      await db
        .prepare("INSERT INTO code_counters (category, next_number) VALUES ('role', 2)")
        .run();
    }

    const roleCode = `ROL-${String(nextNumber).padStart(3, '0')}`;

    // Create the role (use first team as primary)
    const result = await db
      .prepare(`
        INSERT INTO am_roles (
          role_code, client_id, team_id, account_manager_id, title, description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'))
      `)
      .bind(roleCode, client_id, team_ids[0], account_manager_id, title, description || null)
      .run();

    const roleId = result.meta.last_row_id;

    // Add team assignments
    for (const team_id of team_ids) {
      await db
        .prepare("INSERT INTO am_role_teams (role_id, team_id, created_at) VALUES (?, ?, datetime('now'))")
        .bind(roleId, team_id)
        .run();
    }

    await createNotification(db, {
      userId: account_manager_id,
      type: 'system',
      title: 'New Role Created',
      message: `Recruitment Manager ${(rmUser as any).name} created role ${title}`,
      relatedEntityType: 'role',
      relatedEntityId: Number(roleId)
    });

    return c.json({ success: true, role_id: roleId, role_code: roleCode });
  } catch (error) {
    console.error("Error creating role:", error);
    return c.json({ error: "Failed to create role" }, 500);
  }
});

// Update an existing role
app.put("/api/rm/roles/:id", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("id");
  const { client_id, team_ids, title, description, account_manager_id } = await c.req.json();

  if (!client_id || !team_ids || team_ids.length === 0 || !title || !account_manager_id) {
    return c.json({ error: "Client, at least one team, title, and account manager are required" }, 400);
  }

  try {
    // Verify role exists
    const role = await db
      .prepare("SELECT * FROM am_roles WHERE id = ?")
      .bind(roleId)
      .first();

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    // Verify RM has access to the client
    const clientAccess = await db
      .prepare("SELECT * FROM client_assignments WHERE user_id = ? AND client_id = ?")
      .bind((rmUser as any).id, client_id)
      .first();

    if (!clientAccess) {
      return c.json({ error: "You don't have access to this client" }, 403);
    }

    // Verify RM has access to all teams
    for (const team_id of team_ids) {
      const teamAccess = await db
        .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
        .bind((rmUser as any).id, team_id)
        .first();

      if (!teamAccess) {
        return c.json({ error: `You don't have access to team ${team_id}` }, 403);
      }
    }

    // Update the role
    await db
      .prepare(`
        UPDATE am_roles 
        SET client_id = ?, team_id = ?, account_manager_id = ?, title = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(client_id, team_ids[0], account_manager_id, title, description || null, roleId)
      .run();

    // Remove old team assignments
    await db
      .prepare("DELETE FROM am_role_teams WHERE role_id = ?")
      .bind(roleId)
      .run();

    // Add new team assignments
    for (const team_id of team_ids) {
      await db
        .prepare("INSERT INTO am_role_teams (role_id, team_id, created_at) VALUES (?, ?, datetime('now'))")
        .bind(roleId, team_id)
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating role:", error);
    return c.json({ error: "Failed to update role" }, 500);
  }
});

// Get teams assigned to a role
app.get("/api/rm/roles/:id/teams", rmOnly, async (c) => {
  const db = c.env.DB;
  const roleId = c.req.param("id");

  try {
    const teams = await db
      .prepare(`
        SELECT t.* FROM app_teams t
        INNER JOIN am_role_teams art ON t.id = art.team_id
        WHERE art.role_id = ?
      `)
      .bind(roleId)
      .all();

    return c.json(teams.results || []);
  } catch (error) {
    console.error("Error fetching role teams:", error);
    return c.json({ error: "Failed to fetch role teams" }, 500);
  }
});

// Get all Account Managers assigned to RM's teams
app.get("/api/rm/account-managers", rmOnly, async (c) => {
  const db = c.env.DB;

  try {
    const ams = await db
      .prepare(`
        SELECT DISTINCT u.* FROM users u
        WHERE u.role = 'account_manager' AND u.is_active = 1
      `)
      .all();

    return c.json(ams.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch account managers" }, 500);
  }
});

// Get roles for RM (view only)
app.get("/api/rm/roles", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const status = c.req.query("status");
  const clientId = c.req.query("client_id");
  const teamId = c.req.query("team_id");
  const searchQuery = c.req.query("search");

  try {
    // Get RM's assigned teams
    const teams = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teams.results || []).map((t: any) => t.id);

    // Get RM's assigned clients
    const clients = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const clientIds = (clients.results || []).map((c: any) => c.id);

    if (teamIds.length === 0 && clientIds.length === 0) {
      return c.json([]);
    }

    // Build query to fetch roles for RM's assigned clients and teams
    let query = `
      SELECT 
        r.*,
        c.name as client_name,
        c.client_code,
        t.name as team_name,
        t.team_code,
        u.name as account_manager_name,
        u.user_code as account_manager_code,
        (SELECT COUNT(*) 
         FROM recruiter_submissions rs 
         WHERE rs.role_id = r.id AND rs.entry_type = 'submission') as total_submissions,
        (SELECT SUM(CASE WHEN cra.status = 'rm_evaluation' AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as under_evaluation,
        (SELECT SUM(CASE WHEN cra.status IN ('rm_evaluation','submitted') AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as pending_submissions,
        (SELECT SUM(CASE WHEN cra.status = 'client_submitted' AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as under_client_evaluation,
        (SELECT SUM(CASE WHEN cra.status = 'client_submitted' AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as client_submitted,
        (SELECT SUM(CASE WHEN cra.status = 'client_rejected' AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as client_rejected,
        (SELECT COUNT(DISTINCT cra.candidate_id) 
         FROM candidate_role_associations cra 
         WHERE cra.role_id = r.id AND cra.is_discarded = 0) as in_play_submissions,
        (SELECT COUNT(DISTINCT cra.candidate_id) 
         FROM candidate_role_associations cra 
         WHERE cra.role_id = r.id) as total_candidates,
        (SELECT COUNT(DISTINCT cra.candidate_id) 
         FROM candidate_role_associations cra 
         WHERE cra.role_id = r.id AND cra.is_discarded = 0) as active_candidates,
        (SELECT COUNT(DISTINCT cra.candidate_id) 
         FROM candidate_role_associations cra 
         WHERE cra.role_id = r.id AND cra.is_discarded = 1) as discarded_candidates,
        (SELECT COUNT(*) 
         FROM recruiter_submissions rs 
         WHERE rs.role_id = r.id AND rs.entry_type = 'deal') as total_deals,
        (SELECT COUNT(*) 
         FROM recruiter_submissions rs 
         WHERE rs.role_id = r.id AND rs.entry_type = 'interview') as total_interviews,
        CAST(julianday('now') - julianday(r.created_at) AS INTEGER) as days_open,
        (SELECT CAST(julianday(MIN(rs2.submission_date)) - julianday(r.created_at) AS INTEGER)
         FROM recruiter_submissions rs2
         WHERE rs2.role_id = r.id AND rs2.entry_type = 'submission') as first_submission_days,
        (SELECT CAST(julianday(MIN(rs3.submission_date)) - julianday(r.created_at) AS INTEGER)
         FROM recruiter_submissions rs3
         WHERE rs3.role_id = r.id AND rs3.entry_type = 'interview') as first_interview_days
      FROM am_roles r
      INNER JOIN clients c ON r.client_id = c.id
      INNER JOIN app_teams t ON r.team_id = t.id
      INNER JOIN users u ON r.account_manager_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by RM's assigned teams and clients
    if (teamIds.length > 0 && clientIds.length > 0) {
      query += ` AND (r.team_id IN (${teamIds.join(",")}) OR r.client_id IN (${clientIds.join(",")}))`;
    } else if (teamIds.length > 0) {
      query += ` AND r.team_id IN (${teamIds.join(",")})`;
    } else if (clientIds.length > 0) {
      query += ` AND r.client_id IN (${clientIds.join(",")})`;
    }

    // Apply status filter
    if (status) {
      if (status === 'active') {
        query += " AND r.status = 'active'";
      } else if (status === 'non-active') {
        query += " AND r.status != 'active'";
      } else if (['lost','cancelled','deal','on_hold','no_answer'].includes(status)) {
        query += " AND r.status = ?";
        params.push(status);
      }
    }

    if (searchQuery) {
      query += " AND (r.title LIKE ? OR r.role_code LIKE ?)";
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    // Apply client filter
    if (clientId) {
      query += " AND r.client_id = ?";
      params.push(parseInt(clientId));
    }

    // Apply team filter
    if (teamId) {
      query += " AND r.team_id = ?";
      params.push(parseInt(teamId));
    }

    query += " ORDER BY pending_submissions DESC, r.created_at DESC";

    const roles = await db.prepare(query).bind(...params).all();

    return c.json(roles.results || []);
  } catch (error) {
    console.error("Error fetching RM roles:", error);
    return c.json({ error: "Failed to fetch roles" }, 500);
  }
});

// Get all recruiters under RM's teams
app.get("/api/rm/recruiters", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");

  try {
    const recruiters = await db
      .prepare(`
        SELECT DISTINCT u.*, t.id as team_id, t.name as team_name, t.team_code
        FROM users u
        INNER JOIN recruiter_team_assignments rta ON u.id = rta.recruiter_user_id
        INNER JOIN app_teams t ON rta.team_id = t.id
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ? AND u.role = 'recruiter'
      `)
      .bind((rmUser as any).id)
      .all();

    return c.json(recruiters.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch recruiters" }, 500);
  }
});

// Get recruiters assigned to a specific team
app.get("/api/rm/team-recruiters/:teamId", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const teamId = c.req.param("teamId");

  try {
    // Verify team assignment
    const teamAssignment = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, teamId)
      .first();

    if (!teamAssignment) {
      return c.json({ error: "Team not assigned to this recruitment manager" }, 403);
    }

    const recruiters = await db
      .prepare(`
        SELECT u.id, u.name, u.email, u.user_code, rta.created_at as assigned_at
        FROM users u
        INNER JOIN recruiter_team_assignments rta ON u.id = rta.recruiter_user_id
        WHERE rta.team_id = ? AND u.role = 'recruiter' AND u.is_active = 1
        ORDER BY u.name
      `)
      .bind(teamId)
      .all();

    return c.json(recruiters.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch team recruiters" }, 500);
  }
});

// Get available recruiters (not assigned to the given team)
app.get("/api/rm/available-recruiters", rmOnly, async (c) => {
  const db = c.env.DB;
  const teamId = c.req.query("team_id");

  if (!teamId) {
    return c.json({ error: "Team ID required" }, 400);
  }

  try {
    const recruiters = await db
      .prepare(`
        SELECT u.id, u.name, u.email, u.user_code
        FROM users u
        WHERE u.role = 'recruiter' 
        AND u.is_active = 1
        AND u.id NOT IN (
          SELECT recruiter_user_id 
          FROM recruiter_team_assignments 
          WHERE team_id = ?
        )
        ORDER BY u.name
      `)
      .bind(teamId)
      .all();

    return c.json(recruiters.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch available recruiters" }, 500);
  }
});

// Add recruiter to team
app.post("/api/rm/team-recruiters", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const { team_id, recruiter_user_id } = await c.req.json();

  if (!team_id || !recruiter_user_id) {
    return c.json({ error: "Team ID and Recruiter ID required" }, 400);
  }

  try {
    // Verify team assignment
    const teamAssignment = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, team_id)
      .first();

    if (!teamAssignment) {
      return c.json({ error: "Team not assigned to this recruitment manager" }, 403);
    }

    // Check if already assigned
    const existing = await db
      .prepare("SELECT * FROM recruiter_team_assignments WHERE team_id = ? AND recruiter_user_id = ?")
      .bind(team_id, recruiter_user_id)
      .first();

    if (existing) {
      return c.json({ error: "Recruiter already assigned to this team" }, 400);
    }

    // Add team assignment
    await db
      .prepare("INSERT INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at) VALUES (?, ?, ?, datetime('now'))")
      .bind(team_id, recruiter_user_id, (rmUser as any).id)
      .run();

    // Check if RM has exactly one client - if so, auto-assign recruiter to that client
    const rmClients = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const clientCount = rmClients.results?.length || 0;

    if (clientCount === 1) {
      const clientId = (rmClients.results?.[0] as any).id;
      
      // Check if recruiter is already assigned to this client
      const existingClientAssignment = await db
        .prepare("SELECT * FROM recruiter_client_assignments WHERE recruiter_user_id = ? AND client_id = ? AND team_id = ?")
        .bind(recruiter_user_id, clientId, team_id)
        .first();

      if (!existingClientAssignment) {
        // Auto-assign recruiter to the single client
        await db
          .prepare("INSERT INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
          .bind(recruiter_user_id, clientId, team_id, (rmUser as any).id)
          .run();
      }
    }

    return c.json({ success: true, auto_assigned_client: clientCount === 1 });
  } catch (error) {
    return c.json({ error: "Failed to add recruiter to team" }, 500);
  }
});

// Remove recruiter from team
app.delete("/api/rm/team-recruiters/:teamId/:recruiterId", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const teamId = c.req.param("teamId");
  const recruiterId = c.req.param("recruiterId");

  try {
    // Verify team assignment
    const teamAssignment = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, teamId)
      .first();

    if (!teamAssignment) {
      return c.json({ error: "Team not assigned to this recruitment manager" }, 403);
    }

    // Remove assignment
    await db
      .prepare("DELETE FROM recruiter_team_assignments WHERE team_id = ? AND recruiter_user_id = ?")
      .bind(teamId, recruiterId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to remove recruiter from team" }, 500);
  }
});

// Get comprehensive analytics for RM
app.get("/api/rm/analytics", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  let startDate = c.req.query("start_date");
  let endDate = c.req.query("end_date");
  const teamId = c.req.query("team_id");
  const clientId = c.req.query("client_id");
  const recruiterId = c.req.query("recruiter_id");

  try {
    // Get assigned teams
    const teams = await db
      .prepare(`
        SELECT t.* FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teams.results || []).map((t: any) => t.id);

    if (teamIds.length === 0) {
      return c.json({
        total_teams: 0,
        total_recruiters: 0,
        total_active_roles: 0,
        total_non_active_roles: 0,
        total_interviews: 0,
        total_deals: 0,
        total_lost: 0,
        total_on_hold: 0,
        total_no_answer: 0,
        team_breakdown: [],
        recruiter_breakdown: [],
      });
    }

    // Default to current month if no explicit date range provided
    if (!startDate || !endDate) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      startDate = startOfMonth;
      endDate = endOfMonth;
    }

    // Build role query with filters
    let roleQuery = `
      SELECT 
        ar.id,
        ar.status,
        ar.team_id,
        ar.account_manager_id,
        ar.client_id,
        t.name as team_name,
        c.name as client_name
      FROM am_roles ar
      INNER JOIN app_teams t ON ar.team_id = t.id
      INNER JOIN clients c ON ar.client_id = c.id
      WHERE ar.team_id IN (${teamIds.join(",")})
    `;

    const roleParams: any[] = [];

    if (teamId) {
      roleQuery += " AND ar.team_id = ?";
      roleParams.push(teamId);
    }

    if (clientId) {
      roleQuery += " AND ar.client_id = ?";
      roleParams.push(clientId);
    }

    roleQuery += " AND ar.created_at BETWEEN ? AND ?";
    roleParams.push(startDate, endDate);

    const roles = await db.prepare(roleQuery).bind(...roleParams).all();

    // Calculate role statistics
    let total_active_roles = 0;
    let total_non_active_roles = 0;
    let total_deals = 0;
    let total_lost = 0;
    let total_on_hold = 0;
    let total_no_answer = 0;

    for (const role of roles.results || []) {
      const r = role as any;
      if (r.status === 'active') total_active_roles++;
      else total_non_active_roles++;
      
      if (r.status === 'deal') total_deals++;
      if (r.status === 'lost') total_lost++;
      if (r.status === 'on_hold') total_on_hold++;
      if (r.status === 'no_answer') total_no_answer++;
    }

    // Get interview statistics
    const roleIds = (roles.results || []).map((r: any) => r.id);
    let total_interviews = 0;

    if (roleIds.length > 0) {
      const interviews = await db
        .prepare(`
          SELECT SUM(interview_count) as total
          FROM am_role_interviews
          WHERE role_id IN (${roleIds.join(",")})
        `)
        .first();

      total_interviews = (interviews as any)?.total || 0;
    }

    // Get team breakdown
    const teamBreakdown: any[] = [];
    for (const team of teams.results || []) {
      const t = team as any;
      const teamRoles = (roles.results || []).filter((r: any) => r.team_id === t.id);
      
      let active = 0, deals = 0, lost = 0, on_hold = 0, no_answer = 0;
      const teamRoleIds = teamRoles.map((r: any) => r.id);
      
      for (const r of teamRoles) {
        const role = r as any;
        if (role.status === 'active') active++;
        if (role.status === 'deal') deals++;
        if (role.status === 'lost') lost++;
        if (role.status === 'on_hold') on_hold++;
        if (role.status === 'no_answer') no_answer++;
      }

      let interviews = 0;
      if (teamRoleIds.length > 0) {
        const teamInterviews = await db
          .prepare(`
            SELECT SUM(interview_count) as total
            FROM am_role_interviews
            WHERE role_id IN (${teamRoleIds.join(",")})
          `)
          .first();
        interviews = (teamInterviews as any)?.total || 0;
      }

      teamBreakdown.push({
        team_id: t.id,
        team_name: t.name,
        team_code: t.team_code,
        total_roles: teamRoles.length,
        active_roles: active,
        interviews: interviews,
        deals: deals,
        lost: lost,
        on_hold: on_hold,
        no_answer: no_answer,
      });
    }

    // Get recruiter breakdown
    let recruiterQuery = `
      SELECT DISTINCT u.id, u.name, u.user_code
      FROM users u
      INNER JOIN recruiter_team_assignments rta ON u.id = rta.recruiter_user_id
      WHERE rta.team_id IN (${teamIds.join(",")}) AND u.role = 'recruiter'
    `;

    const recruiterParams: any[] = [];

    if (recruiterId) {
      recruiterQuery += " AND u.id = ?";
      recruiterParams.push(recruiterId);
    }

    const recruiters = await db.prepare(recruiterQuery).bind(...recruiterParams).all();

    const recruiterBreakdown: any[] = [];
    for (const recruiter of recruiters.results || []) {
      const r = recruiter as any;
      
      // Get submissions for this recruiter
      let submissionQuery = `
        SELECT 
          COUNT(*) as total_submissions,
          SUM(CASE WHEN entry_type = 'interview' THEN 1 ELSE 0 END) as interviews,
          SUM(CASE WHEN entry_type = 'deal' THEN 1 ELSE 0 END) as deals,
          SUM(CASE WHEN entry_type = 'dropout' THEN 1 ELSE 0 END) as dropouts
        FROM recruiter_submissions
        WHERE recruiter_user_id = ? AND team_id IN (${teamIds.join(",")})
      `;

      const subParams: any[] = [r.id];

      if (teamId) {
        submissionQuery += " AND team_id = ?";
        subParams.push(teamId);
      }

      if (clientId) {
        submissionQuery += " AND client_id = ?";
        subParams.push(clientId);
      }

      submissionQuery += " AND submission_date BETWEEN ? AND ?";
      subParams.push(startDate, endDate);

      const stats = await db.prepare(submissionQuery).bind(...subParams).first();
      const s = stats as any;

      recruiterBreakdown.push({
        recruiter_id: r.id,
        recruiter_name: r.name,
        recruiter_code: r.user_code,
        total_submissions: s?.total_submissions || 0,
        interviews: s?.interviews || 0,
        deals: s?.deals || 0,
        lost_roles: s?.dropouts || 0,
      });
    }

    return c.json({
      total_teams: teams.results?.length || 0,
      total_recruiters: recruiters.results?.length || 0,
      total_active_roles,
      total_non_active_roles,
      total_interviews,
      total_deals,
      total_lost,
      total_on_hold,
      total_no_answer,
      team_breakdown: teamBreakdown,
      recruiter_breakdown: recruiterBreakdown,
    });
  } catch (error) {
    console.error("Error fetching RM analytics:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

// Assign recruiters to a role
app.post("/api/rm/roles/:id/recruiters", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("id");
  const { recruiter_ids } = await c.req.json();

  if (!recruiter_ids || !Array.isArray(recruiter_ids)) {
    return c.json({ error: "Recruiter IDs array required" }, 400);
  }

  try {
    // Verify role exists and is accessible
    const role = await db
      .prepare("SELECT * FROM am_roles WHERE id = ?")
      .bind(roleId)
      .first();

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    // Verify RM has access to the role's team
    const teamAccess = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, (role as any).team_id)
      .first();

    if (!teamAccess) {
      return c.json({ error: "You don't have access to this role's team" }, 403);
    }

    // Remove existing assignments
    await db
      .prepare("DELETE FROM role_recruiter_assignments WHERE role_id = ?")
      .bind(roleId)
      .run();

    // Add new assignments
    for (const recruiterId of recruiter_ids) {
      await db
        .prepare(`
          INSERT INTO role_recruiter_assignments 
          (role_id, recruiter_user_id, assigned_by_user_id, created_at) 
          VALUES (?, ?, ?, datetime('now'))
        `)
        .bind(roleId, recruiterId, (rmUser as any).id)
        .run();

      // Notify recruiter about role assignment
      await createNotification(db, {
        userId: recruiterId,
        type: 'role_assignment',
        title: 'New Role Assignment',
        message: `You have been assigned to role ${(role as any).title}`,
        relatedEntityType: 'role',
        relatedEntityId: Number(roleId)
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error assigning recruiters to role:", error);
    return c.json({ error: "Failed to assign recruiters" }, 500);
  }
});

// Get recruiters assigned to a role
app.get("/api/rm/roles/:id/assigned-recruiters", rmOnly, async (c) => {
  const db = c.env.DB;
  const roleId = c.req.param("id");

  try {
    const recruiters = await db
      .prepare(`
        SELECT u.id, u.name, u.user_code, rra.created_at as assigned_at
        FROM users u
        INNER JOIN role_recruiter_assignments rra ON u.id = rra.recruiter_user_id
        WHERE rra.role_id = ? AND u.role = 'recruiter' AND u.is_active = 1
        ORDER BY u.name
      `)
      .bind(roleId)
      .all();

    return c.json(recruiters.results || []);
  } catch (error) {
    console.error("Error fetching assigned recruiters:", error);
    return c.json({ error: "Failed to fetch assigned recruiters" }, 500);
  }
});

// Get all recruiter-role assignments
app.get("/api/rm/recruiter-assignments", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");

  try {
    // Get RM's assigned teams
    const teams = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teams.results || []).map((t: any) => t.id);

    if (teamIds.length === 0) {
      return c.json([]);
    }

    // Get assignments for roles in RM's teams
    const assignments = await db
      .prepare(`
        SELECT 
          rra.id,
          rra.role_id,
          rra.recruiter_user_id as recruiter_id,
          rra.created_at as assigned_at,
          r.role_code,
          r.title as role_title,
          u.name as recruiter_name,
          u.user_code as recruiter_code
        FROM role_recruiter_assignments rra
        INNER JOIN am_roles r ON rra.role_id = r.id
        INNER JOIN users u ON rra.recruiter_user_id = u.id
        WHERE r.team_id IN (${teamIds.join(",")}) AND r.status = 'active'
        ORDER BY rra.created_at DESC
      `)
      .all();

    return c.json(assignments.results || []);
  } catch (error) {
    console.error("Error fetching recruiter assignments:", error);
    return c.json({ error: "Failed to fetch assignments" }, 500);
  }
});

// Assign a recruiter to a role (for active work tracking)
app.post("/api/rm/assign-recruiter-to-role", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const body = await c.req.json();
  const { role_id, recruiter_id } = body;

  if (!role_id || !recruiter_id) {
    return c.json({ error: "Role ID and Recruiter ID required" }, 400);
  }

  try {
    // Verify role exists and is accessible
    const role = await db
      .prepare("SELECT * FROM am_roles WHERE id = ? AND status = 'active'")
      .bind(role_id)
      .first();

    if (!role) {
      return c.json({ error: "Active role not found" }, 404);
    }

    // Verify RM has access to the role's team
    const teamAccess = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, (role as any).team_id)
      .first();

    if (!teamAccess) {
      return c.json({ error: "You don't have access to this role's team" }, 403);
    }

    // Verify recruiter exists and is active
    const recruiter = await db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'recruiter' AND is_active = 1")
      .bind(recruiter_id)
      .first();

    if (!recruiter) {
      return c.json({ error: "Recruiter not found" }, 404);
    }

    // Check if assignment already exists
    const existing = await db
      .prepare("SELECT * FROM role_recruiter_assignments WHERE role_id = ? AND recruiter_user_id = ?")
      .bind(role_id, recruiter_id)
      .first();

    if (existing) {
      return c.json({ error: "This recruiter is already assigned to this role" }, 400);
    }

    // Create assignment
    await db
      .prepare(`
        INSERT INTO role_recruiter_assignments 
        (role_id, recruiter_user_id, assigned_by_user_id, created_at) 
        VALUES (?, ?, ?, datetime('now'))
      `)
      .bind(role_id, recruiter_id, (rmUser as any).id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error assigning recruiter to role:", error);
    return c.json({ error: "Failed to assign recruiter" }, 500);
  }
});

// Remove a recruiter-role assignment
app.delete("/api/rm/recruiter-assignments/:id", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const assignmentId = c.req.param("id");

  try {
    // Get assignment details
    const assignment = await db
      .prepare(`
        SELECT rra.*, r.team_id
        FROM role_recruiter_assignments rra
        INNER JOIN am_roles r ON rra.role_id = r.id
        WHERE rra.id = ?
      `)
      .bind(assignmentId)
      .first();

    if (!assignment) {
      return c.json({ error: "Assignment not found" }, 404);
    }

    // Verify RM has access to the role's team
    const teamAccess = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, (assignment as any).team_id)
      .first();

    if (!teamAccess) {
      return c.json({ error: "You don't have access to this assignment" }, 403);
    }

    // Delete assignment
    await db
      .prepare("DELETE FROM role_recruiter_assignments WHERE id = ?")
      .bind(assignmentId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing assignment:", error);
    return c.json({ error: "Failed to remove assignment" }, 500);
  }
});

// Save EBES history record
app.post("/api/rm/ebes-history", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const { ebes_score, ebes_label, total_roles, total_deals, total_interviews, total_dropouts } = await c.req.json();

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if record already exists for today
    const existing = await db
      .prepare("SELECT * FROM rm_ebes_history WHERE rm_user_id = ? AND recorded_at = ?")
      .bind((rmUser as any).id, today)
      .first();

    if (existing) {
      // Update existing record
      await db
        .prepare(`
          UPDATE rm_ebes_history 
          SET ebes_score = ?, ebes_label = ?, total_roles = ?, total_deals = ?, 
              total_interviews = ?, total_dropouts = ?, updated_at = datetime('now')
          WHERE rm_user_id = ? AND recorded_at = ?
        `)
        .bind(ebes_score, ebes_label, total_roles, total_deals, total_interviews, total_dropouts, (rmUser as any).id, today)
        .run();
    } else {
      // Insert new record
      await db
        .prepare(`
          INSERT INTO rm_ebes_history 
          (rm_user_id, ebes_score, ebes_label, total_roles, total_deals, total_interviews, total_dropouts, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind((rmUser as any).id, ebes_score, ebes_label, total_roles, total_deals, total_interviews, total_dropouts, today)
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving EBES history:", error);
    return c.json({ error: "Failed to save EBES history" }, 500);
  }
});

// Get EBES history for RM
app.get("/api/rm/ebes-history", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const days = parseInt(c.req.query("days") || "30");

  try {
    const history = await db
      .prepare(`
        SELECT * FROM rm_ebes_history 
        WHERE rm_user_id = ?
        ORDER BY recorded_at DESC
        LIMIT ?
      `)
      .bind((rmUser as any).id, days)
      .all();

    return c.json((history.results || []).reverse());
  } catch (error) {
    console.error("Error fetching EBES history:", error);
    return c.json({ error: "Failed to fetch EBES history" }, 500);
  }
});

// Get pending dropout requests for RM
app.get("/api/rm/dropout-requests", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");

  try {
    const requests = await db
      .prepare(`
        SELECT 
          dr.*,
          r.role_code,
          r.title as role_title,
          c.name as client_name,
          u_recruiter.name as recruiter_name,
          u_recruiter.user_code as recruiter_code,
          u_am.name as am_name
        FROM dropout_requests dr
        INNER JOIN am_roles r ON dr.role_id = r.id
        INNER JOIN clients c ON r.client_id = c.id
        INNER JOIN users u_recruiter ON dr.recruiter_user_id = u_recruiter.id
        INNER JOIN users u_am ON dr.am_user_id = u_am.id
        WHERE dr.rm_user_id = ? AND dr.rm_status = 'pending'
        ORDER BY dr.created_at DESC
      `)
      .bind((rmUser as any).id)
      .all();

    return c.json(requests.results || []);
  } catch (error) {
    console.error("Error fetching dropout requests:", error);
    return c.json({ error: "Failed to fetch dropout requests" }, 500);
  }
});

// RM acknowledges dropout request
app.put("/api/rm/dropout-requests/:id/acknowledge", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const requestId = c.req.param("id");
  const { rm_notes } = await c.req.json();

  try {
    // Verify request belongs to this RM
    const request = await db
      .prepare("SELECT * FROM dropout_requests WHERE id = ? AND rm_user_id = ?")
      .bind(requestId, (rmUser as any).id)
      .first();

    if (!request) {
      return c.json({ error: "Dropout request not found" }, 404);
    }

    // Update request with RM acknowledgment
    await db
      .prepare(`
        UPDATE dropout_requests 
        SET rm_status = 'acknowledged', 
            rm_notes = ?,
            rm_acknowledged_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(rm_notes || '', requestId)
      .run();

    // Notify AM about dropout needing decision
    const req = request as any;
    await createNotification(db, {
      userId: req.am_user_id,
      type: 'dropout',
      title: 'Dropout Requires Decision',
      message: `RM has acknowledged a dropout request. Please review and decide. RM Notes: ${rm_notes || 'None'}`,
      relatedEntityType: 'role',
      relatedEntityId: req.role_id
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging dropout:", error);
    return c.json({ error: "Failed to acknowledge dropout" }, 500);
  }
});

// Get EBES Score for RM
app.get("/api/rm/ebes-score", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const filter = c.req.query("filter") || "custom"; // supports current_month, last_month, current_quarter, last_quarter, custom

  try {
    // Get assigned teams
    const teams = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teams.results || []).map((t: any) => t.id);

    if (teamIds.length === 0) {
      return c.json({
        score: 0,
        performance_label: "No Data",
      });
    }

    // Build date range based on filter
    let dateFilter = "";
    const dateParams: any[] = [];

    const now = new Date();
    if (filter === "current_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startOfMonth, endOfMonth);
    } else if (filter === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split("T")[0];
      const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split("T")[0];
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startOfLastMonth, endOfLastMonth);
    } else if (filter === "current_quarter") {
      const q = Math.floor(now.getMonth() / 3);
      const startMonth = q * 3;
      const startOfQuarter = new Date(now.getFullYear(), startMonth, 1).toISOString().split("T")[0];
      const endOfQuarter = new Date(now.getFullYear(), startMonth + 3, 0).toISOString().split("T")[0];
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startOfQuarter, endOfQuarter);
    } else if (filter === "last_quarter") {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const yearAdjust = q < 0 ? -1 : 0;
      const quarterIndex = q < 0 ? 3 : q;
      const startMonth = quarterIndex * 3;
      const startOfQuarter = new Date(now.getFullYear() + yearAdjust, startMonth, 1).toISOString().split("T")[0];
      const endOfQuarter = new Date(now.getFullYear() + yearAdjust, startMonth + 3, 0).toISOString().split("T")[0];
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startOfQuarter, endOfQuarter);
    } else if (startDate && endDate) {
      // custom range fallback
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startDate, endDate);
    }

    // Get all submissions for RM's teams
    let submissionQuery = `
      SELECT 
        rs.*
      FROM recruiter_submissions rs
      WHERE rs.team_id IN (${teamIds.join(",")})${dateFilter}
    `;

    const params: any[] = [...dateParams];

    const submissions = await db.prepare(submissionQuery).bind(...params).all();

    // Count submission types and entry types for EBES calculation
    let submissions_6h = 0;
    let submissions_24h = 0;
    let submissions_after_24h = 0;
    let totalInterviews = 0;
    let interview_1 = 0;
    let interview_2 = 0;
    let interview_3 = 0;
    let totalDeals = 0;
    let totalDropouts = 0;

    for (const sub of submissions.results || []) {
      const s = sub as any;
      
      // Count submission types
      if (s.submission_type === '6h') submissions_6h++;
      else if (s.submission_type === '24h') submissions_24h++;
      else if (s.submission_type === 'after_24h') submissions_after_24h++;

      // Count entry types
      if (s.entry_type === 'interview') {
        totalInterviews++;
        if (s.interview_level === 1) interview_1++;
        else if (s.interview_level === 2) interview_2++;
        else if (s.interview_level === 3) interview_3++;
      } else if (s.entry_type === 'deal') {
        totalDeals++;
      } else if (s.entry_type === 'dropout') {
        totalDropouts++;
      }
    }

    // Get all roles for table 2 calculation
    let roleQuery = `
      SELECT ar.id, ar.status
      FROM am_roles ar
      WHERE ar.team_id IN (${teamIds.join(",")})
    `;

    const roleParams: any[] = [];

    if (startDate && endDate) {
      roleQuery += " AND ar.created_at BETWEEN ? AND ?";
      roleParams.push(startDate, endDate);
    }

    const roles = await db.prepare(roleQuery).bind(...roleParams).all();

    // Calculate table 2 points (assigned roles * 3 + active roles * 1)
    let assignedRoles = roles.results?.length || 0;
    let activeRoles = 0;

    for (const role of roles.results || []) {
      const r = role as any;
      if (r.status === 'active') activeRoles++;
    }

    // Calculate EBES score using centralized calculator
    const ebesData: RecruitmentManagerEBESData = {
      submissions_6h,
      submissions_24h,
      submissions_after_24h,
      interviews_level_1: interview_1,
      interviews_level_2: interview_2,
      interviews_level_3: interview_3,
      total_interviews: interview_1 + interview_2 + interview_3,
      total_deals: totalDeals,
      total_dropouts: totalDropouts,
      total_roles: assignedRoles,
      total_active_roles: activeRoles
    };

    const ebesResult = calculateRecruitmentManagerEBES(ebesData);

    // CV Quality bonus for RM (based on team submission quality)
    const percents = (submissions.results || [])
      .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
      .map((s: any) => (s as any).cv_match_percent as number);
    const cv_quality_average = percents.length > 0
      ? percents.reduce((a: number, b: number) => a + b, 0) / percents.length
      : 0;
    let cv_quality_label = 'Poor';
    if (cv_quality_average >= 95) cv_quality_label = 'Excellent';
    else if (cv_quality_average >= 90) cv_quality_label = 'Good';
    else if (cv_quality_average >= 85) cv_quality_label = 'Okay';

    let scoreBonus = 0;
    if (cv_quality_average >= 98) scoreBonus = 5;
    else if (cv_quality_average >= 95) scoreBonus = 4;
    else if (cv_quality_average >= 90) scoreBonus = 2;

    const adjustedScore = Math.min(100, Math.max(0, ebesResult.score + scoreBonus));
    let adjustedLabel = ebesResult.performance_label;
    if (adjustedScore >= 90) adjustedLabel = 'Excellent';
    else if (adjustedScore >= 75) adjustedLabel = 'Strong';
    else if (adjustedScore >= 60) adjustedLabel = 'Average';

    return c.json({
      score: adjustedScore,
      performance_label: adjustedLabel,
      total_submissions: submissions.results?.length || 0,
      total_interviews: totalInterviews,
      total_deals: totalDeals,
      total_dropouts: totalDropouts,
      total_roles: assignedRoles,
      active_roles: activeRoles,
      cv_quality_average,
      cv_quality_label
    });
  } catch (error) {
    console.error("Error calculating EBES score:", error);
    return c.json({ error: "Failed to calculate EBES score" }, 500);
  }
});

// Comprehensive analytics endpoint
app.get('/api/rm/analytics-comprehensive', rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get('rmUser');
  
  const clientId = c.req.query('client_id');
  const teamIdParam = c.req.query('team_id');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const submissionType = c.req.query('submission_type');
  const roleStatus = c.req.query('role_status');

  try {
    // Get assigned teams
    const teamsResult = await db.prepare(`
      SELECT t.* FROM app_teams t
      INNER JOIN team_assignments ta ON t.id = ta.team_id
      WHERE ta.user_id = ?
    `).bind((rmUser as any).id).all();

    const assignedTeams = teamsResult.results || [];
    const teamIds = assignedTeams.map((t: any) => t.id);

    if (teamIds.length === 0) {
      return c.json({
        overview: {
          total_teams: 0,
          total_recruiters: 0,
          total_active_roles: 0,
          total_non_active_roles: 0,
          total_deals: 0,
          total_interviews: 0,
          total_dropouts: 0,
          rm_ebes_score: 0,
          rm_ebes_label: 'No Data'
        },
        teams: [],
        recruiters: [],
        clients: [],
        trends: [],
        comparison: { this_month: {}, last_month: {} }
      });
    }

    // Build WHERE clause for submissions filtering
    let submissionWhere = `rs.recruiter_user_id IN (
      SELECT recruiter_user_id FROM recruiter_team_assignments 
      WHERE team_id IN (${teamIds.join(',')})
    )`;
    const submissionParams: any[] = [];

    if (teamIdParam) {
      submissionWhere += ` AND rs.team_id = ?`;
      submissionParams.push(parseInt(teamIdParam));
    }

    if (startDate) {
      submissionWhere += ` AND DATE(rs.created_at) >= ?`;
      submissionParams.push(startDate);
    }
    if (endDate) {
      submissionWhere += ` AND DATE(rs.created_at) <= ?`;
      submissionParams.push(endDate);
    }
    if (submissionType) {
      submissionWhere += ` AND rs.entry_type = ?`;
      submissionParams.push(submissionType);
    }

    // Get all submissions for RM's teams (note: team_id comes from recruiter_submissions table directly)
    const submissions = await db.prepare(`
      SELECT rs.*
      FROM recruiter_submissions rs
      WHERE ${submissionWhere}
    `).bind(...submissionParams).all();

    const allSubmissions = submissions.results || [];

    // Get all roles for RM's teams
    let roleWhere = `ar.team_id IN (${teamIds.join(',')})`;
    const roleParams: any[] = [];

    if (clientId) {
      roleWhere += ` AND ar.client_id = ?`;
      roleParams.push(parseInt(clientId));
    }
    if (teamIdParam) {
      roleWhere += ` AND ar.team_id = ?`;
      roleParams.push(parseInt(teamIdParam));
    }
    if (roleStatus) {
      roleWhere += ` AND ar.status = ?`;
      roleParams.push(roleStatus);
    }

    if (startDate) {
      roleWhere += ` AND DATE(ar.created_at) >= ?`;
      roleParams.push(startDate);
    }
    if (endDate) {
      roleWhere += ` AND DATE(ar.created_at) <= ?`;
      roleParams.push(endDate);
    }

    const roles = await db.prepare(`
      SELECT ar.*, c.name as client_name, c.client_code, t.name as team_name, t.team_code
      FROM am_roles ar
      INNER JOIN clients c ON ar.client_id = c.id
      INNER JOIN app_teams t ON ar.team_id = t.id
      WHERE ${roleWhere}
    `).bind(...roleParams).all();

    const allRoles = roles.results || [];

    // Calculate overview metrics
    const totalActiveRoles = allRoles.filter((r: any) => r.status === 'active').length;
    const totalNonActiveRoles = allRoles.filter((r: any) => r.status !== 'active').length;
    const totalDeals = allSubmissions.filter((s: any) => s.entry_type === 'deal').length;
    const totalInterviews = allSubmissions.filter((s: any) => s.entry_type === 'interview').length;
    const totalDropouts = allSubmissions.filter((s: any) => s.entry_type === 'dropout').length;

    // Get all recruiters
    const recruitersResult = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.user_code
      FROM users u
      INNER JOIN recruiter_team_assignments rta ON u.id = rta.recruiter_user_id
      WHERE rta.team_id IN (${teamIds.join(',')}) AND u.role = 'recruiter'
    `).all();

    const allRecruiters = recruitersResult.results || [];

    // Calculate RM EBES Score using centralized calculator
    let rm_submissions_6h = 0;
    let rm_submissions_24h = 0;
    let rm_submissions_after_24h = 0;
    let rm_deals = 0;
    let rm_interview_1 = 0;
    let rm_interview_2 = 0;
    let rm_interview_3 = 0;

    for (const sub of allSubmissions) {
      const s = sub as any;
      if (s.submission_type === '6h') rm_submissions_6h++;
      else if (s.submission_type === '24h') rm_submissions_24h++;
      else if (s.submission_type === 'after_24h') rm_submissions_after_24h++;

      if (s.entry_type === 'deal') rm_deals++;
      
      if (s.entry_type === 'interview') {
        if (s.interview_level === 1) rm_interview_1++;
        else if (s.interview_level === 2) rm_interview_2++;
        else if (s.interview_level === 3) rm_interview_3++;
      }
    }

    const rmEbesData: RecruitmentManagerEBESData = {
      submissions_6h: rm_submissions_6h,
      submissions_24h: rm_submissions_24h,
      submissions_after_24h: rm_submissions_after_24h,
      total_interviews: totalInterviews,
      interviews_level_1: rm_interview_1,
      interviews_level_2: rm_interview_2,
      interviews_level_3: rm_interview_3,
      total_deals: rm_deals,
      total_dropouts: totalDropouts,
      total_roles: allRoles.length,
      total_active_roles: totalActiveRoles
    };

    const rmEbesResult = calculateRecruitmentManagerEBES(rmEbesData);
    const rmEbesScore = rmEbesResult.score;
    
    let rmEbesLabel = 'At Risk';
    if (rmEbesScore >= 90) rmEbesLabel = 'Excellent';
    else if (rmEbesScore >= 75) rmEbesLabel = 'Strong';
    else if (rmEbesScore >= 60) rmEbesLabel = 'Average';

    const overviewSubmissionPercents = (allSubmissions || [])
      .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
      .map((s: any) => (s as any).cv_match_percent as number);
    const overview_cv_quality_average = overviewSubmissionPercents.length > 0
      ? overviewSubmissionPercents.reduce((a: number, b: number) => a + b, 0) / overviewSubmissionPercents.length
      : 0;
    let overview_cv_quality_label = 'Poor';
    if (overview_cv_quality_average >= 95) overview_cv_quality_label = 'Excellent';
    else if (overview_cv_quality_average >= 90) overview_cv_quality_label = 'Good';
    else if (overview_cv_quality_average >= 85) overview_cv_quality_label = 'Okay';

    const overview = {
      total_teams: assignedTeams.length,
      total_recruiters: allRecruiters.length,
      total_active_roles: totalActiveRoles,
      total_non_active_roles: totalNonActiveRoles,
      total_deals: totalDeals,
      total_interviews: totalInterviews,
      interviews_level_1: rm_interview_1,
      interviews_level_2: rm_interview_2,
      interviews_level_3: rm_interview_3,
      total_dropouts: totalDropouts,
      rm_ebes_score: Math.min(100, Math.max(0, rmEbesScore)),
      rm_ebes_label: rmEbesLabel,
      rm_ebes_table1_points: rmEbesResult.table1_points,
      rm_ebes_table2_points: rmEbesResult.table2_points,
      cv_quality_average: overview_cv_quality_average,
      cv_quality_label: overview_cv_quality_label
    };

    // Team-level analytics
    const teamAnalytics = assignedTeams.map((team: any) => {
      const teamRoles = allRoles.filter((r: any) => r.team_id === team.id);
      const teamSubs = allSubmissions.filter((s: any) => {
        // Get role for this submission to check team
        const subRole = allRoles.find((r: any) => r.id === s.role_id);
        return subRole && subRole.team_id === team.id;
      });
      
      const teamPercents = teamSubs
        .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
        .map((s: any) => (s as any).cv_match_percent as number);
      const team_cv_quality_average = teamPercents.length > 0
        ? teamPercents.reduce((a: number, b: number) => a + b, 0) / teamPercents.length
        : 0;
      let team_cv_quality_label = 'Poor';
      if (team_cv_quality_average >= 95) team_cv_quality_label = 'Excellent';
      else if (team_cv_quality_average >= 90) team_cv_quality_label = 'Good';
      else if (team_cv_quality_average >= 85) team_cv_quality_label = 'Okay';

      return {
        team_id: team.id,
        team_name: team.name,
        team_code: team.team_code,
        total_roles: teamRoles.length,
        active_roles: teamRoles.filter((r: any) => r.status === 'active').length,
        non_active_roles: teamRoles.filter((r: any) => r.status !== 'active').length,
        interviews_level_1: teamSubs.filter((s: any) => s.entry_type === 'interview' && s.interview_level === 1).length,
        interviews_level_2: teamSubs.filter((s: any) => s.entry_type === 'interview' && s.interview_level === 2).length,
        interviews_level_3: teamSubs.filter((s: any) => s.entry_type === 'interview' && s.interview_level === 3).length,
        deals: teamSubs.filter((s: any) => s.entry_type === 'deal').length,
        dropouts: teamSubs.filter((s: any) => s.entry_type === 'dropout').length,
        cv_quality_average: team_cv_quality_average,
        cv_quality_label: team_cv_quality_label
      };
    });

    // Recruiter-level analytics with EBES scores using centralized calculator
    const recruiterAnalytics = await Promise.all(allRecruiters.map(async (recruiter: any) => {
      const recSubs = allSubmissions.filter((s: any) => s.recruiter_user_id === recruiter.id);
      const recRoles = allRoles.filter((r: any) => 
        recSubs.some((s: any) => s.role_id === r.id)
      );

      // Count data for EBES calculation
      const submissions_6h = recSubs.filter((s: any) => s.submission_type === '6h').length;
      const submissions_24h = recSubs.filter((s: any) => s.submission_type === '24h').length;
      const submissions_after_24h = recSubs.filter((s: any) => s.submission_type === 'after_24h').length;
      
      const interview_1 = recSubs.filter((s: any) => s.entry_type === 'interview' && s.interview_level === 1).length;
      const interview_2 = recSubs.filter((s: any) => s.entry_type === 'interview' && s.interview_level === 2).length;
      
      const deals = recSubs.filter((s: any) => s.entry_type === 'deal').length;
      const dropouts = recSubs.filter((s: any) => s.entry_type === 'dropout').length;

      // Check for accepted dropouts
      let accepted_dropouts = 0;
      for (const dropout of recSubs.filter((s: any) => s.entry_type === 'dropout')) {
        const dropoutRequest = await db
          .prepare("SELECT am_decision FROM dropout_requests WHERE role_id = ? AND recruiter_user_id = ? ORDER BY created_at DESC LIMIT 1")
          .bind(dropout.role_id, recruiter.id)
          .first();
        
        if ((dropoutRequest as any)?.am_decision === 'accept') {
          accepted_dropouts++;
        }
      }

      // Calculate discarded and lost role candidates within filters
      let craWhere = `recruiter_user_id = ? AND is_discarded = 1`;
      const craParams: any[] = [recruiter.id];
      if (teamIdParam) {
        craWhere += ` AND team_id = ?`;
        craParams.push(parseInt(teamIdParam));
      }
      if (startDate) {
        craWhere += ` AND submission_date >= ?`;
        craParams.push(startDate);
      }
      if (endDate) {
        craWhere += ` AND submission_date <= ?`;
        craParams.push(endDate);
      }

      const discardedQuery = `
        SELECT COUNT(DISTINCT candidate_id) as count
        FROM candidate_role_associations
        WHERE ${craWhere} AND (is_lost_role = 0 OR is_lost_role IS NULL)
      `;
      const discardedRes = await db.prepare(discardedQuery).bind(...craParams).first();
      const discarded_candidates = (discardedRes as any)?.count || 0;

      const lostQuery = `
        SELECT COUNT(DISTINCT candidate_id) as count
        FROM candidate_role_associations
        WHERE ${craWhere} AND is_lost_role = 1
      `;
      const lostRes = await db.prepare(lostQuery).bind(...craParams).first();
      const lost_role_candidates = (lostRes as any)?.count || 0;

      // Get assigned roles count
      const assignedRolesResult = await db
        .prepare("SELECT COUNT(DISTINCT role_id) as count FROM role_recruiter_assignments WHERE recruiter_user_id = ?")
        .bind(recruiter.id)
        .first();
      const assigned_roles = (assignedRolesResult as any)?.count || 0;

      // Calculate using centralized function
      const recEbesData: RecruiterEBESData = {
        submissions_6h,
        submissions_24h,
        submissions_after_24h,
        interviews_level_1: interview_1,
        interviews_level_2: interview_2,
        deals,
        accepted_dropouts,
        discarded_candidates,
        lost_role_candidates,
        assigned_roles,
        actively_worked_roles: recRoles.length
      };

      const recEbesResult = calculateRecruiterEBES(recEbesData);

      const recPercents = recSubs
        .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
        .map((s: any) => (s as any).cv_match_percent as number);
      const recruiter_cv_quality_average = recPercents.length > 0
        ? recPercents.reduce((a: number, b: number) => a + b, 0) / recPercents.length
        : 0;
      let recruiter_cv_quality_label = 'Poor';
      if (recruiter_cv_quality_average >= 95) recruiter_cv_quality_label = 'Excellent';
      else if (recruiter_cv_quality_average >= 90) recruiter_cv_quality_label = 'Good';
      else if (recruiter_cv_quality_average >= 85) recruiter_cv_quality_label = 'Okay';

      return {
        recruiter_id: recruiter.id,
        recruiter_name: recruiter.name,
        recruiter_code: recruiter.user_code,
        submissions: recSubs.filter((s: any) => s.entry_type === 'submission').length,
        interviews: recSubs.filter((s: any) => s.entry_type === 'interview').length,
        deals,
        dropouts,
        recruiter_ebes: recEbesResult.score,
        recruiter_ebes_label: recEbesResult.performance_label,
        cv_quality_average: recruiter_cv_quality_average,
        cv_quality_label: recruiter_cv_quality_label
      };
    }));

    // Client-level analytics with health
    const clientsResult = await db.prepare(`
      SELECT DISTINCT c.* FROM clients c
      INNER JOIN am_roles ar ON c.id = ar.client_id
      WHERE ar.team_id IN (${teamIds.join(',')})
    `).all();

    const clientAnalytics = (clientsResult.results || []).map((client: any) => {
      const clientRoles = allRoles.filter((r: any) => r.client_id === client.id);
      const clientSubs = allSubmissions.filter((s: any) => {
        const subRole = allRoles.find((r: any) => r.id === s.role_id);
        return subRole && subRole.client_id === client.id;
      });
      
      const interviews = clientSubs.filter((s: any) => s.entry_type === 'interview').length;
      const deals = clientSubs.filter((s: any) => s.entry_type === 'deal').length;
      const dropouts = clientSubs.filter((s: any) => s.entry_type === 'dropout').length;

      const dropoutRate = clientRoles.length > 0 ? dropouts / clientRoles.length : 0;
      const conversionRate = interviews > 0 ? deals / interviews : 0;

      let health = 'Average';
      if (dropoutRate > 0.3 || conversionRate < 0.2) health = 'At Risk';
      else if (conversionRate > 0.5 && dropoutRate < 0.1) health = 'Strong';

      const clientPercents = clientSubs
        .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
        .map((s: any) => (s as any).cv_match_percent as number);
      const client_cv_quality_average = clientPercents.length > 0
        ? clientPercents.reduce((a: number, b: number) => a + b, 0) / clientPercents.length
        : 0;
      let client_cv_quality_label = 'Poor';
      if (client_cv_quality_average >= 95) client_cv_quality_label = 'Excellent';
      else if (client_cv_quality_average >= 90) client_cv_quality_label = 'Good';
      else if (client_cv_quality_average >= 85) client_cv_quality_label = 'Okay';

      return {
        client_id: client.id,
        client_name: client.name,
        client_code: client.client_code,
        total_roles: clientRoles.length,
        interviews,
        deals,
        dropouts,
        health,
        cv_quality_average: client_cv_quality_average,
        cv_quality_label: client_cv_quality_label
      };
    });

    // Trends data (group by date)
    const trendsMap = new Map<string, any>();
    for (const sub of allSubmissions) {
      const s = sub as any;
      const date = s.created_at.split('T')[0];
      
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { date, submissions: 0, interviews: 0, deals: 0, dropouts: 0 });
      }
      
      const trend = trendsMap.get(date);
      if (s.entry_type === 'submission') trend.submissions++;
      else if (s.entry_type === 'interview') trend.interviews++;
      else if (s.entry_type === 'deal') trend.deals++;
      else if (s.entry_type === 'dropout') trend.dropouts++;
    }

    const trends = Array.from(trendsMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, 30);

    // Comparison data (this month vs last month)
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const thisMonthSubs = allSubmissions.filter((s: any) => s.created_at >= thisMonthStart);
    const lastMonthSubs = allSubmissions.filter((s: any) => 
      s.created_at >= lastMonthStart && s.created_at <= lastMonthEnd
    );

    const comparison = {
      this_month: {
        submissions: thisMonthSubs.filter((s: any) => s.entry_type === 'submission').length,
        interviews: thisMonthSubs.filter((s: any) => s.entry_type === 'interview').length,
        deals: thisMonthSubs.filter((s: any) => s.entry_type === 'deal').length,
        dropouts: thisMonthSubs.filter((s: any) => s.entry_type === 'dropout').length
      },
      last_month: {
        submissions: lastMonthSubs.filter((s: any) => s.entry_type === 'submission').length,
        interviews: lastMonthSubs.filter((s: any) => s.entry_type === 'interview').length,
        deals: lastMonthSubs.filter((s: any) => s.entry_type === 'deal').length,
        dropouts: lastMonthSubs.filter((s: any) => s.entry_type === 'dropout').length
      }
    };

    // Aggregate dropout reasons within filters
    let dropoutReasonWhere = `ar.team_id IN (${teamIds.join(',')})`;
    const dropoutReasonParams: any[] = [];

    if (clientId) {
      dropoutReasonWhere += ` AND ar.client_id = ?`;
      dropoutReasonParams.push(parseInt(clientId));
    }
    if (teamIdParam) {
      dropoutReasonWhere += ` AND ar.team_id = ?`;
      dropoutReasonParams.push(parseInt(teamIdParam));
    }
    if (startDate) {
      dropoutReasonWhere += ` AND DATE(dr.created_at) >= ?`;
      dropoutReasonParams.push(startDate);
    }
    if (endDate) {
      dropoutReasonWhere += ` AND DATE(dr.created_at) <= ?`;
      dropoutReasonParams.push(endDate);
    }

    const dropoutReasonsRes = await db.prepare(
      `SELECT COALESCE(dropout_reason, 'Unspecified') as reason, COUNT(*) as count
       FROM dropout_requests dr
       INNER JOIN am_roles ar ON dr.role_id = ar.id
       WHERE ${dropoutReasonWhere}
       GROUP BY reason
       ORDER BY count DESC`
    ).bind(...dropoutReasonParams).all();

    const dropout_reasons = (dropoutReasonsRes.results || []).map((r: any) => ({
      reason: r.reason,
      count: r.count
    }));

    return c.json({
      overview,
      teams: teamAnalytics,
      recruiters: recruiterAnalytics,
      clients: clientAnalytics,
      trends,
      comparison,
      dropout_reasons
    });
  } catch (error) {
    console.error('Error fetching comprehensive analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

// Legacy routes for backward compatibility
app.get("/api/rm/team-analytics/:teamId", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const teamId = c.req.param("teamId");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Verify team assignment
    const teamAssignment = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind((rmUser as any).id, teamId)
      .first();

    if (!teamAssignment) {
      return c.json({ error: "Team not assigned to this recruitment manager" }, 404);
    }

    // Get team info
    const team = await db
      .prepare("SELECT * FROM app_teams WHERE id = ?")
      .bind(teamId)
      .first();

    // Get all recruiters assigned to this team
    const recruiters = await db
      .prepare(`
        SELECT u.* FROM users u
        INNER JOIN recruiter_team_assignments rta ON u.id = rta.recruiter_user_id
        WHERE rta.team_id = ? AND u.role = 'recruiter'
      `)
      .bind(teamId)
      .all();

    // Get submission stats for the team
    let submissionQuery = `
      SELECT 
        rs.recruiter_user_id,
        u.name as recruiter_name,
        u.user_code as recruiter_code,
        COUNT(*) as total_submissions,
        SUM(CASE WHEN rs.submission_type = '6h' THEN 1 ELSE 0 END) as submission_6h,
        SUM(CASE WHEN rs.submission_type = '24h' THEN 1 ELSE 0 END) as submission_24h,
        SUM(CASE WHEN rs.submission_type = 'after_24h' THEN 1 ELSE 0 END) as submission_after_24h
      FROM recruiter_submissions rs
      INNER JOIN users u ON rs.recruiter_user_id = u.id
      WHERE rs.team_id = ?
    `;

    const params: any[] = [teamId];

    if (startDate && endDate) {
      submissionQuery += " AND rs.submission_date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    submissionQuery += " GROUP BY rs.recruiter_user_id, u.name, u.user_code";

    const submissionStats = await db.prepare(submissionQuery).bind(...params).all();

    // Calculate team totals
    const teamStats = {
      total_recruiters: recruiters.results?.length || 0,
      total_submissions: 0,
      submission_6h: 0,
      submission_24h: 0,
      submission_after_24h: 0,
    };

    for (const stat of submissionStats.results || []) {
      const data = stat as any;
      teamStats.total_submissions += data.total_submissions;
      teamStats.submission_6h += data.submission_6h;
      teamStats.submission_24h += data.submission_24h;
      teamStats.submission_after_24h += data.submission_after_24h;
    }

    return c.json({
      team,
      team_stats: teamStats,
      recruiter_stats: submissionStats.results || [],
    });
  } catch (error) {
    console.error("Error fetching team analytics:", error);
    return c.json({ error: "Failed to fetch team analytics" }, 500);
  }
});

app.get("/api/rm/performance-summary", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Get all assigned teams
    const teams = await db
      .prepare(`
        SELECT t.id, t.name, t.team_code FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();

    const teamIds = (teams.results || []).map((t: any) => t.id);

    if (teamIds.length === 0) {
      return c.json({
        total_submissions: 0,
        total_recruiters: 0,
        teams: [],
      });
    }

    // Get total submissions across all teams
    let submissionQuery = `
      SELECT COUNT(*) as total
      FROM recruiter_submissions
      WHERE recruitment_manager_id = ?
    `;

    const params: any[] = [(rmUser as any).id];

    if (startDate && endDate) {
      submissionQuery += " AND submission_date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    const totalSubmissions = await db.prepare(submissionQuery).bind(...params).first();

    // Get total recruiters across all teams
    const totalRecruiters = await db
      .prepare(`
        SELECT COUNT(DISTINCT recruiter_user_id) as total
        FROM recruiter_team_assignments
        WHERE team_id IN (${teamIds.join(",")})
      `)
      .all();

    return c.json({
      total_submissions: (totalSubmissions as any)?.total || 0,
      total_recruiters: (totalRecruiters.results?.[0] as any)?.total || 0,
      teams: teams.results || [],
    });
  } catch (error) {
    console.error("Error fetching performance summary:", error);
    return c.json({ error: "Failed to fetch performance summary" }, 500);
  }
});

// Role submissions for RM
app.get("/api/rm/role-submissions/:roleId", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("roleId");

  const role = await db.prepare("SELECT team_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);

  const access = await db
    .prepare("SELECT 1 FROM team_assignments WHERE user_id = ? AND team_id = ?")
    .bind((rmUser as any).id, (role as any).team_id)
    .first();
  if (!access) return c.json({ error: "Forbidden" }, 403);

  try {
    const rows = await db.prepare(`
      SELECT 
        cra.id as association_id,
        cra.candidate_id,
        c.name as candidate_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        cra.status as association_status,
        cra.submission_date,
        cra.is_discarded,
        cra.discarded_at,
        cra.discarded_reason,
        cra.updated_at,
        u.name as recruiter_name,
        u.user_code as recruiter_code,
        rs.id as submission_id,
        ROUND(rs.cv_match_percent / 20.0, 2) as score,
        rs.rm_validation_status,
        rs.rm_rate_bill,
        rs.rm_rate_pay,
        rs.rm_location,
        rs.rm_work_type,
        rs.rm_notes,
        rs.rm_reviewed_at
      FROM candidate_role_associations cra
      LEFT JOIN candidates c ON cra.candidate_id = c.id
      LEFT JOIN users u ON cra.recruiter_user_id = u.id
      LEFT JOIN recruiter_submissions rs 
        ON rs.role_id = cra.role_id 
       AND rs.recruiter_user_id = cra.recruiter_user_id 
       AND rs.entry_type = 'submission'
       AND DATE(rs.submission_date) = DATE(cra.submission_date)
      WHERE cra.role_id = ?
      ORDER BY cra.submission_date DESC, cra.id DESC
    `).bind(roleId).all();

  const results = rows.results || [];
  
  const isPending = (s: string) => s === 'rm_evaluation';
  
  return c.json({
    pending_evaluation: results.filter((r: any) => (r as any).is_discarded !== 1 && isPending((r as any).association_status)),
    under_consideration: results.filter((r: any) => (r as any).is_discarded !== 1 && !isPending((r as any).association_status) && (r as any).association_status !== 'client_rejected'),
    rejected: results.filter((r: any) => (r as any).is_discarded === 1 || (r as any).association_status === 'client_rejected'),
  });
} catch (error: any) {
  console.error("Error fetching role submissions:", error);
  return c.json({ error: error.message }, 500);
}
});

// RM discard candidate submission
app.post("/api/rm/roles/:roleId/candidates/:candidateId/discard", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");
  const { reason } = await c.req.json();

  const role = await db.prepare("SELECT team_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);

  const access = await db
    .prepare("SELECT 1 FROM team_assignments WHERE user_id = ? AND team_id = ?")
    .bind((rmUser as any).id, (role as any).team_id)
    .first();
  if (!access) return c.json({ error: "Forbidden" }, 403);

  await db.prepare(`
    UPDATE candidate_role_associations
    SET is_discarded = 1,
        discarded_reason = COALESCE(?, 'Discarded by RM'),
        discarded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0
  `).bind(reason || null, roleId, candidateId).run();

  return c.json({ success: true });
});

// RM review/update submission details
app.put("/api/rm/submissions/:id/review", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const id = c.req.param("id");
  const body = await c.req.json();

  const sub = await db.prepare(`
    SELECT rs.*, ar.team_id 
    FROM recruiter_submissions rs 
    LEFT JOIN am_roles ar ON rs.role_id = ar.id
    WHERE rs.id = ? AND rs.entry_type = 'submission'
  `).bind(id).first();
  if (!sub) return c.json({ error: "Submission not found" }, 404);

  const access = await db
    .prepare("SELECT 1 FROM team_assignments WHERE user_id = ? AND team_id = ?")
    .bind((rmUser as any).id, (sub as any).team_id)
    .first();
  if (!access) return c.json({ error: "Forbidden" }, 403);

  // Enforce allowed contract types
  let workType = body.rm_work_type || null;
  if (workType) {
    const wt = String(workType).toLowerCase();
    if (wt === 'sow' || wt === 'payroll') {
      workType = wt === 'sow' ? 'SOW' : 'Payroll';
    } else {
      workType = null;
    }
  }

  await db.prepare(`
    UPDATE recruiter_submissions SET
      rm_validation_status = COALESCE(?, rm_validation_status),
      rm_rate_bill = COALESCE(?, rm_rate_bill),
      rm_rate_pay = COALESCE(?, rm_rate_pay),
      rm_location = COALESCE(?, rm_location),
      rm_work_type = COALESCE(?, rm_work_type),
      cv_match_percent = COALESCE(?, cv_match_percent),
      rm_notes = COALESCE(?, rm_notes),
      rm_reviewed_at = COALESCE(?, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    body.rm_validation_status || null,
    (body.rm_payment != null ? body.rm_payment : body.rm_rate_bill) || null,
    body.rm_rate_pay || null,
    body.rm_location || null,
    workType,
    body.rm_score_0_5 != null ? Number(body.rm_score_0_5) * 20 : null,
    body.rm_notes || null,
    body.rm_review_date || null,
    id
  ).run();

  return c.json({ success: true });
});

app.post("/api/rm/roles/:roleId/candidates/:candidateId/send-to-am", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");

  const role = await db.prepare("SELECT account_manager_id, team_id, title FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);

  const access = await db
    .prepare("SELECT 1 FROM team_assignments WHERE user_id = ? AND team_id = ?")
    .bind((rmUser as any).id, (role as any).team_id)
    .first();
  if (!access) return c.json({ error: "Forbidden" }, 403);

  // Ensure RM has completed required fields on the linked recruiter submission
  const submission = await db
    .prepare(`
      SELECT rm_rate_bill, rm_rate_pay, rm_work_type, cv_match_percent, rm_validation_status, rm_notes, rm_location
      FROM recruiter_submissions
      WHERE role_id = ?
        AND entry_type = 'submission'
        AND recruiter_user_id = (
          SELECT recruiter_user_id
          FROM candidate_role_associations
          WHERE role_id = ? AND candidate_id = ?
        )
      ORDER BY submission_date DESC
      LIMIT 1
    `)
    .bind(roleId, roleId, candidateId)
    .first();

  const s = submission as any;
  const missing: string[] = [];
  if (!s || s.rm_rate_bill == null) missing.push("payment");
  if (!s || !s.rm_work_type) missing.push("contract type");
  if (!s || s.cv_match_percent == null) missing.push("validation score");
  if (!s || !s.rm_validation_status) missing.push("validation status");
  if (!s || !s.rm_notes) missing.push("notes");
  if (!s || !s.rm_location) missing.push("location");
  if (s && s.rm_work_type && s.rm_work_type !== "SOW" && s.rm_work_type !== "Payroll") {
    missing.push("contract type must be SOW or Payroll");
  }
  if (missing.length > 0) {
    return c.json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET status = 'submitted',
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0 AND status = 'rm_evaluation'
  `).bind(roleId, candidateId).run();

  if ((role as any).account_manager_id) {
    await createNotification(db, {
      userId: (role as any).account_manager_id,
      type: 'system',
      title: 'Candidate Ready',
      message: `RM completed validation for ${(role as any).title}. Candidate sent to AM.`,
      relatedEntityType: 'role',
      relatedEntityId: Number(roleId)
    });
  }

  return c.json({ success: true });
});

// RM review/update submission details by role/candidate (handles missing submission_id)
app.put("/api/rm/roles/:roleId/candidates/:candidateId/review", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");
  const body = await c.req.json();

  const role = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);

  const access = await db
    .prepare("SELECT 1 FROM team_assignments WHERE user_id = ? AND team_id = ?")
    .bind((rmUser as any).id, (role as any).team_id)
    .first();
  if (!access) return c.json({ error: "Forbidden" }, 403);

  const assoc = await db
    .prepare("SELECT recruiter_user_id, submission_date FROM candidate_role_associations WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0")
    .bind(roleId, candidateId)
    .first();
  if (!assoc) return c.json({ error: "Association not found" }, 404);

  const sub = await db.prepare(`
    SELECT rs.id, ar.team_id
    FROM recruiter_submissions rs
    LEFT JOIN am_roles ar ON rs.role_id = ar.id
    WHERE rs.role_id = ? 
      AND rs.recruiter_user_id = ?
      AND rs.entry_type = 'submission'
    ORDER BY rs.submission_date DESC, rs.created_at DESC
    LIMIT 1
  `).bind(roleId, (assoc as any).recruiter_user_id).first();

  if (!sub) {
    try {
      const cand = await db.prepare("SELECT name FROM candidates WHERE id = ?").bind(candidateId).first();
      const created = await db.prepare(`
        INSERT INTO recruiter_submissions
        (recruiter_user_id, client_id, team_id, role_id, account_manager_id, recruitment_manager_id, submission_type, submission_date, notes, entry_type, interview_level, candidate_name, rm_validation_status, rm_rate_bill, rm_rate_pay, rm_location, rm_work_type, cv_match_percent, rm_notes, rm_reviewed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'after_24h', ?, NULL, 'submission', NULL, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        (assoc as any).recruiter_user_id,
        (role as any).client_id,
        (role as any).team_id,
        (role as any).id,
        (role as any).account_manager_id,
        (rmUser as any).id,
        (assoc as any).submission_date || new Date().toISOString().slice(0, 10),
        (cand as any)?.name || null,
        body.rm_validation_status || null,
        (body.rm_payment != null ? Number(body.rm_payment) : (body.rm_rate_bill != null ? Number(body.rm_rate_bill) : null)),
        body.rm_rate_pay != null ? Number(body.rm_rate_pay) : null,
        body.rm_location || null,
        (() => {
          const wt = body.rm_work_type ? String(body.rm_work_type).toLowerCase() : null;
          if (wt === 'sow') return 'SOW';
          if (wt === 'payroll') return 'Payroll';
          return null;
        })(),
        body.rm_score_0_5 != null ? Number(body.rm_score_0_5) * 20 : null,
        body.rm_notes || null
      ).run();
      const newId = created.meta.last_row_id;
      const subObj = { id: newId, team_id: (role as any).team_id } as any;
      let workType = body.rm_work_type || null;
      if (workType) {
        const wt = String(workType).toLowerCase();
        if (wt === 'sow') workType = 'SOW';
        else if (wt === 'payroll') workType = 'Payroll';
        else workType = null;
      }
      await db.prepare(`
        UPDATE recruiter_submissions SET
          rm_validation_status = COALESCE(?, rm_validation_status),
          rm_rate_bill = COALESCE(?, rm_rate_bill),
          rm_rate_pay = COALESCE(?, rm_rate_pay),
          rm_location = COALESCE(?, rm_location),
          rm_work_type = COALESCE(?, rm_work_type),
          cv_match_percent = COALESCE(?, cv_match_percent),
          rm_notes = COALESCE(?, rm_notes),
          rm_reviewed_at = COALESCE(?, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        body.rm_validation_status || null,
        (body.rm_payment != null ? Number(body.rm_payment) : (body.rm_rate_bill != null ? Number(body.rm_rate_bill) : null)),
        body.rm_rate_pay != null ? Number(body.rm_rate_pay) : null,
        body.rm_location || null,
        workType,
        body.rm_score_0_5 != null ? Number(body.rm_score_0_5) * 20 : null,
        body.rm_notes || null,
        body.rm_review_date || null,
        subObj.id
      ).run();
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error?.message || "Failed to update validation (create path)" }, 500);
    }
  }

  let workType = body.rm_work_type || null;
  if (workType) {
    const wt = String(workType).toLowerCase();
    if (wt === 'sow') workType = 'SOW';
    else if (wt === 'payroll') workType = 'Payroll';
    else workType = null;
  }

  try {
    await db.prepare(`
      UPDATE recruiter_submissions SET
        rm_validation_status = COALESCE(?, rm_validation_status),
        rm_rate_bill = COALESCE(?, rm_rate_bill),
        rm_rate_pay = COALESCE(?, rm_rate_pay),
        rm_location = COALESCE(?, rm_location),
        rm_work_type = COALESCE(?, rm_work_type),
        cv_match_percent = COALESCE(?, cv_match_percent),
        rm_notes = COALESCE(?, rm_notes),
        rm_reviewed_at = COALESCE(?, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.rm_validation_status || null,
      (body.rm_payment != null ? Number(body.rm_payment) : (body.rm_rate_bill != null ? Number(body.rm_rate_bill) : null)),
      body.rm_rate_pay != null ? Number(body.rm_rate_pay) : null,
      body.rm_location || null,
      workType,
      body.rm_score_0_5 != null ? Number(body.rm_score_0_5) * 20 : null,
      body.rm_notes || null,
      body.rm_review_date || null,
      (sub as any).id
    ).run();
  } catch (error: any) {
    return c.json({ error: error?.message || "Failed to update validation" }, 500);
  }

  return c.json({ success: true });
});

// RM submit candidate to client
app.post("/api/rm/roles/:roleId/candidates/:candidateId/submit-to-client", rmOnly, async (c) => {
  return c.json({ error: "Action not allowed. Only Account Manager can submit to client." }, 400);
});

// RM mark client rejection
app.post("/api/rm/roles/:roleId/candidates/:candidateId/client-reject", rmOnly, async (c) => {
  return c.json({ error: "Action not allowed. Only Account Manager can mark client rejection." }, 400);
});

// RM mark deal for candidate
app.post("/api/rm/roles/:roleId/candidates/:candidateId/deal", rmOnly, async (c) => {
  return c.json({ error: "Action not allowed. Only Account Manager can mark a deal." }, 400);
});

// RM daily custom report
app.get("/api/rm/reports/daily", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  const ta = await db
    .prepare("SELECT team_id FROM team_assignments WHERE user_id = ?")
    .bind((rmUser as any).id)
    .all();
  const teamIds = (ta.results || []).map((r: any) => (r as any).team_id);
  if (teamIds.length === 0) {
    return c.json({
      day_before_yesterday: { roles_created: 0, submissions: 0, forwarded_to_client: 0, client_rejected: 0, interviews: 0, deals: 0, discarded: 0 },
      yesterday: { roles_created: 0, submissions: 0, forwarded_to_client: 0, client_rejected: 0, interviews: 0, deals: 0, discarded: 0 }
    });
  }
  const ids = teamIds.join(",");
  const countsFor = async (offset: string) => {
    const rolesCreated = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND DATE(created_at) = DATE('now', ?)`).bind(offset).first();
    const submissions = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations WHERE team_id IN (${ids}) AND is_discarded = 0 AND DATE(submission_date) = DATE('now', ?)`).bind(offset).first();
    const forwardedToClient = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations WHERE team_id IN (${ids}) AND status = 'client_submitted' AND is_discarded = 0 AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const clientRejected = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations WHERE team_id IN (${ids}) AND status = 'client_rejected' AND is_discarded = 0 AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const deals = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations WHERE team_id IN (${ids}) AND status = 'deal' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const discarded = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations WHERE team_id IN (${ids}) AND is_discarded = 1 AND DATE(discarded_at) = DATE('now', ?)`).bind(offset).first();
    const interviews = await db.prepare(`SELECT COUNT(*) as c FROM recruiter_submissions rs INNER JOIN am_roles ar ON rs.role_id = ar.id WHERE ar.team_id IN (${ids}) AND rs.entry_type = 'interview' AND DATE(rs.submission_date) = DATE('now', ?)`).bind(offset).first();
    const rolesStatusDeal = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND status = 'deal' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const rolesStatusLost = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND status = 'lost' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const rolesStatusOnHold = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND status = 'on_hold' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const rolesStatusCancelled = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND status = 'cancelled' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    const rolesStatusNoAnswer = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE team_id IN (${ids}) AND status = 'no_answer' AND DATE(updated_at) = DATE('now', ?)`).bind(offset).first();
    return {
      roles_created: Number((rolesCreated as any)?.c || 0),
      submissions: Number((submissions as any)?.c || 0),
      forwarded_to_client: Number((forwardedToClient as any)?.c || 0),
      client_rejected: Number((clientRejected as any)?.c || 0),
      interviews: Number((interviews as any)?.c || 0),
      deals: Number((deals as any)?.c || 0),
      discarded: Number((discarded as any)?.c || 0),
      role_status_changes: {
        deal: Number((rolesStatusDeal as any)?.c || 0),
        lost: Number((rolesStatusLost as any)?.c || 0),
        on_hold: Number((rolesStatusOnHold as any)?.c || 0),
        cancelled: Number((rolesStatusCancelled as any)?.c || 0),
        no_answer: Number((rolesStatusNoAnswer as any)?.c || 0)
      }
    };
  };
  const day_before_yesterday = await countsFor("-2 day");
  const yesterday = await countsFor("-1 day");
  return c.json({ day_before_yesterday, yesterday });
});

app.post("/api/rm/seed/sample-data", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}
  const perRole = Math.max(1, Math.min(Number(body?.per_role || 6), 20));
  try {
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => t.id);
    const clientIds = (clientRows.results || []).map((c2: any) => c2.id);
    let filter = "";
    if (teamIds.length > 0 && clientIds.length > 0) {
      filter = `WHERE r.team_id IN (${teamIds.join(",")}) OR r.client_id IN (${clientIds.join(",")})`;
    } else if (teamIds.length > 0) {
      filter = `WHERE r.team_id IN (${teamIds.join(",")})`;
    } else if (clientIds.length > 0) {
      filter = `WHERE r.client_id IN (${clientIds.join(",")})`;
    }
    const roleRows = await db
      .prepare(`
        SELECT r.id, r.client_id, r.team_id, r.account_manager_id, r.title 
        FROM am_roles r
        ${filter}
        ORDER BY r.created_at DESC
      `)
      .all();
    const roles = roleRows.results || [];
    if (roles.length === 0) {
      return c.json({ error: "No roles found to seed" }, 404);
    }
    const ensureCandidateCode = async () => {
      const counter = await db
        .prepare("SELECT next_number FROM code_counters WHERE category = 'candidate'")
        .first();
      if (!counter) {
        await db
          .prepare("INSERT INTO code_counters (category, next_number) VALUES ('candidate', 1)")
          .run();
        return 1;
      }
      return (counter as any).next_number || 1;
    };
    const generateCandidateCode = async () => {
      const next = await ensureCandidateCode();
      const code = `NL-${String(next).padStart(4, "0")}`;
      await db
        .prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'candidate'")
        .run();
      return code;
    };
    const pickRecruiterForTeam = async (teamId: number) => {
      const rec = await db
        .prepare("SELECT recruiter_user_id FROM recruiter_team_assignments WHERE team_id = ? LIMIT 1")
        .bind(teamId)
        .first();
      if (rec) return (rec as any).recruiter_user_id;
      const anyRec = await db
        .prepare("SELECT id FROM users WHERE role = 'recruiter' AND is_active = 1 LIMIT 1")
        .first();
      return anyRec ? (anyRec as any).id : null;
    };
    const statuses = ["rm_evaluation", "submitted", "client_submitted", "client_rejected", "deal", "discarded"];
    for (const role of roles) {
      const r = role as any;
      const recruiterId = await pickRecruiterForTeam(r.team_id);
      if (!recruiterId) continue;
      for (let i = 0; i < Math.min(perRole, statuses.length); i++) {
        const status = statuses[i];
        const daysAgo = 3 + i;
        const submissionDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
        const candCode = await generateCandidateCode();
        const name = `Candidate ${r.title} ${status.toUpperCase()} ${i + 1}`;
        const email = `cand_${r.id}_${status}_${i + 1}@example.com`;
        const phone = `+1-555-01${String(r.id).padStart(2, "0")}${i}`;
        const notes = `Auto-seeded for ${r.title} with status ${status}`;
        const candRes = await db
          .prepare(`
            INSERT INTO candidates (candidate_code, name, email, phone, resume_url, notes, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(candCode, name, email, phone, null, notes, recruiterId)
          .run();
        const candidateId = candRes.meta.last_row_id;
        const isDiscarded = status === "discarded" ? 1 : 0;
        const assocStatus = status === "discarded" ? "rm_evaluation" : status;
        const discardedReason = isDiscarded ? "Discarded during RM review" : null;
        await db
          .prepare(`
            INSERT INTO candidate_role_associations
            (candidate_id, role_id, recruiter_user_id, client_id, team_id, status, submission_date, is_discarded, discarded_at, discarded_reason, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(
            candidateId,
            r.id,
            recruiterId,
            r.client_id,
            r.team_id,
            assocStatus,
            submissionDate,
            isDiscarded,
            isDiscarded ? new Date().toISOString() : null,
            discardedReason
          )
          .run();
        if (!isDiscarded) {
          const workType = i % 2 === 0 ? "SOW" : "Payroll";
          const validationStatus = i % 2 === 0 ? "Validated" : "Pending";
          const scorePercent = 60 + i * 5;
          const rmRateBill = 700 + i * 25;
          const rmRatePay = 500 + i * 20;
          const rmLocation = i % 2 === 0 ? "Berlin" : "Madrid";
          const rmNotes = `RM review details for ${name}`;
          await db
            .prepare(`
              INSERT INTO recruiter_submissions
              (recruiter_user_id, client_id, team_id, role_id, account_manager_id, recruitment_manager_id, submission_type, submission_date, notes, entry_type, interview_level, candidate_name, rm_validation_status, rm_rate_bill, rm_rate_pay, rm_location, rm_work_type, cv_match_percent, rm_notes, rm_reviewed_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(
              recruiterId,
              r.client_id,
              r.team_id,
              r.id,
              r.account_manager_id,
              (rmUser as any).id,
              i % 3 === 0 ? "after_24h" : i % 3 === 1 ? "24h" : "6h",
              submissionDate,
              notes,
              "submission",
              null,
              name,
              validationStatus,
              rmRateBill,
              rmRatePay,
              rmLocation,
              workType,
              scorePercent,
              rmNotes
            )
            .run();
        }
      }
      const todayStr = new Date().toISOString().slice(0, 10);
      const recId = await pickRecruiterForTeam(r.team_id);
      if (recId) {
        await db
          .prepare(`
            INSERT INTO recruiter_submissions
            (recruiter_user_id, client_id, team_id, role_id, account_manager_id, submission_type, submission_date, notes, entry_type, interview_level, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(recId, r.client_id, r.team_id, r.id, r.account_manager_id, "after_24h", todayStr, "Interview round 1", "interview", 1)
          .run();
        await db
          .prepare(`
            INSERT INTO recruiter_submissions
            (recruiter_user_id, client_id, team_id, role_id, account_manager_id, submission_type, submission_date, notes, entry_type, interview_level, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(recId, r.client_id, r.team_id, r.id, r.account_manager_id, "after_24h", todayStr, "Interview round 2", "interview", 2)
          .run();
      }
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to seed sample data" }, 500);
  }
});

app.post("/api/rm/seed/reset-and-populate", rmOnly, async (c) => {
  const db = c.env.DB;
  const rmUser = c.get("rmUser");
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}
  const rolesPerTeam = Math.max(1, Math.min(Number(body?.roles_per_team || 2), 10));
  const submissionsPerRole = Math.max(1, Math.min(Number(body?.submissions_per_role || 5), 30));
  try {
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => t.id);
    const clientIds = (clientRows.results || []).map((c2: any) => c2.id);
    if (teamIds.length === 0 && clientIds.length === 0) {
      return c.json({ error: "No teams or clients found for RM" }, 404);
    }
    let filter = "";
    if (teamIds.length > 0 && clientIds.length > 0) {
      filter = `WHERE r.team_id IN (${teamIds.join(",")}) OR r.client_id IN (${clientIds.join(",")})`;
    } else if (teamIds.length > 0) {
      filter = `WHERE r.team_id IN (${teamIds.join(",")})`;
    } else if (clientIds.length > 0) {
      filter = `WHERE r.client_id IN (${clientIds.join(",")})`;
    }
    const roleRows = await db
      .prepare(`
        SELECT r.id 
        FROM am_roles r
        ${filter}
      `)
      .all();
    const roleIds = (roleRows.results || []).map((r: any) => r.id);
    for (const roleId of roleIds) {
      await db.prepare("DELETE FROM candidate_role_associations WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM recruiter_submissions WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM am_role_interviews WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM role_recruiter_assignments WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM am_role_teams WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM role_status_pending WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM dropout_requests WHERE role_id = ?").bind(roleId).run();
      await db.prepare("DELETE FROM am_roles WHERE id = ?").bind(roleId).run();
    }
    const anyClientRow = clientIds.length === 0
      ? await db.prepare("SELECT id FROM clients ORDER BY id LIMIT 1").first()
      : null;
    const anyClientId = anyClientRow ? (anyClientRow as any).id : null;
    const ensureRoleCodeCounter = async () => {
      const counter = await db.prepare("SELECT next_number FROM code_counters WHERE category = 'role'").first();
      if (!counter) {
        await db.prepare("INSERT INTO code_counters (category, next_number) VALUES ('role', 2)").run();
        return 1;
      }
      return (counter as any).next_number || 1;
    };
    const generateRoleCode = async () => {
      const next = await ensureRoleCodeCounter();
      const code = `ROL-${String(next).padStart(3, "0")}`;
      await db.prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'role'").run();
      return code;
    };
    const pickAMFor = async (teamId: number | null, clientId: number | null) => {
      if (clientId != null) {
        const am = await db
          .prepare(`
            SELECT u.id FROM users u
            INNER JOIN client_assignments ca ON u.id = ca.user_id
            WHERE ca.client_id = ? AND u.role = 'account_manager' AND u.is_active = 1
            LIMIT 1
          `)
          .bind(clientId)
          .first();
        if (am) return (am as any).id;
      }
      if (teamId != null) {
        const am2 = await db
          .prepare(`
            SELECT u.id FROM users u
            INNER JOIN team_assignments ta ON u.id = ta.user_id
            WHERE ta.team_id = ? AND u.role = 'account_manager' AND u.is_active = 1
            LIMIT 1
          `)
          .bind(teamId)
          .first();
        if (am2) return (am2 as any).id;
      }
      const anyAm = await db
        .prepare("SELECT id FROM users WHERE role = 'account_manager' AND is_active = 1 LIMIT 1")
        .first();
      return anyAm ? (anyAm as any).id : null;
    };
    const ensureCandidateCode = async () => {
      const counter = await db.prepare("SELECT next_number FROM code_counters WHERE category = 'candidate'").first();
      if (!counter) {
        await db.prepare("INSERT INTO code_counters (category, next_number) VALUES ('candidate', 1)").run();
        return 1;
      }
      return (counter as any).next_number || 1;
    };
    const generateCandidateCode = async () => {
      const next = await ensureCandidateCode();
      const code = `NL-${String(next).padStart(4, "0")}`;
      await db.prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'candidate'").run();
      return code;
    };
    const pickRecruiterForTeam = async (teamId: number) => {
      const rec = await db
        .prepare("SELECT recruiter_user_id FROM recruiter_team_assignments WHERE team_id = ? LIMIT 1")
        .bind(teamId)
        .first();
      if (rec) return (rec as any).recruiter_user_id;
      const anyRec = await db
        .prepare("SELECT id FROM users WHERE role = 'recruiter' AND is_active = 1 LIMIT 1")
        .first();
      return anyRec ? (anyRec as any).id : null;
    };
    let createdRoles = 0;
    let createdSubmissions = 0;
    for (let tIndex = 0; tIndex < teamIds.length; tIndex++) {
      const teamId = teamIds[tIndex];
      for (let r = 0; r < rolesPerTeam; r++) {
        const clientId = clientIds.length > 0 ? clientIds[(tIndex + r) % clientIds.length] : anyClientId;
        if (!clientId) continue;
        const amId = await pickAMFor(teamId, clientId);
        if (!amId) continue;
        const roleCode = await generateRoleCode();
        const title = `Seed Role ${teamId}-${r + 1}`;
        const result = await db
          .prepare(`
            INSERT INTO am_roles (role_code, client_id, team_id, account_manager_id, title, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(roleCode, clientId, teamId, amId, title, `Auto-seeded for team ${teamId}`)
          .run();
        const roleId = result.meta.last_row_id;
        createdRoles++;
        const recruiterId = await pickRecruiterForTeam(teamId);
        if (!recruiterId) continue;
        for (let i = 0; i < submissionsPerRole; i++) {
          const submissionDate = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          const candCode = await generateCandidateCode();
          const name = `Candidate ${title} ${i + 1}`;
          const email = `cand_${roleId}_rm_eval_${i + 1}@example.com`;
          const phone = `+1-555-${String(roleId).padStart(4, "0")}${String(i).padStart(2, "0")}`;
          const notes = `Seed submission for ${title}`;
          const candRes = await db
            .prepare(`
              INSERT INTO candidates (candidate_code, name, email, phone, resume_url, notes, created_by_user_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(candCode, name, email, phone, null, notes, recruiterId)
            .run();
          const candidateId = candRes.meta.last_row_id;
          await db
            .prepare(`
              INSERT INTO candidate_role_associations
              (candidate_id, role_id, recruiter_user_id, client_id, team_id, status, submission_date, is_discarded, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'rm_evaluation', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(candidateId, roleId, recruiterId, clientId, teamId, submissionDate)
            .run();
          await db
            .prepare(`
              INSERT INTO recruiter_submissions
              (recruiter_user_id, client_id, team_id, role_id, account_manager_id, recruitment_manager_id, submission_type, submission_date, notes, entry_type, interview_level, candidate_name, rm_validation_status, rm_rate_bill, rm_rate_pay, rm_location, rm_work_type, cv_match_percent, rm_notes, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submission', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(
              recruiterId,
              clientId,
              teamId,
              roleId,
              amId,
              (rmUser as any).id,
              i % 3 === 0 ? "after_24h" : i % 3 === 1 ? "24h" : "6h",
              submissionDate,
              notes,
              null,
              name,
              "Pending",
              null,
              null,
              null,
              null,
              0,
              null
            )
            .run();
          createdSubmissions++;
        }
      }
    }
    return c.json({ success: true, created_roles: createdRoles, created_submissions: createdSubmissions });
  } catch (error) {
    return c.json({ error: "Failed to reset and populate roles" }, 500);
  }
});

app.get("/api/rm/ledger/export", rmOnly, async (c) => {
  try {
    const db = c.env.DB;
    const rmUser = c.get("rmUser");
    const dateRange = c.req.query("date_range") || "month";
    const startDateParam = c.req.query("start_date");
    const endDateParam = c.req.query("end_date");
    const eventTypeParam = c.req.query("event_type");
    const statusFilterParam = c.req.query("status");
    const searchParam = c.req.query("search");
    const formatParam = c.req.query("format") || "csv";
    const roleStatusParam = c.req.query("role_status");
    const todayStr = new Date().toISOString().slice(0, 10);
    let startDate = todayStr;
    let endDate = todayStr;
    if (dateRange === "custom" && startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else if (dateRange === "week") {
      const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      startDate = start;
      endDate = todayStr;
    } else if (dateRange === "month") {
      const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      startDate = start;
      endDate = todayStr;
    } else if (dateRange === "today") {
      startDate = todayStr;
      endDate = todayStr;
    }
    const allowedEventTypes = ["rm_evaluation", "submitted", "client_submitted", "client_rejected", "interview", "deal", "discarded", "dropout"];
    const eventType = eventTypeParam && allowedEventTypes.includes(eventTypeParam) ? eventTypeParam : null;
    const statusFilter = statusFilterParam && ["in_play", "positive", "negative"].includes(statusFilterParam) ? statusFilterParam : null;
    const search = searchParam ? String(searchParam).trim() : "";
    const allowedRoleStatuses = ["active", "lost", "deal", "on_hold", "cancelled", "no_answer"];
    const roleStatus = roleStatusParam && allowedRoleStatuses.includes(String(roleStatusParam)) ? String(roleStatusParam) : null;
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => (t as any).id);
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientIds = (clientRows.results || []).map((c2: any) => (c2 as any).id);
    let craWhere = "cra.is_discarded = 0";
    const filters: string[] = [];
    if (teamIds.length > 0) filters.push(`r.team_id IN (${teamIds.join(",")})`);
    if (clientIds.length > 0) filters.push(`r.client_id IN (${clientIds.join(",")})`);
    if (filters.length > 0) craWhere += ` AND (${filters.join(" OR ")})`;
    let craDateClause = " AND ((cra.status = 'rm_evaluation' AND DATE(cra.submission_date) BETWEEN ? AND ?) OR (cra.status IN ('submitted','client_submitted','client_rejected') AND DATE(cra.updated_at) BETWEEN ? AND ?))";
    let craDateParams: any[] = [startDate, endDate, startDate, endDate];
    if (eventType && ["rm_evaluation", "submitted", "client_submitted", "client_rejected"].includes(eventType)) {
      craDateClause =
        eventType === "rm_evaluation"
          ? " AND (cra.status = 'rm_evaluation' AND DATE(cra.submission_date) BETWEEN ? AND ?)"
          : " AND (cra.status = ? AND DATE(cra.updated_at) BETWEEN ? AND ?)";
      craDateParams =
        eventType === "rm_evaluation"
          ? [startDate, endDate]
          : [eventType, startDate, endDate];
    }
    let craSearchClause = "";
    let craSearchParams: any[] = [];
    if (search.length > 0) {
      craSearchClause = " AND (c.name LIKE ? OR r.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      craSearchParams = [like, like, like, like];
    }
    const craRows = eventType === "discarded"
      ? { results: [] }
      : await db
          .prepare(
            `
            SELECT 
              CASE 
                WHEN cra.status = 'rm_evaluation' THEN DATE(cra.submission_date)
                ELSE DATE(cra.updated_at)
              END as event_date,
              cra.status as event_type,
              c.name as candidate_name,
              c.candidate_code as candidate_code,
              c.email as candidate_email,
              c.phone as candidate_phone,
              r.title as role_title,
              r.role_code as role_code,
              r.status as role_status,
              r.description as role_description,
              cl.name as client_name,
              t.name as team_name,
              NULL as submission_type,
              NULL as interview_level,
              NULL as cv_match_percent,
              NULL as notes
            FROM candidate_role_associations cra
            INNER JOIN candidates c ON c.id = cra.candidate_id
            INNER JOIN am_roles r ON r.id = cra.role_id
            INNER JOIN clients cl ON cl.id = r.client_id
            INNER JOIN app_teams t ON t.id = r.team_id
            WHERE ${craWhere}${craDateClause}${craSearchClause}
            ORDER BY event_date DESC
            `
          )
          .bind(...craDateParams, ...craSearchParams)
          .all();
    let discardedWhere = "cra.is_discarded = 1";
    if (filters.length > 0) discardedWhere += ` AND (${filters.join(" OR ")})`;
    const discardedParams: any[] = [startDate, endDate];
    let discardedSearchClause = "";
    let discardedSearchParams: any[] = [];
    if (search.length > 0) {
      discardedSearchClause = " AND (c.name LIKE ? OR r.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      discardedSearchParams = [like, like, like, like];
    }
    const discardedRows = await db
      .prepare(
        `
        SELECT 
          DATE(cra.discarded_at) as event_date,
          'discarded' as event_type,
          c.name as candidate_name,
          c.candidate_code as candidate_code,
          c.email as candidate_email,
          c.phone as candidate_phone,
          r.title as role_title,
          r.role_code as role_code,
          r.status as role_status,
          r.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          NULL as submission_type,
          NULL as interview_level,
          NULL as cv_match_percent,
          cra.discarded_reason as notes
        FROM candidate_role_associations cra
        INNER JOIN candidates c ON c.id = cra.candidate_id
        INNER JOIN am_roles r ON r.id = cra.role_id
        INNER JOIN clients cl ON cl.id = r.client_id
        INNER JOIN app_teams t ON t.id = r.team_id
        WHERE ${discardedWhere} AND DATE(cra.discarded_at) BETWEEN ? AND ?${discardedSearchClause}
        ORDER BY cra.discarded_at DESC
        `
      )
      .bind(...discardedParams, ...discardedSearchParams)
      .all();
    const rsBaseParams: any[] = [startDate, endDate];
    let rsWhere = "DATE(rs.submission_date) BETWEEN ? AND ?";
    if (teamIds.length > 0) {
      rsWhere += ` AND rs.team_id IN (${teamIds.join(",")})`;
    }
    let rsEventClause = " AND rs.entry_type IN ('interview','deal')";
    if (eventType && ["interview", "deal"].includes(eventType)) {
      rsEventClause = " AND rs.entry_type = ?";
      rsBaseParams.push(eventType);
    }
    let rsSearchClause = "";
    let rsSearchParams: any[] = [];
    if (search.length > 0) {
      rsSearchClause = " AND (rs.candidate_name LIKE ? OR ar.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      rsSearchParams = [like, like, like, like];
    }
    const rsRows = await db
      .prepare(
        `
        SELECT 
          DATE(rs.submission_date) as event_date,
          rs.entry_type as event_type,
          rs.candidate_name,
          c.candidate_code as candidate_code,
          c.email as candidate_email,
          c.phone as candidate_phone,
          ar.title as role_title,
          ar.role_code as role_code,
          ar.status as role_status,
          ar.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          rs.submission_type,
          rs.interview_level,
          rs.cv_match_percent,
          rs.notes
        FROM recruiter_submissions rs
        INNER JOIN am_roles ar ON rs.role_id = ar.id
        INNER JOIN clients cl ON ar.client_id = cl.id
        INNER JOIN app_teams t ON ar.team_id = t.id
        LEFT JOIN candidate_role_associations cra ON cra.role_id = rs.role_id AND cra.is_discarded = 0
        LEFT JOIN candidates c ON c.id = cra.candidate_id AND c.name = rs.candidate_name
        WHERE ${rsWhere}${rsEventClause}${rsSearchClause}
        ORDER BY rs.submission_date DESC
        `
      )
      .bind(...rsBaseParams, ...rsSearchParams)
      .all();
    const dropoutBaseParams: any[] = [(rmUser as any).id, startDate, endDate];
    let dropoutSearchClause = "";
    let dropoutSearchParams: any[] = [];
    if (search.length > 0) {
      dropoutSearchClause = " AND (ar.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      dropoutSearchParams = [like, like, like];
    }
    const dropoutRows = await db
      .prepare(
        `
        SELECT 
          DATE(COALESCE(dr.rm_acknowledged_at, dr.created_at)) as event_date,
          'dropout' as event_type,
          NULL as candidate_name,
          ar.title as role_title,
          ar.role_code as role_code,
          ar.status as role_status,
          ar.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          NULL as submission_type,
          NULL as interview_level,
          NULL as cv_match_percent,
          dr.dropout_reason as notes
        FROM dropout_requests dr
        INNER JOIN am_roles ar ON dr.role_id = ar.id
        INNER JOIN clients cl ON ar.client_id = cl.id
        INNER JOIN app_teams t ON ar.team_id = t.id
        WHERE dr.rm_user_id = ? AND DATE(COALESCE(dr.rm_acknowledged_at, dr.created_at)) BETWEEN ? AND ?${dropoutSearchClause}
        ORDER BY COALESCE(dr.rm_acknowledged_at, dr.created_at) DESC
        `
      )
      .bind(...dropoutBaseParams, ...dropoutSearchParams)
      .all();
    let allEvents = [
      ...(rsRows.results || []),
      ...(craRows.results || []),
      ...(discardedRows.results || []),
      ...(dropoutRows.results || [])
    ].map((r: any) => ({
      event_date: (r as any).event_date,
      event_type: (r as any).event_type,
      candidate_name: (r as any).candidate_name || "",
      candidate_code: (r as any).candidate_code || "",
      candidate_email: (r as any).candidate_email || "",
      candidate_phone: (r as any).candidate_phone || "",
      role_title: (r as any).role_title || "",
      role_code: (r as any).role_code || "",
      role_status: (r as any).role_status || "",
      role_description: (r as any).role_description || "",
      client_name: (r as any).client_name || "",
      team_name: (r as any).team_name || "",
      submission_type: (r as any).submission_type || "",
      interview_level: (r as any).interview_level != null ? String((r as any).interview_level) : "",
      cv_match_percent: (r as any).cv_match_percent != null ? String((r as any).cv_match_percent) : "",
      notes: (r as any).notes || ""
    }));
    if (eventType) {
      allEvents = allEvents.filter((e) => e.event_type === eventType);
    }
    if (roleStatus) {
      allEvents = allEvents.filter((e) => e.role_status === roleStatus);
    }
    if (statusFilter === "in_play") {
      allEvents = allEvents.filter((e) => e.event_type === "rm_evaluation" || e.event_type === "submitted" || e.event_type === "interview");
    } else if (statusFilter === "positive") {
      allEvents = allEvents.filter((e) => e.event_type === "client_submitted" || e.event_type === "deal" || e.event_type === "interview");
    } else if (statusFilter === "negative") {
      allEvents = allEvents.filter((e) => e.event_type === "client_rejected" || e.event_type === "discarded" || e.event_type === "dropout");
    }
    allEvents.sort((a, b) => {
      const ad = new Date(a.event_date).getTime();
      const bd = new Date(b.event_date).getTime();
      return bd - ad;
    });
    const headers = ["Date", "Event", "Candidate", "Role", "RoleStatus", "Client", "Team", "SubmissionType", "InterviewLevel", "CVMatchPercent", "Notes"];
    const rows = allEvents.map((e) => [
      e.event_date || "",
      e.event_type || "",
      (e.candidate_name || "").replace(/,/g, " "),
      ((e.role_title || "") + (e.role_code ? ` (${e.role_code})` : "")).replace(/,/g, " "),
      (e.role_status || "").replace(/,/g, " "),
      (e.client_name || "").replace(/,/g, " "),
      (e.team_name || "").replace(/,/g, " "),
      e.submission_type || "",
      e.interview_level || "",
      e.cv_match_percent || "",
      (e.notes || "").replace(/,/g, " ")
    ].join(","));
    if (formatParam === "excel") {
      const csv = [headers.join(","), ...rows].join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel;charset=utf-8",
          "Content-Disposition": `attachment; filename="rm-submissions-ledger.xls"`
        }
      });
    }
    if (formatParam === "pdf") {
      const tableHead = headers.map((h) => `<th style="padding:8px;border:1px solid #ddd;text-align:left;font-weight:600">${h}</th>`).join("");
      const tableRows = allEvents
        .map((e) => {
          const cells = [
            e.event_date || "",
            e.event_type || "",
            e.candidate_name || "",
            ((e.role_title || "") + (e.role_code ? ` (${e.role_code})` : "")) || "",
            e.role_status || "",
            e.client_name || "",
            e.team_name || "",
            e.submission_type || "",
            e.interview_level || "",
            e.cv_match_percent || "",
            e.notes || ""
          ];
          return `<tr>${cells.map((c) => `<td style="padding:8px;border:1px solid #ddd;">${String(c)}</td>`).join("")}</tr>`;
        })
        .join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>RM Submissions Ledger</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto;font-size:12px;color:#111;padding:16px} h2{margin:0 0 12px} table{border-collapse:collapse;width:100%}</style></head><body><h2>Recruitment Manager Submissions Ledger</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table><script>window.onload=function(){window.print&&window.print();}</script></body></html>`;
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="rm-submissions-ledger.html"`
        }
      });
    }
    const csv = [headers.join(","), ...rows].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="rm-submissions-ledger.csv"`
      }
    });
  } catch (error: any) {
    console.error("RM Ledger export failed:", error);
    return c.json({ error: "Failed to export RM ledger" }, 500);
  }
});

app.get("/api/rm/ledger", rmOnly, async (c) => {
  try {
    const db = c.env.DB;
    const rmUser = c.get("rmUser");
    const dateRange = c.req.query("date_range") || "month";
    const startDateParam = c.req.query("start_date");
    const endDateParam = c.req.query("end_date");
    const eventTypeParam = c.req.query("event_type");
    const statusFilterParam = c.req.query("status");
    const searchParam = c.req.query("search");
    const todayStr = new Date().toISOString().slice(0, 10);
    let startDate = todayStr;
    let endDate = todayStr;
    if (dateRange === "custom" && startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else if (dateRange === "week") {
      const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      startDate = start;
      endDate = todayStr;
    } else if (dateRange === "month") {
      const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      startDate = start;
      endDate = todayStr;
    } else if (dateRange === "today") {
      startDate = todayStr;
      endDate = todayStr;
    }
    const allowedEventTypes = ["rm_evaluation", "submitted", "client_submitted", "client_rejected", "interview", "deal", "discarded", "dropout"];
    const eventType = eventTypeParam && allowedEventTypes.includes(eventTypeParam) ? eventTypeParam : null;
    const statusFilter = statusFilterParam && ["in_play", "positive", "negative"].includes(statusFilterParam) ? statusFilterParam : null;
    const search = searchParam ? String(searchParam).trim() : "";
    const sortByParam = c.req.query("sort_by");
    const sortOrderParam = c.req.query("sort_order") || "desc";
    const pageParam = c.req.query("page");
    const pageSizeParam = c.req.query("page_size");
    const roleStatusParam = c.req.query("role_status");
    const allowedRoleStatuses = ["active", "lost", "deal", "on_hold", "cancelled", "no_answer"];
    const roleStatus = roleStatusParam && allowedRoleStatuses.includes(String(roleStatusParam)) ? String(roleStatusParam) : null;
    const allowedSortBy = ["event_date", "event_type", "candidate_name", "role_title", "client_name", "team_name"];
    const sortBy = sortByParam && allowedSortBy.includes(sortByParam) ? sortByParam : "event_date";
    const sortDesc = String(sortOrderParam).toLowerCase() !== "asc";
    const page = Math.max(1, parseInt(String(pageParam || "1"), 10));
    const pageSize = Math.max(1, parseInt(String(pageSizeParam || "25"), 10));
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => (t as any).id);
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientIds = (clientRows.results || []).map((c2: any) => (c2 as any).id);
    let craWhere = "cra.is_discarded = 0";
    const filters: string[] = [];
    if (teamIds.length > 0) filters.push(`r.team_id IN (${teamIds.join(",")})`);
    if (clientIds.length > 0) filters.push(`r.client_id IN (${clientIds.join(",")})`);
    if (filters.length > 0) craWhere += ` AND (${filters.join(" OR ")})`;
    let craDateClause = " AND ((cra.status = 'rm_evaluation' AND DATE(cra.submission_date) BETWEEN ? AND ?) OR (cra.status IN ('submitted','client_submitted','client_rejected') AND DATE(cra.updated_at) BETWEEN ? AND ?))";
    let craDateParams: any[] = [startDate, endDate, startDate, endDate];
    if (eventType && ["rm_evaluation", "submitted", "client_submitted", "client_rejected"].includes(eventType)) {
      craDateClause =
        eventType === "rm_evaluation"
          ? " AND (cra.status = 'rm_evaluation' AND DATE(cra.submission_date) BETWEEN ? AND ?)"
          : " AND (cra.status = ? AND DATE(cra.updated_at) BETWEEN ? AND ?)";
      craDateParams =
        eventType === "rm_evaluation"
          ? [startDate, endDate]
          : [eventType, startDate, endDate];
    }
    let craSearchClause = "";
    let craSearchParams: any[] = [];
    if (search.length > 0) {
      craSearchClause = " AND (c.name LIKE ? OR r.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      craSearchParams = [like, like, like, like];
    }
    const craRows = eventType === "discarded"
      ? { results: [] }
      : await db
          .prepare(
            `
            SELECT 
              CASE 
                WHEN cra.status = 'rm_evaluation' THEN DATE(cra.submission_date)
                ELSE DATE(cra.updated_at)
              END as event_date,
              cra.status as event_type,
              c.name as candidate_name,
              c.candidate_code as candidate_code,
              c.email as candidate_email,
              c.phone as candidate_phone,
              r.title as role_title,
              r.role_code as role_code,
              r.status as role_status,
              r.description as role_description,
              cl.name as client_name,
              t.name as team_name,
              NULL as submission_type,
              NULL as interview_level,
              NULL as cv_match_percent,
              NULL as notes
            FROM candidate_role_associations cra
            INNER JOIN candidates c ON c.id = cra.candidate_id
            INNER JOIN am_roles r ON r.id = cra.role_id
            INNER JOIN clients cl ON cl.id = r.client_id
            INNER JOIN app_teams t ON t.id = r.team_id
            WHERE ${craWhere}${craDateClause}${craSearchClause}
            ORDER BY event_date DESC
            `
          )
          .bind(...craDateParams, ...craSearchParams)
          .all();
    let discardedWhere = "cra.is_discarded = 1";
    if (filters.length > 0) discardedWhere += ` AND (${filters.join(" OR ")})`;
    const discardedParams: any[] = [startDate, endDate];
    let discardedSearchClause = "";
    let discardedSearchParams: any[] = [];
    if (search.length > 0) {
      discardedSearchClause = " AND (c.name LIKE ? OR r.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      discardedSearchParams = [like, like, like, like];
    }
    const discardedRows = await db
      .prepare(
        `
        SELECT 
          DATE(cra.discarded_at) as event_date,
          'discarded' as event_type,
          c.name as candidate_name,
          c.candidate_code as candidate_code,
          c.email as candidate_email,
          c.phone as candidate_phone,
          r.title as role_title,
          r.role_code as role_code,
          r.status as role_status,
          r.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          NULL as submission_type,
          NULL as interview_level,
          NULL as cv_match_percent,
          cra.discarded_reason as notes
        FROM candidate_role_associations cra
        INNER JOIN candidates c ON c.id = cra.candidate_id
        INNER JOIN am_roles r ON r.id = cra.role_id
        INNER JOIN clients cl ON cl.id = r.client_id
        INNER JOIN app_teams t ON t.id = r.team_id
        WHERE ${discardedWhere} AND DATE(cra.discarded_at) BETWEEN ? AND ?${discardedSearchClause}
        ORDER BY cra.discarded_at DESC
        `
      )
      .bind(...discardedParams, ...discardedSearchParams)
      .all();
    const rsBaseParams: any[] = [startDate, endDate];
    let rsWhere = "DATE(rs.submission_date) BETWEEN ? AND ?";
    if (teamIds.length > 0) {
      rsWhere += ` AND rs.team_id IN (${teamIds.join(",")})`;
    }
    let rsEventClause = " AND rs.entry_type IN ('interview','deal')";
    if (eventType && ["interview", "deal"].includes(eventType)) {
      rsEventClause = " AND rs.entry_type = ?";
      rsBaseParams.push(eventType);
    }
    let rsSearchClause = "";
    let rsSearchParams: any[] = [];
    if (search.length > 0) {
      rsSearchClause = " AND (rs.candidate_name LIKE ? OR ar.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      rsSearchParams = [like, like, like, like];
    }
    const rsRows = await db
      .prepare(
        `
        SELECT 
          DATE(rs.submission_date) as event_date,
          rs.entry_type as event_type,
          rs.candidate_name,
          ar.title as role_title,
          ar.role_code as role_code,
          ar.status as role_status,
          ar.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          rs.submission_type,
          rs.interview_level,
          rs.cv_match_percent,
          rs.notes
        FROM recruiter_submissions rs
        INNER JOIN am_roles ar ON rs.role_id = ar.id
        INNER JOIN clients cl ON ar.client_id = cl.id
        INNER JOIN app_teams t ON ar.team_id = t.id
        WHERE ${rsWhere}${rsEventClause}${rsSearchClause}
        ORDER BY rs.submission_date DESC
        `
      )
      .bind(...rsBaseParams, ...rsSearchParams)
      .all();
    const dropoutBaseParams: any[] = [(rmUser as any).id, startDate, endDate];
    let dropoutSearchClause = "";
    let dropoutSearchParams: any[] = [];
    if (search.length > 0) {
      dropoutSearchClause = " AND (ar.title LIKE ? OR cl.name LIKE ? OR t.name LIKE ?)";
      const like = `%${search}%`;
      dropoutSearchParams = [like, like, like];
    }
    const dropoutRows = await db
      .prepare(
        `
        SELECT 
          DATE(COALESCE(dr.rm_acknowledged_at, dr.created_at)) as event_date,
          'dropout' as event_type,
          NULL as candidate_name,
          ar.title as role_title,
          ar.role_code as role_code,
          ar.status as role_status,
          ar.description as role_description,
          cl.name as client_name,
          t.name as team_name,
          NULL as submission_type,
          NULL as interview_level,
          NULL as cv_match_percent,
          dr.dropout_reason as notes
        FROM dropout_requests dr
        INNER JOIN am_roles ar ON dr.role_id = ar.id
        INNER JOIN clients cl ON ar.client_id = cl.id
        INNER JOIN app_teams t ON ar.team_id = t.id
        WHERE dr.rm_user_id = ? AND DATE(COALESCE(dr.rm_acknowledged_at, dr.created_at)) BETWEEN ? AND ?${dropoutSearchClause}
        ORDER BY COALESCE(dr.rm_acknowledged_at, dr.created_at) DESC
        `
      )
      .bind(...dropoutBaseParams, ...dropoutSearchParams)
      .all();
    let allEvents = [
      ...(rsRows.results || []),
      ...(craRows.results || []),
      ...(discardedRows.results || []),
      ...(dropoutRows.results || [])
    ].map((r: any) => ({
      event_date: (r as any).event_date,
      event_type: (r as any).event_type,
      candidate_name: (r as any).candidate_name || "",
      role_title: (r as any).role_title || "",
      role_code: (r as any).role_code || "",
      role_status: (r as any).role_status || "",
      role_description: (r as any).role_description || "",
      client_name: (r as any).client_name || "",
      team_name: (r as any).team_name || "",
      submission_type: (r as any).submission_type || "",
      interview_level: (r as any).interview_level != null ? String((r as any).interview_level) : "",
      cv_match_percent: (r as any).cv_match_percent != null ? String((r as any).cv_match_percent) : "",
      notes: (r as any).notes || ""
    }));
    if (eventType) {
      allEvents = allEvents.filter((e) => e.event_type === eventType);
    }
    if (roleStatus) {
      allEvents = allEvents.filter((e) => e.role_status === roleStatus);
    }
    if (statusFilter === "in_play") {
      allEvents = allEvents.filter((e) => e.event_type === "rm_evaluation" || e.event_type === "submitted" || e.event_type === "interview");
    } else if (statusFilter === "positive") {
      allEvents = allEvents.filter((e) => e.event_type === "client_submitted" || e.event_type === "deal" || e.event_type === "interview");
    } else if (statusFilter === "negative") {
      allEvents = allEvents.filter((e) => e.event_type === "client_rejected" || e.event_type === "discarded" || e.event_type === "dropout");
    }
    allEvents.sort((a, b) => {
      const av = (a as any)[sortBy] || "";
      const bv = (b as any)[sortBy] || "";
      if (sortBy === "event_date") {
        const at = new Date(av).getTime();
        const bt = new Date(bv).getTime();
        return sortDesc ? bt - at : at - bt;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
    const total = allEvents.length;
    const start = (page - 1) * pageSize;
    const paged = allEvents.slice(start, start + pageSize);
    return c.json({ events: paged, total });
  } catch (error: any) {
    console.error("RM Ledger read failed:", error);
    return c.json({ error: "Failed to read RM ledger" }, 500);
  }
});

// RM candidates summary (aggregate by candidate across RM's teams/clients)
app.get("/api/rm/candidates", rmOnly, async (c) => {
  try {
    const db = c.env.DB;
    const rmUser = c.get("rmUser");
    const searchParam = c.req.query("search");
    const search = searchParam ? `%${String(searchParam).trim()}%` : null;
    const teamRows = await db
      .prepare(`
        SELECT t.id FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const clientRows = await db
      .prepare(`
        SELECT c.id FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((rmUser as any).id)
      .all();
    const teamIds = (teamRows.results || []).map((t: any) => (t as any).id);
    const clientIds = (clientRows.results || []).map((c2: any) => (c2 as any).id);
    const scopeFilters: string[] = [];
    if (teamIds.length > 0) scopeFilters.push(`r.team_id IN (${teamIds.join(",")})`);
    if (clientIds.length > 0) scopeFilters.push(`r.client_id IN (${clientIds.join(",")})`);
    let where = "1=1";
    if (scopeFilters.length > 0) where += ` AND (${scopeFilters.join(" OR ")})`;
    const params: any[] = [];
    if (search) {
      where += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)";
      params.push(search, search, search);
    }
    const rows = await db
      .prepare(
        `
        SELECT 
          c.id as candidate_id,
          c.name as candidate_name,
          c.candidate_code,
          c.email,
          c.phone,
          COUNT(DISTINCT cra.role_id) as total_roles,
          SUM(CASE WHEN cra.is_discarded = 0 THEN 1 ELSE 0 END) as in_play_roles,
          SUM(CASE WHEN cra.status = 'rm_evaluation' AND cra.is_discarded = 0 THEN 1 ELSE 0 END) as rm_evaluation,
          SUM(CASE WHEN cra.status = 'submitted' AND cra.is_discarded = 0 THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN cra.status = 'client_submitted' AND cra.is_discarded = 0 THEN 1 ELSE 0 END) as client_submitted,
          SUM(CASE WHEN cra.status = 'client_rejected' AND cra.is_discarded = 0 THEN 1 ELSE 0 END) as client_rejected,
          SUM(CASE WHEN cra.status = 'deal' THEN 1 ELSE 0 END) as deals,
          DATE(MAX(COALESCE(cra.updated_at, cra.submission_date, cra.discarded_at))) as last_event_date
        FROM candidate_role_associations cra
        INNER JOIN candidates c ON c.id = cra.candidate_id
        INNER JOIN am_roles r ON r.id = cra.role_id
        WHERE ${where}
        GROUP BY c.id, c.name, c.candidate_code, c.email, c.phone
        ORDER BY last_event_date DESC
        `
      )
      .bind(...params)
      .all();
    return c.json(rows.results || []);
  } catch (error) {
    console.error("Error fetching RM candidates:", error);
    return c.json({ error: "Failed to fetch candidates" }, 500);
  }
});

export default app;
