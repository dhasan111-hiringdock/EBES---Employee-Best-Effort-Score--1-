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

export default app;
