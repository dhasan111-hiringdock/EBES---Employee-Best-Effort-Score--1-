
-- Remove all user data except admin and super admin
DELETE FROM recruiter_submissions;
DELETE FROM recruiter_client_assignments;
DELETE FROM role_recruiter_assignments;
DELETE FROM role_status_pending;
DELETE FROM am_role_interviews;
DELETE FROM am_role_teams;
DELETE FROM am_roles;
DELETE FROM am_monthly_reminders;
DELETE FROM client_assignments;
DELETE FROM team_assignments;
DELETE FROM recruiter_team_assignments;
DELETE FROM app_teams;
DELETE FROM clients;

-- Remove old recruiter table data
DELETE FROM daily_entries;
DELETE FROM entry_notes;
DELETE FROM roles_worked;
DELETE FROM weekly_roles_tracking;
DELETE FROM ooo_dates;
DELETE FROM teams;
DELETE FROM recruiters;

-- Remove all users except admin (id=1) and super admin (id=32)
DELETE FROM users WHERE id NOT IN (1, 32);

-- Reset code counters
UPDATE code_counters SET next_number = 1 WHERE category = 'admin';
UPDATE code_counters SET next_number = 1 WHERE category = 'recruitment_manager';
UPDATE code_counters SET next_number = 1 WHERE category = 'account_manager';
UPDATE code_counters SET next_number = 1 WHERE category = 'recruiter';
UPDATE code_counters SET next_number = 1 WHERE category = 'am_role';

-- Update admin user code to ADM-001 if needed
UPDATE users SET user_code = 'ADM-001' WHERE id = 1 AND user_code != 'ADM-001';

-- Ensure super admin has correct code
UPDATE users SET user_code = 'SUPER-001' WHERE id = 32;
