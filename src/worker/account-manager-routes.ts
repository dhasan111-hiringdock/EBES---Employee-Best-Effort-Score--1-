import { Hono } from "hono";
import { z } from "zod";
import { calculateAccountManagerEBES, type AccountManagerEBESData } from "./ebes-calculator";
import { createNotification } from "./notification-routes";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to verify Account Manager role
const amOnly = async (c: any, next: any) => {
  const db = c.env.DB;
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'account_manager'")
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: "Unauthorized - Account Manager only" }, 403);
  }

  c.set("amUser", user);
  await next();
};

// Pending submissions count for AM (awaiting AM review)
app.get("/api/am/pending-submissions-count", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  try {
    const row = await db
      .prepare(`
        SELECT COUNT(*) as count
        FROM candidate_role_associations cra
        INNER JOIN am_roles r ON r.id = cra.role_id
        WHERE cra.status = 'submitted'
          AND cra.is_discarded = 0
          AND r.account_manager_id = ?
      `)
      .bind((amUser as any).id)
      .first();
    return c.json({ count: (row as any)?.count || 0 });
  } catch (error) {
    return c.json({ error: "Failed to fetch pending submissions count" }, 500);
  }
});

// Pending submissions list for AM
app.get("/api/am/pending-submissions", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  try {
    const qLimit = Number(c.req.query("limit") || "100");
    const limit = Math.max(1, Math.min(qLimit, 500));
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
        WHERE cra.status = 'submitted' 
          AND cra.is_discarded = 0
          AND r.account_manager_id = ?
        ORDER BY cra.submission_date DESC
        LIMIT ${limit}
      `)
      .bind((amUser as any).id)
      .all();
    return c.json(rows.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch pending submissions" }, 500);
  }
});

// Generate role code
async function generateRoleCode(db: any): Promise<string> {
  const counter = await db
    .prepare("SELECT next_number FROM code_counters WHERE category = 'am_role'")
    .first();

  const number = (counter as any).next_number;
  const code = `ROLE-${number.toString().padStart(4, "0")}`;

  await db
    .prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'am_role'")
    .run();

  return code;
}

// Get current month key (YYYY-MM)
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Get AM assignments
app.get("/api/am/assignments", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");

  try {
    const clients = await db
      .prepare(`
        SELECT c.* FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((amUser as any).id)
      .all();

    const teams = await db
      .prepare(`
        SELECT t.* FROM app_teams t
        INNER JOIN team_assignments ta ON t.id = ta.team_id
        WHERE ta.user_id = ?
      `)
      .bind((amUser as any).id)
      .all();

    return c.json({
      clients: clients.results || [],
      teams: teams.results || [],
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch assignments" }, 500);
  }
});

// Check monthly reminder status
app.get("/api/am/reminder-status", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const currentMonth = getCurrentMonth();

  try {
    const reminder = await db
      .prepare("SELECT * FROM am_monthly_reminders WHERE user_id = ? AND reminder_month = ?")
      .bind((amUser as any).id, currentMonth)
      .first();

    return c.json({
      shouldShow: !reminder || !(reminder as any).is_confirmed,
      currentMonth,
    });
  } catch (error) {
    return c.json({ error: "Failed to check reminder status" }, 500);
  }
});

// Confirm monthly reminder
app.post("/api/am/confirm-reminder", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const currentMonth = getCurrentMonth();

  try {
    await db
      .prepare(`
        INSERT INTO am_monthly_reminders (user_id, reminder_month, is_confirmed)
        VALUES (?, ?, 1)
        ON CONFLICT(user_id, reminder_month) DO UPDATE SET is_confirmed = 1
      `)
      .bind((amUser as any).id, currentMonth)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to confirm reminder" }, 500);
  }
});

// Get all roles for AM
app.get("/api/am/roles", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const status = c.req.query("status");
  const clientId = c.req.query("client_id");
  const teamId = c.req.query("team_id");

  try {
    let query = `
      SELECT 
        r.*,
        c.name as client_name,
        t.name as team_name,
        (SELECT SUM(CASE WHEN cra.status = 'submitted' AND cra.is_discarded = 0 THEN 1 ELSE 0 END)
         FROM candidate_role_associations cra
         WHERE cra.role_id = r.id) as pending_submissions
      FROM am_roles r
      INNER JOIN clients c ON r.client_id = c.id
      INNER JOIN app_teams t ON r.team_id = t.id
      WHERE r.account_manager_id = ?
    `;

    const params: any[] = [(amUser as any).id];

    // Filter by client if provided
    if (clientId) {
      query += " AND r.client_id = ?";
      params.push(clientId);
    }

    // Filter by team if provided
    if (teamId) {
      query += " AND r.team_id = ?";
      params.push(teamId);
    }

    if (status) {
      if (status === "active") {
        query += " AND r.status = 'active'";
      } else if (status === "non-active") {
        query += " AND r.status != 'active'";
      } else if (["lost", "cancelled", "deal", "on_hold", "no_answer"].includes(status)) {
        query += " AND r.status = ?";
        params.push(status);
      }
    }

    query += " ORDER BY pending_submissions DESC, r.created_at DESC";

    const roles = await db.prepare(query).bind(...params).all();

    // Get interview counts and pending status for each role
    const rolesWithInterviews = await Promise.all(
      (roles.results || []).map(async (role: any) => {
        const interviews = await db
          .prepare(`
            SELECT interview_round, SUM(interview_count) as total
            FROM am_role_interviews
            WHERE role_id = ?
            GROUP BY interview_round
          `)
          .bind(role.id)
          .all();

        const interviewMap: any = { 1: 0, 2: 0, 3: 0 };
        for (const interview of interviews.results || []) {
          const data = interview as any;
          interviewMap[data.interview_round] = data.total;
        }

        // Check if role has pending dropout
        const pendingStatus = await db
          .prepare("SELECT * FROM role_status_pending WHERE role_id = ? ORDER BY created_at DESC LIMIT 1")
          .bind(role.id)
          .first();

        // Check if role has been dropped out (accepted or ignored)
        const dropoutRequest = await db
          .prepare("SELECT * FROM dropout_requests WHERE role_id = ? AND final_status = 'completed' ORDER BY am_decided_at DESC LIMIT 1")
          .bind(role.id)
          .first();

        // Get additional team assignments
        const additionalTeams = await db
          .prepare(`
            SELECT t.id, t.name, t.team_code
            FROM am_role_teams rt
            INNER JOIN app_teams t ON rt.team_id = t.id
            WHERE rt.role_id = ?
          `)
          .bind(role.id)
          .all();

        // Total submissions: all candidate-role associations (not discarded)
        const totalSubsRow = await db
          .prepare(`
            SELECT COUNT(*) as total
            FROM candidate_role_associations
            WHERE role_id = ? AND is_discarded = 0
          `)
          .bind(role.id)
          .first();

        const clientStatusCounts = await db
          .prepare(`
            SELECT 
              SUM(CASE WHEN status = 'client_submitted' AND is_discarded = 0 THEN 1 ELSE 0 END) as under_client_evaluation,
              SUM(CASE WHEN status = 'client_rejected' AND is_discarded = 0 THEN 1 ELSE 0 END) as client_rejected
            FROM candidate_role_associations
            WHERE role_id = ?
          `)
          .bind(role.id)
          .first();

        return {
          ...role,
          interview_1_count: interviewMap[1],
          interview_2_count: interviewMap[2],
          interview_3_count: interviewMap[3],
          total_interviews: interviewMap[1] + interviewMap[2] + interviewMap[3],
          total_submissions: (totalSubsRow as any)?.total || 0,
          under_client_evaluation: (clientStatusCounts as any)?.under_client_evaluation || 0,
          client_rejected: (clientStatusCounts as any)?.client_rejected || 0,
          has_pending_dropout: !!pendingStatus,
          pending_dropout_reason: pendingStatus ? (pendingStatus as any).reason : null,
          has_dropout: !!dropoutRequest,
          dropout_decision: dropoutRequest ? (dropoutRequest as any).am_decision : null,
          additional_teams: additionalTeams.results || [],
        };
      })
    );

    return c.json(rolesWithInterviews);
  } catch (error) {
    return c.json({ error: "Failed to fetch roles" }, 500);
  }
});

