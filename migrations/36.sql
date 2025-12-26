
-- Add employee profile visibility settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('show_employee_profiles', 'true'),
  ('show_recruiter_stats', 'true'),
  ('show_rm_stats', 'true'),
  ('show_am_stats', 'true'),
  ('show_client_stats', 'true'),
  ('show_team_stats', 'true')
ON CONFLICT(setting_key) DO NOTHING;
