import { Hono } from "hono";
import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  CreateClientSchema,
  UpdateClientSchema,
  CreateTeamSchema,
  UpdateTeamSchema,
  AssignTeamSchema,
  AssignClientSchema,
} from "../shared/types";
import { createNotification } from "./notification-routes";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to check if user is admin
const adminOnly = async (c: any, next: any) => {
  const db = c.env.DB;
  
  try {
    // Get user from request body/headers (in a real app, this would come from JWT or session)
    // For now, we'll accept user_id from request header
    const userId = c.req.header('x-user-id');
    
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const appUser = await db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_active = 1")
      .bind(userId)
      .first();

    if (!appUser) {
      return c.json({ error: "Unauthorized - Admin access required" }, 403);
    }

    c.set("appUser", appUser);
    await next();
  } catch (error) {
    return c.json({ error: "Unauthorized" }, 401);
  }
};

// Helper function to generate unique user code
async function generateUserCode(db: any, role: string): Promise<string> {
  let category: string;
  let prefix: string;

  switch (role) {
    case "admin":
      category = "admin";
      prefix = "ADM";
      break;
    case "recruitment_manager":
      category = "recruitment_manager";
      prefix = "RM";
      break;
    case "account_manager":
      category = "account_manager";
      prefix = "AM";
      break;
    case "recruiter":
      category = "recruiter";
      prefix = "REC";
      break;
    default:
      throw new Error("Invalid role");
  }

  // Get and increment counter
  const counter = await db
    .prepare("SELECT next_number FROM code_counters WHERE category = ?")
    .bind(category)
    .first();

  const number = (counter as any).next_number;
  const code = `${prefix}-${number.toString().padStart(3, "0")}`;

  // Increment counter
  await db
    .prepare("UPDATE code_counters SET next_number = next_number + 1 WHERE category = ?")
    .bind(category)
    .run();

  return code;
}

// Helper function to generate client code
async function generateClientCode(db: any, shortName: string): Promise<string> {
  const prefix = `CL-${shortName.toUpperCase()}`;
  
  // Find the next available number for this client prefix
  const existingCodes = await db
    .prepare("SELECT client_code FROM clients WHERE client_code LIKE ?")
    .bind(`${prefix}-%`)
    .all();

  let maxNumber = 0;
  for (const row of existingCodes.results || []) {
    const code = (row as any).client_code;
    const parts = code.split("-");
    if (parts.length === 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  return `${prefix}-${nextNumber.toString().padStart(3, "0")}`;
}

// Helper function to generate team code
async function generateTeamCode(db: any): Promise<string> {
  const existingCodes = await db
    .prepare("SELECT team_code FROM app_teams ORDER BY id DESC LIMIT 1")
    .first();

  let nextNumber = 1;
  if (existingCodes) {
    const code = (existingCodes as any).team_code;
    const parts = code.split("-");
    if (parts.length === 2 && parts[0] === "TEAM") {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num)) {
        nextNumber = num + 1;
      }
    }
  }

  return `TEAM-${nextNumber.toString().padStart(3, "0")}`;
}

