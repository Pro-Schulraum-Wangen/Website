-- «Was macht Wangen besonders?» – submitted stories.
-- New entries start as 'pending' and only appear on the website once
-- set to 'approved' (see README section "Beiträge freigeben").
CREATE TABLE stories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	name TEXT,
	text TEXT NOT NULL,
	ip TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
	reviewed_at TEXT
);

-- rate limit lookup: submissions per IP in the last 24 hours
CREATE INDEX idx_stories_ip_created ON stories (ip, created_at);
-- public list: approved stories, newest first
CREATE INDEX idx_stories_status_created ON stories (status, created_at);
