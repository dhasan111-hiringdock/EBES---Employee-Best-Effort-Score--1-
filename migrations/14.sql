
-- Add new fields to recruiter_submissions for tracking interviews, deals, and dropouts
ALTER TABLE recruiter_submissions ADD COLUMN entry_type TEXT CHECK(entry_type IN ('submission', 'interview', 'deal', 'dropout'));
ALTER TABLE recruiter_submissions ADD COLUMN interview_level INTEGER CHECK(interview_level IN (1, 2, 3));
ALTER TABLE recruiter_submissions ADD COLUMN dropout_role_id INTEGER;

-- Create a new table to track pending role statuses after dropouts
CREATE TABLE role_status_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  previous_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
