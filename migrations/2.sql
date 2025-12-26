
ALTER TABLE recruiters ADD COLUMN designation TEXT;
ALTER TABLE recruiters ADD COLUMN country_code TEXT DEFAULT 'US';

CREATE TABLE weekly_roles_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  roles_actively_worked INTEGER DEFAULT 0,
  roles_passively_worked INTEGER DEFAULT 0,
  is_filled BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weekly_roles_recruiter ON weekly_roles_tracking(recruiter_id, week_start_date);

CREATE TABLE ooo_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL,
  ooo_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ooo_dates ON ooo_dates(recruiter_id, ooo_date);
