import { Hono } from "hono";
import type { HonoContext } from "./types";
import { z } from "zod";

const app = new Hono<HonoContext>();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Login endpoint
app.post("/api/auth/login", async (c) => {
  const db = c.env.DB;
  
  try {
    const body = await c.req.json();
    const { email, password } = LoginSchema.parse(body);

    // Find user by email (case-insensitive)
    const user = await db
      .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
      .bind(email)
      .first();

    if (!user) {
      console.error(`Login failed: User not found for email: ${email}`);
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const userData = user as any;

    // Check if user is active
    if (!userData.is_active) {
      return c.json({ error: "Your account has been deactivated. Please contact your administrator." }, 403);
    }

    // Verify password (simple comparison - in production use proper hashing)
    if (userData.password !== password) {
      console.error(`Login failed: Invalid password for email: ${email}`);
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Return user data (excluding password)
    // Special case: if email is ebes@gmail.com, return role as super_admin
    const userRole = userData.email === 'ebes@gmail.com' ? 'super_admin' : userData.role;
    
    return c.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userRole,
        user_code: userData.user_code,
        is_active: userData.is_active,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "An error occurred during login" }, 500);
  }
});

// Logout endpoint
app.post("/api/auth/logout", async (c) => {
  return c.json({ success: true });
});

export default app;
