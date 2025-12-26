
ALTER TABLE recruiters ADD COLUMN role TEXT DEFAULT 'recruiter';
ALTER TABLE recruiters ADD COLUMN team_id INTEGER;

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recruiters_team_id ON recruiters(team_id);
CREATE INDEX idx_teams_manager_id ON teams(manager_id);
