-- Insert Users (using INSERT OR REPLACE to handle existing codes)
INSERT OR REPLACE INTO users (id, mocha_user_id, email, user_code, role, name, password, is_active, created_at, updated_at) VALUES
(2, 'rm-002', 'danish@gmail.com', 'RM-002', 'recruitment_manager', 'Danish', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'rec-002', 'adela@gmail.com', 'REC-002', 'recruiter', 'Adela', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'rec-001', 'suchitragarikapati@gmail.com', 'REC-001', 'recruiter', 'Suchitra', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'rm-001', 'mitul@gmail.com', 'RM-001', 'recruitment_manager', 'Mitul', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 'am-001', 'natalia@gmail.com', 'AM-001', 'account_manager', 'Natalia', 'test123', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert Clients (using INSERT OR REPLACE)
INSERT OR REPLACE INTO clients (id, client_code, name, short_name, is_active, created_at, updated_at) VALUES
(1, 'AG-001', 'AG Assurance', 'AG', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'UCB-001', 'UCB', 'UCB', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'SANDOZ-001', 'Sandoz', 'Sandoz', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'ROCHE-001', 'Roche', 'Roche', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'BI-001', 'BI', 'BI', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert Teams (using INSERT OR REPLACE)
INSERT OR REPLACE INTO app_teams (id, team_code, name, is_active, created_at, updated_at) VALUES
(1, 'TEAM-001', 'Ts-Consultancy', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'TEAM-002', 'Ts-DACH', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'TEAM-003', 'Ts-Spain', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Update code counters
UPDATE code_counters SET next_number = 3 WHERE category = 'recruitment_manager';
UPDATE code_counters SET next_number = 3 WHERE category = 'recruiter';
UPDATE code_counters SET next_number = 2 WHERE category = 'account_manager';