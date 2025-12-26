
-- Only insert if they don't exist
INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
VALUES 
  (2, 1, 1, datetime('now'), datetime('now')),
  (2, 2, 1, datetime('now'), datetime('now')),
  (2, 3, 1, datetime('now'), datetime('now')),
  (5, 4, 1, datetime('now'), datetime('now')),
  (5, 5, 1, datetime('now'), datetime('now')),
  (6, 1, 1, datetime('now'), datetime('now')),
  (6, 2, 1, datetime('now'), datetime('now')),
  (6, 3, 1, datetime('now'), datetime('now')),
  (6, 4, 1, datetime('now'), datetime('now')),
  (6, 5, 1, datetime('now'), datetime('now'));
