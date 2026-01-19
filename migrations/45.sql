ALTER TABLE am_roles ADD COLUMN role_level TEXT CHECK(role_level IN ('junior','mid','senior'));

