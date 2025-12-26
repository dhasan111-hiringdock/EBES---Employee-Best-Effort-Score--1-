
DELETE FROM app_settings WHERE setting_key IN (
  'show_employee_profiles',
  'show_recruiter_stats',
  'show_rm_stats',
  'show_am_stats',
  'show_client_stats',
  'show_team_stats'
);
