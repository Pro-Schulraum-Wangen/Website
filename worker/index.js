// Cloudflare Worker in front of the static Astro site.
// Only requests to /api/* reach this code (see `run_worker_first` in
// wrangler.jsonc); every other page is served straight from ./dist.
//
//   POST /api/stories  – submit a story (stored as 'pending')
//   GET  /api/stories  – list approved stories for the homepage

// Roughly half an A4 page of running text.
const MAX_TEXT_LENGTH = 1500;
const MIN_TEXT_LENGTH = 20;
const MAX_NAME_LENGTH = 80;
const MAX_PER_DAY = 3;

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		if (pathname === '/api/stories') {
			if (request.method === 'GET') return listStories(env);
			if (request.method === 'POST') return submitStory(request, env);
			return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST' });
		}

		if (pathname.startsWith('/api/')) return json({ error: 'Nicht gefunden.' }, 404);

		return env.ASSETS.fetch(request);
	},
};

async function listStories(env) {
	const { results } = await env.DB.prepare(
		`SELECT id, name, text, created_at FROM stories
		 WHERE status = 'approved'
		 ORDER BY created_at DESC
		 LIMIT 100`,
	).all();
	return json({ stories: results }, 200, { 'Cache-Control': 'public, max-age=60' });
}

async function submitStory(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}

	// Honeypot: a field hidden from people. Bots that fill it get a fake
	// success so they don't retry.
	if (body.website) return json({ ok: true }, 201);

	const text = cleanText(body.text);
	const name = cleanLine(body.name).slice(0, MAX_NAME_LENGTH);

	if (body.consent !== true) {
		return json({ error: 'Bitte bestätigen Sie die Einwilligung zur Veröffentlichung.' }, 400);
	}
	if (text.length < MIN_TEXT_LENGTH) {
		return json({ error: `Bitte schreiben Sie mindestens ${MIN_TEXT_LENGTH} Zeichen.` }, 400);
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return json({ error: `Bitte kürzen Sie Ihren Beitrag auf höchstens ${MAX_TEXT_LENGTH} Zeichen.` }, 400);
	}
	if (/https?:\/\/|www\./i.test(text + ' ' + name)) {
		return json({ error: 'Bitte verzichten Sie auf Links – nur Text ist möglich.' }, 400);
	}

	const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

	const { count } = await env.DB.prepare(
		`SELECT COUNT(*) AS count FROM stories
		 WHERE ip = ? AND created_at >= datetime('now', '-1 day')`,
	)
		.bind(ip)
		.first();
	if (count >= MAX_PER_DAY) {
		return json(
			{ error: `Pro Tag sind höchstens ${MAX_PER_DAY} Beiträge möglich. Versuchen Sie es morgen wieder.` },
			429,
		);
	}

	await env.DB.prepare('INSERT INTO stories (name, text, ip) VALUES (?, ?, ?)')
		.bind(name || null, text, ip)
		.run();

	return json({ ok: true }, 201);
}

// Plain text only: normalises line breaks, drops control characters and
// collapses more than one empty line in a row. Line breaks are kept.
function cleanText(value) {
	if (typeof value !== 'string') return '';
	return value
		.replace(/\r\n?/g, '\n')
		.replace(/[^\S\n]+\n/g, '\n')
		.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function cleanLine(value) {
	if (typeof value !== 'string') return '';
	return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function json(data, status = 200, headers = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
	});
}
