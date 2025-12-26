
-- Remove default role so new users see role selection
UPDATE recruiters SET role = NULL WHERE role = 'recruiter';