// Create new user (TESTING MODE - auth removed)
app.post("/api/admin/users", adminOnly, async (c) => {
  const body = await c.req.json();
  const validatedData = CreateUserSchema.parse(body);
  const db = c.env.DB;

  try {
    // Check if email already exists
    const existingUser = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(validatedData.email)
      .first();

    if (existingUser) {
      return c.json({ error: "User with this email already exists" }, 400);
    }

    // Generate user code
    const userCode = await generateUserCode(db, validatedData.role);

    // Create placeholder mocha_user_id (will be updated when user first logs in)
    const mochaUserId = `pending_${validatedData.email}`;

    // Insert user
    const result = await db
      .prepare(`
        INSERT INTO users (mocha_user_id, email, user_code, role, name, password, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(mochaUserId, validatedData.email, userCode, validatedData.role, validatedData.name, validatedData.password)
      .run();

    // Create notification for new user
    await createNotification(db, {
      userId: result.meta.last_row_id,
      type: 'system',
      title: 'Welcome to EBES',
      message: `Your account has been created. Your user code is ${userCode}. Please check your email for login credentials.`,
      relatedEntityType: 'user',
      relatedEntityId: result.meta.last_row_id
    });

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      user_code: userCode,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Get all users (TESTING MODE - auth removed)
app.get("/api/admin/users", adminOnly, async (c) => {
  const db = c.env.DB;

  try {
    const users = await db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    return c.json(users.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// Update user
app.put("/api/admin/users/:id", adminOnly, async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json();
  const validatedData = UpdateUserSchema.parse(body);
  const db = c.env.DB;

  try {
    // Check if this is the protected admin account
    const user = await db
      .prepare("SELECT email, role FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if ((user as any)?.email === 'dhasan111@gmail.com' && (user as any)?.role === 'admin') {
      // Prevent role change and deactivation for protected admin
      if (validatedData.role !== undefined && validatedData.role !== 'admin') {
        return c.json({ error: "Cannot change the role of the default admin account" }, 403);
      }
      if (validatedData.is_active !== undefined && !validatedData.is_active) {
        return c.json({ error: "Cannot deactivate the default admin account" }, 403);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push("name = ?");
      values.push(validatedData.name);
    }
    if (validatedData.role !== undefined) {
      updates.push("role = ?");
      values.push(validatedData.role);
    }
    if (validatedData.password !== undefined) {
      updates.push("password = ?");
      values.push(validatedData.password);
    }
    if (validatedData.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(validatedData.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(userId);

    await db
      .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// Delete user
app.delete("/api/admin/users/:id", adminOnly, async (c) => {
  const userId = c.req.param("id");
  const db = c.env.DB;

  try {
    // Check if this is the protected admin account
    const user = await db
      .prepare("SELECT email, role FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if ((user as any)?.email === 'dhasan111@gmail.com' && (user as any)?.role === 'admin') {
      return c.json({ error: "Cannot delete the default admin account" }, 403);
    }

    // Delete related assignments first
    await db.prepare("DELETE FROM team_assignments WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM client_assignments WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM recruiter_team_assignments WHERE recruiter_user_id = ?").bind(userId).run();

    // Delete user
    await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

// Create client (TESTING MODE - auth removed)
app.post("/api/admin/clients", adminOnly, async (c) => {
  const body = await c.req.json();
  const validatedData = CreateClientSchema.parse(body);
  const db = c.env.DB;

  try {
    // Generate client code
    const clientCode = await generateClientCode(db, validatedData.short_name);

    // Insert client
    const result = await db
      .prepare(`
        INSERT INTO clients (client_code, name, short_name, is_active)
        VALUES (?, ?, ?, 1)
      `)
      .bind(clientCode, validatedData.name, validatedData.short_name)
      .run();

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      client_code: clientCode,
    });
  } catch (error) {
    return c.json({ error: "Failed to create client" }, 500);
  }
});

// Get all clients (TESTING MODE - auth removed)
app.get("/api/admin/clients", adminOnly, async (c) => {
  const db = c.env.DB;

  try {
    const clients = await db.prepare("SELECT * FROM clients ORDER BY created_at DESC").all();
    return c.json(clients.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
});

// Update client
app.put("/api/admin/clients/:id", adminOnly, async (c) => {
  const clientId = c.req.param("id");
  const body = await c.req.json();
  const validatedData = UpdateClientSchema.parse(body);
  const db = c.env.DB;

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push("name = ?");
      values.push(validatedData.name);
    }
    if (validatedData.short_name !== undefined) {
      updates.push("short_name = ?");
      values.push(validatedData.short_name);
    }
    if (validatedData.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(validatedData.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(clientId);

    await db
      .prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update client" }, 500);
  }
});

// Delete client
app.delete("/api/admin/clients/:id", adminOnly, async (c) => {
  const clientId = c.req.param("id");
  const db = c.env.DB;

  try {
    // Delete related assignments first
    await db.prepare("DELETE FROM client_assignments WHERE client_id = ?").bind(clientId).run();

    // Delete client
    await db.prepare("DELETE FROM clients WHERE id = ?").bind(clientId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete client" }, 500);
  }
});

// Create team (TESTING MODE - auth removed)
app.post("/api/admin/teams", adminOnly, async (c) => {
  const body = await c.req.json();
  const validatedData = CreateTeamSchema.parse(body);
  const db = c.env.DB;

  try {
    // Generate team code
    const teamCode = await generateTeamCode(db);

    // Insert team
    const result = await db
      .prepare(`
        INSERT INTO app_teams (team_code, name, is_active)
        VALUES (?, ?, 1)
      `)
      .bind(teamCode, validatedData.name)
      .run();

    return c.json({
      success: true,
      id: result.meta.last_row_id,
      team_code: teamCode,
    });
  } catch (error) {
    return c.json({ error: "Failed to create team" }, 500);
  }
});

// Get all teams (TESTING MODE - auth removed)
app.get("/api/admin/teams", adminOnly, async (c) => {
  const db = c.env.DB;

  try {
    const teams = await db.prepare("SELECT * FROM app_teams ORDER BY created_at DESC").all();
    return c.json(teams.results || []);
  } catch (error) {
    return c.json({ error: "Failed to fetch teams" }, 500);
  }
});

// Update team
app.put("/api/admin/teams/:id", adminOnly, async (c) => {
  const teamId = c.req.param("id");
  const body = await c.req.json();
  const validatedData = UpdateTeamSchema.parse(body);
  const db = c.env.DB;

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (validatedData.name !== undefined) {
      updates.push("name = ?");
      values.push(validatedData.name);
    }
    if (validatedData.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(validatedData.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(teamId);

    await db
      .prepare(`UPDATE app_teams SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update team" }, 500);
  }
});

// Delete team
app.delete("/api/admin/teams/:id", adminOnly, async (c) => {
  const teamId = c.req.param("id");
  const db = c.env.DB;

  try {
    // Delete related assignments first
    await db.prepare("DELETE FROM team_assignments WHERE team_id = ?").bind(teamId).run();
    await db.prepare("DELETE FROM recruiter_team_assignments WHERE team_id = ?").bind(teamId).run();

    // Delete team
    await db.prepare("DELETE FROM app_teams WHERE id = ?").bind(teamId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete team" }, 500);
  }
});

// Assign team to user (Recruitment Manager or Account Manager) (TESTING MODE - auth removed)
app.post("/api/admin/assign-team", adminOnly, async (c) => {
  const body = await c.req.json();
  const validatedData = AssignTeamSchema.parse(body);
  const db = c.env.DB;
  const adminUser = c.get("appUser");

  try {
    // Check if assignment already exists
    const existing = await db
      .prepare("SELECT * FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind(validatedData.user_id, validatedData.team_id)
      .first();

    if (existing) {
      return c.json({ error: "Team already assigned to this user" }, 400);
    }

    // Insert assignment
    await db
      .prepare(`
        INSERT INTO team_assignments (user_id, team_id, assigned_by_user_id)
        VALUES (?, ?, ?)
      `)
      .bind(validatedData.user_id, validatedData.team_id, (adminUser as any).id)
      .run();

    // Get team name for notification
    const team = await db
      .prepare("SELECT name FROM app_teams WHERE id = ?")
      .bind(validatedData.team_id)
      .first();

    // Create notification for user
    await createNotification(db, {
      userId: validatedData.user_id,
      type: 'role_assignment',
      title: 'Team Assigned',
      message: `You have been assigned to team: ${(team as any)?.name || 'Unknown'}`,
      relatedEntityType: 'team',
      relatedEntityId: validatedData.team_id
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to assign team" }, 500);
  }
});

// Assign client to Account Manager or Recruitment Manager (TESTING MODE - auth removed)
app.post("/api/admin/assign-client", adminOnly, async (c) => {
  const body = await c.req.json();
  const validatedData = AssignClientSchema.parse(body);
  const db = c.env.DB;
  const adminUser = c.get("appUser");

  try {
    // Verify user is an account manager or recruitment manager
    const user = await db
      .prepare("SELECT * FROM users WHERE id = ? AND (role = 'account_manager' OR role = 'recruitment_manager')")
      .bind(validatedData.user_id)
      .first();

    if (!user) {
      return c.json({ error: "User is not an Account Manager or Recruitment Manager" }, 400);
    }

    // Check if assignment already exists
    const existing = await db
      .prepare("SELECT * FROM client_assignments WHERE user_id = ? AND client_id = ?")
      .bind(validatedData.user_id, validatedData.client_id)
      .first();

    if (existing) {
      return c.json({ error: "Client already assigned to this user" }, 400);
    }

    // Insert assignment
    await db
      .prepare(`
        INSERT INTO client_assignments (user_id, client_id, assigned_by_user_id)
        VALUES (?, ?, ?)
      `)
      .bind(validatedData.user_id, validatedData.client_id, (adminUser as any).id)
      .run();

    // Get client name for notification
    const client = await db
      .prepare("SELECT name FROM clients WHERE id = ?")
      .bind(validatedData.client_id)
      .first();

    // Create notification for user
    await createNotification(db, {
      userId: validatedData.user_id,
      type: 'role_assignment',
      title: 'Client Assigned',
      message: `You have been assigned to client: ${(client as any)?.name || 'Unknown'}`,
      relatedEntityType: 'client',
      relatedEntityId: validatedData.client_id
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to assign client" }, 500);
  }
});

// Get user assignments (teams and clients) (TESTING MODE - auth removed)
app.get("/api/admin/users/:userId/assignments", adminOnly, async (c) => {
  const userId = c.req.param("userId");
  const db = c.env.DB;

  try {
    // Check user role
    const user = await db.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first();
    
    if ((user as any)?.role === "recruiter") {
      // For recruiters, get recruiter-client assignments with team info
      const recruiterClientAssignments = await db
        .prepare(`
          SELECT rca.id, rca.client_id, c.name as client_name, c.client_code,
                 rca.team_id, t.name as team_name, t.team_code
          FROM recruiter_client_assignments rca
          INNER JOIN clients c ON rca.client_id = c.id
          INNER JOIN app_teams t ON rca.team_id = t.id
          WHERE rca.recruiter_user_id = ?
        `)
        .bind(userId)
        .all();
      
      return c.json({
        recruiter_clients: recruiterClientAssignments.results || [],
        teams: [],
        clients: [],
      });
    } else {
      // For other roles, get team and client assignments
      const teamAssignments = await db
        .prepare(`
          SELECT t.* FROM app_teams t
          INNER JOIN team_assignments ta ON t.id = ta.team_id
          WHERE ta.user_id = ?
        `)
        .bind(userId)
        .all();

      const clientAssignments = await db
        .prepare(`
          SELECT c.* FROM clients c
          INNER JOIN client_assignments ca ON c.id = ca.client_id
          WHERE ca.user_id = ?
        `)
        .bind(userId)
        .all();

      return c.json({
        teams: teamAssignments.results || [],
        clients: clientAssignments.results || [],
      });
    }
  } catch (error) {
    return c.json({ error: "Failed to fetch assignments" }, 500);
  }
});

// Unassign team from user (TESTING MODE - auth removed)
app.delete("/api/admin/unassign-team", adminOnly, async (c) => {
  const body = await c.req.json();
  const { user_id, team_id } = body;
  const db = c.env.DB;

  try {
    await db
      .prepare("DELETE FROM team_assignments WHERE user_id = ? AND team_id = ?")
      .bind(user_id, team_id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to unassign team" }, 500);
  }
});

// Unassign client from user (TESTING MODE - auth removed)
app.delete("/api/admin/unassign-client", adminOnly, async (c) => {
  const body = await c.req.json();
  const { user_id, client_id } = body;
  const db = c.env.DB;

  try {
    await db
      .prepare("DELETE FROM client_assignments WHERE user_id = ? AND client_id = ?")
      .bind(user_id, client_id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to unassign client" }, 500);
  }
});

// Assign client to recruiter (TESTING MODE - auth removed)
app.post("/api/admin/assign-recruiter-client", adminOnly, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const adminUser = c.get("appUser");

  const AssignRecruiterClientSchema = z.object({
    recruiter_user_id: z.number(),
    client_id: z.number(),
    team_id: z.number(),
  });

  try {
    const data = AssignRecruiterClientSchema.parse(body);

    // Check if assignment already exists
    const existing = await db
      .prepare("SELECT * FROM recruiter_client_assignments WHERE recruiter_user_id = ? AND client_id = ? AND team_id = ?")
      .bind(data.recruiter_user_id, data.client_id, data.team_id)
      .first();

    if (existing) {
      return c.json({ error: "Client already assigned to this recruiter" }, 400);
    }

    // Insert assignment
    await db
      .prepare(`
        INSERT INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id)
        VALUES (?, ?, ?, ?)
      `)
      .bind(data.recruiter_user_id, data.client_id, data.team_id, (adminUser as any).id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to assign client" }, 500);
  }
});

// Delete recruiter-client assignment (TESTING MODE - auth removed)
app.delete("/api/admin/recruiter-client/:recruiterId/:clientId", adminOnly, async (c) => {
  const recruiterId = c.req.param("recruiterId");
  const clientId = c.req.param("clientId");
  const db = c.env.DB;

  try {
    await db
      .prepare("DELETE FROM recruiter_client_assignments WHERE recruiter_user_id = ? AND client_id = ?")
      .bind(recruiterId, clientId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to remove assignment" }, 500);
  }
});

// Assign recruiter to team (TESTING MODE - auth removed)
app.post("/api/admin/assign-recruiter-team", adminOnly, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const adminUser = c.get("appUser");

  const AssignRecruiterTeamSchema = z.object({
    recruiter_user_id: z.number(),
    team_id: z.number(),
  });

  try {
    const data = AssignRecruiterTeamSchema.parse(body);

    // Verify recruiter exists
    const recruiter = await db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'recruiter'")
      .bind(data.recruiter_user_id)
      .first();

    if (!recruiter) {
      return c.json({ error: "Recruiter not found" }, 404);
    }

    // Check if assignment already exists
    const existing = await db
      .prepare("SELECT * FROM recruiter_team_assignments WHERE recruiter_user_id = ? AND team_id = ?")
      .bind(data.recruiter_user_id, data.team_id)
      .first();

    if (existing) {
      return c.json({ error: "Team already assigned to this recruiter" }, 400);
    }

    // Insert team assignment
    await db
      .prepare(`
        INSERT INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
      .bind(data.team_id, data.recruiter_user_id, (adminUser as any).id)
      .run();

    // Get all active clients
    const clientsResult = await db
      .prepare("SELECT id FROM clients WHERE is_active = 1")
      .all();
    
    const clients = clientsResult.results || [];

    // If there's exactly one client, auto-assign recruiter to that client
    if (clients.length === 1) {
      const clientId = (clients[0] as any).id;
      
      const existingClientAssignment = await db
        .prepare("SELECT * FROM recruiter_client_assignments WHERE recruiter_user_id = ? AND client_id = ? AND team_id = ?")
        .bind(data.recruiter_user_id, clientId, data.team_id)
        .first();

      if (!existingClientAssignment) {
        await db
          .prepare(`
            INSERT INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `)
          .bind(data.recruiter_user_id, clientId, data.team_id, (adminUser as any).id)
          .run();
      }
    }

    return c.json({ 
      success: true,
      auto_assigned_client: clients.length === 1
    });
  } catch (error) {
    console.error("Error assigning recruiter to team:", error);
    return c.json({ error: "Failed to assign team" }, 500);
  }
});

// Delete recruiter-team assignment
app.delete("/api/admin/recruiter-team/:recruiterId/:teamId", adminOnly, async (c) => {
  const recruiterId = c.req.param("recruiterId");
  const teamId = c.req.param("teamId");
  const db = c.env.DB;

  try {
    await db
      .prepare("DELETE FROM recruiter_team_assignments WHERE recruiter_user_id = ? AND team_id = ?")
      .bind(recruiterId, teamId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to remove assignment" }, 500);
  }
});

// Get comprehensive performance stats for all users (admin dashboard)
app.get("/api/admin/performance-stats", adminOnly, async (c) => {
  const db = c.env.DB;
  const role = c.req.query("role");
  const userName = c.req.query("userName");
  const teamId = c.req.query("teamId");
  const clientId = c.req.query("clientId");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  try {
    // Get all users with their role
    let userQuery = "SELECT * FROM users WHERE is_active = 1";
    const queryParams: any[] = [];

    if (role && role !== "all") {
      userQuery += " AND role = ?";
      queryParams.push(role);
    }

    if (userName) {
      userQuery += " AND (name LIKE ? OR email LIKE ? OR user_code LIKE ?)";
      const searchTerm = `%${userName}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    userQuery += " ORDER BY role, name";

    const usersResult = await db.prepare(userQuery).bind(...queryParams).all();
    const users = usersResult.results || [];

    const stats = [];

    for (const user of users) {
      const userData = user as any;

      // Get teams assigned to this user
      const teamsResult = await db
        .prepare(`
          SELECT t.id, t.name, t.team_code
          FROM app_teams t
          INNER JOIN team_assignments ta ON t.id = ta.team_id
          WHERE ta.user_id = ?
        `)
        .bind(userData.id)
        .all();
      const teams = teamsResult.results || [];

      // Get clients assigned to this user
      const clientsResult = await db
        .prepare(`
          SELECT c.id, c.name, c.client_code
          FROM clients c
          INNER JOIN client_assignments ca ON c.id = ca.client_id
          WHERE ca.user_id = ?
        `)
        .bind(userData.id)
        .all();
      const clients = clientsResult.results || [];

      // Apply team filter
      if (teamId && teamId !== "all") {
        if (!teams.find((t: any) => t.id === parseInt(teamId))) {
          continue;
        }
      }

      // Apply client filter
      if (clientId && clientId !== "all") {
        if (!clients.find((c: any) => c.id === parseInt(clientId))) {
          continue;
        }
      }

      let userStats: any = {
        user_id: userData.id,
        user_code: userData.user_code,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        teams: teams.map((t: any) => ({ id: t.id, name: t.name, code: t.team_code })),
        clients: clients.map((c: any) => ({ id: c.id, name: c.name, code: c.client_code })),
        ebesScore: 0,
        performanceLabel: "No Data",
      };

      if (userData.role === "recruiter") {
        // Get submissions with date filter
        let submissionsQuery = "SELECT * FROM recruiter_submissions WHERE recruiter_user_id = ?";
        const submissionsParams = [userData.id];

        if (startDate) {
          submissionsQuery += " AND submission_date >= ?";
          submissionsParams.push(startDate);
        }
        if (endDate) {
          submissionsQuery += " AND submission_date <= ?";
          submissionsParams.push(endDate);
        }

        const submissionsResult = await db
          .prepare(submissionsQuery)
          .bind(...submissionsParams)
          .all();
        const submissions = submissionsResult.results || [];

        let totalSubmissions = 0;
        let interviews1st = 0;
        let interviews2nd = 0;
        let interviews3rd = 0;
        let deals = 0;
        let dropouts = 0;

        for (const sub of submissions) {
          const subData = sub as any;
          if (subData.entry_type === "submission") totalSubmissions++;
          else if (subData.entry_type === "interview") {
            if (subData.interview_level === 1) interviews1st++;
            else if (subData.interview_level === 2) interviews2nd++;
            else if (subData.interview_level === 3) interviews3rd++;
          }
          else if (subData.entry_type === "deal") deals++;
          else if (subData.entry_type === "dropout") dropouts++;
        }

        const totalInterviews = interviews1st + interviews2nd + interviews3rd;

        // Calculate EBES score for recruiter
        const table1Points =
          totalSubmissions * 1.5 + totalInterviews * 3.0 + deals * 7.0;

        // Get active roles count
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

        let performanceLabel = "No Data";
        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        userStats = {
          ...userStats,
          totalSubmissions,
          interviews1st,
          interviews2nd,
          interviews3rd,
          totalInterviews,
          deals,
          dropouts,
          activeRoles,
          nonActiveRoles: 0,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        };
      } else if (userData.role === "account_manager") {
        // Get roles created by this AM with date filter
        let rolesQuery = "SELECT * FROM am_roles WHERE account_manager_id = ?";
        const rolesParams = [userData.id];

        if (startDate) {
          rolesQuery += " AND created_at >= ?";
          rolesParams.push(startDate);
        }
        if (endDate) {
          rolesQuery += " AND created_at <= ?";
          rolesParams.push(endDate);
        }

        const rolesResult = await db.prepare(rolesQuery).bind(...rolesParams).all();
        const roles = rolesResult.results || [];

        const totalRoles = roles.length;
        const activeRoles = roles.filter((r: any) => r.status === "active").length;
        const dealsClosedRoles = roles.filter((r: any) => r.status === "deal").length;
        const lostRoles = roles.filter((r: any) => r.status === "lost").length;
        const onHoldRoles = roles.filter((r: any) => r.status === "on_hold").length;
        const noAnswerRoles = roles.filter((r: any) => r.status === "no_answer").length;

        // Get interviews for AM's roles
        const interviewsResult = await db
          .prepare(`
            SELECT interview_round, SUM(interview_count) as count
            FROM am_role_interviews
            WHERE role_id IN (SELECT id FROM am_roles WHERE account_manager_id = ?)
            GROUP BY interview_round
          `)
          .bind(userData.id)
          .all();
        
        let interviews1st = 0;
        let interviews2nd = 0;
        let interviews3rd = 0;
        
        for (const row of interviewsResult.results || []) {
          const r = row as any;
          if (r.interview_round === 1) interviews1st = r.count;
          else if (r.interview_round === 2) interviews2nd = r.count;
          else if (r.interview_round === 3) interviews3rd = r.count;
        }
        
        const totalInterviews = interviews1st + interviews2nd + interviews3rd;

        // Calculate EBES score for AM
        const table1Points = activeRoles * 3.0 + dealsClosedRoles * 7.0 + totalInterviews * 2.0;
        const table2Points = totalRoles * 4.0;
        const ebesScore = table2Points > 0 ? (table1Points / table2Points) * 100 : 0;

        let performanceLabel = "No Data";
        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        userStats = {
          ...userStats,
          totalRoles,
          activeRoles,
          nonActiveRoles: totalRoles - activeRoles,
          dealsClosedRoles,
          lostRoles,
          onHoldRoles,
          noAnswerRoles,
          interviews1st,
          interviews2nd,
          interviews3rd,
          totalInterviews,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        };
      } else if (userData.role === "recruitment_manager") {
        // Get teams managed by this RM
        const managedTeams = teams.length;

        // Get recruiters under RM (from their teams)
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

        // Get roles under RM's teams/clients
        let rmRolesQuery = `
          SELECT r.*
          FROM am_roles r
          INNER JOIN client_assignments ca ON r.client_id = ca.client_id
          WHERE ca.user_id = ?
        `;
        const rmRolesParams = [userData.id];

        if (startDate) {
          rmRolesQuery += " AND r.created_at >= ?";
          rmRolesParams.push(startDate);
        }
        if (endDate) {
          rmRolesQuery += " AND r.created_at <= ?";
          rmRolesParams.push(endDate);
        }

        const rmRolesResult = await db.prepare(rmRolesQuery).bind(...rmRolesParams).all();
        const rmRoles = rmRolesResult.results || [];

        const totalRoles = rmRoles.length;
        const activeRoles = rmRoles.filter((r: any) => r.status === "active").length;

        // Get deals from recruiters under RM
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

        // Get interviews
        const interviewsResult = await db
          .prepare(`
            SELECT rs.interview_level, COUNT(*) as count
            FROM recruiter_submissions rs
            INNER JOIN recruiter_team_assignments rta ON rs.recruiter_user_id = rta.recruiter_user_id
            INNER JOIN team_assignments ta ON rta.team_id = ta.team_id
            WHERE ta.user_id = ? AND rs.entry_type = 'interview'
            GROUP BY rs.interview_level
          `)
          .bind(userData.id)
          .all();
        
        let interviews1st = 0;
        let interviews2nd = 0;
        let interviews3rd = 0;
        
        for (const row of interviewsResult.results || []) {
          const r = row as any;
          if (r.interview_level === 1) interviews1st = r.count;
          else if (r.interview_level === 2) interviews2nd = r.count;
          else if (r.interview_level === 3) interviews3rd = r.count;
        }
        
        const totalInterviews = interviews1st + interviews2nd + interviews3rd;

        // Calculate EBES score for RM
        const table1Points = totalDeals * 7.0 + totalInterviews * 3.0 + activeRoles * 2.0;
        const table2Points = totalRecruiters * 5.0 + managedTeams * 3.0;
        const ebesScore = table2Points > 0 ? (table1Points / table2Points) * 100 : 0;

        let performanceLabel = "No Data";
        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        userStats = {
          ...userStats,
          managedTeams,
          totalRecruiters,
          totalRoles,
          activeRoles,
          nonActiveRoles: totalRoles - activeRoles,
          totalDeals,
          interviews1st,
          interviews2nd,
          interviews3rd,
          totalInterviews,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        };
      }

      stats.push(userStats);
    }

    return c.json(stats);
  } catch (error) {
    console.error("Error fetching performance stats:", error);
    return c.json({ error: "Failed to fetch performance stats" }, 500);
  }
});

// Organization-wide role aging and SLA metrics (admin)
app.get("/api/admin/sla", adminOnly, async (c) => {
  const db = c.env.DB;
  const clientId = c.req.query("client_id");
  const teamId = c.req.query("team_id");
  const status = c.req.query("status") || "active";

  try {
    let query = `
      SELECT r.*
      FROM am_roles r
      WHERE 1 = 1
    `;
    const params: any[] = [];

    if (clientId) {
      query += " AND r.client_id = ?";
      params.push(parseInt(clientId));
    }
    if (teamId) {
      query += " AND r.team_id = ?";
      params.push(parseInt(teamId));
    }
    if (status && status !== "all") {
      query += " AND r.status = ?";
      params.push(status);
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
        .prepare(
          `SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND entry_type = 'submission' ORDER BY submission_date ASC LIMIT 1`
        )
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
        .prepare(
          `SELECT submission_date FROM recruiter_submissions WHERE role_id = ? AND entry_type = 'interview' ORDER BY submission_date ASC LIMIT 1`
        )
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
        .prepare(
          "SELECT am_decision FROM dropout_requests WHERE role_id = ? AND final_status = 'completed' ORDER BY am_decided_at DESC LIMIT 1"
        )
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
    console.error("Error fetching admin SLA metrics:", error);
    return c.json({ error: "Failed to fetch SLA metrics" }, 500);
  }
});

// Get leaderboards for admin
app.get("/api/admin/leaderboards", adminOnly, async (c) => {
  const db = c.env.DB;

  try {
    // Get all users with basic EBES calculations
    const usersResult = await db.prepare("SELECT * FROM users WHERE is_active = 1").all();
    const users = usersResult.results || [];

    const recruiters = [];
    const accountManagers = [];
    const recruitmentManagers = [];

    for (const user of users) {
      const userData = user as any;

      // Get teams for this user
      const teamsResult = await db
        .prepare(`
          SELECT t.name
          FROM app_teams t
          INNER JOIN team_assignments ta ON t.id = ta.team_id
          WHERE ta.user_id = ?
          LIMIT 1
        `)
        .bind(userData.id)
        .first();
      const teamName = (teamsResult as any)?.name || "No Team";

      let ebesScore = 0;
      let performanceLabel = "No Data";

      if (userData.role === "recruiter") {
        const submissionsResult = await db
          .prepare("SELECT * FROM recruiter_submissions WHERE recruiter_user_id = ?")
          .bind(userData.id)
          .all();
        const submissions = submissionsResult.results || [];

        let totalSubmissions = 0;
        let totalInterviews = 0;
        let deals = 0;
        let totalDropouts = 0;

        for (const sub of submissions) {
          const subData = sub as any;
          if (subData.entry_type === "submission") totalSubmissions++;
          else if (subData.entry_type === "interview") totalInterviews++;
          else if (subData.entry_type === "deal") deals++;
          else if (subData.entry_type === "dropout") totalDropouts++;
        }

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

        const table1Points = totalSubmissions * 1.5 + totalInterviews * 3.0 + deals * 7.0 - ((lostRoles + totalDropouts) * 3.0);

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

        const table2Raw = activeRoles * 4.0;
        const table2Points = Math.min(table2Raw, 20);
        const effectiveT2 = Math.max(table2Points, 1);
        ebesScore = (table1Points / effectiveT2) * 100;

        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        recruiters.push({
          name: userData.name,
          team: teamName,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        });
      } else if (userData.role === "account_manager") {
        const rolesResult = await db
          .prepare("SELECT * FROM am_roles WHERE account_manager_id = ?")
          .bind(userData.id)
          .all();
        const roles = rolesResult.results || [];

        const totalRoles = roles.length;
        const activeRoles = roles.filter((r: any) => r.status === "active").length;
        const dealsClosedRoles = roles.filter((r: any) => r.status === "deal").length;

        const interviewsResult = await db
          .prepare(`
            SELECT SUM(interview_count) as count
            FROM am_role_interviews
            WHERE role_id IN (SELECT id FROM am_roles WHERE account_manager_id = ?)
          `)
          .bind(userData.id)
          .first();
        const totalInterviews = (interviewsResult as any)?.count || 0;

        const table1Points = activeRoles * 3.0 + dealsClosedRoles * 7.0 + totalInterviews * 2.0;
        const table2Points = totalRoles * 4.0;
        const effectiveT2 = Math.max(table2Points, 1);
        ebesScore = (table1Points / effectiveT2) * 100;

        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        accountManagers.push({
          name: userData.name,
          team: teamName,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        });
      } else if (userData.role === "recruitment_manager") {
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

        const interviewsResult = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM recruiter_submissions rs
            INNER JOIN recruiter_team_assignments rta ON rs.recruiter_user_id = rta.recruiter_user_id
            INNER JOIN team_assignments ta ON rta.team_id = ta.team_id
            WHERE ta.user_id = ? AND rs.entry_type = 'interview'
          `)
          .bind(userData.id)
          .first();
        const totalInterviews = (interviewsResult as any)?.count || 0;

        const rolesResult = await db
          .prepare(`
            SELECT COUNT(*) as count
            FROM am_roles r
            INNER JOIN client_assignments ca ON r.client_id = ca.client_id
            WHERE ca.user_id = ? AND r.status = 'active'
          `)
          .bind(userData.id)
          .first();
        const activeRoles = (rolesResult as any)?.count || 0;

        const table1Points = totalDeals * 7.0 + totalInterviews * 3.0 + activeRoles * 2.0;
        const table2Points = totalRecruiters * 5.0 + managedTeams * 3.0;
        ebesScore = table2Points > 0 ? (table1Points / table2Points) * 100 : 0;

        if (ebesScore >= 80) performanceLabel = "Excellent";
        else if (ebesScore >= 60) performanceLabel = "Good";
        else if (ebesScore >= 40) performanceLabel = "Average";
        else if (ebesScore > 0) performanceLabel = "Needs Improvement";

        recruitmentManagers.push({
          name: userData.name,
          team: teamName,
          ebesScore: Math.min(100, Math.max(0, Math.round(ebesScore * 10) / 10)),
          performanceLabel,
        });
      }
    }

    // Sort by EBES score
    recruiters.sort((a, b) => b.ebesScore - a.ebesScore);
    accountManagers.sort((a, b) => b.ebesScore - a.ebesScore);
    recruitmentManagers.sort((a, b) => b.ebesScore - a.ebesScore);

    return c.json({
      recruiters: recruiters.slice(0, 10),
      accountManagers: accountManagers.slice(0, 10),
      recruitmentManagers: recruitmentManagers.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching leaderboards:", error);
    return c.json({ error: "Failed to fetch leaderboards" }, 500);
  }
});

// Get employee profile visibility settings
app.get("/api/admin/profile-settings", adminOnly, async (c) => {
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
      settingsMap[data.setting_key] = data.setting_value === 'true';
    }

    return c.json(settingsMap);
  } catch (error) {
    console.error("Error fetching profile settings:", error);
    return c.json({ error: "Failed to fetch profile settings" }, 500);
  }
});

// Update employee profile visibility settings
app.put("/api/admin/profile-settings", adminOnly, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const schema = z.object({
    show_employee_profiles: z.boolean().optional(),
    show_recruiter_stats: z.boolean().optional(),
    show_rm_stats: z.boolean().optional(),
    show_am_stats: z.boolean().optional(),
    show_client_stats: z.boolean().optional(),
    show_team_stats: z.boolean().optional(),
  });

  try {
    const data = schema.parse(body);

    // Update each setting
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        await db
          .prepare(`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?
          `)
          .bind(key, value ? 'true' : 'false', value ? 'true' : 'false')
          .run();
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating profile settings:", error);
    return c.json({ error: "Failed to update profile settings" }, 500);
  }
});

export default app;
