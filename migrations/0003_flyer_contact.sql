-- Flyer-Verteilung: e-mail and phone so we can arrange the flyer pick-up.
-- Nullable here because SQLite can't add NOT NULL columns to an existing
-- table without a default; the worker requires both for new sign-ups.
ALTER TABLE flyer_signups ADD COLUMN email TEXT;
ALTER TABLE flyer_signups ADD COLUMN phone TEXT;
