
-- Delete all assignment data for non-admin users
DELETE FROM recruiter_client_assignments WHERE recruiter_user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');
DELETE FROM recruiter_team_assignments WHERE recruiter_user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');
DELETE FROM team_assignments WHERE user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');
DELETE FROM client_assignments WHERE user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');

-- Delete recruiter submissions and related data
DELETE FROM role_status_pending WHERE created_by_user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');
DELETE FROM recruiter_submissions WHERE recruiter_user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');

-- Delete AM role data
DELETE FROM am_role_interviews WHERE role_id IN (SELECT id FROM am_roles WHERE account_manager_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com'));
DELETE FROM am_roles WHERE account_manager_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');
DELETE FROM am_monthly_reminders WHERE user_id IN (SELECT id FROM users WHERE email != 'dhasan111@gmail.com');

-- Finally, delete all users except admin
DELETE FROM users WHERE email != 'dhasan111@gmail.com';
