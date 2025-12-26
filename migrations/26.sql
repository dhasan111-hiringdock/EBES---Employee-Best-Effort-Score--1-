
-- Update all references from super admin (id=32) to main admin (id=1)
UPDATE team_assignments SET user_id = 1 WHERE user_id = 32;
UPDATE team_assignments SET assigned_by_user_id = 1 WHERE assigned_by_user_id = 32;

UPDATE client_assignments SET user_id = 1 WHERE user_id = 32;
UPDATE client_assignments SET assigned_by_user_id = 1 WHERE assigned_by_user_id = 32;

UPDATE recruiter_team_assignments SET recruiter_user_id = 1 WHERE recruiter_user_id = 32;
UPDATE recruiter_team_assignments SET assigned_by_user_id = 1 WHERE assigned_by_user_id = 32;

UPDATE recruiter_client_assignments SET recruiter_user_id = 1 WHERE recruiter_user_id = 32;
UPDATE recruiter_client_assignments SET assigned_by_user_id = 1 WHERE assigned_by_user_id = 32;

UPDATE am_roles SET account_manager_id = 1 WHERE account_manager_id = 32;

UPDATE am_monthly_reminders SET user_id = 1 WHERE user_id = 32;

UPDATE recruiter_submissions SET recruiter_user_id = 1 WHERE recruiter_user_id = 32;
UPDATE recruiter_submissions SET account_manager_id = 1 WHERE account_manager_id = 32;
UPDATE recruiter_submissions SET recruitment_manager_id = 1 WHERE recruitment_manager_id = 32;

UPDATE role_status_pending SET created_by_user_id = 1 WHERE created_by_user_id = 32;

UPDATE role_recruiter_assignments SET recruiter_user_id = 1 WHERE recruiter_user_id = 32;
UPDATE role_recruiter_assignments SET assigned_by_user_id = 1 WHERE assigned_by_user_id = 32;

-- Delete the super admin user
DELETE FROM users WHERE id = 32;
