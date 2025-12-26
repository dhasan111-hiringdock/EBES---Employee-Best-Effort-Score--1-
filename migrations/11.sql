
-- Monthly update reminders tracking
CREATE TABLE am_monthly_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reminder_month TEXT NOT NULL,
  is_confirmed BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_am_monthly_reminders_user ON am_monthly_reminders(user_id);
CREATE UNIQUE INDEX idx_am_monthly_reminders_user_month ON am_monthly_reminders(user_id, reminder_month);