// AM submit candidate to client (mark under client evaluation)
app.post("/api/am/roles/:roleId/candidates/:candidateId/submit-to-client", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");

  const role = await db.prepare("SELECT account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET status = 'client_submitted',
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0
  `).bind(roleId, candidateId).run();

  return c.json({ success: true });
});

// AM mark client rejection for a submitted candidate
app.post("/api/am/roles/:roleId/candidates/:candidateId/client-reject", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");

  const role = await db.prepare("SELECT account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET status = 'client_rejected',
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0
  `).bind(roleId, candidateId).run();

  return c.json({ success: true });
});

// AM pull out candidate from client evaluation back to submitted
app.post("/api/am/roles/:roleId/candidates/:candidateId/pull-out", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");

  const role = await db.prepare("SELECT account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET status = 'submitted',
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0 AND status = 'client_submitted'
  `).bind(roleId, candidateId).run();

  return c.json({ success: true });
});

// AM mark deal for a candidate and close role as deal
app.post("/api/am/roles/:roleId/candidates/:candidateId/deal", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");

  const role = await db.prepare("SELECT * FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET status = 'deal',
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ?
  `).bind(roleId, candidateId).run();

  await db.prepare(`
    UPDATE am_roles
    SET status = 'deal',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(roleId).run();

  return c.json({ success: true });
});

// Create role
app.post("/api/am/roles", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const body = await c.req.json();

  const schema = z.object({
    client_id: z.number(),
    team_id: z.number(),
    team_ids: z.array(z.number()).optional(),
    title: z.string().min(1),
    description: z.string().optional(),
  });

  try {
    const data = schema.parse(body);

    // Check active role limit
    const activeCount = await db
      .prepare("SELECT COUNT(*) as count FROM am_roles WHERE account_manager_id = ? AND status = 'active'")
      .bind((amUser as any).id)
      .first();

    if ((activeCount as any).count >= 30) {
      return c.json({ error: "You have reached the maximum of 30 active roles. Please update role statuses to continue." }, 400);
    }

    const roleCode = await generateRoleCode(db);

    const result = await db
      .prepare(`
        INSERT INTO am_roles (role_code, client_id, team_id, account_manager_id, title, description, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `)
      .bind(roleCode, data.client_id, data.team_id, (amUser as any).id, data.title, data.description || "")
      .run();

    const roleId = result.meta.last_row_id;

    if (data.team_ids && data.team_ids.length > 0) {
      for (const teamId of data.team_ids) {
        if (teamId !== data.team_id) {
          await db
            .prepare("INSERT INTO am_role_teams (role_id, team_id) VALUES (?, ?)" )
            .bind(roleId, teamId)
            .run();
        }
      }
    }

    const rmUsersPrimary = await db
      .prepare(`
        SELECT u.id
        FROM users u
        INNER JOIN team_assignments ta ON u.id = ta.user_id
        WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
      `)
      .bind(data.team_id)
      .all();

    for (const row of rmUsersPrimary.results || []) {
      const rmId = (row as any).id;
      await createNotification(db, {
        userId: rmId,
        type: 'system',
        title: 'New Role Created',
        message: `Account Manager ${(amUser as any).name} created role ${data.title}`,
        relatedEntityType: 'role',
        relatedEntityId: Number(roleId)
      });
    }

    if (data.team_ids && data.team_ids.length > 0) {
      for (const teamId of data.team_ids) {
        if (teamId !== data.team_id) {
          const rmUsersExtra = await db
            .prepare(`
              SELECT u.id
              FROM users u
              INNER JOIN team_assignments ta ON u.id = ta.user_id
              WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
            `)
            .bind(teamId)
            .all();

          for (const row of rmUsersExtra.results || []) {
            const rmId = (row as any).id;
            await createNotification(db, {
              userId: rmId,
              type: 'system',
              title: 'New Role Created',
              message: `Account Manager ${(amUser as any).name} created role ${data.title}`,
              relatedEntityType: 'role',
              relatedEntityId: Number(roleId)
            });
          }
        }
      }
    }

    return c.json({
      success: true,
      id: roleId,
      role_code: roleCode,
    });
  } catch (error) {
    console.error("Error creating role:", error);
    return c.json({ error: "Failed to create role" }, 500);
  }
});

// Update role
app.put("/api/am/roles/:id", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    client_id: z.number().optional(),
    team_id: z.number().optional(),
    team_ids: z.array(z.number()).optional(),
    status: z.enum(["active", "lost", "deal", "on_hold", "cancelled", "no_answer"]).optional(),
    clear_pending_dropout: z.boolean().optional(),
  });

  try {
    const data = schema.parse(body);

    // Verify ownership
    const role = await db
      .prepare("SELECT * FROM am_roles WHERE id = ? AND account_manager_id = ?")
      .bind(roleId, (amUser as any).id)
      .first();

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push("title = ?");
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      values.push(data.description);
    }
    if (data.client_id !== undefined) {
      updates.push("client_id = ?");
      values.push(data.client_id);
    }
    if (data.team_id !== undefined) {
      updates.push("team_id = ?");
      values.push(data.team_id);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      values.push(data.status);
    }

    if (updates.length === 0 && !data.clear_pending_dropout && !data.team_ids) {
      return c.json({ error: "No fields to update" }, 400);
    }

    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(roleId, (amUser as any).id);

      await db
        .prepare(`UPDATE am_roles SET ${updates.join(", ")} WHERE id = ? AND account_manager_id = ?`)
        .bind(...values)
        .run();
      
      // Handle candidate deactivation based on status change
      if (data.status !== undefined) {
        const newStatus = data.status;
        
        // For on_hold, cancelled, or deal: deactivate candidates (no score impact)
        if (['on_hold', 'cancelled', 'deal'].includes(newStatus)) {
          await db
            .prepare(`
              UPDATE candidate_role_associations 
              SET is_discarded = 1, 
                  discarded_at = CURRENT_TIMESTAMP,
                  discarded_reason = 'Role status changed to ${newStatus}',
                  updated_at = CURRENT_TIMESTAMP
              WHERE role_id = ? AND is_discarded = 0
            `)
            .bind(roleId)
            .run();
        }
        
        // For lost: deactivate candidates (with -1.5 score penalty per candidate)
        if (newStatus === 'lost') {
          await db
            .prepare(`
              UPDATE candidate_role_associations 
              SET is_discarded = 1,
                  is_lost_role = 1,
                  discarded_at = CURRENT_TIMESTAMP,
                  discarded_reason = 'Role marked as lost',
                  updated_at = CURRENT_TIMESTAMP
              WHERE role_id = ? AND is_discarded = 0
            `)
            .bind(roleId)
            .run();
        }

        const targetTeamId = data.team_id !== undefined ? data.team_id : (role as any).team_id;
        const rmUsers = await db
          .prepare(`
            SELECT u.id
            FROM users u
            INNER JOIN team_assignments ta ON u.id = ta.user_id
            WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
          `)
          .bind(targetTeamId)
          .all();

        for (const row of rmUsers.results || []) {
          const rmId = (row as any).id;
          await createNotification(db, {
            userId: rmId,
            type: newStatus === 'deal' ? 'deal' : 'system',
            title: newStatus === 'deal' ? 'Role Closed as Deal' : 'Role Status Updated',
            message: `Role ${(role as any).title} status changed to ${newStatus}`,
            relatedEntityType: 'role',
            relatedEntityId: Number(roleId)
          });
        }

        const assignedRecruiters = await db
          .prepare(`
            SELECT DISTINCT recruiter_user_id AS id
            FROM role_recruiter_assignments
            WHERE role_id = ?
          `)
          .bind(roleId)
          .all();

        for (const row of assignedRecruiters.results || []) {
          const recId = (row as any).id;
          await createNotification(db, {
            userId: recId,
            type: newStatus === 'deal' ? 'deal' : 'system',
            title: newStatus === 'deal' ? 'Role Closed as Deal' : 'Role Status Updated',
            message: `Role ${(role as any).title} status changed to ${newStatus}`,
            relatedEntityType: 'role',
            relatedEntityId: Number(roleId)
          });
        }
      }
    }

    // Update team assignments if provided
    if (data.team_ids !== undefined) {
      // Delete existing additional team assignments
      await db
        .prepare("DELETE FROM am_role_teams WHERE role_id = ?")
        .bind(roleId)
        .run();

      // Insert new additional team assignments
      const primaryTeamId = data.team_id || (role as any).team_id;
      for (const teamId of data.team_ids) {
        if (teamId !== primaryTeamId) { // Don't duplicate the primary team
          await db
            .prepare("INSERT INTO am_role_teams (role_id, team_id) VALUES (?, ?)")
            .bind(roleId, teamId)
            .run();
        }
      }
    }

    // Clear pending dropout if requested
    if (data.clear_pending_dropout) {
      await db
        .prepare("DELETE FROM role_status_pending WHERE role_id = ?")
        .bind(roleId)
        .run();
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update role" }, 500);
  }
});

// Delete role
app.delete("/api/am/roles/:id", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("id");

  try {
    // Delete interviews first
    await db.prepare("DELETE FROM am_role_interviews WHERE role_id = ?").bind(roleId).run();

    // Delete role
    await db
      .prepare("DELETE FROM am_roles WHERE id = ? AND account_manager_id = ?")
      .bind(roleId, (amUser as any).id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete role" }, 500);
  }
});

// Add interview entry
app.post("/api/am/roles/:id/interviews", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    interview_round: z.number().min(1).max(3),
    interview_count: z.number().min(1),
  });

  try {
    const data = schema.parse(body);

    // Verify ownership
    const role = await db
      .prepare("SELECT * FROM am_roles WHERE id = ? AND account_manager_id = ?")
      .bind(roleId, (amUser as any).id)
      .first();

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    const currentMonth = getCurrentMonth();

    await db
      .prepare(`
        INSERT INTO am_role_interviews (role_id, interview_round, interview_count, entry_month)
        VALUES (?, ?, ?, ?)
      `)
      .bind(roleId, data.interview_round, data.interview_count, currentMonth)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to add interview entry" }, 500);
  }
});

// Get client analytics for dashboard
app.get("/api/am/client-analytics", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");

  try {
    // Get assigned clients
    const clients = await db
      .prepare(`
        SELECT c.* FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((amUser as any).id)
      .all();

    const clientAnalytics = await Promise.all(
      (clients.results || []).map(async (client: any) => {
        // Get all roles for this client
        const roles = await db
          .prepare("SELECT * FROM am_roles WHERE client_id = ? AND account_manager_id = ?")
          .bind(client.id, (amUser as any).id)
          .all();

        const allRoles = roles.results || [];
        const totalRoles = allRoles.length;
        const activeRoles = allRoles.filter((r: any) => r.status === "active").length;
        const dealRoles = allRoles.filter((r: any) => r.status === "deal").length;

        // Count dropouts from dropout_requests table (both accepted and ignored)
        const dropouts = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM dropout_requests dr
            INNER JOIN am_roles r ON dr.role_id = r.id
            WHERE r.client_id = ? AND r.account_manager_id = ?
          `)
          .bind(client.id, (amUser as any).id)
          .first();

        const dropoutCount = (dropouts as any)?.count || 0;

        // Calculate interview totals
        let totalInterviews = 0;

        for (const role of allRoles) {
          const interviews = await db
            .prepare(`
              SELECT SUM(interview_count) as total
              FROM am_role_interviews
              WHERE role_id = ?
            `)
            .bind((role as any).id)
            .first();

          totalInterviews += (interviews as any)?.total || 0;
        }

        // Calculate health
        let health = "Average";
        const dealRate = totalRoles > 0 ? (dealRoles / totalRoles) * 100 : 0;
        const dropoutRate = totalRoles > 0 ? (dropoutCount / totalRoles) * 100 : 0;
        
        if (dealRate >= 30 && dropoutRate < 10) health = "Strong";
        else if (dealRate < 10 || dropoutRate > 30) health = "At Risk";

        return {
          id: client.id,
          name: client.name,
          client_code: client.client_code,
          total_roles: totalRoles,
          active_roles: activeRoles,
          interviews: totalInterviews,
          deals: dealRoles,
          dropouts: dropoutCount,
          health,
        };
      })
    );

    return c.json(clientAnalytics);
  } catch (error) {
    console.error("Error fetching client analytics:", error);
    return c.json({ error: "Failed to fetch client analytics" }, 500);
  }
});

// Get client analytics
app.get("/api/am/analytics", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  
  // Get date range from query params (default to current month)
  let startDate = c.req.query("start_date");
  let endDate = c.req.query("end_date");
  if (!startDate || !endDate) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    startDate = startOfMonth;
    endDate = endOfMonth;
  }

  try {
    // Get assigned clients
    const clients = await db
      .prepare(`
        SELECT c.* FROM clients c
        INNER JOIN client_assignments ca ON c.id = ca.client_id
        WHERE ca.user_id = ?
      `)
      .bind((amUser as any).id)
      .all();
    
    // Also get submission counts for clients from recruiter_submissions
    // const submissionCounts = await db
    //   .prepare(`
    //     SELECT client_id, COUNT(*) as submission_count
    //     FROM recruiter_submissions
    //     WHERE account_manager_id = ?
    //     ${startDate && endDate ? 'AND submission_date BETWEEN ? AND ?' : ''}
    //     GROUP BY client_id
    //   `)
    //   .bind((amUser as any).id, ...(startDate && endDate ? [startDate, endDate] : []))
    //   .all();

    const currentMonth = getCurrentMonth();
    const now = new Date();
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}`;

    const clientAnalytics = await Promise.all(
      (clients.results || []).map(async (client: any) => {
        // Get all roles for this client, filtered by date range if provided
        let rolesQuery = "SELECT * FROM am_roles WHERE client_id = ? AND account_manager_id = ?";
        const rolesParams: any[] = [client.id, (amUser as any).id];
        
        rolesQuery += " AND created_at BETWEEN ? AND ?";
        rolesParams.push(startDate, endDate + " 23:59:59");
        
        const roles = await db
          .prepare(rolesQuery)
          .bind(...rolesParams)
          .all();

        const allRoles = roles.results || [];
        const totalRoles = allRoles.length;
        const activeRoles = allRoles.filter((r: any) => r.status === "active").length;
        const dealRoles = allRoles.filter((r: any) => r.status === "deal").length;
        const lostRoles = allRoles.filter((r: any) => r.status === "lost").length;
        const onHoldRoles = allRoles.filter((r: any) => r.status === "on_hold").length;
        const cancelledRoles = allRoles.filter((r: any) => r.status === "cancelled").length;
        const noAnswerRoles = allRoles.filter((r: any) => r.status === "no_answer").length;

        // Calculate interview totals
        let totalInterviews = 0;
        let interview1Total = 0;
        let interview2Total = 0;
        let interview3Total = 0;

        for (const role of allRoles) {
          const interviews = await db
            .prepare(`
              SELECT interview_round, SUM(interview_count) as total
              FROM am_role_interviews
              WHERE role_id = ?
              GROUP BY interview_round
            `)
            .bind((role as any).id)
            .all();

          for (const interview of interviews.results || []) {
            const data = interview as any;
            const count = data.total;
            totalInterviews += count;
            if (data.interview_round === 1) interview1Total += count;
            if (data.interview_round === 2) interview2Total += count;
            if (data.interview_round === 3) interview3Total += count;
          }
        }

        // Monthly comparison
        const currentMonthRoles = allRoles.filter((r: any) => 
          r.created_at && r.created_at.startsWith(currentMonth)
        ).length;
        
        const lastMonthRoles = allRoles.filter((r: any) => 
          r.created_at && r.created_at.startsWith(lastMonth)
        ).length;

        const currentMonthDeals = allRoles.filter((r: any) => 
          r.status === "deal" && r.updated_at && r.updated_at.startsWith(currentMonth)
        ).length;

        const lastMonthDeals = allRoles.filter((r: any) => 
          r.status === "deal" && r.updated_at && r.updated_at.startsWith(lastMonth)
        ).length;

        const currentMonthLost = allRoles.filter((r: any) => 
          r.status === "lost" && r.updated_at && r.updated_at.startsWith(currentMonth)
        ).length;

        const lastMonthLost = allRoles.filter((r: any) => 
          r.status === "lost" && r.updated_at && r.updated_at.startsWith(lastMonth)
        ).length;

        // Calculate interviews (filter by date range if provided)
        let currentMonthInterviews = 0;
        let lastMonthInterviews = 0;

        for (const role of allRoles) {
          // For date range filtering, get interviews within that range (month granularity)
          const rangeInterviews = await db
            .prepare(`
              SELECT SUM(interview_count) as total
              FROM am_role_interviews
              WHERE role_id = ? AND entry_month BETWEEN ? AND ?
            `)
            .bind((role as any).id, startDate.substring(0, 7), endDate.substring(0, 7))
            .first();
          
          currentMonthInterviews += (rangeInterviews as any)?.total || 0;
        }

        // Conversion rates
        const rolesToDealConversion = totalRoles > 0 ? (dealRoles / totalRoles) * 100 : 0;
        const interviewToDealConversion = totalInterviews > 0 ? ((interview2Total + interview3Total + dealRoles) / totalInterviews) * 100 : 0;

        // Interview drop-off
        const stage1To2Dropoff = interview1Total > 0 ? ((interview1Total - interview2Total) / interview1Total) * 100 : 0;
        const stage2To3Dropoff = interview2Total > 0 ? ((interview2Total - interview3Total) / interview2Total) * 100 : 0;

        // Calculate health score (0-100)
        let healthScore = 0;
        
        // Positive factors
        if (totalRoles > 0) healthScore += 20;
        if (dealRoles > 0) healthScore += (dealRoles / Math.max(totalRoles, 1)) * 30;
        if (totalInterviews > 0) healthScore += 15;
        if (rolesToDealConversion > 20) healthScore += 20;
        if (currentMonthDeals > lastMonthDeals) healthScore += 10;
        
        // Negative factors
        if (lostRoles > dealRoles) healthScore -= 15;
        if (cancelledRoles > 3) healthScore -= 10;
        if (noAnswerRoles > 5) healthScore -= 10;
        if (activeRoles > 15 && dealRoles === 0) healthScore -= 20;
        
        healthScore = Math.max(0, Math.min(100, healthScore));

        // Determine health tag
        let healthTag = "Average Account";
        if (healthScore >= 70) healthTag = "Strong Account";
        else if (healthScore < 40) healthTag = "At Risk Account";

        // Risk indicators
        const highActiveRoleLowDeals = activeRoles > 10 && dealRoles < 2;
        const highInterviewsNoClosures = totalInterviews > 20 && dealRoles === 0;
        const consistentClosures = dealRoles >= 3 && currentMonthDeals > 0;
        const repeatedCancellations = cancelledRoles > 3;

        return {
          client_id: client.id,
          client_name: client.name,
          client_code: client.client_code,
          
          // Overview
          total_roles: totalRoles,
          active_roles: activeRoles,
          deal_roles: dealRoles,
          lost_roles: lostRoles,
          on_hold_roles: onHoldRoles,
          cancelled_roles: cancelledRoles,
          no_answer_roles: noAnswerRoles,
          
          // Interviews
          total_interviews: totalInterviews,
          interview_1_count: interview1Total,
          interview_2_count: interview2Total,
          interview_3_count: interview3Total,
          
          // Conversions
          roles_to_deal_conversion: Math.round(rolesToDealConversion * 10) / 10,
          interview_to_deal_conversion: Math.round(interviewToDealConversion * 10) / 10,
          stage_1_to_2_dropoff: Math.round(stage1To2Dropoff * 10) / 10,
          stage_2_to_3_dropoff: Math.round(stage2To3Dropoff * 10) / 10,
          
          // Monthly comparison
          current_month: {
            roles_created: currentMonthRoles,
            interviews: currentMonthInterviews,
            deals: currentMonthDeals,
            lost: currentMonthLost,
          },
          last_month: {
            roles_created: lastMonthRoles,
            interviews: lastMonthInterviews,
            deals: lastMonthDeals,
            lost: lastMonthLost,
          },
          
          // Growth
          roles_growth: lastMonthRoles > 0 ? Math.round(((currentMonthRoles - lastMonthRoles) / lastMonthRoles) * 100) : 0,
          interviews_growth: lastMonthInterviews > 0 ? Math.round(((currentMonthInterviews - lastMonthInterviews) / lastMonthInterviews) * 100) : 0,
          deals_growth: lastMonthDeals > 0 ? Math.round(((currentMonthDeals - lastMonthDeals) / lastMonthDeals) * 100) : 0,
          
          // Health
          health_score: Math.round(healthScore),
          health_tag: healthTag,
          
          // Risk indicators
          high_active_low_deals: highActiveRoleLowDeals,
          high_interviews_no_closures: highInterviewsNoClosures,
          consistent_closures: consistentClosures,
          repeated_cancellations: repeatedCancellations,
        };
      })
    );

    return c.json({
      clients: clientAnalytics,
      summary: {
        total_clients: clientAnalytics.length,
        strong_accounts: clientAnalytics.filter((c: any) => c.health_tag === "Strong Account").length,
        average_accounts: clientAnalytics.filter((c: any) => c.health_tag === "Average Account").length,
        at_risk_accounts: clientAnalytics.filter((c: any) => c.health_tag === "At Risk Account").length,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

// Get Performance Dashboard Data
app.get("/api/am/performance", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  
  const clientId = c.req.query("client_id");
  const teamId = c.req.query("team_id");
  const status = c.req.query("status");
  const dateRange = c.req.query("date_range");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Build date filter
    let dateFilter = "";
    let dateParams: any[] = [];
    
    if (startDate && endDate) {
      dateFilter = " AND created_at BETWEEN ? AND ?";
      dateParams = [startDate, endDate + " 23:59:59"];
    } else if (dateRange) {
      const now = new Date();
      if (dateRange === "this_week") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        dateFilter = " AND created_at >= ?";
        dateParams = [weekStart.toISOString().split('T')[0]];
      } else if (dateRange === "this_month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = " AND created_at >= ?";
        dateParams = [monthStart.toISOString().split('T')[0]];
      } else if (dateRange === "last_month") {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        dateFilter = " AND created_at BETWEEN ? AND ?";
        dateParams = [
          lastMonthStart.toISOString().split('T')[0],
          lastMonthEnd.toISOString().split('T')[0] + " 23:59:59"
        ];
      }
    }

    // Build role query
    let rolesQuery = "SELECT * FROM am_roles WHERE account_manager_id = ?";
    const rolesParams: any[] = [(amUser as any).id];
    
    if (clientId) {
      rolesQuery += " AND client_id = ?";
      rolesParams.push(clientId);
    }
    if (teamId) {
      rolesQuery += " AND team_id = ?";
      rolesParams.push(teamId);
    }
    if (status && status !== "all") {
      rolesQuery += " AND status = ?";
      rolesParams.push(status);
    }
    
    rolesQuery += dateFilter;
    rolesParams.push(...dateParams);

    const roles = await db.prepare(rolesQuery).bind(...rolesParams).all();
    const allRoles = roles.results || [];

    // Calculate overview metrics
    const totalRoles = allRoles.length;
    const activeRoles = allRoles.filter((r: any) => r.status === "active").length;
    const nonActiveRoles = totalRoles - activeRoles;
    const dealRoles = allRoles.filter((r: any) => r.status === "deal").length;
    const lostRoles = allRoles.filter((r: any) => r.status === "lost").length;
    const onHoldRoles = allRoles.filter((r: any) => r.status === "on_hold").length;
    const noAnswerRoles = allRoles.filter((r: any) => r.status === "no_answer").length;
    const cancelledRoles = allRoles.filter((r: any) => r.status === "cancelled").length;
    const dropoutRoles = allRoles.filter((r: any) => r.status === "dropout").length;

    // Calculate interview counts
    let interview1Count = 0;
    let interview2Count = 0;
    let interview3Count = 0;

    for (const role of allRoles) {
      const interviews = await db
        .prepare(`
          SELECT interview_round, SUM(interview_count) as total
          FROM am_role_interviews
          WHERE role_id = ?
          GROUP BY interview_round
        `)
        .bind((role as any).id)
        .all();

      for (const interview of interviews.results || []) {
        const data = interview as any;
        if (data.interview_round === 1) interview1Count += data.total;
        if (data.interview_round === 2) interview2Count += data.total;
        if (data.interview_round === 3) interview3Count += data.total;
      }
    }

    const totalInterviews = interview1Count + interview2Count + interview3Count;

    // Calculate EBES Score using centralized calculator
    const ebesData: AccountManagerEBESData = {
      total_roles: totalRoles,
      interview_1_count: interview1Count,
      interview_2_count: interview2Count,
      deal_roles: dealRoles,
      lost_roles: lostRoles,
      no_answer_roles: noAnswerRoles,
      on_hold_roles: onHoldRoles,
      cancelled_roles: cancelledRoles,
      dropout_roles: dropoutRoles,
      active_roles: activeRoles
    };

    const ebesResult = calculateAccountManagerEBES(ebesData);
    const cappedEbesScore = ebesResult.score;
    const performanceLabel = ebesResult.performance_label;

    // Monthly comparison
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0")}`;

    const currentMonthRoles = allRoles.filter((r: any) => 
      r.created_at && r.created_at.startsWith(currentMonth)
    ).length;
    
    const lastMonthRoles = allRoles.filter((r: any) => 
      r.created_at && r.created_at.startsWith(lastMonth)
    ).length;

    const currentMonthDeals = allRoles.filter((r: any) => 
      r.status === "deal" && r.updated_at && r.updated_at.startsWith(currentMonth)
    ).length;

    const lastMonthDeals = allRoles.filter((r: any) => 
      r.status === "deal" && r.updated_at && r.updated_at.startsWith(lastMonth)
    ).length;

    const currentMonthLost = allRoles.filter((r: any) => 
      r.status === "lost" && r.updated_at && r.updated_at.startsWith(currentMonth)
    ).length;

    const lastMonthLost = allRoles.filter((r: any) => 
      r.status === "lost" && r.updated_at && r.updated_at.startsWith(lastMonth)
    ).length;

    let currentMonthInterviews = 0;
    let lastMonthInterviews = 0;

    for (const role of allRoles) {
      const currentInterviews = await db
        .prepare(`
          SELECT SUM(interview_count) as total
          FROM am_role_interviews
          WHERE role_id = ? AND entry_month = ?
        `)
        .bind((role as any).id, currentMonth)
        .first();

      const lastInterviews = await db
        .prepare(`
          SELECT SUM(interview_count) as total
          FROM am_role_interviews
          WHERE role_id = ? AND entry_month = ?
        `)
        .bind((role as any).id, lastMonth)
        .first();

      currentMonthInterviews += (currentInterviews as any)?.total || 0;
      lastMonthInterviews += (lastInterviews as any)?.total || 0;
    }

    // Conversion rates
    const rolesToInterviewsConversion = totalRoles > 0 ? (totalInterviews / totalRoles) * 100 : 0;
    const interviewsToDealsConversion = totalInterviews > 0 ? (dealRoles / totalInterviews) * 100 : 0;

    // Client-wise performance
    const clientPerformance: any[] = [];
    const clientIds = [...new Set(allRoles.map((r: any) => r.client_id))];
    
    for (const cId of clientIds) {
      const clientRoles = allRoles.filter((r: any) => r.client_id === cId);
      const client = await db.prepare("SELECT * FROM clients WHERE id = ?").bind(cId).first();
      
      if (!client) continue;

      const clientTotalRoles = clientRoles.length;
      const clientActiveRoles = clientRoles.filter((r: any) => r.status === "active").length;
      const clientDeals = clientRoles.filter((r: any) => r.status === "deal").length;
      const clientLost = clientRoles.filter((r: any) => r.status === "lost").length;
      const clientOnHold = clientRoles.filter((r: any) => r.status === "on_hold").length;
      const clientNoAnswer = clientRoles.filter((r: any) => r.status === "no_answer").length;
      const clientCancelled = clientRoles.filter((r: any) => r.status === "cancelled").length;

      let clientInt1 = 0, clientInt2 = 0, clientInt3 = 0;
      for (const role of clientRoles) {
        const interviews = await db
          .prepare(`
            SELECT interview_round, SUM(interview_count) as total
            FROM am_role_interviews
            WHERE role_id = ?
            GROUP BY interview_round
          `)
          .bind((role as any).id)
          .all();

        for (const interview of interviews.results || []) {
          const data = interview as any;
          if (data.interview_round === 1) clientInt1 += data.total;
          if (data.interview_round === 2) clientInt2 += data.total;
          if (data.interview_round === 3) clientInt3 += data.total;
        }
      }

      // Calculate client health
      let health = "Average";
      const dealRate = clientTotalRoles > 0 ? (clientDeals / clientTotalRoles) * 100 : 0;
      if (dealRate >= 30 && clientActiveRoles > 0) health = "Strong";
      else if (dealRate < 10 && (clientLost > clientDeals || clientNoAnswer > 5)) health = "At Risk";

      clientPerformance.push({
        client_id: cId,
        client_name: (client as any).name,
        client_code: (client as any).client_code,
        total_roles: clientTotalRoles,
        active_roles: clientActiveRoles,
        interview_1: clientInt1,
        interview_2: clientInt2,
        interview_3: clientInt3,
        deals: clientDeals,
        lost: clientLost,
        on_hold: clientOnHold,
        no_answer: clientNoAnswer,
        cancelled: clientCancelled,
        health,
      });
    }

    // Team-wise performance
    const teamPerformance: any[] = [];
    const teamIds = [...new Set(allRoles.map((r: any) => r.team_id))];
    
    for (const tId of teamIds) {
      const teamRoles = allRoles.filter((r: any) => r.team_id === tId);
      const team = await db.prepare("SELECT * FROM app_teams WHERE id = ?").bind(tId).first();
      
      if (!team) continue;

      const teamTotalRoles = teamRoles.length;
      const teamActiveRoles = teamRoles.filter((r: any) => r.status === "active").length;
      const teamDeals = teamRoles.filter((r: any) => r.status === "deal").length;
      const teamLost = teamRoles.filter((r: any) => r.status === "lost").length;

      let teamInterviews = 0;
      for (const role of teamRoles) {
        const interviews = await db
          .prepare(`
            SELECT SUM(interview_count) as total
            FROM am_role_interviews
            WHERE role_id = ?
          `)
          .bind((role as any).id)
          .first();

        teamInterviews += (interviews as any)?.total || 0;
      }

      let performanceLabel = "Average";
      const teamDealRate = teamTotalRoles > 0 ? (teamDeals / teamTotalRoles) * 100 : 0;
      if (teamDealRate >= 30) performanceLabel = "Strong";
      else if (teamDealRate < 10) performanceLabel = "At Risk";

      teamPerformance.push({
        team_id: tId,
        team_name: (team as any).name,
        team_code: (team as any).team_code,
        total_roles: teamTotalRoles,
        active_roles: teamActiveRoles,
        total_interviews: teamInterviews,
        total_deals: teamDeals,
        total_lost: teamLost,
        performance_label: performanceLabel,
      });
    }

    return c.json({
      overview: {
        total_roles: totalRoles,
        active_roles: activeRoles,
        non_active_roles: nonActiveRoles,
        total_interviews: totalInterviews,
        interview_1_count: interview1Count,
        interview_2_count: interview2Count,
        interview_3_count: interview3Count,
        total_deals: dealRoles,
        total_lost: lostRoles,
        total_on_hold: onHoldRoles,
        total_no_answer: noAnswerRoles,
        total_cancelled: cancelledRoles,
        total_dropouts: dropoutRoles,
        ebes_score: Math.round(cappedEbesScore * 10) / 10,
        performance_label: performanceLabel,
        current_month: {
          roles: currentMonthRoles,
          interviews: currentMonthInterviews,
          deals: currentMonthDeals,
          lost: currentMonthLost,
        },
        last_month: {
          roles: lastMonthRoles,
          interviews: lastMonthInterviews,
          deals: lastMonthDeals,
          lost: lastMonthLost,
        },
        roles_to_interviews_conversion: Math.round(rolesToInterviewsConversion * 10) / 10,
        interviews_to_deals_conversion: Math.round(interviewsToDealsConversion * 10) / 10,
      },
      client_performance: clientPerformance,
      team_performance: teamPerformance,
    });
  } catch (error) {
    console.error("Error fetching performance data:", error);
    return c.json({ error: "Failed to fetch performance data" }, 500);
  }
});

// Role aging and SLA metrics
app.get("/api/am/aging", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");

  const clientId = c.req.query("client_id");
  const teamId = c.req.query("team_id");
  const status = c.req.query("status") || "active";

  try {
    let query = `
      SELECT r.*
      FROM am_roles r
      WHERE r.account_manager_id = ?
    `;
    const params: any[] = [(amUser as any).id];

    if (clientId) {
      query += " AND r.client_id = ?";
      params.push(parseInt(clientId));
    }
    if (teamId) {
      query += " AND r.team_id = ?";
      params.push(parseInt(teamId));
    }
    if (status === "active") {
      query += " AND r.status = 'active'";
    }

    const rolesRes = await db.prepare(query).bind(...params).all();
    const roles = rolesRes.results || [];

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const items: any[] = [];
    let daysOpenSum = 0;
    let firstSubSum = 0;
    let firstIntSum = 0;
    let firstSubCount = 0;
    let firstIntCount = 0;
    let over14 = 0;
    let over30 = 0;

    for (const role of roles) {
      const r = role as any;
      const createdAt = new Date(r.created_at).getTime();
      const daysOpen = Math.max(0, Math.floor((now - createdAt) / dayMs));
      daysOpenSum += daysOpen;
      if (daysOpen >= 14) over14++;
      if (daysOpen >= 30) over30++;

      const firstSubmission = await db
        .prepare(`SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND entry_type = 'submission' ORDER BY submission_date ASC LIMIT 1`)
        .bind(r.id)
        .first();
      let firstSubmissionDays = null as number | null;
      if (firstSubmission) {
        const subDate = new Date((firstSubmission as any).submission_date).getTime();
        firstSubmissionDays = Math.max(0, Math.floor((subDate - createdAt) / dayMs));
        firstSubSum += firstSubmissionDays;
        firstSubCount++;
      }

      const firstInterview = await db
        .prepare(`SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND entry_type = 'interview' ORDER BY submission_date ASC LIMIT 1`)
        .bind(r.id)
        .first();
      let firstInterviewDays = null as number | null;
      if (firstInterview) {
        const intDate = new Date((firstInterview as any).submission_date).getTime();
        firstInterviewDays = Math.max(0, Math.floor((intDate - createdAt) / dayMs));
        firstIntSum += firstInterviewDays;
        firstIntCount++;
      }

      const dropoutRequest = await db
        .prepare("SELECT am_decision FROM dropout_requests WHERE role_id = ? AND final_status = 'completed' ORDER BY am_decided_at DESC LIMIT 1")
        .bind(r.id)
        .first();

      items.push({
        id: r.id,
        role_code: r.role_code,
        title: r.title,
        status: r.status,
        days_open: daysOpen,
        first_submission_days: firstSubmissionDays,
        first_interview_days: firstInterviewDays,
        has_dropout: !!dropoutRequest,
        dropout_decision: dropoutRequest ? (dropoutRequest as any).am_decision : null,
      });
    }

    items.sort((a, b) => b.days_open - a.days_open);

    const avgDaysOpen = roles.length > 0 ? Math.round((daysOpenSum / roles.length) * 10) / 10 : 0;
    const avgFirstSubmission = firstSubCount > 0 ? Math.round((firstSubSum / firstSubCount) * 10) / 10 : 0;
    const avgFirstInterview = firstIntCount > 0 ? Math.round((firstIntSum / firstIntCount) * 10) / 10 : 0;

    return c.json({
      metrics: {
        avg_days_open: avgDaysOpen,
        roles_over_14: over14,
        roles_over_30: over30,
        avg_time_to_first_submission: avgFirstSubmission,
        avg_time_to_first_interview: avgFirstInterview,
      },
      roles: items,
    });
  } catch (error) {
    console.error("Error fetching aging metrics:", error);
    return c.json({ error: "Failed to fetch aging metrics" }, 500);
  }
});

// Get pending dropout requests for AM (acknowledged by RM)
app.get("/api/am/dropout-requests", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");

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
          u_rm.name as rm_name
        FROM dropout_requests dr
        INNER JOIN am_roles r ON dr.role_id = r.id
        INNER JOIN clients c ON r.client_id = c.id
        INNER JOIN users u_recruiter ON dr.recruiter_user_id = u_recruiter.id
        LEFT JOIN users u_rm ON dr.rm_user_id = u_rm.id
        WHERE dr.am_user_id = ? AND dr.rm_status = 'acknowledged' AND dr.am_decision IS NULL
        ORDER BY dr.rm_acknowledged_at DESC
      `)
      .bind((amUser as any).id)
      .all();

    return c.json(requests.results || []);
  } catch (error) {
    console.error("Error fetching dropout requests:", error);
    return c.json({ error: "Failed to fetch dropout requests" }, 500);
  }
});

// AM decides on dropout request
app.put("/api/am/dropout-requests/:id/decide", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const requestId = c.req.param("id");
  const { decision, new_role_status } = await c.req.json();

  // Validate decision
  if (!['accept', 'ignore'].includes(decision)) {
    return c.json({ error: "Decision must be 'accept' or 'ignore'" }, 400);
  }

  // Note: For both accept and ignore, new_role_status is now optional
  // If not provided, we'll keep the current status or set a default

  try {
    // Verify request belongs to this AM
    const request = await db
      .prepare("SELECT * FROM dropout_requests WHERE id = ? AND am_user_id = ?")
      .bind(requestId, (amUser as any).id)
      .first();

    if (!request) {
      return c.json({ error: "Dropout request not found" }, 404);
    }

    const req = request as any;

    // Update dropout request with AM decision
    await db
      .prepare(`
        UPDATE dropout_requests 
        SET am_decision = ?,
            am_new_role_status = ?,
            am_decided_at = datetime('now'),
            final_status = 'completed',
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(decision, new_role_status || null, requestId)
      .run();

    // Update role status based on decision
    if (decision === 'accept') {
      // Accept: keep role active for rework unless AM explicitly sets a non-active status
      const proposed = new_role_status || 'active';
      const finalStatus = proposed === 'dropout' ? 'active' : proposed;
      await db
        .prepare("UPDATE am_roles SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(finalStatus, req.role_id)
        .run();
      
      // Notify recruiter about accepted dropout
      await createNotification(db, {
        userId: req.recruiter_user_id,
        type: 'dropout',
        title: 'Dropout Accepted',
        message: `Your dropout request was accepted by the Account Manager. Role remains ${finalStatus}.`,
        relatedEntityType: 'role',
        relatedEntityId: req.role_id
      });
    } else if (decision === 'ignore') {
      // Ignore: keep role active for rework unless AM explicitly sets a non-active status
      const proposed = new_role_status || 'active';
      const finalStatus = proposed === 'dropout' ? 'active' : proposed;
      await db
        .prepare("UPDATE am_roles SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(finalStatus, req.role_id)
        .run();
      
      // Notify recruiter about ignored dropout
      await createNotification(db, {
        userId: req.recruiter_user_id,
        type: 'system',
        title: 'Dropout Ignored',
        message: `Your dropout request was reviewed. Role remains ${finalStatus}.`,
        relatedEntityType: 'role',
        relatedEntityId: req.role_id
      });
    }

    // Notify RM about AM decision
    if (req.rm_user_id) {
      await createNotification(db, {
        userId: req.rm_user_id,
        type: 'system',
        title: 'Dropout Decision Made',
        message: `AM ${decision === 'accept' ? 'accepted' : 'ignored'} the dropout request for role ${req.role_id}.`,
        relatedEntityType: 'role',
        relatedEntityId: req.role_id
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deciding on dropout:", error);
    return c.json({ error: "Failed to process decision" }, 500);
  }
});

// Get EBES Score for Account Manager
app.get("/api/am/ebes-score", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  
  // Get date range from query params
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Count new roles created in the date range
    let newRolesCount = 0;
    if (startDate && endDate) {
      const newRoles = await db
        .prepare("SELECT COUNT(*) as total FROM am_roles WHERE account_manager_id = ? AND created_at BETWEEN ? AND ?")
        .bind((amUser as any).id, startDate, endDate + " 23:59:59")
        .first();
      newRolesCount = (newRoles as any)?.total || 0;
    } else {
      const newRoles = await db
        .prepare("SELECT COUNT(*) as total FROM am_roles WHERE account_manager_id = ?")
        .bind((amUser as any).id)
        .first();
      newRolesCount = (newRoles as any)?.total || 0;
    }

    // Count role statuses — use updated_at window when date range provided, otherwise current status totals
    let activeRoles = 0;
    let dealRoles = 0;
    let lostRoles = 0;
    let noAnswerRoles = 0;
    let onHoldRoles = 0;
    let cancelledRoles = 0;
    let dropoutRoles = 0;

    if (startDate && endDate) {
      const statusRows = await db
        .prepare(`
          SELECT status, COUNT(*) as total
          FROM am_roles
          WHERE account_manager_id = ?
            AND updated_at BETWEEN ? AND ?
          GROUP BY status
        `)
        .bind((amUser as any).id, startDate, endDate + " 23:59:59")
        .all();
      for (const row of statusRows.results || []) {
        const s = (row as any).status as string;
        const t = (row as any).total as number;
        if (s === "active") activeRoles = t;
        else if (s === "deal") dealRoles = t;
        else if (s === "lost") lostRoles = t;
        else if (s === "no_answer") noAnswerRoles = t;
        else if (s === "on_hold") onHoldRoles = t;
        else if (s === "cancelled") cancelledRoles = t;
        else if (s === "dropout") dropoutRoles = t;
      }
    } else {
      const statusRows = await db
        .prepare(`
          SELECT status, COUNT(*) as total
          FROM am_roles
          WHERE account_manager_id = ?
          GROUP BY status
        `)
        .bind((amUser as any).id)
        .all();
      for (const row of statusRows.results || []) {
        const s = (row as any).status as string;
        const t = (row as any).total as number;
        if (s === "active") activeRoles = t;
        else if (s === "deal") dealRoles = t;
        else if (s === "lost") lostRoles = t;
        else if (s === "no_answer") noAnswerRoles = t;
        else if (s === "on_hold") onHoldRoles = t;
        else if (s === "cancelled") cancelledRoles = t;
        else if (s === "dropout") dropoutRoles = t;
      }
    }

    // Calculate interview counts across AM roles
    let interview1Count = 0;
    let interview2Count = 0;

    const rolesForInterviews = await db
      .prepare("SELECT id FROM am_roles WHERE account_manager_id = ?")
      .bind((amUser as any).id)
      .all();
    for (const role of rolesForInterviews.results || []) {
      let interviewQuery = `
        SELECT interview_round, SUM(interview_count) as total
        FROM am_role_interviews
        WHERE role_id = ?
      `;
      const interviewParams: any[] = [(role as any).id];

      if (startDate && endDate) {
        interviewQuery += " AND entry_month BETWEEN ? AND ?";
        interviewParams.push(startDate.substring(0, 7), endDate.substring(0, 7));
      }

      interviewQuery += " GROUP BY interview_round";

      const interviews = await db
        .prepare(interviewQuery)
        .bind(...interviewParams)
        .all();

      for (const interview of interviews.results || []) {
        const data = interview as any;
        const count = data.total;
        if (data.interview_round === 1) interview1Count += count;
        if (data.interview_round === 2) interview2Count += count;
      }
    }

    // Calculate EBES Score using centralized calculator
    const ebesData: AccountManagerEBESData = {
      total_roles: newRolesCount,
      interview_1_count: interview1Count,
      interview_2_count: interview2Count,
      deal_roles: dealRoles,
      lost_roles: lostRoles,
      no_answer_roles: noAnswerRoles,
      on_hold_roles: onHoldRoles,
      cancelled_roles: cancelledRoles,
      dropout_roles: dropoutRoles,
      active_roles: activeRoles
    };

    const ebesResult = calculateAccountManagerEBES(ebesData);

    return c.json({
      score: ebesResult.score,
      performance_label: ebesResult.performance_label,
    });
  } catch (error) {
    console.error("Error calculating EBES score:", error);
    return c.json({ error: "Failed to calculate EBES score" }, 500);
  }
});

// Role submissions for AM
app.get("/api/am/role-submissions/:roleId", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");

  const role = await db.prepare("SELECT account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db.prepare(`
    SELECT 
      cra.id as association_id,
      cra.candidate_id,
      c.candidate_code as candidate_code,
      c.name as candidate_name,
      c.email as candidate_email,
      c.phone as candidate_phone,
      c.resume_url as candidate_resume_url,
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
      rs.am_notes,
      rs.am_reviewed_at
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
  return c.json({
    under_consideration: results.filter((r: any) => (r as any).is_discarded !== 1 && (r as any).association_status !== 'client_rejected'),
    rejected: results.filter((r: any) => (r as any).is_discarded === 1 || (r as any).association_status === 'client_rejected'),
  });
});

// AM discard candidate submission
app.post("/api/am/roles/:roleId/candidates/:candidateId/discard", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const roleId = c.req.param("roleId");
  const candidateId = c.req.param("candidateId");
  const { reason } = await c.req.json();

  const role = await db.prepare("SELECT account_manager_id FROM am_roles WHERE id = ?").bind(roleId).first();
  if (!role) return c.json({ error: "Role not found" }, 404);
  if ((role as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE candidate_role_associations
    SET is_discarded = 1,
        discarded_reason = COALESCE(?, 'Discarded by AM'),
        discarded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND candidate_id = ? AND is_discarded = 0
  `).bind(reason || null, roleId, candidateId).run();

  return c.json({ success: true });
});

// AM review/update submission notes
app.put("/api/am/submissions/:id/review", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");
  const id = c.req.param("id");
  const body = await c.req.json();

  const sub = await db.prepare(`
    SELECT rs.*, ar.account_manager_id 
    FROM recruiter_submissions rs 
    LEFT JOIN am_roles ar ON rs.role_id = ar.id
    WHERE rs.id = ? AND rs.entry_type = 'submission'
  `).bind(id).first();
  if (!sub) return c.json({ error: "Submission not found" }, 404);
  if ((sub as any).account_manager_id !== (amUser as any).id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.prepare(`
    UPDATE recruiter_submissions SET
      am_notes = COALESCE(?, am_notes),
      am_reviewed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(body.am_notes || null, id).run();

  return c.json({ success: true });
});

// AM daily custom report
app.get("/api/am/reports/daily", amOnly, async (c) => {
  const db = c.env.DB;
  const amUser = c.get("amUser");

  const countsFor = async (offset: string) => {
    const rolesCreated = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND DATE(created_at) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const submissions = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations cra INNER JOIN am_roles ar ON cra.role_id = ar.id WHERE ar.account_manager_id = ? AND cra.is_discarded = 0 AND DATE(cra.submission_date) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const forwardedToClient = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations cra INNER JOIN am_roles ar ON cra.role_id = ar.id WHERE ar.account_manager_id = ? AND cra.status = 'client_submitted' AND cra.is_discarded = 0 AND DATE(cra.updated_at) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const clientRejected = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations cra INNER JOIN am_roles ar ON cra.role_id = ar.id WHERE ar.account_manager_id = ? AND cra.status = 'client_rejected' AND cra.is_discarded = 0 AND DATE(cra.updated_at) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const deals = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations cra INNER JOIN am_roles ar ON cra.role_id = ar.id WHERE ar.account_manager_id = ? AND cra.status = 'deal' AND DATE(cra.updated_at) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const discarded = await db.prepare(`SELECT COUNT(*) as c FROM candidate_role_associations cra INNER JOIN am_roles ar ON cra.role_id = ar.id WHERE ar.account_manager_id = ? AND cra.is_discarded = 1 AND DATE(cra.discarded_at) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const interviews = await db.prepare(`SELECT COUNT(*) as c FROM recruiter_submissions rs INNER JOIN am_roles ar ON rs.role_id = ar.id WHERE ar.account_manager_id = ? AND rs.entry_type = 'interview' AND DATE(rs.submission_date) = DATE('now', ?)`)
      .bind((amUser as any).id, offset).first();
    const rolesStatusDeal = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND status = 'deal' AND DATE(updated_at) = DATE('now', ?)`).bind((amUser as any).id, offset).first();
    const rolesStatusLost = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND status = 'lost' AND DATE(updated_at) = DATE('now', ?)`).bind((amUser as any).id, offset).first();
    const rolesStatusOnHold = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND status = 'on_hold' AND DATE(updated_at) = DATE('now', ?)`).bind((amUser as any).id, offset).first();
    const rolesStatusCancelled = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND status = 'cancelled' AND DATE(updated_at) = DATE('now', ?)`).bind((amUser as any).id, offset).first();
    const rolesStatusNoAnswer = await db.prepare(`SELECT COUNT(*) as c FROM am_roles WHERE account_manager_id = ? AND status = 'no_answer' AND DATE(updated_at) = DATE('now', ?)`).bind((amUser as any).id, offset).first();

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

app.get("/api/am/ledger/export", amOnly, async (c) => {
  try {
    const db = c.env.DB;
    const amUser = c.get("amUser");
    const dateRange = c.req.query("date_range") || "month";
    const startDateParam = c.req.query("start_date");
    const endDateParam = c.req.query("end_date");
    const eventTypeParam = c.req.query("event_type");
    const statusFilterParam = c.req.query("status");
    const searchParam = c.req.query("search");
    const formatParam = c.req.query("format") || "csv";
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
    const allowedEventTypes = ["submitted", "client_submitted", "client_rejected", "interview", "deal", "discarded", "dropout"];
    const eventType = eventTypeParam && allowedEventTypes.includes(eventTypeParam) ? eventTypeParam : null;
    const statusFilter = statusFilterParam && ["in_play", "positive", "negative"].includes(statusFilterParam) ? statusFilterParam : null;
    const search = searchParam ? String(searchParam).trim() : "";
    const craBaseParams: any[] = [(amUser as any).id];
    let craWhere = "r.account_manager_id = ? AND cra.is_discarded = 0";
    let craDateClause = " AND ((cra.status = 'submitted' AND DATE(cra.updated_at) BETWEEN ? AND ?) OR (cra.status IN ('client_submitted','client_rejected') AND DATE(cra.updated_at) BETWEEN ? AND ?))";
    let craDateParams: any[] = [startDate, endDate, startDate, endDate];
    if (eventType && ["submitted", "client_submitted", "client_rejected"].includes(eventType)) {
      craDateClause = " AND (cra.status = ? AND DATE(cra.updated_at) BETWEEN ? AND ?)";
      craDateParams = [eventType, startDate, endDate];
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
              DATE(cra.updated_at) as event_date,
              cra.status as event_type,
              c.name as candidate_name,
              r.title as role_title,
              r.role_code as role_code,
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
          .bind(...craBaseParams, ...craDateParams, ...craSearchParams)
          .all();
    const discardedParams: any[] = [(amUser as any).id, startDate, endDate];
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
          r.title as role_title,
          r.role_code as role_code,
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
        WHERE r.account_manager_id = ? AND cra.is_discarded = 1 AND DATE(cra.discarded_at) BETWEEN ? AND ?${discardedSearchClause}
        ORDER BY cra.discarded_at DESC
        `
      )
      .bind(...discardedParams, ...discardedSearchParams)
      .all();
    const rsBaseParams: any[] = [(amUser as any).id, startDate, endDate];
    let rsWhere = "ar.account_manager_id = ? AND DATE(rs.submission_date) BETWEEN ? AND ?";
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
    const dropoutParams: any[] = [(amUser as any).id, startDate, endDate];
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
          DATE(COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at)) as event_date,
          'dropout' as event_type,
          NULL as candidate_name,
          ar.title as role_title,
          ar.role_code as role_code,
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
        WHERE dr.am_user_id = ? AND DATE(COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at)) BETWEEN ? AND ?${dropoutSearchClause}
        ORDER BY COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at) DESC
        `
      )
      .bind(...dropoutParams, ...dropoutSearchParams)
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
    if (statusFilter === "in_play") {
      allEvents = allEvents.filter((e) => e.event_type === "submitted" || e.event_type === "interview");
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
    const headers = ["Date", "Event", "Candidate", "Role", "Client", "Team", "SubmissionType", "InterviewLevel", "CVMatchPercent", "Notes"];
    const rows = allEvents.map((e) => [
      e.event_date || "",
      e.event_type || "",
      (e.candidate_name || "").replace(/,/g, " "),
      ((e.role_title || "") + (e.role_code ? ` (${e.role_code})` : "")).replace(/,/g, " "),
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
          "Content-Disposition": `attachment; filename="am-submissions-ledger.xls"`
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
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>AM Submissions Ledger</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto;font-size:12px;color:#111;padding:16px} h2{margin:0 0 12px} table{border-collapse:collapse;width:100%}</style></head><body><h2>Account Manager Submissions Ledger</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table><script>window.onload=function(){window.print&&window.print();}</script></body></html>`;
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="am-submissions-ledger.html"`
        }
      });
    }
    const csv = [headers.join(","), ...rows].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="am-submissions-ledger.csv"`
      }
    });
  } catch (error: any) {
    console.error("AM Ledger export failed:", error);
    return c.json({ error: "Failed to export AM ledger" }, 500);
  }
});

