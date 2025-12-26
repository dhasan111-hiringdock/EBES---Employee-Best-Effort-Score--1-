
-- Reset all user passwords to 'test123' for recovery
UPDATE users SET password = 'test123' WHERE role != 'admin';
UPDATE users SET password = 'test123' WHERE email = 'dhasan111@gmail.com';

-- Ensure admin account exists with correct email and password
INSERT OR REPLACE INTO users (id, mocha_user_id, email, user_code, role, name, is_active, password)
VALUES (1, 'admin-001', 'dhasan111@gmail.com', 'ADM-001', 'admin', 'Danish Hasan', 1, 'test123');

-- Ensure all users are active
UPDATE users SET is_active = 1;
