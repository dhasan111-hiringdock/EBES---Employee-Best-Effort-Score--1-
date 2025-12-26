
-- Remove added users
DELETE FROM users WHERE id IN (25, 27);

-- Revert users to old @gmail.com emails
UPDATE users SET email = 'Natalia@gmail.com', name = 'Natalia' WHERE email = 'natalia.martinez@next-link.ch';
UPDATE users SET email = 'mitul@gmail.com', name = 'Mitul' WHERE email = 'mitul.shukla@next-link.ch';
UPDATE users SET email = 'adela@gmail.com', name = 'Adela' WHERE email = 'adela.labrador@next-link.ch';
