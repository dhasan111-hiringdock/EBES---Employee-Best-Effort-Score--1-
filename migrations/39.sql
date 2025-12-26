
INSERT INTO code_counters (category, next_number)
SELECT 'am_role', 1
WHERE NOT EXISTS (SELECT 1 FROM code_counters WHERE category = 'am_role');