app.get("/api/am/ledger", amOnly, async (c) => {
  try {
    const db = c.env.DB;
    const amUser = c.get("amUser");
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
    const allowedEventTypes = ["submitted", "client_submitted", "client_rejected", "interview", "deal", "discarded", "dropout"];
    const eventType = eventTypeParam && allowedEventTypes.includes(eventTypeParam) ? eventTypeParam : null;
    const statusFilter = statusFilterParam && ["in_play", "positive", "negative"].includes(statusFilterParam) ? statusFilterParam : null;
    const search = searchParam ? String(searchParam).trim() : "";
    const sortByParam = c.req.query("sort_by");
    const sortOrderParam = c.req.query("sort_order") || "desc";
    const pageParam = c.req.query("page");
    const pageSizeParam = c.req.query("page_size");
    const allowedSortBy = ["event_date", "event_type", "candidate_name", "role_title", "client_name", "team_name"];
    const sortBy = sortByParam && allowedSortBy.includes(sortByParam) ? sortByParam : "event_date";
    const sortDesc = String(sortOrderParam).toLowerCase() !== "asc";
    const page = Math.max(1, parseInt(String(pageParam || "1"), 10));
    const pageSize = Math.max(1, parseInt(String(pageSizeParam || "25"), 10));
    const craBaseParams: any[] = [(amUser as any).id];
    let craWhere = "r.account_manager_id = ? AND cra.is_discarded = 0";
    let craDateClause = " AND ((cra.status = 'submitted' AND DATE(cra.updated_at) BETWEEN ? AND ?) OR (cra.status IN ('client_submitted','client_rejected') AND DATE(cra.updated_at) BETWEEN ? AND ?))";
    let craDateParams: any[] = [startDate, endDate, startDate, endDate];
    if (eventType && ["submitted", "client_submitted", "client_rejected"].includes(eventType)) {
      craDateClause = " AND (cra.status = ? AND DATE(cra.updated_at) BETWEEN ? AND ?)";
      craDateParams = [eventType, startDate, endDate];
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
              DATE(cra.updated_at) as event_date,
              cra.status as event_type,
              c.name as candidate_name,
              r.title as role_title,
              r.role_code as role_code,
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
          .bind(...craBaseParams, ...craDateParams, ...craSearchParams)
          .all();
    const discardedParams: any[] = [(amUser as any).id, startDate, endDate];
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
          r.title as role_title,
          r.role_code as role_code,
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
        WHERE r.account_manager_id = ? AND cra.is_discarded = 1 AND DATE(cra.discarded_at) BETWEEN ? AND ?${discardedSearchClause}
        ORDER BY cra.discarded_at DESC
        `
      )
      .bind(...discardedParams, ...discardedSearchParams)
      .all();
    const rsBaseParams: any[] = [(amUser as any).id, startDate, endDate];
    let rsWhere = "ar.account_manager_id = ? AND DATE(rs.submission_date) BETWEEN ? AND ?";
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
    const dropoutParams: any[] = [(amUser as any).id, startDate, endDate];
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
          DATE(COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at)) as event_date,
          'dropout' as event_type,
          NULL as candidate_name,
          ar.title as role_title,
          ar.role_code as role_code,
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
        WHERE dr.am_user_id = ? AND DATE(COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at)) BETWEEN ? AND ?${dropoutSearchClause}
        ORDER BY COALESCE(dr.am_decided_at, dr.rm_acknowledged_at, dr.created_at) DESC
        `
      )
      .bind(...dropoutParams, ...dropoutSearchParams)
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
    if (statusFilter === "in_play") {
      allEvents = allEvents.filter((e) => e.event_type === "submitted" || e.event_type === "interview");
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
    console.error("AM Ledger read failed:", error);
    return c.json({ error: "Failed to read AM ledger" }, 500);
  }
});

export default app;
