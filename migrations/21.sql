
CREATE TABLE role_recruiter_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  recruiter_user_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, recruiter_user_id)
);

CREATE INDEX idx_role_recruiter_assignments_role ON role_recruiter_assignments(role_id);
CREATE INDEX idx_role_recruiter_assignments_recruiter ON role_recruiter_assignments(recruiter_user_id);
