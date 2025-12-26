import { Hono } from "hono";
import type { HonoContext } from "./types";

const app = new Hono<HonoContext>();

// Middleware to check if user is super admin
app.use('/api/super-admin/*', async (c, next) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.DB;
  const user = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first() as any;

  if (!user || user.email !== 'ebes@gmail.com') {
    return c.json({ error: 'Forbidden: Super admin access only' }, 403);
  }

  await next();
});

// Get dashboard stats
app.get('/api/super-admin/dashboard-stats', async (c) => {
  const db = c.env.DB;

  const stats = await db.prepare(`
    SELECT
      COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_companies,
      COUNT(*) as total_companies
    FROM companies
  `).first() as any;

  const userStats = await db.prepare(`
    SELECT
      COUNT(*) as total_users,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
      COUNT(CASE WHEN role = 'account_manager' THEN 1 END) as am_count,
      COUNT(CASE WHEN role = 'recruitment_manager' THEN 1 END) as rm_count,
      COUNT(CASE WHEN role = 'recruiter' THEN 1 END) as recruiter_count
    FROM users
  `).first() as any;

  return c.json({
    active_companies: stats?.active_companies || 0,
    total_companies: stats?.total_companies || 0,
    admin_count: userStats?.admin_count || 0,
    recruiter_count: userStats?.recruiter_count || 0,
    am_count: userStats?.am_count || 0,
    rm_count: userStats?.rm_count || 0,
    total_users: userStats?.total_users || 0
  });
});

// Get all companies
app.get('/api/super-admin/companies', async (c) => {
  const db = c.env.DB;

  // Since users table doesn't have company_id yet, just return companies with zeroes
  const companies = await db.prepare(`
    SELECT 
      c.*,
      0 as admin_count,
      0 as total_users
    FROM companies c
    ORDER BY c.created_at DESC
  `).all();

  return c.json(companies.results || []);
});

// Create company
app.post('/api/super-admin/companies', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, company_code, logo_url } = body;

  if (!name || !company_code) {
    return c.json({ error: 'Name and company code are required' }, 400);
  }

  try {
    const result = await db.prepare(`
      INSERT INTO companies (name, company_code, logo_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(name, company_code, logo_url || null).run();

    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error('Failed to create company:', error);
    return c.json({ error: 'Failed to create company' }, 500);
  }
});

// Update company
app.put('/api/super-admin/companies/:id', async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('id');
  
  const body = await c.req.json();
  const { name, company_code, logo_url, is_active } = body;

  try {
    await db.prepare(`
      UPDATE companies
      SET name = ?, company_code = ?, logo_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, company_code, logo_url || null, is_active, companyId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to update company:', error);
    return c.json({ error: 'Failed to update company' }, 500);
  }
});

// Delete company
app.delete('/api/super-admin/companies/:id', async (c) => {
  const db = c.env.DB;
  const companyId = c.req.param('id');

  // Check if company has users
  const userCount = await db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE company_id = ?
  `).bind(companyId).first() as any;

  if (userCount && userCount.count > 0) {
    return c.json({ error: 'Cannot delete company with existing users' }, 400);
  }

  try {
    await db.prepare('DELETE FROM companies WHERE id = ?').bind(companyId).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete company:', error);
    return c.json({ error: 'Failed to delete company' }, 500);
  }
});

// Get all users across all companies
app.get('/api/super-admin/all-users', async (c) => {
  const db = c.env.DB;

  // Since users table doesn't have company_id yet, just return users
  const users = await db.prepare(`
    SELECT 
      u.*,
      NULL as company_name,
      NULL as company_code
    FROM users u
    ORDER BY u.created_at DESC
  `).all();

  return c.json(users.results || []);
});

// Create company admin
app.post('/api/super-admin/companies/:id/admin', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  // Check if email already exists
  const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  // Generate user code
  const userCodeResult = await db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(user_code, 6) AS INTEGER)), 0) + 1 as next_code
    FROM users
    WHERE user_code LIKE 'ADMIN-%'
  `).first() as any;

  const userCode = `ADMIN-${String(userCodeResult?.next_code || 1).padStart(3, '0')}`;

  try {
    // Note: users table doesn't have company_id column yet, so we create admin without it
    const result = await db.prepare(`
      INSERT INTO users (name, email, password, role, user_code, is_active, created_at, updated_at, mocha_user_id)
      VALUES (?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `).bind(name, email, password, userCode, `admin-${Date.now()}`).run();

    return c.json({ success: true, id: result.meta.last_row_id, user_code: userCode });
  } catch (error) {
    console.error('Failed to create admin:', error);
    return c.json({ error: 'Failed to create admin' }, 500);
  }
});

export default app;
