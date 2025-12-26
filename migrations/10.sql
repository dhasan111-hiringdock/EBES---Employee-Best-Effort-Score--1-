
-- Interview entries for roles
CREATE TABLE am_role_interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  interview_round INTEGER NOT NULL CHECK(interview_round IN (1, 2, 3)),
  interview_count INTEGER NOT NULL DEFAULT 0,
  entry_month TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_am_role_interviews_role ON am_role_interviews(role_id);
CREATE INDEX idx_am_role_interviews_month ON am_role_interviews(entry_month);
