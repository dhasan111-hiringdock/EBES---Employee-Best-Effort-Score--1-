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

// Get notifications for current user
app.get("/api/notifications", authOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user") as any;
  const limit = c.req.query("limit") || "20";
  const unreadOnly = c.req.query("unread_only") === "true";

  try {
    let query = "SELECT * FROM notifications WHERE user_id = ?";
    const params: any[] = [user.id];

    if (unreadOnly) {
      query += " AND is_read = 0";
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const notifications = await db.prepare(query).bind(...params).all();

    return c.json(notifications.results || []);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

// Get unread notification count
app.get("/api/notifications/unread-count", authOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user") as any;

  try {
    const result = await db
      .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0")
      .bind(user.id)
      .first();

    return c.json({ count: (result as any)?.count || 0 });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return c.json({ error: "Failed to fetch unread count" }, 500);
  }
});

// Mark notification as read
app.put("/api/notifications/:id/read", authOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user") as any;
  const notificationId = c.req.param("id");

  try {
    // Verify notification belongs to user
    const notification = await db
      .prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?")
      .bind(notificationId, user.id)
      .first();

    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }

    await db
      .prepare("UPDATE notifications SET is_read = 1, updated_at = datetime('now') WHERE id = ?")
      .bind(notificationId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return c.json({ error: "Failed to mark notification as read" }, 500);
  }
});

// Mark all notifications as read
app.put("/api/notifications/read-all", authOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user") as any;

  try {
    await db
      .prepare("UPDATE notifications SET is_read = 1, updated_at = datetime('now') WHERE user_id = ? AND is_read = 0")
      .bind(user.id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return c.json({ error: "Failed to mark all as read" }, 500);
  }
});

// Delete notification
app.delete("/api/notifications/:id", authOnly, async (c) => {
  const db = c.env.DB;
  const user = c.get("user") as any;
  const notificationId = c.req.param("id");

  try {
    // Verify notification belongs to user
    const notification = await db
      .prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?")
      .bind(notificationId, user.id)
      .first();

    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }

    await db
      .prepare("DELETE FROM notifications WHERE id = ?")
      .bind(notificationId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return c.json({ error: "Failed to delete notification" }, 500);
  }
});

// Helper function to create notification (can be called from other routes)
export async function createNotification(
  db: any,
  params: {
    userId: number;
    type: string;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
  }
) {
  try {
    await db
      .prepare(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.userId, 
        params.type, 
        params.title, 
        params.message, 
        params.relatedEntityType || null, 
        params.relatedEntityId || null
      )
      .run();
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

export default app;
