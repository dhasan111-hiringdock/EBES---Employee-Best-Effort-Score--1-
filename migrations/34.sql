
-- Update existing 'user' category to be more specific
-- First, delete the generic 'user' category
DELETE FROM code_counters WHERE category = 'user';

-- Insert specific categories for each role
INSERT INTO code_counters (category, next_number, created_at, updated_at)
VALUES 
  ('admin', 2, datetime('now'), datetime('now')),
  ('recruiter', 1, datetime('now'), datetime('now')),
  ('account_manager', 1, datetime('now'), datetime('now')),
  ('recruitment_manager', 1, datetime('now'), datetime('now'))
ON CONFLICT(category) DO NOTHING;
