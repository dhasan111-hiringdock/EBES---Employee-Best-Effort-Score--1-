
CREATE TABLE rm_ebes_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rm_user_id INTEGER NOT NULL,
  ebes_score REAL NOT NULL,
  ebes_label TEXT NOT NULL,
  total_roles INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  total_interviews INTEGER DEFAULT 0,
  total_dropouts INTEGER DEFAULT 0,
  recorded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rm_ebes_history_user_date ON rm_ebes_history(rm_user_id, recorded_at);
