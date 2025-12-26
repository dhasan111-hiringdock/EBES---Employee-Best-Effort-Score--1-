
DROP INDEX idx_recruiter_team_assignments_team;
DROP INDEX idx_recruiter_team_assignments_recruiter;
DROP TABLE recruiter_team_assignments;

DROP INDEX idx_client_assignments_client_id;
DROP INDEX idx_client_assignments_user_id;
DROP TABLE client_assignments;

DROP INDEX idx_team_assignments_team_id;
DROP INDEX idx_team_assignments_user_id;
DROP TABLE team_assignments;

DROP INDEX idx_app_teams_team_code;
DROP TABLE app_teams;

DROP INDEX idx_clients_client_code;
DROP TABLE clients;

DROP INDEX idx_users_role;
DROP INDEX idx_users_email;
DROP INDEX idx_users_mocha_user_id;
DROP TABLE users;
