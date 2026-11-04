-- Flyer-Verteilung, zweiter Flyer («Was kostet ein Nein?», Abholung ab
-- 7. November 2026): the sign-ups for the first flyer are deleted and every
-- street is free again. Streets themselves (names, geometry, households)
-- stay as they are.
UPDATE flyer_streets SET signup_id = NULL;
DELETE FROM flyer_signups;
