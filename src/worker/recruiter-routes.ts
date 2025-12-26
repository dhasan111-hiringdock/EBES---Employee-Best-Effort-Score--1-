import { Hono } from "hono";
import { createNotification } from "./notification-routes";
import { z } from "zod";
import { calculateRecruiterEBES, type RecruiterEBESData } from "./ebes-calculator";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to verify Recruiter role
const recruiterOnly = async (c: any, next: any) => {
  const db = c.env.DB;
  const userId = c.req.header("x-user-id");

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'recruiter' AND is_active = 1")
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ error: "Unauthorized - Recruiter only" }, 403);
  }

  c.set("recruiterUser", user);
  await next();
};

// Get assigned clients for recruiter
app.get("/api/recruiter/clients", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");

  try {
    const assignments = await db
      .prepare(`
        SELECT c.*, t.id as team_id, t.name as team_name, t.team_code
        FROM recruiter_client_assignments rca
        INNER JOIN clients c ON rca.client_id = c.id
        INNER JOIN app_teams t ON rca.team_id = t.id
        WHERE rca.recruiter_user_id = ? AND c.is_active = 1
      `)
      .bind((recruiterUser as any).id)
      .all();

    return c.json(assignments.results || []);
  } catch (error) {
    console.error("Error fetching recruiter clients:", error);
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
});

// Get assigned teams for recruiter
app.get("/api/recruiter/teams", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");

  try {
    const teams = await db
      .prepare(`
        SELECT DISTINCT t.*
        FROM app_teams t
        INNER JOIN recruiter_team_assignments rta ON t.id = rta.team_id
        WHERE rta.recruiter_user_id = ? AND t.is_active = 1
        ORDER BY t.name
      `)
      .bind((recruiterUser as any).id)
      .all();

    return c.json(teams.results || []);
  } catch (error) {
    console.error("Error fetching recruiter teams:", error);
    return c.json({ error: "Failed to fetch teams" }, 500);
  }
});

// Get active roles for a client and team
app.get("/api/recruiter/roles/:clientId/:teamId", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const clientId = c.req.param("clientId");
  const teamId = c.req.param("teamId");

  try {
    const roles = await db
      .prepare(`
        SELECT r.*, u.name as account_manager_name
        FROM am_roles r
        INNER JOIN users u ON r.account_manager_id = u.id
        WHERE r.client_id = ? AND r.team_id = ? AND r.status = 'active'
        ORDER BY r.created_at DESC
      `)
      .bind(clientId, teamId)
      .all();

    return c.json(roles.results || []);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return c.json({ error: "Failed to fetch roles" }, 500);
  }
});

// Get recruiter's team and managers info
app.get("/api/recruiter/team-info", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");

  try {
    // Get recruiter's team assignment
    const teamAssignment = await db
      .prepare(`
        SELECT t.id, t.name, t.team_code
        FROM recruiter_team_assignments rta
        INNER JOIN app_teams t ON rta.team_id = t.id
        WHERE rta.recruiter_user_id = ?
        LIMIT 1
      `)
      .bind((recruiterUser as any).id)
      .first();

    if (!teamAssignment) {
      return c.json({ error: "No team assigned" }, 404);
    }

    // Get recruitment manager for this team
    const recruitmentManager = await db
      .prepare(`
        SELECT u.id, u.name, u.email, u.user_code
        FROM users u
        INNER JOIN team_assignments ta ON u.id = ta.user_id
        WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
        LIMIT 1
      `)
      .bind((teamAssignment as any).id)
      .first();

    return c.json({
      team: teamAssignment,
      recruitment_manager: recruitmentManager || null,
    });
  } catch (error) {
    console.error("Error fetching team info:", error);
    return c.json({ error: "Failed to fetch team info" }, 500);
  }
});

