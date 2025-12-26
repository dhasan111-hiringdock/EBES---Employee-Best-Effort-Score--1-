import { Hono } from "hono";
import { z } from "zod";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to get authenticated user
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
    return c.json({ error: "User not found" }, 404);
  }

  c.set("currentUser", user);
  await next();
};

// Get current user profile
app.get("/api/profile", authenticatedUser, async (c) => {
  const user = c.get("currentUser") as any;
  return c.json({
    id: (user as any).id,
    email: (user as any).email,
    name: (user as any).name,
    user_code: (user as any).user_code,
    role: (user as any).role,
    is_active: (user as any).is_active,
  });
});

// Update profile
app.put("/api/profile", authenticatedUser, async (c) => {
  const db = c.env.DB;
  const user = c.get("currentUser") as any;
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
  });

  try {
    const data = schema.parse(body);

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      values.push(data.name);
    }
    if (data.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await db
        .prepare("SELECT * FROM users WHERE email = ? AND id != ?")
        .bind(data.email, (user as any).id)
        .first();

      if (existingUser) {
        return c.json({ error: "Email already in use by another user" }, 400);
      }

      updates.push("email = ?");
      values.push(data.email);
    }

    if (updates.length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push((user as any).id);

    await db
      .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Change password
app.post("/api/profile/change-password", authenticatedUser, async (c) => {
  const db = c.env.DB;
  const user = c.get("currentUser") as any;
  const body = await c.req.json();

  const schema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(6),
  });

  try {
    const data = schema.parse(body);

    // Verify current password
    if ((user as any).password !== data.current_password) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    // Update password
    await db
      .prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(data.new_password, (user as any).id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to change password" }, 500);
  }
});

export default app;
