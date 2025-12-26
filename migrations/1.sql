
CREATE TABLE recruiters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  submission_6h INTEGER DEFAULT 0,
  submission_24h INTEGER DEFAULT 0,
  submission_after_24h INTEGER DEFAULT 0,
  interviews INTEGER DEFAULT 0,
  deals INTEGER DEFAULT 0,
  pullouts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entry_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_entry_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles_worked (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  assigned_roles INTEGER DEFAULT 0,
  active_roles INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_entries_recruiter_date ON daily_entries(recruiter_id, entry_date);
CREATE INDEX idx_entry_notes_daily_entry ON entry_notes(daily_entry_id);
CREATE INDEX idx_roles_worked_recruiter_date ON roles_worked(recruiter_id, entry_date);