// Pipeline metrics and SLA/focus for recruiter
app.get("/api/recruiter/pipeline", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const clientId = c.req.query("client_id");

  try {
    // Stage counts
    const submissionsRes = await db
      .prepare(`SELECT COUNT(*) as count FROM recruiter_submissions WHERE recruiter_user_id = ? ${clientId ? 'AND client_id = ?' : ''} AND entry_type = 'submission'`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();
    const interviews1Res = await db
      .prepare(`SELECT COUNT(*) as count FROM recruiter_submissions WHERE recruiter_user_id = ? ${clientId ? 'AND client_id = ?' : ''} AND entry_type = 'interview' AND interview_level = 1`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();
    const interviews2Res = await db
      .prepare(`SELECT COUNT(*) as count FROM recruiter_submissions WHERE recruiter_user_id = ? ${clientId ? 'AND client_id = ?' : ''} AND entry_type = 'interview' AND interview_level = 2`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();
    const interviews3Res = await db
      .prepare(`SELECT COUNT(*) as count FROM recruiter_submissions WHERE recruiter_user_id = ? ${clientId ? 'AND client_id = ?' : ''} AND entry_type = 'interview' AND interview_level = 3`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();
    const dealsRes = await db
      .prepare(`SELECT COUNT(*) as count FROM recruiter_submissions WHERE recruiter_user_id = ? ${clientId ? 'AND client_id = ?' : ''} AND entry_type = 'deal'`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();
    const dropoutsRes = await db
      .prepare(`SELECT COUNT(*) as count FROM dropout_requests WHERE recruiter_user_id = ? ${clientId ? 'AND role_id IN (SELECT id FROM am_roles WHERE client_id = ?)' : ''}`)
      .bind(...([ (recruiterUser as any).id ].concat(clientId ? [parseInt(clientId)] : [])))
      .first();

    // SLA calculations: roles with no submission/interview in last 7 days
    const rolesBaseQuery = `SELECT r.id, r.title, r.role_code, r.created_at FROM am_roles r WHERE r.status = 'active' ${clientId ? 'AND r.client_id = ?' : ''}`;
    const rolesBaseParams: any[] = clientId ? [parseInt(clientId)] : [];
    const rolesRes = await db.prepare(rolesBaseQuery).bind(...rolesBaseParams).all();
    const roles = rolesRes.results || [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let rolesNoSubmission7d = 0;
    let rolesNoInterview7d = 0;
    const focus: any[] = [];

    for (const role of roles) {
      const r = role as any;
      const latestSubmission = await db
        .prepare(`SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND recruiter_user_id = ? AND entry_type = 'submission' ORDER BY submission_date DESC LIMIT 1`)
        .bind(r.id, (recruiterUser as any).id)
        .first();
      const latestInterview = await db
        .prepare(`SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND recruiter_user_id = ? AND entry_type = 'interview' ORDER BY submission_date DESC LIMIT 1`)
        .bind(r.id, (recruiterUser as any).id)
        .first();

      if (!latestSubmission || ((latestSubmission as any).submission_date < sevenDaysAgo)) {
        rolesNoSubmission7d++;
        if (focus.length < 5) focus.push({ role_id: r.id, role_code: r.role_code, title: r.title, reason: 'No submission ≥7d' });
      } else if (!latestInterview || ((latestInterview as any).submission_date < sevenDaysAgo)) {
        rolesNoInterview7d++;
        if (focus.length < 5) focus.push({ role_id: r.id, role_code: r.role_code, title: r.title, reason: 'No interview ≥7d' });
      }

      const lastDropout = await db
        .prepare(`SELECT am_decision FROM dropout_requests WHERE role_id = ? AND recruiter_user_id = ? ORDER BY created_at DESC LIMIT 1`)
        .bind(r.id, (recruiterUser as any).id)
        .first();
      if ((lastDropout as any)?.am_decision === 'accept' && focus.length < 5) {
        focus.push({ role_id: r.id, role_code: r.role_code, title: r.title, reason: 'Dropout accepted – rework' });
      }
    }

    return c.json({
      counts: {
        submissions: (submissionsRes as any)?.count || 0,
        interview_1: (interviews1Res as any)?.count || 0,
        interview_2: (interviews2Res as any)?.count || 0,
        interview_3: (interviews3Res as any)?.count || 0,
        deals: (dealsRes as any)?.count || 0,
        dropouts: (dropoutsRes as any)?.count || 0,
      },
      sla: {
        roles_no_submission_7d: rolesNoSubmission7d,
        roles_no_interview_7d: rolesNoInterview7d,
      },
      focus,
    });
  } catch (error) {
    console.error("Error fetching pipeline metrics:", error);
    return c.json({ error: "Failed to fetch pipeline metrics" }, 500);
  }
});

// Get roles with deals (for dropout selection)
app.get("/api/recruiter/deal-roles", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");

  try {
    const clientIdParam = c.req.query("client_id");
    const teamIdParam = c.req.query("team_id");

    let where = "r.status = 'deal'";
    const params: any[] = [];

    if (clientIdParam) {
      where += " AND r.client_id = ?";
      params.push(parseInt(clientIdParam));
    }

    if (teamIdParam) {
      where += " AND r.team_id = ?";
      params.push(parseInt(teamIdParam));
    } else {
      const assignedTeams = await db
        .prepare(`SELECT team_id FROM team_assignments WHERE user_id = ?`)
        .bind((recruiterUser as any).id)
        .all();
      const teamIds = (assignedTeams.results || []).map((row: any) => (row as any).team_id);
      if (teamIds.length > 0) {
        const placeholders = teamIds.map(() => "?").join(",");
        where += ` AND r.team_id IN (${placeholders})`;
        params.push(...teamIds);
      }
    }

    const query = `
      SELECT r.*, c.name as client_name, t.name as team_name
      FROM am_roles r
      INNER JOIN clients c ON r.client_id = c.id
      INNER JOIN app_teams t ON r.team_id = t.id
      WHERE ${where}
      ORDER BY r.updated_at DESC
      LIMIT 50
    `;

    const dealRoles = await db.prepare(query).bind(...params).all();

    return c.json(dealRoles.results || []);
  } catch (error) {
    console.error("Error fetching deal roles:", error);
    return c.json({ error: "Failed to fetch deal roles" }, 500);
  }
});

// Create submission
app.post("/api/recruiter/submissions", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const body = await c.req.json();

  const schema = z.object({
    client_id: z.number().optional(),
    team_id: z.number().optional(),
    role_id: z.number().optional(),
    submission_type: z.enum(["6h", "24h", "after_24h"]).optional(),
    submission_date: z.string(),
    candidate_name: z.string().optional(),
    candidate_email: z.string().optional(),
    candidate_phone: z.string().optional(),
    candidate_id: z.number().nullable().optional(),
    notes: z.string().optional(),
    entry_type: z.enum(["submission", "interview", "deal", "dropout"]).optional(),
    interview_level: z.number().min(1).max(3).optional(),
    dropout_role_id: z.number().optional(),
    dropout_reason: z.string().optional(),
    cv_match_percent: z.number().min(0).max(100).optional(),
  });

  try {
    const data = schema.parse(body);

    // Handle different entry types
    const entryType = data.entry_type || "submission";
    let roleId = data.role_id;
    let clientId = data.client_id;
    let teamId = data.team_id;
    let accountManagerId = null;
    let recruitmentManagerId = null;

    // Handle dropout case
    if (entryType === "dropout" && data.dropout_role_id) {
      roleId = data.dropout_role_id;
      
      // Get role details
      const dropoutRole = await db
        .prepare("SELECT * FROM am_roles WHERE id = ?")
        .bind(data.dropout_role_id)
        .first();

      if (!dropoutRole) {
        return c.json({ error: "Dropout role not found" }, 404);
      }

      clientId = (dropoutRole as any).client_id;
      teamId = (dropoutRole as any).team_id;
      accountManagerId = (dropoutRole as any).account_manager_id;

      // Get RM for this team
      let rmUserId = null;
      if (teamId) {
        const rm = await db
          .prepare(`
            SELECT u.id
            FROM users u
            INNER JOIN team_assignments ta ON u.id = ta.user_id
            WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
            LIMIT 1
          `)
          .bind(teamId)
          .first();
        rmUserId = rm ? (rm as any).id : null;
      }

      // Create dropout request for RM to acknowledge first
      await db
        .prepare(`
          INSERT INTO dropout_requests (
            role_id, recruiter_user_id, rm_user_id, am_user_id, 
            dropout_reason, rm_status, final_status
          ) VALUES (?, ?, ?, ?, ?, 'pending', 'pending')
        `)
        .bind(
          data.dropout_role_id,
          (recruiterUser as any).id,
          rmUserId,
          accountManagerId,
          data.dropout_reason || 'Not specified'
        )
        .run();

      // Notify RM about dropout needing acknowledgment
      if (rmUserId) {
        await createNotification(db, {
          userId: rmUserId,
          type: 'dropout',
          title: 'Dropout Requires Acknowledgment',
          message: `Recruiter ${(recruiterUser as any).name} marked a dropout on role ${(dropoutRole as any).title}. Please review and acknowledge.`,
          relatedEntityType: 'role',
          relatedEntityId: data.dropout_role_id
        });
      }
    } else if (roleId) {
      // Get role details including account manager
      const role = await db
        .prepare("SELECT * FROM am_roles WHERE id = ?")
        .bind(roleId)
        .first();

      if (!role) {
        return c.json({ error: "Role not found" }, 404);
      }

      accountManagerId = (role as any).account_manager_id;
      clientId = clientId || (role as any).client_id;
      teamId = teamId || (role as any).team_id;

      // If it's a deal entry, update the role status and create notification for AM
      if (entryType === "deal") {
        await db
          .prepare("UPDATE am_roles SET status = 'deal' WHERE id = ?")
          .bind(roleId)
          .run();

        // Notify Account Manager about the deal
        if (accountManagerId) {
          await createNotification(db, {
            userId: accountManagerId,
            type: 'deal',
            title: 'New Deal!',
            message: `Recruiter ${(recruiterUser as any).name} closed a deal on role ${(role as any).title}`,
            relatedEntityType: 'role',
            relatedEntityId: Number(roleId)
          });
        }

        if (teamId) {
          const rmUsers = await db
            .prepare(`
              SELECT u.id
              FROM users u
              INNER JOIN team_assignments ta ON u.id = ta.user_id
              WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
            `)
            .bind(teamId)
            .all();

          for (const row of rmUsers.results || []) {
            const rmId = (row as any).id;
            await createNotification(db, {
              userId: rmId,
              type: 'deal',
              title: 'New Deal!',
              message: `Recruiter ${(recruiterUser as any).name} closed a deal on role ${(role as any).title}`,
              relatedEntityType: 'role',
              relatedEntityId: Number(roleId)
            });
          }
        }
      }
    }

    // Get recruitment manager from team assignment if we have a team
    if (teamId) {
      const recruitmentManager = await db
        .prepare(`
          SELECT u.id
          FROM users u
          INNER JOIN team_assignments ta ON u.id = ta.user_id
          WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
          LIMIT 1
        `)
        .bind(teamId)
        .first();

      recruitmentManagerId = recruitmentManager ? (recruitmentManager as any).id : null;
    }

    // Handle candidate creation/association
    let candidateId = data.candidate_id;
    
    if (entryType === "submission" && data.candidate_name && data.candidate_name.trim()) {
      if (!candidateId) {
        // Create new candidate if name provided and not linked to existing
        const candidateName = data.candidate_name.trim();
        
        // Get next candidate code
        const codeCounter = await db
          .prepare("SELECT next_number FROM code_counters WHERE category = 'candidate'")
          .first();
        
        let nextNumber = 1;
        if (codeCounter) {
          nextNumber = (codeCounter as any).next_number;
          await db
            .prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'candidate'")
            .run();
        } else {
          await db
            .prepare("INSERT INTO code_counters (category, next_number) VALUES ('candidate', 2)")
            .run();
        }
        
        const candidateCode = `NL-${String(nextNumber).padStart(4, '0')}`;
        
        // Create candidate with email and phone if provided
        const candidateResult = await db
          .prepare(`
            INSERT INTO candidates (candidate_code, name, email, phone, is_active, created_by_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(
            candidateCode, 
            candidateName, 
            data.candidate_email?.trim() || null,
            data.candidate_phone?.trim() || null,
            (recruiterUser as any).id
          )
          .run();
        
        candidateId = candidateResult.meta.last_row_id;
      }
      
      // Create candidate-role association
      if (candidateId && roleId) {
        await db
          .prepare(`
            INSERT INTO candidate_role_associations (
              candidate_id, role_id, recruiter_user_id, client_id, team_id,
              status, submission_date, is_discarded
            )
            VALUES (?, ?, ?, ?, ?, 'submitted', ?, 0)
          `)
          .bind(candidateId, roleId, (recruiterUser as any).id, clientId, teamId, data.submission_date)
          .run();
      }
    }
    
    // Insert submission with new fields
    // For non-submission entry types, use a default submission_type since it's a NOT NULL field
    const submissionTypeValue = data.submission_type || '24h';

    if (entryType === 'submission') {
      const percent = typeof data.cv_match_percent === 'number' ? data.cv_match_percent : undefined;
      if (percent === undefined) {
        return c.json({ error: "cv_match_percent is required for submissions" }, 400);
      }
      if (percent < 85) {
        return c.json({ error: "Submission blocked: CV matching percentage must be at least 85%" }, 400);
      }
    }
    
    await db
      .prepare(`
        INSERT INTO recruiter_submissions (
          recruiter_user_id, client_id, team_id, role_id, 
          account_manager_id, recruitment_manager_id, 
          submission_type, submission_date, candidate_name, notes, entry_type,
          interview_level, dropout_role_id, dropout_reason, cv_match_percent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        (recruiterUser as any).id,
        clientId || null,
        teamId || null,
        roleId || null,
        accountManagerId,
        recruitmentManagerId,
        submissionTypeValue,
        data.submission_date,
        data.candidate_name || null,
        data.notes || "",
        entryType,
        data.interview_level || null,
        data.dropout_role_id || null,
        data.dropout_reason || null,
        entryType === 'submission' ? (data.cv_match_percent as number) : null
      )
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error creating submission:", error);
    return c.json({ error: "Failed to create submission" }, 500);
  }
});

// Get recruiter submissions with analytics
app.get("/api/recruiter/submissions", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");
  const clientId = c.req.query("client_id");
  const searchName = c.req.query("search_name");

  try {
    let query = `
      SELECT rs.*, c.name as client_name, t.name as team_name, 
             r.title as role_title, r.role_code,
             u.name as account_manager_name
      FROM recruiter_submissions rs
      INNER JOIN clients c ON rs.client_id = c.id
      INNER JOIN app_teams t ON rs.team_id = t.id
      INNER JOIN am_roles r ON rs.role_id = r.id
      INNER JOIN users u ON rs.account_manager_id = u.id
      WHERE rs.recruiter_user_id = ?
    `;

    const params: any[] = [(recruiterUser as any).id];

    if (clientId) {
      query += " AND rs.client_id = ?";
      params.push(parseInt(clientId));
    }

    if (startDate && endDate) {
      query += " AND rs.submission_date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    if (searchName) {
      query += " AND rs.candidate_name LIKE ?";
      params.push(`%${searchName}%`);
    }

    query += " ORDER BY rs.submission_date DESC, rs.created_at DESC";

    const submissions = await db.prepare(query).bind(...params).all();

    // Calculate stats
    const stats = {
      total: submissions.results?.length || 0,
      submission_6h: submissions.results?.filter((s: any) => s.entry_type === "submission" && s.submission_type === "6h").length || 0,
      submission_24h: submissions.results?.filter((s: any) => s.entry_type === "submission" && s.submission_type === "24h").length || 0,
      submission_after_24h: submissions.results?.filter((s: any) => s.entry_type === "submission" && s.submission_type === "after_24h").length || 0,
      interviews: submissions.results?.filter((s: any) => s.entry_type === "interview").length || 0,
      deals: submissions.results?.filter((s: any) => s.entry_type === "deal").length || 0,
      dropouts: submissions.results?.filter((s: any) => s.entry_type === "dropout").length || 0,
    };

    return c.json({
      submissions: submissions.results || [],
      stats,
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return c.json({ error: "Failed to fetch submissions" }, 500);
  }
});

// Get EBES score with filters
app.get("/api/recruiter/ebes", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const filter = c.req.query("filter") || "combined"; // date, client, combined
  const clientId = c.req.query("client_id");

  try {
    // Build date filter for submissions query
    let dateFilter = "";
    const dateParams: any[] = [];
    
    const now = new Date();
    if (filter === "date") {
      // Current month only
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startOfMonth, endOfMonth);
    }

    let query = `
      SELECT rs.*
      FROM recruiter_submissions rs
      WHERE rs.recruiter_user_id = ?${dateFilter}
    `;

    const params: any[] = [(recruiterUser as any).id, ...dateParams];

    // Apply client filter
    if (filter === "client" && clientId) {
      query += ` AND rs.client_id = ?`;
      params.push(parseInt(clientId));
    }
    // else combined = all data

    const submissions = await db.prepare(query).bind(...params).all();
    const results = submissions.results || [];

    // ============ TABLE 1: Performance Points ============
    let table1Points = 0;

    // Submission timing points
    const submission6h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "6h").length;
    const submission24h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "24h").length;
    const submissionAfter24h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "after_24h").length;
    
    table1Points += submission6h * 2;        // 2 points per 6h submission
    table1Points += submission24h * 1.5;     // 1.5 points per 24h submission
    table1Points += submissionAfter24h * 1;  // 1 point per after 24h submission

    // Interview level points
    const interview1 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 1).length;
    const interview2 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 2).length;
    const interview3 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 3).length;
    
    table1Points += interview1 * 3;    // 3 points per 1st interview
    table1Points += interview2 * 1.5;  // 1.5 points per 2nd interview
    table1Points += interview3 * 0;    // 0 points per 3rd interview

    // Deal points
    const deals = results.filter((s: any) => s.entry_type === "deal").length;
    table1Points += deals * 7;  // 7 points per deal

    // Dropout (pullout) points - check AM decision
    const dropoutEntries = results.filter((s: any) => s.entry_type === "dropout");
    let acceptedDropouts = 0;
    
    for (const dropout of dropoutEntries) {
      // Check if this dropout was accepted by AM
      const dropoutRequest = await db
        .prepare("SELECT am_decision FROM dropout_requests WHERE role_id = ? AND recruiter_user_id = ? ORDER BY created_at DESC LIMIT 1")
        .bind(dropout.role_id, (recruiterUser as any).id)
        .first();
      
      if ((dropoutRequest as any)?.am_decision === 'accept') {
        acceptedDropouts++;
      }
    }
    
    // Build CRA date filter matching submissions date range
    let craDateFilter = "";
    let craDateParams: any[] = [];
    if (dateParams.length === 2) {
      craDateFilter = " AND submission_date BETWEEN ? AND ?";
      craDateParams = [dateParams[0], dateParams[1]];
    }

    // Get discarded candidates count (excluding lost role candidates) within date range
    const discardedCandidatesQuery = `
      SELECT COUNT(DISTINCT candidate_id) as count
      FROM candidate_role_associations
      WHERE recruiter_user_id = ? AND is_discarded = 1 AND (is_lost_role = 0 OR is_lost_role IS NULL)${craDateFilter}
    `;
    const discardedCandidatesResult = await db
      .prepare(discardedCandidatesQuery)
      .bind((recruiterUser as any).id, ...craDateParams)
      .first();
    const discardedCandidatesCount = (discardedCandidatesResult as any)?.count || 0;
    
    // Get lost role candidates count (separate penalty) within date range
    const lostRoleCandidatesQuery = `
      SELECT COUNT(DISTINCT candidate_id) as count
      FROM candidate_role_associations
      WHERE recruiter_user_id = ? AND is_discarded = 1 AND is_lost_role = 1${craDateFilter}
    `;
    const lostRoleCandidatesResult = await db
      .prepare(lostRoleCandidatesQuery)
      .bind((recruiterUser as any).id, ...craDateParams)
      .first();
    const lostRoleCandidatesCount = (lostRoleCandidatesResult as any)?.count || 0;

    // ============ TABLE 2: Role Engagement Points ============
    let table2Points = 0;

    // Get assigned roles (from role_recruiter_assignments table)
    const assignedRolesQuery = `
      SELECT COUNT(DISTINCT role_id) as count
      FROM role_recruiter_assignments
      WHERE recruiter_user_id = ?
    `;
    const assignedRolesResult = await db
      .prepare(assignedRolesQuery)
      .bind((recruiterUser as any).id)
      .first();
    const assignedRolesCount = (assignedRolesResult as any)?.count || 0;
    
    table2Points += assignedRolesCount * 3;  // 3 points per assigned role

    // Get actively worked roles (roles with submissions but NOT in assignments)
    const activelyWorkedQuery = `
      SELECT COUNT(DISTINCT rs.role_id) as count
      FROM recruiter_submissions rs
      WHERE rs.recruiter_user_id = ?${dateFilter}
        AND rs.role_id NOT IN (
          SELECT role_id 
          FROM role_recruiter_assignments 
          WHERE recruiter_user_id = ?
        )
    `;
    const activelyWorkedResult = await db
      .prepare(activelyWorkedQuery)
      .bind((recruiterUser as any).id, ...dateParams, (recruiterUser as any).id)
      .first();
    const activelyWorkedCount = (activelyWorkedResult as any)?.count || 0;
    
    table2Points += activelyWorkedCount * 1;  // 1 point per actively worked role

    // ============ Calculate EBES Score using centralized calculator ==========
    const percents = results
      .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
      .map((s: any) => (s as any).cv_match_percent as number);
    const avgCvQuality = percents.length > 0
      ? percents.reduce((a: number, b: number) => a + b, 0) / percents.length
      : 0;

    const ebesData: RecruiterEBESData = {
      submissions_6h: submission6h,
      submissions_24h: submission24h,
      submissions_after_24h: submissionAfter24h,
      interviews_level_1: interview1,
      interviews_level_2: interview2,
      deals,
      accepted_dropouts: acceptedDropouts,
      discarded_candidates: discardedCandidatesCount,
      lost_role_candidates: lostRoleCandidatesCount,
      assigned_roles: assignedRolesCount,
      actively_worked_roles: activelyWorkedCount,
      avg_cv_quality: avgCvQuality
    };

    const result = calculateRecruiterEBES(ebesData);

    return c.json({ 
      score: result.score,
      breakdown: {
        table1: {
          total: result.table1_points,
          submission_6h: submission6h,
          submission_24h: submission24h,
          submission_after_24h: submissionAfter24h,
          interview_1: interview1,
          interview_2: interview2,
          interview_3: interview3,
          deals,
          dropouts: dropoutEntries.length,
          accepted_dropouts: acceptedDropouts,
          discarded_candidates: discardedCandidatesCount,
          lost_role_candidates: lostRoleCandidatesCount
        },
        table2: {
          total: result.table2_points,
          assigned_roles: assignedRolesCount,
          actively_worked_roles: activelyWorkedCount
        }
      }
    });
  } catch (error) {
    console.error("Error calculating EBES:", error);
    return c.json({ error: "Failed to calculate EBES" }, 500);
  }
});

