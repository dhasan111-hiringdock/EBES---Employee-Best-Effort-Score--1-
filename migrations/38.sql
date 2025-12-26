
CREATE TABLE dropout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  recruiter_user_id INTEGER NOT NULL,
  rm_user_id INTEGER,
  am_user_id INTEGER NOT NULL,
  dropout_reason TEXT,
  rm_status TEXT DEFAULT 'pending',
  rm_notes TEXT,
  rm_acknowledged_at DATETIME,
  am_decision TEXT,
  am_new_role_status TEXT,
  am_decided_at DATETIME,
  final_status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dropout_requests_rm ON dropout_requests(rm_user_id, rm_status);
CREATE INDEX idx_dropout_requests_am ON dropout_requests(am_user_id, am_decision);
CREATE INDEX idx_dropout_requests_role ON dropout_requests(role_id);
