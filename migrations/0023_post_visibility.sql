-- Password-protected posts: listed normally, body unlocked with a password.
ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE posts ADD COLUMN access_password_hash TEXT;