// Get all roles for recruiter (for analytics filters)
app.get("/api/recruiter/all-roles", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");

  try {
    const roles = await db
      .prepare(`
        SELECT DISTINCT r.id, r.title, r.role_code
        FROM am_roles r
        INNER JOIN recruiter_submissions rs ON r.id = rs.role_id
        WHERE rs.recruiter_user_id = ?
        ORDER BY r.title
      `)
      .bind((recruiterUser as any).id)
      .all();

    return c.json(roles.results || []);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return c.json({ error: "Failed to fetch roles" }, 500);
  }
});

// Get recruiter analytics with filters
app.get("/api/recruiter/analytics", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const clientId = c.req.query("client_id");
  const roleId = c.req.query("role_id");
  const entryType = c.req.query("entry_type");
  const dateRange = c.req.query("date_range") || "";
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Build date filter
    let dateFilter = "";
    const now = new Date();
    let dateParams: string[] = [];

    if (dateRange === "today") {
      const today = now.toISOString().split("T")[0];
      dateFilter = "AND rs.submission_date = ?";
      dateParams = [today];
    } else if (dateRange === "this_week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      dateFilter = "AND rs.submission_date BETWEEN ? AND ?";
      dateParams = [startOfWeek.toISOString().split("T")[0], endOfWeek.toISOString().split("T")[0]];
    } else if (dateRange === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      dateFilter = "AND rs.submission_date BETWEEN ? AND ?";
      dateParams = [startOfMonth.toISOString().split("T")[0], endOfMonth.toISOString().split("T")[0]];
    } else if (dateRange === "custom" && startDate && endDate) {
      dateFilter = "AND rs.submission_date BETWEEN ? AND ?";
      dateParams = [startDate, endDate];
    }

    // Build base query
    let query = `
      SELECT rs.*
      FROM recruiter_submissions rs
      WHERE rs.recruiter_user_id = ?
    `;
    const params: any[] = [(recruiterUser as any).id];

    if (clientId) {
      query += " AND rs.client_id = ?";
      params.push(parseInt(clientId));
    }
    if (roleId) {
      query += " AND rs.role_id = ?";
      params.push(parseInt(roleId));
    }
    if (entryType) {
      query += " AND rs.entry_type = ?";
      params.push(entryType);
    }
    if (dateFilter) {
      query += ` ${dateFilter}`;
      params.push(...dateParams);
    }

    const submissions = await db.prepare(query).bind(...params).all();
    const results = submissions.results || [];

    // Calculate stats
    const total_submissions = results.filter((s: any) => s.entry_type === "submission").length;
    const total_interviews = results.filter((s: any) => s.entry_type === "interview").length;
    const interview_1 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 1).length;
    const interview_2 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 2).length;
    const interview_3 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 3).length;
    const total_deals = results.filter((s: any) => s.entry_type === "deal").length;
    const total_dropouts = results.filter((s: any) => s.entry_type === "dropout").length;

    const submissionPercents = results
      .filter((s: any) => s.entry_type === 'submission' && typeof s.cv_match_percent === 'number')
      .map((s: any) => s.cv_match_percent as number);
    const cv_quality_average = submissionPercents.length > 0
      ? submissionPercents.reduce((a: number, b: number) => a + b, 0) / submissionPercents.length
      : 0;
    let cv_quality_label = 'Poor';
    if (cv_quality_average >= 95) cv_quality_label = 'Excellent';
    else if (cv_quality_average >= 90) cv_quality_label = 'Good';
    else if (cv_quality_average >= 85) cv_quality_label = 'Okay';

    // Get active roles count
    const activeRolesQuery = `
      SELECT COUNT(DISTINCT rs.role_id) as count
      FROM recruiter_submissions rs
      INNER JOIN am_roles r ON rs.role_id = r.id
      WHERE rs.recruiter_user_id = ? AND r.status = 'active'
    `;
    const activeRolesResult = await db.prepare(activeRolesQuery).bind((recruiterUser as any).id).first();
    const active_roles_count = (activeRolesResult as any)?.count || 0;

    // Client breakdown
    const clientBreakdown = await db
      .prepare(`
        SELECT c.name as client_name, COUNT(*) as count
        FROM recruiter_submissions rs
        INNER JOIN clients c ON rs.client_id = c.id
        WHERE rs.recruiter_user_id = ? ${roleId ? "AND rs.role_id = ?" : ""} ${entryType ? "AND rs.entry_type = ?" : ""} ${dateFilter}
        GROUP BY c.id, c.name
        ORDER BY count DESC
      `)
      .bind(...[
        (recruiterUser as any).id,
        ...(roleId ? [parseInt(roleId)] : []),
        ...(entryType ? [entryType] : []),
        ...dateParams
      ].filter(p => p !== undefined))
      .all();

    // Team breakdown
    const teamBreakdown = await db
      .prepare(`
        SELECT t.name as team_name, COUNT(*) as count
        FROM recruiter_submissions rs
        INNER JOIN app_teams t ON rs.team_id = t.id
        WHERE rs.recruiter_user_id = ? ${clientId ? "AND rs.client_id = ?" : ""} ${roleId ? "AND rs.role_id = ?" : ""} ${entryType ? "AND rs.entry_type = ?" : ""} ${dateFilter}
        GROUP BY t.id, t.name
        ORDER BY count DESC
      `)
      .bind(...[
        (recruiterUser as any).id,
        ...(clientId ? [parseInt(clientId)] : []),
        ...(roleId ? [parseInt(roleId)] : []),
        ...(entryType ? [entryType] : []),
        ...dateParams
      ].filter(p => p !== undefined))
      .all();

    // Daily trend (last 30 days)
    const dailyTrend = await db
      .prepare(`
        SELECT rs.submission_date as date, COUNT(*) as count
        FROM recruiter_submissions rs
        WHERE rs.recruiter_user_id = ? 
          ${clientId ? "AND rs.client_id = ?" : ""}
          ${roleId ? "AND rs.role_id = ?" : ""}
          ${entryType ? "AND rs.entry_type = ?" : ""}
          AND rs.submission_date >= date('now', '-30 days')
        GROUP BY rs.submission_date
        ORDER BY rs.submission_date DESC
        LIMIT 30
      `)
      .bind(...[
        (recruiterUser as any).id,
        ...(clientId ? [parseInt(clientId)] : []),
        ...(roleId ? [parseInt(roleId)] : []),
        ...(entryType ? [entryType] : [])
      ].filter(p => p !== undefined))
      .all();

    // Monthly trend (last 12 months)
    const monthlyTrend = await db
      .prepare(`
        SELECT strftime('%Y-%m', rs.submission_date) as month, COUNT(*) as count
        FROM recruiter_submissions rs
        WHERE rs.recruiter_user_id = ? 
          ${clientId ? "AND rs.client_id = ?" : ""}
          ${roleId ? "AND rs.role_id = ?" : ""}
          ${entryType ? "AND rs.entry_type = ?" : ""}
          AND rs.submission_date >= date('now', '-12 months')
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `)
      .bind(...[
        (recruiterUser as any).id,
        ...(clientId ? [parseInt(clientId)] : []),
        ...(roleId ? [parseInt(roleId)] : []),
        ...(entryType ? [entryType] : [])
      ].filter(p => p !== undefined))
      .all();

    return c.json({
      total_submissions,
      total_interviews,
      interview_1,
      interview_2,
      interview_3,
      total_deals,
      total_dropouts,
      active_roles_count,
      cv_quality_average,
      cv_quality_label,
      client_breakdown: clientBreakdown.results || [],
      team_breakdown: teamBreakdown.results || [],
      daily_trend: (dailyTrend.results || []).reverse(),
      monthly_trend: (monthlyTrend.results || []).reverse()
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

// Get roles list with stats
app.get("/api/recruiter/roles-list", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const isActive = c.req.query("is_active");
  const searchQuery = c.req.query("search");

  try {
    let query = `
      SELECT 
        r.*,
        c.name as client_name,
        t.name as team_name,
        u.name as account_manager_name,
        COUNT(DISTINCT CASE WHEN rs.entry_type = 'submission' THEN rs.id END) as total_submissions,
        COUNT(DISTINCT CASE WHEN rs.entry_type = 'interview' THEN rs.id END) as total_interviews,
        COUNT(DISTINCT CASE WHEN rs.entry_type = 'deal' THEN rs.id END) as total_deals,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 0 THEN cra.candidate_id END) as total_candidates,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 0 THEN cra.candidate_id END) as active_candidates,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 1 THEN cra.candidate_id END) as discarded_candidates,
        COUNT(DISTINCT CASE WHEN rs.entry_type = 'submission' AND cra.is_discarded = 0 THEN cra.candidate_id END) as in_play_submissions
      FROM am_roles r
      INNER JOIN clients c ON r.client_id = c.id
      INNER JOIN app_teams t ON r.team_id = t.id
      LEFT JOIN users u ON r.account_manager_id = u.id
      LEFT JOIN recruiter_submissions rs ON r.id = rs.role_id AND rs.recruiter_user_id = ?
      LEFT JOIN candidate_role_associations cra ON r.id = cra.role_id AND cra.recruiter_user_id = ?
      WHERE 1=1
    `;

    const params: any[] = [(recruiterUser as any).id, (recruiterUser as any).id];

    if (isActive !== undefined) {
      if (isActive === '1') {
        query += ` AND r.status = 'active'`;
      } else {
        query += ` AND r.status != 'active'`;
      }
    }

    if (searchQuery) {
      query += ` AND (r.title LIKE ? OR r.role_code LIKE ?)`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    query += ` GROUP BY r.id ORDER BY r.created_at DESC`;

    const { results } = await db.prepare(query).bind(...params).all();

    return c.json(results);
  } catch (error: any) {
    console.error('Error fetching roles list:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get recruiter EBES score with date filter
app.get("/api/recruiter/ebes-score", recruiterOnly, async (c) => {
  const db = c.env.DB;
  const recruiterUser = c.get("recruiterUser");
  const filter = c.req.query("filter") || "current_month";
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  try {
    // Build date filter for submissions query
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
    } else if (filter === "custom" && startDate && endDate) {
      dateFilter = " AND rs.submission_date BETWEEN ? AND ?";
      dateParams.push(startDate, endDate);
    }

    // Get all submissions for this recruiter in the date range
    const allSubmissionsQuery = `
      SELECT rs.*
      FROM recruiter_submissions rs
      WHERE rs.recruiter_user_id = ?${dateFilter}
    `;
    const allSubmissions = await db
      .prepare(allSubmissionsQuery)
      .bind((recruiterUser as any).id, ...dateParams)
      .all();

    const results = allSubmissions.results || [];

    // ============ TABLE 1: Performance Points ============
    let table1Points = 0;

    // Submission timing points
    const submission6h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "6h").length;
    const submission24h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "24h").length;
    const submissionAfter24h = results.filter((s: any) => s.entry_type === "submission" && s.submission_type === "after_24h").length;
    
    table1Points += submission6h * 2;        // 2 points per 6h submission
    table1Points += submission24h * 1.5;     // 1.5 points per 24h submission
    table1Points += submissionAfter24h * 1;  // 1 point per after 24h submission

    // Interview level points
    const interview1 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 1).length;
    const interview2 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 2).length;
    const interview3 = results.filter((s: any) => s.entry_type === "interview" && s.interview_level === 3).length;
    
    table1Points += interview1 * 3;    // 3 points per 1st interview
    table1Points += interview2 * 1.5;  // 1.5 points per 2nd interview
    table1Points += interview3 * 0;    // 0 points per 3rd interview

    // Deal points
    const deals = results.filter((s: any) => s.entry_type === "deal").length;
    table1Points += deals * 7;  // 7 points per deal

    // Dropout (pullout) points - check AM decision
    const dropoutEntries = results.filter((s: any) => s.entry_type === "dropout");
    let acceptedDropoutsCount = 0;
    
    for (const dropout of dropoutEntries) {
      // Check if this dropout was accepted by AM
      const dropoutRequest = await db
        .prepare("SELECT am_decision FROM dropout_requests WHERE role_id = ? AND recruiter_user_id = ? ORDER BY created_at DESC LIMIT 1")
        .bind(dropout.role_id, (recruiterUser as any).id)
        .first();
      
      if ((dropoutRequest as any)?.am_decision === 'accept') {
        acceptedDropoutsCount++;
      }
    }
    
    // Get discarded candidates count (excluding lost role candidates)
    const discardedCandidatesQuery = `
      SELECT COUNT(DISTINCT candidate_id) as count
      FROM candidate_role_associations
      WHERE recruiter_user_id = ? AND is_discarded = 1 AND (is_lost_role = 0 OR is_lost_role IS NULL)
    `;
    const discardedCandidatesResult = await db
      .prepare(discardedCandidatesQuery)
      .bind((recruiterUser as any).id)
      .first();
    const discardedCandidatesCount = (discardedCandidatesResult as any)?.count || 0;
    
    // Get lost role candidates count (separate penalty)
    const lostRoleCandidatesQuery = `
      SELECT COUNT(DISTINCT candidate_id) as count
      FROM candidate_role_associations
      WHERE recruiter_user_id = ? AND is_discarded = 1 AND is_lost_role = 1
    `;
    const lostRoleCandidatesResult = await db
      .prepare(lostRoleCandidatesQuery)
      .bind((recruiterUser as any).id)
      .first();
    const lostRoleCandidatesCount = (lostRoleCandidatesResult as any)?.count || 0;

    // ============ TABLE 2: Role Engagement Points ============
    let table2Points = 0;

    // Get assigned roles (from role_recruiter_assignments table)
    const assignedRolesQuery = `
      SELECT COUNT(DISTINCT role_id) as count
      FROM role_recruiter_assignments
      WHERE recruiter_user_id = ?
    `;
    const assignedRolesResult = await db
      .prepare(assignedRolesQuery)
      .bind((recruiterUser as any).id)
      .first();
    const assignedRolesCount = (assignedRolesResult as any)?.count || 0;
    
    table2Points += assignedRolesCount * 3;  // 3 points per assigned role

    // Get actively worked roles (roles with submissions but NOT in assignments)
    const activelyWorkedQuery = `
      SELECT COUNT(DISTINCT rs.role_id) as count
      FROM recruiter_submissions rs
      WHERE rs.recruiter_user_id = ?${dateFilter}
        AND rs.role_id NOT IN (
          SELECT role_id 
          FROM role_recruiter_assignments 
          WHERE recruiter_user_id = ?
        )
    `;
    const activelyWorkedResult = await db
      .prepare(activelyWorkedQuery)
      .bind((recruiterUser as any).id, ...dateParams, (recruiterUser as any).id)
      .first();
    const activelyWorkedCount = (activelyWorkedResult as any)?.count || 0;
    
    table2Points += activelyWorkedCount * 1;  // 1 point per actively worked role

    // ============ Calculate EBES Score using centralized calculator ============
    const ebesData: RecruiterEBESData = {
      submissions_6h: submission6h,
      submissions_24h: submission24h,
      submissions_after_24h: submissionAfter24h,
      interviews_level_1: interview1,
      interviews_level_2: interview2,
      deals,
      accepted_dropouts: acceptedDropoutsCount,
      discarded_candidates: discardedCandidatesCount,
      lost_role_candidates: lostRoleCandidatesCount,
      assigned_roles: assignedRolesCount,
      actively_worked_roles: activelyWorkedCount
    };

    const result = calculateRecruiterEBES(ebesData);

    const percents = results
      .filter((s: any) => s.entry_type === 'submission' && typeof (s as any).cv_match_percent === 'number')
      .map((s: any) => (s as any).cv_match_percent as number);
    const cv_quality_average = percents.length > 0
      ? percents.reduce((a: number, b: number) => a + b, 0) / percents.length
      : 0;
    let cv_quality_label = 'Poor';
    if (cv_quality_average >= 95) cv_quality_label = 'Excellent';
    else if (cv_quality_average >= 90) cv_quality_label = 'Good';
    else if (cv_quality_average >= 85) cv_quality_label = 'Okay';

    return c.json({
      score: result.score,
      performance_label: result.performance_label,
      cv_quality_average,
      cv_quality_label,
      breakdown: {
        table1: {
          total: result.table1_points,
          submission6h,
          submission24h,
          submissionAfter24h,
          interview_1: interview1,
          interview_2: interview2,
          deals,
          dropouts: dropoutEntries.length,
          accepted_dropouts: acceptedDropoutsCount,
          discarded_candidates: discardedCandidatesCount,
          lost_role_candidates: lostRoleCandidatesCount
        },
        table2: {
          total: result.table2_points,
          assigned_roles: assignedRolesCount,
          actively_worked_roles: activelyWorkedCount
        }
      }
    });
  } catch (error) {
    console.error("Error calculating EBES score:", error);
    return c.json({ error: "Failed to calculate EBES score" }, 500);
  }
});

export default app;
