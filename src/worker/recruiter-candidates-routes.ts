import { Hono } from 'hono';
import type { HonoContext } from './types';

const app = new Hono<HonoContext>();

// Middleware to ensure recruiter access
const recruiterOnly = async (c: any, next: any) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: 'Unauthorized - User ID required' }, 401);
  }

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE id = ? AND role = ? AND is_active = 1')
    .bind(userId, 'recruiter')
    .first();

  if (!user) {
    return c.json({ error: 'Unauthorized - Recruiter access required' }, 401);
  }

  c.set('user', user);
  await next();
};

app.use('*', recruiterOnly);

// Generate candidate code
async function generateCandidateCode(db: any): Promise<string> {
  const counter = await db.prepare(
    'SELECT next_number FROM code_counters WHERE category = ?'
  ).bind('candidate').first();

  const nextNumber = counter?.next_number || 1;
  const code = `NL-${String(nextNumber).padStart(4, '0')}`;

  await db.prepare(
    'UPDATE code_counters SET next_number = next_number + 1 WHERE category = ?'
  ).bind('candidate').run();

  return code;
}

// Get all candidates (active and inactive)
app.get('/candidates', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const isActive = c.req.query('is_active');
    const searchQuery = c.req.query('search');

    let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT cra.id) as total_associations,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 0 THEN cra.id END) as active_associations,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 1 THEN cra.id END) as discarded_associations
      FROM candidates c
      LEFT JOIN candidate_role_associations cra ON c.id = cra.candidate_id AND cra.recruiter_user_id = ?
      WHERE c.created_by_user_id = ?
    `;
    
    const params: any[] = [user.id, user.id];

    if (isActive !== undefined) {
      query += ` AND c.is_active = ?`;
      params.push(isActive === '1' ? 1 : 0);
    }

    if (searchQuery) {
      query += ` AND c.name LIKE ?`;
      params.push(`%${searchQuery}%`);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const { results } = await db.prepare(query).bind(...params).all();

    return c.json(results);
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get single candidate details
app.get('/candidates/:id', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('id');
    const db = c.env.DB;

    const candidate = await db.prepare(`
      SELECT * FROM candidates 
      WHERE id = ? AND created_by_user_id = ?
    `).bind(candidateId, user.id).first();

    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404);
    }

    // Get all role associations for this candidate
    const { results: associations } = await db.prepare(`
      SELECT 
        cra.*,
        r.role_code,
        r.title as role_title,
        r.description as role_description,
        r.status as role_status,
        cl.name as client_name,
        cl.client_code,
        t.name as team_name,
        t.team_code,
        u.name as account_manager_name,
        rec.name as recruiter_name,
        rec.user_code as recruiter_code
      FROM candidate_role_associations cra
      INNER JOIN am_roles r ON cra.role_id = r.id
      INNER JOIN clients cl ON cra.client_id = cl.id
      INNER JOIN app_teams t ON cra.team_id = t.id
      LEFT JOIN users u ON r.account_manager_id = u.id
      LEFT JOIN users rec ON cra.recruiter_user_id = rec.id
      WHERE cra.candidate_id = ? AND cra.recruiter_user_id = ?
      ORDER BY cra.created_at DESC
    `).bind(candidateId, user.id).all();

    return c.json({
      candidate,
      associations
    });
  } catch (error: any) {
    console.error('Error fetching candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create candidate
app.post('/candidates', async (c) => {
  try {
    const user = c.get('user');
    const db = c.env.DB;
    const body = await c.req.json();

    const { name, email, phone, resume_url, notes } = body;

    if (!name) {
      return c.json({ error: 'Candidate name is required' }, 400);
    }

    const candidateCode = await generateCandidateCode(db);

    const result = await db.prepare(`
      INSERT INTO candidates (candidate_code, name, email, phone, resume_url, notes, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      candidateCode,
      name.trim(),
      email?.trim() || null,
      phone?.trim() || null,
      resume_url?.trim() || null,
      notes?.trim() || null,
      user.id
    ).run();

    const candidate = await db.prepare('SELECT * FROM candidates WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return c.json(candidate, 201);
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update candidate
app.put('/candidates/:id', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('id');
    const db = c.env.DB;
    const body = await c.req.json();

    const candidate = await db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND created_by_user_id = ?
    `).bind(candidateId, user.id).first();

    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404);
    }

    const { name, email, phone, resume_url, notes } = body;

    await db.prepare(`
      UPDATE candidates 
      SET name = ?, email = ?, phone = ?, resume_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      name?.trim() || candidate.name,
      email?.trim() || null,
      phone?.trim() || null,
      resume_url?.trim() || null,
      notes?.trim() || null,
      candidateId
    ).run();

    const updated = await db.prepare('SELECT * FROM candidates WHERE id = ?')
      .bind(candidateId).first();

    return c.json(updated);
  } catch (error: any) {
    console.error('Error updating candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Discard candidate (mark as inactive)
app.post('/candidates/:id/discard', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('id');
    const db = c.env.DB;

    const candidate = await db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND created_by_user_id = ?
    `).bind(candidateId, user.id).first();

    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404);
    }

    // Mark candidate as inactive
    await db.prepare(`
      UPDATE candidates 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(candidateId).run();

    // Mark all role associations as discarded (not lost role)
    await db.prepare(`
      UPDATE candidate_role_associations 
      SET is_discarded = 1, 
          is_lost_role = 0,
          discarded_at = CURRENT_TIMESTAMP,
          discarded_reason = 'Candidate globally discarded',
          updated_at = CURRENT_TIMESTAMP
      WHERE candidate_id = ? AND recruiter_user_id = ? AND is_discarded = 0
    `).bind(candidateId, user.id).run();

    return c.json({ message: 'Candidate discarded successfully' });
  } catch (error: any) {
    console.error('Error discarding candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Restore candidate (mark as active)
app.post('/candidates/:id/restore', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('id');
    const db = c.env.DB;

    const candidate = await db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND created_by_user_id = ?
    `).bind(candidateId, user.id).first();

    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404);
    }

    // Mark candidate as active
    await db.prepare(`
      UPDATE candidates 
      SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(candidateId).run();

    // Restore all role associations that were globally discarded
    await db.prepare(`
      UPDATE candidate_role_associations 
      SET is_discarded = 0, 
          discarded_at = NULL,
          discarded_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE candidate_id = ? 
        AND recruiter_user_id = ? 
        AND is_discarded = 1 
        AND discarded_reason = 'Candidate globally discarded'
    `).bind(candidateId, user.id).run();

    return c.json({ message: 'Candidate restored successfully' });
  } catch (error: any) {
    console.error('Error restoring candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Search for similar candidates by name (for duplicate detection)
app.get('/candidates/search/similar', async (c) => {
  try {
    const db = c.env.DB;
    const name = c.req.query('name');

    if (!name || name.trim().length < 3) {
      return c.json([]);
    }

    const { results } = await db.prepare(`
      SELECT 
        c.*,
        COUNT(DISTINCT cra.id) as total_associations,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 0 THEN cra.id END) as active_associations,
        COUNT(DISTINCT CASE WHEN cra.is_discarded = 1 THEN cra.id END) as discarded_associations
      FROM candidates c
      LEFT JOIN candidate_role_associations cra ON c.id = cra.candidate_id
      WHERE c.name LIKE ?
      GROUP BY c.id
      ORDER BY c.is_active DESC, c.name
      LIMIT 5
    `).bind(`%${name.trim()}%`).all();

    return c.json(results);
  } catch (error: any) {
    console.error('Error searching similar candidates:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Associate candidate with role
app.post('/candidates/:id/associate', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('id');
    const db = c.env.DB;
    const body = await c.req.json();

    const { role_id, client_id, team_id, submission_date, status } = body;

    if (!role_id || !client_id || !team_id || !submission_date) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify candidate exists and belongs to user
    const candidate = await db.prepare(`
      SELECT * FROM candidates WHERE id = ? AND created_by_user_id = ?
    `).bind(candidateId, user.id).first();

    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404);
    }

    // Create association
    await db.prepare(`
      INSERT INTO candidate_role_associations 
      (candidate_id, role_id, recruiter_user_id, client_id, team_id, status, submission_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      candidateId,
      role_id,
      user.id,
      client_id,
      team_id,
      status || 'submitted',
      submission_date
    ).run();

    return c.json({ message: 'Candidate associated with role successfully' });
  } catch (error: any) {
    console.error('Error associating candidate:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Discard candidate from role
app.post('/candidates/:candidateId/roles/:roleId/discard', async (c) => {
  try {
    const user = c.get('user');
    const candidateId = c.req.param('candidateId');
    const roleId = c.req.param('roleId');
    const db = c.env.DB;
    const body = await c.req.json();

    const { reason } = body;

    await db.prepare(`
      UPDATE candidate_role_associations 
      SET is_discarded = 1, 
          discarded_at = CURRENT_TIMESTAMP,
          discarded_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE candidate_id = ? 
        AND role_id = ? 
        AND recruiter_user_id = ?
    `).bind(reason || null, candidateId, roleId, user.id).run();

    return c.json({ message: 'Candidate discarded from role successfully' });
  } catch (error: any) {
    console.error('Error discarding candidate from role:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
