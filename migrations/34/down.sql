
-- Revert back to generic 'user' category
DELETE FROM code_counters WHERE category IN ('admin', 'recruiter', 'account_manager', 'recruitment_manager');

INSERT INTO code_counters (category, next_number, created_at, updated_at)
VALUES ('user', 1, datetime('now'), datetime('now'))
ON CONFLICT(category) DO NOTHING;
