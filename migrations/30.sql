
-- This migration ensures all necessary assignments exist without conflicts
-- Using INSERT OR IGNORE to skip if data already exists

-- Ensure team assignments exist
INSERT OR IGNORE INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 2, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM team_assignments WHERE user_id = 2 AND team_id = 1);

INSERT OR IGNORE INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 5, 2, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM team_assignments WHERE user_id = 5 AND team_id = 2);

INSERT OR IGNORE INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 3, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM team_assignments WHERE user_id = 6 AND team_id = 3);

-- Ensure client assignments exist
INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 2, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 2 AND client_id = 1);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 2, 2, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 2 AND client_id = 2);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 2, 3, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 2 AND client_id = 3);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 5, 4, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 5 AND client_id = 4);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 5, 5, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 5 AND client_id = 5);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 6 AND client_id = 1);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 2, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 6 AND client_id = 2);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 3, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 6 AND client_id = 3);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 4, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 6 AND client_id = 4);

INSERT OR IGNORE INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
SELECT 6, 5, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM client_assignments WHERE user_id = 6 AND client_id = 5);

-- Ensure recruiter team assignments exist
INSERT OR IGNORE INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at, updated_at)
SELECT 1, 3, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_team_assignments WHERE recruiter_user_id = 3 AND team_id = 1);

INSERT OR IGNORE INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at, updated_at)
SELECT 2, 4, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_team_assignments WHERE recruiter_user_id = 4 AND team_id = 2);

-- Ensure recruiter client assignments exist
INSERT OR IGNORE INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 3, 1, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_client_assignments WHERE recruiter_user_id = 3 AND client_id = 1 AND team_id = 1);

INSERT OR IGNORE INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 3, 2, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_client_assignments WHERE recruiter_user_id = 3 AND client_id = 2 AND team_id = 1);

INSERT OR IGNORE INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 3, 3, 1, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_client_assignments WHERE recruiter_user_id = 3 AND client_id = 3 AND team_id = 1);

INSERT OR IGNORE INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 4, 4, 2, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_client_assignments WHERE recruiter_user_id = 4 AND client_id = 4 AND team_id = 2);

INSERT OR IGNORE INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at, updated_at)
SELECT 4, 5, 2, 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM recruiter_client_assignments WHERE recruiter_user_id = 4 AND client_id = 5 AND team_id = 2);
