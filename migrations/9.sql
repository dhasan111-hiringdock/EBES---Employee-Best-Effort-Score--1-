
-- Roles table for Account Managers
CREATE TABLE am_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_code TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  account_manager_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('active', 'lost', 'deal', 'on_hold', 'cancelled', 'no_answer')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_am_roles_account_manager ON am_roles(account_manager_id);
CREATE INDEX idx_am_roles_client ON am_roles(client_id);
CREATE INDEX idx_am_roles_team ON am_roles(team_id);
CREATE INDEX idx_am_roles_status ON am_roles(status);
