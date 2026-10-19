-- Flyer-Verteilung: when a volunteer picked up their flyers (NULL = not yet).
-- Set from the checkbox in /admin/flyer/.
ALTER TABLE flyer_signups ADD COLUMN picked_up_at TEXT;
