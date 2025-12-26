
-- Insert admin user if not exists
INSERT OR IGNORE INTO users (mocha_user_id, email, password, name, role, user_code, is_active, created_at, updated_at)
VALUES ('admin_001', 'dhasan111@gmail.com', 'test123', 'Admin User', 'admin', 'ADM-001', 1, datetime('now'), datetime('now'));
