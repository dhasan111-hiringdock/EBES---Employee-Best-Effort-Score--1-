
-- Code counters for generating unique codes
CREATE TABLE code_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  next_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize counters for each category
INSERT INTO code_counters (category, next_number) VALUES ('admin', 1);
INSERT INTO code_counters (category, next_number) VALUES ('recruitment_manager', 101);
INSERT INTO code_counters (category, next_number) VALUES ('account_manager', 201);
INSERT INTO code_counters (category, next_number) VALUES ('recruiter', 301);
