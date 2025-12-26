
-- Add is_lost_role flag to candidate_role_associations
ALTER TABLE candidate_role_associations ADD COLUMN is_lost_role INTEGER DEFAULT 0;
