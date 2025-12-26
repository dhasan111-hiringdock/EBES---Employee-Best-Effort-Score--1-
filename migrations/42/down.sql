
-- Remove is_lost_role flag from candidate_role_associations
ALTER TABLE candidate_role_associations DROP COLUMN is_lost_role;
