
CREATE TABLE recruiter_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  account_manager_id INTEGER NOT NULL,
  recruitment_manager_id INTEGER,
  submission_type TEXT NOT NULL CHECK(submission_type IN ('6h', '24h', 'after_24h')),
  submission_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recruiter_submissions_recruiter ON recruiter_submissions(recruiter_user_id);
CREATE INDEX idx_recruiter_submissions_client ON recruiter_submissions(client_id);
CREATE INDEX idx_recruiter_submissions_team ON recruiter_submissions(team_id);
CREATE INDEX idx_recruiter_submissions_role ON recruiter_submissions(role_id);
CREATE INDEX idx_recruiter_submissions_date ON recruiter_submissions(submission_date);

CREATE TABLE recruiter_client_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_user_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recruiter_client_assignments_recruiter ON recruiter_client_assignments(recruiter_user_id);
CREATE INDEX idx_recruiter_client_assignments_client ON recruiter_client_assignments(client_id);
