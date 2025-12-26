
-- Complete database reset to allow migration #27 to run cleanly
-- Delete ALL users including admin - migration #27 will recreate them

DELETE FROM recruiter_client_assignments;
DELETE FROM recruiter_team_assignments;
DELETE FROM client_assignments;
DELETE FROM team_assignments;
DELETE FROM role_recruiter_assignments;
DELETE FROM role_status_pending;
DELETE FROM am_role_teams;
DELETE FROM am_role_interviews;
DELETE FROM recruiter_submissions;
DELETE FROM am_roles;
DELETE FROM companies;
DELETE FROM app_teams;
DELETE FROM clients;
DELETE FROM am_monthly_reminders;
DELETE FROM app_settings;

-- Delete ALL users to let migration #27 recreate them
DELETE FROM users;

-- Delete legacy data
DELETE FROM daily_entries;
DELETE FROM entry_notes;
DELETE FROM roles_worked;
DELETE FROM weekly_roles_tracking;
DELETE FROM ooo_dates;
DELETE FROM teams;
DELETE FROM recruiters;

-- Reset ALL counters to 1
DELETE FROM code_counters;
INSERT INTO code_counters (category, next_number) VALUES 
  ('user', 1),
  ('client', 1),
  ('team', 1),
  ('role', 1);
