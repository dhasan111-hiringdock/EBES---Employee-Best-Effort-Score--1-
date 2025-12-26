
-- Remove sample data
DELETE FROM roles_worked WHERE recruiter_id > 1;
DELETE FROM daily_entries WHERE recruiter_id > 1;
DELETE FROM recruiters WHERE id > 1;
DELETE FROM teams WHERE id > 0;
