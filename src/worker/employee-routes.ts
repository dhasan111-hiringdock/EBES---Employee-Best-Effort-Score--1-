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

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function getRangeForToken(token: string): { start?: string; end?: string } {
  const now = new Date();
  if (token.includes("today")) {
    const s = toISODate(now);
    return { start: s, end: s };
  }
  if (token.includes("this week")) {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }
  if (token.includes("this month")) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toISODate(start), end: toISODate(end) };
  }
  if (token.includes("last month")) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toISODate(start), end: toISODate(end) };
  }
  if (token.includes("this year")) {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: toISODate(start), end: toISODate(end) };
  }
  return {};
}
function parsePeriod(query: string, body: any): { start?: string; end?: string } {
  const lower = (query || "").toLowerCase();
  const explicit = (lower.match(/from\s+(\d{4}-\d{2}-\d{2})\s+(?:to|until)\s+(\d{4}-\d{2}-\d{2})/) || []);
  if (explicit.length === 3) {
    return { start: explicit[1], end: explicit[2] };
  }
  const t = getRangeForToken(lower);
  if (t.start || t.end) return t;
  if (body?.start_date && body?.end_date) {
    return { start: body.start_date, end: body.end_date };
  }
  return {};
}
function parseIntent(query: string):
  | "roles_on_hold"
  | "roles_worked_with"
  | "must_start"
  | "count_deals"
  | "count_interviews"
  | "count_dropouts"
  | "count_submissions"
  | "count_active_roles"
  | "list_roles"
  | "list_deals"
  | "list_interviews"
  | "list_submissions"
  | "list_dropouts"
  | "roles_search"
  | "unknown" {
  const lower = (query || "").toLowerCase();
  if (lower.includes("on hold")) return "roles_on_hold";
  if (lower.includes("worked with")) return "roles_worked_with";
  if (lower.includes("must start") || lower.includes("should start")) return "must_start";
  if ((lower.includes("how many") || lower.includes("count")) && lower.includes("deal")) return "count_deals";
  if ((lower.includes("how many") || lower.includes("count")) && lower.includes("interview")) return "count_interviews";
  if ((lower.includes("how many") || lower.includes("count")) && lower.includes("dropout")) return "count_dropouts";
  if ((lower.includes("how many") || lower.includes("count")) && lower.includes("submission")) return "count_submissions";
  if ((lower.includes("how many") || lower.includes("count")) && lower.includes("active role")) return "count_active_roles";
  if ((lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("table")) && lower.includes("role")) return "list_roles";
  if ((lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("table")) && lower.includes("deal")) return "list_deals";
  if ((lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("table")) && lower.includes("interview")) return "list_interviews";
  if ((lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("table")) && lower.includes("submission")) return "list_submissions";
  if ((lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("table")) && lower.includes("dropout")) return "list_dropouts";
  if (lower.includes("search role") || lower.includes("find role") || lower.includes("search roles") || lower.includes("find roles")) return "roles_search";
  return "unknown";
}
async function countRolesOnHold(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  if (role === "admin") {
    if (period.start && period.end) {
      const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles WHERE status = 'on_hold' AND updated_at BETWEEN ? AND ?").bind(period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles WHERE status = 'on_hold'").first();
    return (row as any)?.total || 0;
  }
  if (role === "account_manager") {
    if (period.start && period.end) {
      const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles WHERE account_manager_id = ? AND status = 'on_hold' AND updated_at BETWEEN ? AND ?").bind((user as any).id, period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles WHERE account_manager_id = ? AND status = 'on_hold'").bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  if (role === "recruitment_manager") {
    if (period.start && period.end) {
      const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles r INNER JOIN client_assignments ca ON r.client_id = ca.client_id WHERE ca.user_id = ? AND r.status = 'on_hold' AND r.updated_at BETWEEN ? AND ?").bind((user as any).id, period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles r INNER JOIN client_assignments ca ON r.client_id = ca.client_id WHERE ca.user_id = ? AND r.status = 'on_hold'").bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  if (role === "recruiter") {
    if (period.start && period.end) {
      const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles r INNER JOIN recruiter_client_assignments rca ON r.client_id = rca.client_id WHERE rca.recruiter_user_id = ? AND r.status = 'on_hold' AND r.updated_at BETWEEN ? AND ?").bind((user as any).id, period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles r INNER JOIN recruiter_client_assignments rca ON r.client_id = rca.client_id WHERE rca.recruiter_user_id = ? AND r.status = 'on_hold'").bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  return 0;
}
async function countRolesWorkedWith(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  if (role === "recruiter") {
    const base = "SELECT COUNT(DISTINCT role_id) as total FROM recruiter_submissions WHERE recruiter_user_id = ?";
    if (period.start && period.end) {
      const row = await db.prepare(base + " AND submission_date BETWEEN ? AND ?").bind((user as any).id, period.start, period.end).first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare(base).bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  if (role === "account_manager") {
    const base = "SELECT COUNT(*) as total FROM am_roles WHERE account_manager_id = ?";
    if (period.start && period.end) {
      const row = await db.prepare(base + " AND created_at BETWEEN ? AND ?").bind((user as any).id, period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare(base).bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  if (role === "recruitment_manager") {
    const base = "SELECT COUNT(*) as total FROM am_roles r INNER JOIN client_assignments ca ON r.client_id = ca.client_id WHERE ca.user_id = ?";
    if (period.start && period.end) {
      const row = await db.prepare(base + " AND r.created_at BETWEEN ? AND ?").bind((user as any).id, period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare(base).bind((user as any).id).first();
    return (row as any)?.total || 0;
  }
  if (role === "admin") {
    if (period.start && period.end) {
      const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles WHERE created_at BETWEEN ? AND ?").bind(period.start, period.end + " 23:59:59").first();
      return (row as any)?.total || 0;
    }
    const row = await db.prepare("SELECT COUNT(*) as total FROM am_roles").first();
    return (row as any)?.total || 0;
  }
  return 0;
}
async function countMustStart(db: any, user: any) {
  const role = (user as any).role as string;
  if (role === "recruiter") {
    const rows = await db.prepare(`
      SELECT COUNT(*) as total
      FROM am_roles r
      INNER JOIN recruiter_client_assignments rca ON r.client_id = rca.client_id
      WHERE rca.recruiter_user_id = ? AND r.status = 'active' AND r.id NOT IN (
        SELECT DISTINCT role_id FROM recruiter_submissions WHERE recruiter_user_id = ?
      )
    `).bind((user as any).id, (user as any).id).first();
    return (rows as any)?.total || 0;
  }
  if (role === "account_manager") {
    const rows = await db.prepare(`
      SELECT COUNT(*) as total
      FROM am_roles r
      WHERE r.account_manager_id = ? AND r.status = 'active' AND r.id NOT IN (
        SELECT DISTINCT role_id FROM recruiter_submissions
      )
    `).bind((user as any).id).first();
    return (rows as any)?.total || 0;
  }
  if (role === "recruitment_manager") {
    const rows = await db.prepare(`
      SELECT COUNT(*) as total
      FROM am_roles r
      INNER JOIN client_assignments ca ON r.client_id = ca.client_id
      WHERE ca.user_id = ? AND r.status = 'active' AND r.id NOT IN (
        SELECT DISTINCT role_id FROM recruiter_submissions
      )
    `).bind((user as any).id).first();
    return (rows as any)?.total || 0;
  }
  return 0;
}
async function countDeals(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  let base = "SELECT COUNT(*) as total FROM recruiter_submissions WHERE entry_type = 'deal'";
  const params: any[] = [];
  if (role === "recruiter") {
    base += " AND recruiter_user_id = ?";
    params.push((user as any).id);
  }
  if (role === "recruitment_manager") {
    base += " AND recruiter_user_id IN (SELECT rta.recruiter_user_id FROM recruiter_team_assignments rta INNER JOIN team_assignments ta ON rta.team_id = ta.team_id WHERE ta.user_id = ?)";
    params.push((user as any).id);
  }
  if (role === "account_manager") {
    base += " AND account_manager_id = ?";
    params.push((user as any).id);
  }
  if (period.start && period.end) {
    base += " AND submission_date BETWEEN ? AND ?";
    params.push(period.start, period.end);
  }
  const row = await db.prepare(base).bind(...params).first();
  return (row as any)?.total || 0;
}
async function countInterviews(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  let base = "SELECT COUNT(*) as total FROM recruiter_submissions WHERE entry_type = 'interview'";
  const params: any[] = [];
  if (role === "recruiter") {
    base += " AND recruiter_user_id = ?";
    params.push((user as any).id);
  }
  if (role === "recruitment_manager") {
    base += " AND recruiter_user_id IN (SELECT rta.recruiter_user_id FROM recruiter_team_assignments rta INNER JOIN team_assignments ta ON rta.team_id = ta.team_id WHERE ta.user_id = ?)";
    params.push((user as any).id);
  }
  if (role === "account_manager") {
    base += " AND account_manager_id = ?";
    params.push((user as any).id);
  }
  if (period.start && period.end) {
    base += " AND submission_date BETWEEN ? AND ?";
    params.push(period.start, period.end);
  }
  const row = await db.prepare(base).bind(...params).first();
  return (row as any)?.total || 0;
}
async function countDropouts(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  let base = "SELECT COUNT(*) as total FROM recruiter_submissions WHERE entry_type = 'dropout'";
  const params: any[] = [];
  if (role === "recruiter") {
    base += " AND recruiter_user_id = ?";
    params.push((user as any).id);
  }
  if (role === "recruitment_manager") {
    base += " AND recruiter_user_id IN (SELECT rta.recruiter_user_id FROM recruiter_team_assignments rta INNER JOIN team_assignments ta ON rta.team_id = ta.team_id WHERE ta.user_id = ?)";
    params.push((user as any).id);
  }
  if (role === "account_manager") {
    base += " AND account_manager_id = ?";
    params.push((user as any).id);
  }
  if (period.start && period.end) {
    base += " AND submission_date BETWEEN ? AND ?";
    params.push(period.start, period.end);
  }
  const row = await db.prepare(base).bind(...params).first();
  return (row as any)?.total || 0;
}
async function countSubmissions(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  let base = "SELECT COUNT(*) as total FROM recruiter_submissions";
  const params: any[] = [];
  const filters: string[] = [];
  if (role === "recruiter") {
    filters.push("recruiter_user_id = ?");
    params.push((user as any).id);
  }
  if (role === "recruitment_manager") {
    filters.push("recruiter_user_id IN (SELECT rta.recruiter_user_id FROM recruiter_team_assignments rta INNER JOIN team_assignments ta ON rta.team_id = ta.team_id WHERE ta.user_id = ?)");
    params.push((user as any).id);
  }
  if (role === "account_manager") {
    filters.push("account_manager_id = ?");
    params.push((user as any).id);
  }
  if (period.start && period.end) {
    filters.push("submission_date BETWEEN ? AND ?");
    params.push(period.start, period.end);
  }
  if (filters.length > 0) {
    base += " WHERE " + filters.join(" AND ");
  }
  const row = await db.prepare(base).bind(...params).first();
  return (row as any)?.total || 0;
}
async function countActiveRoles(db: any, user: any, period: { start?: string; end?: string }) {
  const role = (user as any).role as string;
  let base = "SELECT COUNT(*) as total FROM am_roles WHERE status = 'active'";
  const params: any[] = [];
  if (role === "recruiter") {
    base += " AND client_id IN (SELECT client_id FROM recruiter_client_assignments WHERE recruiter_user_id = ?)";
    params.push((user as any).id);
  } else if (role === "recruitment_manager") {
    base += " AND client_id IN (SELECT client_id FROM client_assignments WHERE user_id = ?)";
    params.push((user as any).id);
  } else if (role === "account_manager") {
    base += " AND account_manager_id = ?";
    params.push((user as any).id);
  }
  if (period.start && period.end) {
    base += " AND updated_at BETWEEN ? AND ?";
    params.push(period.start, period.end + " 23:59:59");
  }
  const row = await db.prepare(base).bind(...params).first();
  return (row as any)?.total || 0;
}
async function listRoles(db: any, user: any, period: { start?: string; end?: string }, status?: string, search?: string) {
  const role = (user as any).role as string;
  const filters: string[] = [];
  const params: any[] = [];
  if (status) {
    filters.push("r.status = ?");
    params.push(status);
  }
  if (search) {
    filters.push("LOWER(r.title) LIKE ?");
    params.push(`%${search.toLowerCase()}%`);
  }
  if (period.start && period.end) {
    filters.push("r.updated_at BETWEEN ? AND ?");
    params.push(period.start, period.end + " 23:59:59");
  }
  if (role === "recruiter") {
    filters.push("r.client_id IN (SELECT client_id FROM recruiter_client_assignments WHERE recruiter_user_id = ?)");
    params.push((user as any).id);
  } else if (role === "recruitment_manager") {
    filters.push("r.client_id IN (SELECT client_id FROM client_assignments WHERE user_id = ?)");
    params.push((user as any).id);
  } else if (role === "account_manager") {
    filters.push("r.account_manager_id = ?");
    params.push((user as any).id);
  }
  const where = filters.length > 0 ? "WHERE " + filters.join(" AND ") : "";
  const rows = await db
    .prepare(`
      SELECT r.id, r.title, r.role_code, r.status, r.updated_at, c.name as client_name, t.name as team_name
      FROM am_roles r
      INNER JOIN clients c ON r.client_id = c.id
      INNER JOIN app_teams t ON r.team_id = t.id
      ${where}
      ORDER BY r.updated_at DESC
      LIMIT 20
    `)
    .bind(...params)
    .all();
  const items = rows.results || [];
  const columns = ["id", "title", "role_code", "status", "client_name", "team_name", "updated_at"];
  return { items, columns };
}
async function listSubmissions(db: any, user: any, period: { start?: string; end?: string }, type?: string) {
  const role = (user as any).role as string;
  const filters: string[] = [];
  const params: any[] = [];
  if (type) {
    filters.push("rs.entry_type = ?");
    params.push(type);
  }
  if (period.start && period.end) {
    filters.push("rs.submission_date BETWEEN ? AND ?");
    params.push(period.start, period.end);
  }
  if (role === "recruiter") {
    filters.push("rs.recruiter_user_id = ?");
    params.push((user as any).id);
  } else if (role === "recruitment_manager") {
    filters.push("rs.recruiter_user_id IN (SELECT rta.recruiter_user_id FROM recruiter_team_assignments rta INNER JOIN team_assignments ta ON rta.team_id = ta.team_id WHERE ta.user_id = ?)");
    params.push((user as any).id);
  } else if (role === "account_manager") {
    filters.push("rs.account_manager_id = ?");
    params.push((user as any).id);
  }
  const where = filters.length > 0 ? "WHERE " + filters.join(" AND ") : "";
  const rows = await db
    .prepare(`
      SELECT rs.id, rs.entry_type, rs.submission_date, rs.candidate_name, rs.interview_level, rs.cv_match_percent,
             c.name as client_name, t.name as team_name, r.title as role_title, r.role_code
      FROM recruiter_submissions rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN app_teams t ON rs.team_id = t.id
      LEFT JOIN am_roles r ON rs.role_id = r.id
      ${where}
      ORDER BY rs.submission_date DESC
      LIMIT 20
    `)
    .bind(...params)
    .all();
  const items = rows.results || [];
  const columns = ["id", "entry_type", "submission_date", "candidate_name", "interview_level", "cv_match_percent", "client_name", "team_name", "role_title", "role_code"];
  return { items, columns };
}
app.post("/api/reports/bot/query", authenticatedUser, async (c) => {
  const db = c.env.DB;
  const user = c.get("currentUser");
  let body: any = {};
  try {
    body = await c.req.json();
  } catch {}
  const query = String(body?.query || "");
  const period = parsePeriod(query, body);
  const intent = parseIntent(query);
  if (intent === "unknown") {
    return c.json({ success: false, error: "Unknown report question" }, 400);
  }
  if (intent === "roles_on_hold") {
    const count = await countRolesOnHold(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "roles_worked_with") {
    const count = await countRolesWorkedWith(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "must_start") {
    const count = await countMustStart(db, user);
    return c.json({ success: true, intent, answer: { count } });
  }
  if (intent === "count_deals") {
    const count = await countDeals(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "count_interviews") {
    const count = await countInterviews(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "count_dropouts") {
    const count = await countDropouts(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "count_submissions") {
    const count = await countSubmissions(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "count_active_roles") {
    const count = await countActiveRoles(db, user, period);
    return c.json({ success: true, intent, period, answer: { count } });
  }
  if (intent === "list_roles") {
    const browse = await listRoles(db, user, period);
    return c.json({ success: true, intent, period, answer: browse });
  }
  if (intent === "list_deals") {
    const browse = await listSubmissions(db, user, period, "deal");
    return c.json({ success: true, intent, period, answer: browse });
  }
  if (intent === "list_interviews") {
    const browse = await listSubmissions(db, user, period, "interview");
    return c.json({ success: true, intent, period, answer: browse });
  }
  if (intent === "list_submissions") {
    const browse = await listSubmissions(db, user, period);
    return c.json({ success: true, intent, period, answer: browse });
  }
  if (intent === "list_dropouts") {
    const browse = await listSubmissions(db, user, period, "dropout");
    return c.json({ success: true, intent, period, answer: browse });
  }
  if (intent === "roles_search") {
    const lower = query.toLowerCase();
    const m = lower.match(/roles?\s*(?:for|with|containing|like)?\s*([a-z0-9\s\-]+)/);
    const term = m && m[1] ? m[1].trim() : "";
    const browse = await listRoles(db, user, period, undefined, term || undefined);
    return c.json({ success: true, intent, period, answer: browse });
  }
  return c.json({ success: false, error: "Unhandled intent" }, 400);
});

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
