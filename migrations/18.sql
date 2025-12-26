
-- Update existing users to have correct @next-link.ch emails
UPDATE users SET email = 'natalia.martinez@next-link.ch', name = 'Natalia' WHERE role = 'account_manager' AND (email LIKE '%natalia%' OR user_code = 'AM-001' OR user_code = 'AM-002');
UPDATE users SET email = 'mitul.shukla@next-link.ch', name = 'Mitul Shukla' WHERE role = 'recruitment_manager' AND (email LIKE '%mitul%' OR user_code = 'RM-002');
UPDATE users SET email = 'adela.labrador@next-link.ch', name = 'Adela Labrador' WHERE role = 'recruiter' AND (email LIKE '%adela%' OR user_code = 'REC-001');

-- Add missing users if they don't exist
INSERT OR IGNORE INTO users (id, email, name, role, user_code, password, is_active, created_at, updated_at)
VALUES 
  (25, 'dilsha.s@next-link.ch', 'Dilsha', 'recruiter', 'REC-004', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (27, 'kunal.nagdeve@next-link.ch', 'Kunal', 'recruiter', 'REC-005', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
