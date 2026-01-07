import { Hono } from "hono";
import type { HonoContext } from "./types";
import { cors } from "hono/cors";
import authRoutes from "./auth-routes";
import adminRoutes from "./admin-routes";
import accountManagerRoutes from "./account-manager-routes";
import profileRoutes from "./profile-routes";
import recruiterRoutes from "./recruiter-routes";
import recruiterCandidatesRoutes from "./recruiter-candidates-routes";
import recruitmentManagerRoutes from "./recruitment-manager-routes";
import companyRoutes from "./company-routes";
import superAdminRoutes from "./super-admin-routes";
import notificationRoutes from "./notification-routes";
import employeeRoutes from "./employee-routes";
import { createNotification } from "./notification-routes";

const app = new Hono<HonoContext>();

// Enable CORS
app.use("*", cors());

// Mount auth routes
app.route("/", authRoutes);

// Mount admin routes
app.route("/", adminRoutes);
app.route("/", accountManagerRoutes);
app.route("/", profileRoutes);
app.route("/", recruiterRoutes);
app.route("/api/recruiter", recruiterCandidatesRoutes);
app.route("/", recruitmentManagerRoutes);
app.route("/", companyRoutes);
app.route("/", superAdminRoutes);
app.route("/", notificationRoutes);
app.route("/", employeeRoutes);

export default {
  fetch: app.fetch,
  scheduled: async (_event: any, env: any, _ctx: any) => {
    const db = env.DB;
    const settingsRows = await db
      .prepare(`
        SELECT setting_key, setting_value 
        FROM app_settings 
        WHERE setting_key IN (
          'sla_rm_eval_days',
          'sla_submitted_days',
          'sla_client_feedback_days'
        )
      `)
      .all();
    const settingsMap: Record<string, number> = {};
    for (const row of settingsRows.results || []) {
      const r = row as any;
      const n = Number(r.setting_value);
      if (!Number.isNaN(n) && n > 0) settingsMap[r.setting_key] = n;
    }
    const thresholds: Record<string, number> = {
      rm_evaluation: settingsMap.sla_rm_eval_days ?? 2,
      submitted: settingsMap.sla_submitted_days ?? 3,
      client_submitted: settingsMap.sla_client_feedback_days ?? 5,
    };

    const overdueByStatus = async (status: string, days: number) => {
      const rows = await db
        .prepare(`
          SELECT 
            cra.id as assoc_id,
            cra.role_id,
            cra.candidate_id,
            c.name as candidate_name,
            ar.account_manager_id,
            ar.team_id,
            ar.title as role_title
          FROM candidate_role_associations cra
          INNER JOIN candidates c ON c.id = cra.candidate_id
          INNER JOIN am_roles ar ON ar.id = cra.role_id
          WHERE cra.is_discarded = 0
            AND cra.status = ?
            AND datetime(cra.updated_at) <= datetime('now', ?)
        `)
        .bind(status, `-${days} day`)
        .all();
      return rows.results || [];
    };

    const hasRecentSlaNotification = async (userId: number, assocId: number) => {
      const existing = await db
        .prepare(`
          SELECT 1 FROM notifications
          WHERE user_id = ?
            AND type = 'sla'
            AND related_entity_type = 'candidate_role_association'
            AND related_entity_id = ?
            AND datetime(created_at) >= datetime('now','-1 day')
          LIMIT 1
        `)
        .bind(userId, assocId)
        .first();
      return !!existing;
    };

    const getRmForTeam = async (teamId: number) => {
      const rm = await db
        .prepare(`
          SELECT u.id FROM users u
          INNER JOIN team_assignments ta ON u.id = ta.user_id
          WHERE ta.team_id = ? AND u.role = 'recruitment_manager'
          LIMIT 1
        `)
        .bind(teamId)
        .first();
      return (rm as any)?.id || null;
    };

    const notifyIfNeeded = async (userId: number | null, title: string, message: string, assocId: number) => {
      if (!userId) return;
      const skip = await hasRecentSlaNotification(userId, assocId);
      if (skip) return;
      await createNotification(db, {
        userId,
        type: "sla",
        title,
        message,
        relatedEntityType: "candidate_role_association",
        relatedEntityId: assocId,
      });
    };

    const rmEvalOverdue = await overdueByStatus("rm_evaluation", thresholds.rm_evaluation);
    for (const row of rmEvalOverdue) {
      const r = row as any;
      const rmId = await getRmForTeam(Number(r.team_id));
      const title = "RM Evaluation Overdue";
      const message = `Candidate ${r.candidate_name} for role ${r.role_title} pending RM evaluation for ${thresholds.rm_evaluation}+ days.`;
      await notifyIfNeeded(rmId, title, message, Number(r.assoc_id));
    }

    const submittedOverdue = await overdueByStatus("submitted", thresholds.submitted);
    for (const row of submittedOverdue) {
      const r = row as any;
      const amId = (r.account_manager_id as number) || null;
      const title = "Client Submission Overdue";
      const message = `Candidate ${r.candidate_name} for role ${r.role_title} not submitted to client for ${thresholds.submitted}+ days.`;
      await notifyIfNeeded(amId, title, message, Number(r.assoc_id));
    }

    const clientSubmittedOverdue = await overdueByStatus("client_submitted", thresholds.client_submitted);
    for (const row of clientSubmittedOverdue) {
      const r = row as any;
      const amId = (r.account_manager_id as number) || null;
      const rmId = await getRmForTeam(Number(r.team_id));
      const title = "Client Feedback Overdue";
      const message = `Candidate ${r.candidate_name} for role ${r.role_title} pending client feedback for ${thresholds.client_submitted}+ days.`;
      await notifyIfNeeded(amId, title, message, Number(r.assoc_id));
      await notifyIfNeeded(rmId, title, message, Number(r.assoc_id));
    }
  },
};
