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
    const settings = await db
      .prepare(`
        SELECT setting_key, setting_value 
        FROM app_settings 
        WHERE setting_key IN (
          'show_company_page',
          'sla_rm_eval_days',
          'sla_submitted_days',
          'sla_client_feedback_days'
        )
      `)
      .all();

    const map: Record<string, any> = {};
    for (const row of settings.results || []) {
      const r = row as any;
      map[r.setting_key] = r.setting_value;
    }

    return c.json({ 
      show_company_page: map.show_company_page ? map.show_company_page === 'true' : true,
      sla_rm_eval_days: map.sla_rm_eval_days ? Number(map.sla_rm_eval_days) : 2,
      sla_submitted_days: map.sla_submitted_days ? Number(map.sla_submitted_days) : 3,
      sla_client_feedback_days: map.sla_client_feedback_days ? Number(map.sla_client_feedback_days) : 5
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

// Update company page visibility (admin only)
app.put("/api/company/settings", adminOnly, async (c) => {
  const db = c.env.DB;
  const { show_company_page, sla_rm_eval_days, sla_submitted_days, sla_client_feedback_days } = await c.req.json();

  try {
    if (show_company_page !== undefined) {
      await db
        .prepare("UPDATE app_settings SET setting_value = ?, updated_at = datetime('now') WHERE setting_key = 'show_company_page'")
        .bind(show_company_page ? 'true' : 'false')
        .run();
    }

    const upsert = async (key: string, value: any) => {
      if (value === undefined || value === null) return;
      const existing = await db
        .prepare("SELECT 1 FROM app_settings WHERE setting_key = ?")
        .bind(key)
        .first();
      if (existing) {
        await db
          .prepare("UPDATE app_settings SET setting_value = ?, updated_at = datetime('now') WHERE setting_key = ?")
          .bind(String(value), key)
          .run();
      } else {
        await db
          .prepare("INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))")
          .bind(key, String(value))
          .run();
      }
    };

    await upsert('sla_rm_eval_days', sla_rm_eval_days);
    await upsert('sla_submitted_days', sla_submitted_days);
    await upsert('sla_client_feedback_days', sla_client_feedback_days);

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

app.post("/api/dev/seed-submissions", authOnly, async (c) => {
  const db = c.env.DB;
  try {
    const r4qa = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE title = ?").bind("QA Automation Lead").first();
    const r4de = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE title = ?").bind("Senior Data Engineer").first();
    const r3java = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE title = ?").bind("Java Backend Developer").first();
    const r3fe = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE title = ?").bind("Frontend React Engineer").first();
    const r3devops = await db.prepare("SELECT id, client_id, team_id, account_manager_id FROM am_roles WHERE title = ?").bind("DevOps Engineer").first();
    const roles = [r4qa, r4de, r3java, r3fe, r3devops].filter(Boolean) as any[];
    for (const role of roles) {
      const rid = (role as any).id;
      const cid = (role as any).client_id;
      const tid = (role as any).team_id;
      const amid = (role as any).account_manager_id;
      const recId = tid === 2 ? 4 : 3;
      const rmRow = await db.prepare("SELECT u.id FROM users u INNER JOIN team_assignments ta ON u.id = ta.user_id WHERE ta.team_id = ? AND u.role = 'recruitment_manager' LIMIT 1").bind(tid).first();
      const rmid = rmRow ? (rmRow as any).id : null;
      const seeds = [
        { name: "Candidate A", email: "cand.a@example.com", phone: "+1000000001", date: "2026-01-06", type: "6h", percent: 92 },
        { name: "Candidate B", email: "cand.b@example.com", phone: "+1000000002", date: "2026-01-07", type: "24h", percent: 90 },
        { name: "Candidate C", email: "cand.c@example.com", phone: "+1000000003", date: "2025-12-29", type: "after_24h", percent: 88 }
      ];
      for (const s of seeds) {
        const counter = await db.prepare("SELECT next_number FROM code_counters WHERE category = 'candidate'").first();
        let nextNumber = 1;
        if (counter) {
          nextNumber = (counter as any).next_number;
          await db.prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = 'candidate'").run();
        } else {
          await db.prepare("INSERT INTO code_counters (category, next_number) VALUES ('candidate', 2)").run();
        }
        const candidateCode = `NL-${String(nextNumber).padStart(4, "0")}`;
        const candRes = await db.prepare("INSERT INTO candidates (candidate_code, name, email, phone, is_active, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(candidateCode, s.name, s.email, s.phone, recId).run();
        const candId = candRes.meta.last_row_id;
        await db.prepare("INSERT INTO candidate_role_associations (candidate_id, role_id, recruiter_user_id, client_id, team_id, status, submission_date, is_discarded) VALUES (?, ?, ?, ?, ?, 'rm_evaluation', ?, 0)").bind(candId, rid, recId, cid, tid, s.date).run();
        await db.prepare("INSERT INTO recruiter_submissions (recruiter_user_id, client_id, team_id, role_id, account_manager_id, recruitment_manager_id, submission_type, submission_date, candidate_name, notes, entry_type, interview_level, dropout_role_id, dropout_reason, cv_match_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submission', NULL, NULL, NULL, ?)").bind(recId, cid, tid, rid, amid, rmid, s.type, s.date, s.name, "Sample submission", s.percent).run();
      }
      await db.prepare("INSERT INTO recruiter_submissions (recruiter_user_id, client_id, team_id, role_id, account_manager_id, recruitment_manager_id, submission_type, submission_date, candidate_name, notes, entry_type, interview_level, dropout_role_id, dropout_reason, cv_match_percent) VALUES (?, ?, ?, ?, ?, ?, '24h', ?, ?, ?, 'interview', 1, NULL, NULL, NULL)").bind(recId, cid, tid, rid, amid, rmid, "2026-01-07", "Candidate A", "Initial interview").run();
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to seed submissions" }, 500);
  }
});

app.post("/api/dev/advance-workflow", authOnly, async (c) => {
  const db = c.env.DB;
  try {
    const titles = ["QA Automation Lead", "Senior Data Engineer", "Java Backend Developer", "Frontend React Engineer", "DevOps Engineer"];
    const roles = await db.prepare(`SELECT id, client_id, team_id, account_manager_id, title FROM am_roles WHERE title IN (${titles.map(() => "?").join(",")})`).bind(...titles).all();
    for (const r of roles.results || []) {
      const role = r as any;
      const craRows = await db.prepare("SELECT cra.id, cra.candidate_id, c.name as candidate_name FROM candidate_role_associations cra INNER JOIN candidates c ON c.id = cra.candidate_id WHERE cra.role_id = ? AND cra.is_discarded = 0 ORDER BY cra.created_at ASC").bind(role.id).all();
      let idx = 0;
      for (const row of craRows.results || []) {
        const candidateName = (row as any).candidate_name;
        const submission = await db.prepare("SELECT id FROM recruiter_submissions WHERE role_id = ? AND entry_type = 'submission' AND candidate_name = ? ORDER BY submission_date DESC LIMIT 1").bind(role.id, candidateName).first();
        if (submission) {
          await db.prepare("UPDATE recruiter_submissions SET rm_validation_status = 'pass', rm_rate_bill = ?, rm_work_type = ?, rm_location = ?, rm_notes = 'Validated', rm_reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(80 + (idx % 5), idx % 2 === 0 ? "SOW" : "Payroll", role.team_id === 2 ? "Berlin" : "London", (submission as any).id).run();
        }
        if (idx === 0 && role.title === "Java Backend Developer") {
          await db.prepare("UPDATE candidate_role_associations SET status = 'deal', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind((row as any).id).run();
          await db.prepare("UPDATE am_roles SET status = 'deal', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(role.id).run();
        } else if (idx % 2 === 0) {
          await db.prepare("UPDATE candidate_role_associations SET status = 'client_submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind((row as any).id).run();
        } else {
          await db.prepare("UPDATE candidate_role_associations SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind((row as any).id).run();
        }
        idx++;
      }
    }
    const r4 = await db.prepare("SELECT entry_type, submission_type FROM recruiter_submissions WHERE recruiter_user_id = 4").all();
    const r3 = await db.prepare("SELECT entry_type, submission_type FROM recruiter_submissions WHERE recruiter_user_id = 3").all();
    const toCounts = (rows: any[]) => {
      const submission6h = rows.filter((s: any) => s.entry_type === "submission" && s.submission_type === "6h").length;
      const submission24h = rows.filter((s: any) => s.entry_type === "submission" && s.submission_type === "24h").length;
      const submissionAfter24h = rows.filter((s: any) => s.entry_type === "submission" && s.submission_type === "after_24h").length;
      const interviews = rows.filter((s: any) => s.entry_type === "interview").length;
      const deals = rows.filter((s: any) => s.entry_type === "deal").length;
      const dropouts = rows.filter((s: any) => s.entry_type === "dropout").length;
      return { submission6h, submission24h, submissionAfter24h, interviews, deals, dropouts, total: rows.length };
    };
    const companyTotals = await db.prepare("SELECT entry_type FROM recruiter_submissions").all();
    const rolesTotals = await db.prepare("SELECT status FROM am_roles").all();
    const craTotals = await db.prepare("SELECT status FROM candidate_role_associations WHERE is_discarded = 0").all();
    const dealsCount = (rolesTotals.results || []).filter((r: any) => (r as any).status === "deal").length;
    const activeRoles = (rolesTotals.results || []).filter((r: any) => (r as any).status === "active").length;
    const submittedCount = (craTotals.results || []).filter((r: any) => (r as any).status === "submitted").length;
    const clientSubmittedCount = (craTotals.results || []).filter((r: any) => (r as any).status === "client_submitted").length;
    return c.json({
      success: true,
      recruiter4: toCounts((r4.results || []).map((x: any) => ({ entry_type: (x as any).entry_type, submission_type: (x as any).submission_type }))),
      recruiter3: toCounts((r3.results || []).map((x: any) => ({ entry_type: (x as any).entry_type, submission_type: (x as any).submission_type }))),
      company: {
        submissions: (companyTotals.results || []).filter((s: any) => (s as any).entry_type === "submission").length,
        interviews: (companyTotals.results || []).filter((s: any) => (s as any).entry_type === "interview").length,
        deals: (companyTotals.results || []).filter((s: any) => (s as any).entry_type === "deal").length,
        dropouts: (companyTotals.results || []).filter((s: any) => (s as any).entry_type === "dropout").length,
        active_roles: activeRoles,
        roles_deal: dealsCount,
        submitted_candidates: submittedCount,
        client_submitted_candidates: clientSubmittedCount
      }
    });
  } catch (error) {
    return c.json({ error: "Failed to advance workflow" }, 500);
  }
});

export default app;
