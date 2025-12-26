
ALTER TABLE clients ADD COLUMN company_id INTEGER;
ALTER TABLE app_teams ADD COLUMN company_id INTEGER;
ALTER TABLE am_roles ADD COLUMN company_id INTEGER;
ALTER TABLE recruiter_submissions ADD COLUMN company_id INTEGER;

UPDATE clients SET company_id = 1 WHERE company_id IS NULL;
UPDATE app_teams SET company_id = 1 WHERE company_id IS NULL;
UPDATE am_roles SET company_id = 1 WHERE company_id IS NULL;
UPDATE recruiter_submissions SET company_id = 1 WHERE company_id IS NULL;
