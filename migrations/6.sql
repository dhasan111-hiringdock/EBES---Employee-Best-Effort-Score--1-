
-- Users table (extends Mocha authentication with app-specific data)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'recruiter', 'account_manager', 'recruitment_manager')),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_mocha_user_id ON users(mocha_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Clients table
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_client_code ON clients(client_code);

-- Teams table (updated to remove manager_id, will use assignments)
CREATE TABLE app_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_teams_team_code ON app_teams(team_code);

-- Team assignments (for Recruitment Managers and Account Managers)
CREATE TABLE team_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_assignments_user_id ON team_assignments(user_id);
CREATE INDEX idx_team_assignments_team_id ON team_assignments(team_id);

-- Client assignments (for Account Managers)
CREATE TABLE client_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_assignments_user_id ON client_assignments(user_id);
CREATE INDEX idx_client_assignments_client_id ON client_assignments(client_id);

-- Recruiter assignments (recruiters assigned to teams by Recruitment Managers)
CREATE TABLE recruiter_team_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recruiter_team_assignments_recruiter ON recruiter_team_assignments(recruiter_user_id);
CREATE INDEX idx_recruiter_team_assignments_team ON recruiter_team_assignments(team_id);
