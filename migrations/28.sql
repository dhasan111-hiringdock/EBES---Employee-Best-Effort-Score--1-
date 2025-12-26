
-- Assign RM Danish to team Ts-Consultancy (id=1)
INSERT INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
VALUES (2, 1, 1, datetime('now'), datetime('now'));

-- Assign RM Mitul to team Ts-DACH (id=2)
INSERT INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
VALUES (5, 2, 1, datetime('now'), datetime('now'));

-- Assign AM Natalia to team Ts-Spain (id=3)
INSERT INTO team_assignments (user_id, team_id, assigned_by_user_id, created_at, updated_at)
VALUES (6, 3, 1, datetime('now'), datetime('now'));

-- Assign RM Danish to clients AG Assurance, UCB, Sandoz
INSERT INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
VALUES 
  (2, 1, 1, datetime('now'), datetime('now')),
  (2, 2, 1, datetime('now'), datetime('now')),
  (2, 3, 1, datetime('now'), datetime('now'));

-- Assign RM Mitul to clients Roche, BI
INSERT INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
VALUES 
  (5, 4, 1, datetime('now'), datetime('now')),
  (5, 5, 1, datetime('now'), datetime('now'));

-- Assign AM Natalia to all clients
INSERT INTO client_assignments (user_id, client_id, assigned_by_user_id, created_at, updated_at)
VALUES 
  (6, 1, 1, datetime('now'), datetime('now')),
  (6, 2, 1, datetime('now'), datetime('now')),
  (6, 3, 1, datetime('now'), datetime('now')),
  (6, 4, 1, datetime('now'), datetime('now')),
  (6, 5, 1, datetime('now'), datetime('now'));

-- Assign recruiter Adela to team Ts-Consultancy
INSERT INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at)
VALUES (1, 3, 1, datetime('now'));

-- Assign recruiter Suchitra to team Ts-DACH
INSERT INTO recruiter_team_assignments (team_id, recruiter_user_id, assigned_by_user_id, created_at)
VALUES (2, 4, 1, datetime('now'));

-- Assign recruiter Adela to clients AG Assurance, UCB, Sandoz with team Ts-Consultancy
INSERT INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at)
VALUES 
  (3, 1, 1, 1, datetime('now')),
  (3, 2, 1, 1, datetime('now')),
  (3, 3, 1, 1, datetime('now'));

-- Assign recruiter Suchitra to clients Roche, BI with team Ts-DACH
INSERT INTO recruiter_client_assignments (recruiter_user_id, client_id, team_id, assigned_by_user_id, created_at)
VALUES 
  (4, 4, 2, 1, datetime('now')),
  (4, 5, 2, 1, datetime('now'));
