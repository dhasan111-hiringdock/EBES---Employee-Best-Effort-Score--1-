
-- Update the default admin account
UPDATE users 
SET email = 'danish.hasan@nextlink.ch', 
    password = 'test123',
    name = 'Danish Hasan',
    is_active = 1
WHERE email = 'dhasan111@gmail.com' AND role = 'admin';

-- If the admin doesn't exist, create it
INSERT OR IGNORE INTO users (mocha_user_id, email, user_code, role, name, password, is_active, created_at, updated_at)
VALUES ('admin_default', 'danish.hasan@nextlink.ch', 'ADM-001', 'admin', 'Danish Hasan', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Delete all demo/test data except the default admin
DELETE FROM recruiter_submissions;
DELETE FROM role_status_pending;
DELETE FROM recruiter_client_assignments WHERE recruiter_user_id IN (SELECT id FROM users WHERE email != 'danish.hasan@nextlink.ch');
DELETE FROM am_monthly_reminders;
DELETE FROM am_role_interviews;
DELETE FROM am_roles WHERE account_manager_id IN (SELECT id FROM users WHERE email != 'danish.hasan@nextlink.ch');
DELETE FROM team_assignments WHERE user_id IN (SELECT id FROM users WHERE email != 'danish.hasan@nextlink.ch');
DELETE FROM client_assignments WHERE user_id IN (SELECT id FROM users WHERE email != 'danish.hasan@nextlink.ch');
DELETE FROM users WHERE email != 'danish.hasan@nextlink.ch';
DELETE FROM clients;
DELETE FROM app_teams;

-- Reset code counters
UPDATE code_counters SET next_number = 2 WHERE category = 'admin';
UPDATE code_counters SET next_number = 1 WHERE category IN ('recruitment_manager', 'account_manager', 'recruiter');
