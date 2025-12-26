
-- Delete all data except admin user to allow migration #27 to run
-- This prepares the database for clean production deployment

-- Delete all assignment data
DELETE FROM recruiter_client_assignments;
DELETE FROM recruiter_team_assignments;
DELETE FROM client_assignments;
DELETE FROM team_assignments;
DELETE FROM role_recruiter_assignments;

-- Delete all role and submission data
DELETE FROM role_status_pending;
DELETE FROM am_role_teams;
DELETE FROM am_role_interviews;
DELETE FROM recruiter_submissions;
DELETE FROM am_roles;

-- Delete all company data
DELETE FROM companies WHERE id != 0;

-- Delete teams and clients
DELETE FROM app_teams;
DELETE FROM clients;

-- Delete all users except the admin
DELETE FROM users WHERE email != 'dhasan111@gmail.com';

-- Delete legacy tables data
DELETE FROM daily_entries;
DELETE FROM entry_notes;
DELETE FROM roles_worked;
DELETE FROM weekly_roles_tracking;
DELETE FROM ooo_dates;
DELETE FROM teams;
DELETE FROM recruiters;

-- Delete monthly reminders
DELETE FROM am_monthly_reminders;

-- Reset code counters to start fresh
UPDATE code_counters SET next_number = 1 WHERE category IN ('user', 'client', 'team', 'role');

-- Ensure admin user has correct values
UPDATE users 
SET 
  mocha_user_id = 'admin-001',
  user_code = 'ADM-001',
  role = 'admin',
  name = 'Danish Hasan',
  password = 'test123',
  is_active = 1
WHERE email = 'dhasan111@gmail.com';
