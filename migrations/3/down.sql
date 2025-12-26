
DROP INDEX idx_teams_manager_id;
DROP INDEX idx_recruiters_team_id;
DROP TABLE teams;
ALTER TABLE recruiters DROP COLUMN team_id;
ALTER TABLE recruiters DROP COLUMN role;
