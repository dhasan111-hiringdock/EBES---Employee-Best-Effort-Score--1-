
CREATE TABLE am_role_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, team_id)
);

CREATE INDEX idx_am_role_teams_role_id ON am_role_teams(role_id);
CREATE INDEX idx_am_role_teams_team_id ON am_role_teams(team_id);
