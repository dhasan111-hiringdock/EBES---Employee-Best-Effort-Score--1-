-- Remove inserted data
DELETE FROM users WHERE id IN (2, 3, 4, 5, 6);
DELETE FROM clients WHERE id IN (1, 2, 3, 4, 5);
DELETE FROM app_teams WHERE id IN (1, 2, 3);

-- Reset counters
UPDATE code_counters SET next_number = 1 WHERE category = 'recruitment_manager';
UPDATE code_counters SET next_number = 1 WHERE category = 'recruiter';
UPDATE code_counters SET next_number = 1 WHERE category = 'account_manager';