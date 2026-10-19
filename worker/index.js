// Cloudflare Worker in front of the static Astro site.
// Only requests to /api/* reach this code (see `run_worker_first` in
// wrangler.jsonc); every other page is served straight from ./dist.
//
//   POST /api/stories               – submit a story (stored as 'pending')
//   GET  /api/stories               – list approved stories for the homepage
//   GET    /api/admin/stories       – list every story, any status (admin panel)
//   PATCH  /api/admin/stories/:id   – change a story's status, name and/or text
//   DELETE /api/admin/stories/:id   – delete a story permanently
//
//   GET  /api/flyer                       – streets for /flyer/, with geometry and whether taken
//   POST /api/flyer                       – sign up to distribute flyers in one or more streets
//   GET    /api/admin/flyer               – every sign-up and every street (admin panel)
//   PATCH  /api/admin/flyer/signups/:id   – edit a sign-up's personal details and/or picked_up
//   DELETE /api/admin/flyer/signups/:id   – delete a sign-up (its streets become free again)
//   POST   /api/admin/flyer/streets       – add a street
//   PATCH  /api/admin/flyer/streets/:id   – rename a street and/or (re)assign it to a sign-up
//   DELETE /api/admin/flyer/streets/:id   – delete a street
//
// The /api/admin/* routes are meant to sit behind Cloudflare Access (see
// README section "Admin panel"). Access injects the
// Cf-Access-Authenticated-User-Email header only on requests it has
// authenticated, so requiring that header here fails closed if the Access
// application is ever missing or misconfigured for these paths.
//
// Access doesn't run against local `wrangler dev`, so there's no way to get
// that header locally. Set SKIP_ADMIN_AUTH=true in a local-only `.dev.vars`
// file (never committed, never deployed) to bypass the check while testing.

// Roughly half an A4 page of running text.
const MAX_TEXT_LENGTH = 1500;
const MIN_TEXT_LENGTH = 20;
const MAX_NAME_LENGTH = 80;
const MAX_PER_DAY = 3;

const FLYER_MAX_FIELD_LENGTH = 100;
const FLYER_MAX_NOTE_LENGTH = 500;
const FLYER_MAX_STREETS = 30;
const FLYER_MAX_PER_DAY = 5;

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);

		if (pathname === '/api/stories') {
			if (request.method === 'GET') return listStories(env);
			if (request.method === 'POST') return submitStory(request, env);
			return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST' });
		}

		if (pathname === '/api/flyer') {
			if (request.method === 'GET') return listFlyerStreets(env);
			if (request.method === 'POST') return submitFlyerSignup(request, env);
			return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST' });
		}

		if (pathname.startsWith('/api/admin/')) {
			if (!isAuthorizedAdmin(request, env)) return json({ error: 'Nicht autorisiert.' }, 403);

			if (pathname.startsWith('/api/admin/flyer')) return handleFlyerAdmin(request, env, pathname);

			if (pathname === '/api/admin/stories') {
				if (request.method === 'GET') return listAllStories(env);
				return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET' });
			}

			const match = pathname.match(/^\/api\/admin\/stories\/(\d+)$/);
			if (match) {
				const id = Number(match[1]);
				if (request.method === 'PATCH') return updateStory(request, env, id);
				if (request.method === 'DELETE') return deleteStory(env, id);
				return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'PATCH, DELETE' });
			}

			return json({ error: 'Nicht gefunden.' }, 404);
		}

		if (pathname.startsWith('/api/')) return json({ error: 'Nicht gefunden.' }, 404);

		return env.ASSETS.fetch(request);
	},
};

function isAuthorizedAdmin(request, env) {
	if (env.SKIP_ADMIN_AUTH === 'true') return true;
	return Boolean(request.headers.get('Cf-Access-Authenticated-User-Email'));
}

async function listStories(env) {
	const { results } = await env.DB.prepare(
		`SELECT id, name, text, created_at FROM stories
		 WHERE status = 'approved'
		 ORDER BY created_at DESC
		 LIMIT 100`,
	).all();
	return json({ stories: results }, 200, { 'Cache-Control': 'no-store' });
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

async function listAllStories(env) {
	const { results } = await env.DB.prepare(
		`SELECT id, created_at, name, text, status, reviewed_at, ip FROM stories
		 ORDER BY created_at DESC`,
	).all();
	return json({ stories: results });
}

// Accepts any combination of `status`, `name` and `text`; fields left out
// stay unchanged. Only a status change counts as a review, so editing the
// wording alone doesn't touch reviewed_at.
async function updateStory(request, env, id) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}

	const assignments = [];
	const values = [];

	if ('status' in body) {
		if (!['pending', 'approved', 'rejected'].includes(body.status)) {
			return json({ error: 'Ungültiger Status.' }, 400);
		}
		assignments.push('status = ?', "reviewed_at = datetime('now')");
		values.push(body.status);
	}

	if ('name' in body) {
		const name = cleanLine(body.name);
		if (name.length > MAX_NAME_LENGTH) {
			return json({ error: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.` }, 400);
		}
		assignments.push('name = ?');
		values.push(name || null);
	}

	if ('text' in body) {
		const text = cleanText(body.text);
		if (!text) return json({ error: 'Der Text darf nicht leer sein.' }, 400);
		if (text.length > MAX_TEXT_LENGTH) {
			return json({ error: `Der Text darf höchstens ${MAX_TEXT_LENGTH} Zeichen lang sein.` }, 400);
		}
		assignments.push('text = ?');
		values.push(text);
	}

	if (assignments.length === 0) return json({ error: 'Keine Änderungen angegeben.' }, 400);

	const story = await env.DB.prepare(
		`UPDATE stories SET ${assignments.join(', ')} WHERE id = ?
		 RETURNING id, created_at, name, text, status, reviewed_at, ip`,
	)
		.bind(...values, id)
		.first();
	if (!story) return json({ error: 'Nicht gefunden.' }, 404);

	return json({ ok: true, story });
}

async function deleteStory(env, id) {
	const { meta } = await env.DB.prepare('DELETE FROM stories WHERE id = ?').bind(id).run();
	if (meta.changes === 0) return json({ error: 'Nicht gefunden.' }, 404);

	return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Flyer-Verteilung (/flyer/)
// ---------------------------------------------------------------------------

// Public list: no names, only whether a street is taken.
async function listFlyerStreets(env) {
	const { results } = await env.DB.prepare(
		`SELECT id, name, zip, geometry, signup_id IS NOT NULL AS taken FROM flyer_streets
		 ORDER BY name COLLATE NOCASE, id`,
	).all();
	const streets = results.map((s) => ({
		...s,
		taken: Boolean(s.taken),
		geometry: s.geometry ? JSON.parse(s.geometry) : null,
	}));
	return json({ streets }, 200, { 'Cache-Control': 'no-store' });
}

async function submitFlyerSignup(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}

	// Honeypot, see submitStory.
	if (body.website) return json({ ok: true }, 201);

	const person = readFlyerPerson(body);
	if (person.error) return json({ error: person.error }, 400);

	const streetIds = Array.isArray(body.streets)
		? [...new Set(body.streets.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
		: [];
	if (streetIds.length === 0) return json({ error: 'Bitte wählen Sie mindestens eine Strasse aus.' }, 400);
	if (streetIds.length > FLYER_MAX_STREETS) {
		return json({ error: `Bitte wählen Sie höchstens ${FLYER_MAX_STREETS} Strassen aus.` }, 400);
	}

	const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	const { count } = await env.DB.prepare(
		`SELECT COUNT(*) AS count FROM flyer_signups
		 WHERE ip = ? AND created_at >= datetime('now', '-1 day')`,
	)
		.bind(ip)
		.first();
	if (count >= FLYER_MAX_PER_DAY) {
		return json({ error: 'Zu viele Anmeldungen von diesem Anschluss. Bitte melden Sie sich bei uns per E-Mail.' }, 429);
	}

	const placeholders = streetIds.map(() => '?').join(', ');
	const { results: streets } = await env.DB.prepare(
		`SELECT id, name, signup_id FROM flyer_streets WHERE id IN (${placeholders})`,
	)
		.bind(...streetIds)
		.all();
	if (streets.length !== streetIds.length) {
		return json({ error: 'Mindestens eine Strasse gibt es nicht mehr. Bitte laden Sie die Seite neu.' }, 400);
	}
	const taken = streets.filter((s) => s.signup_id !== null).map((s) => s.name);
	if (taken.length > 0) {
		return json({ error: `Bereits vergeben: ${taken.join(', ')}. Bitte wählen Sie andere Strassen.`, taken }, 409);
	}

	// One transaction: the sign-up plus its streets. `signup_id IS NULL` keeps
	// a street someone else grabbed in the meantime from being overwritten.
	const [, assigned] = await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO flyer_signups (first_name, last_name, email, phone, street, zip_city, note, ip)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			person.first_name,
			person.last_name,
			person.email,
			person.phone,
			person.street,
			person.zip_city,
			person.note,
			ip,
		),
		env.DB.prepare(
			`UPDATE flyer_streets SET signup_id = last_insert_rowid()
			 WHERE id IN (${placeholders}) AND signup_id IS NULL`,
		).bind(...streetIds),
	]);

	return json({ ok: true, assigned: assigned.meta.changes }, 201);
}

// Validates the personal details of a sign-up. With `partial`, missing
// fields are skipped (admin edits); otherwise all required fields must be set.
function readFlyerPerson(body, partial = false) {
	const labels = {
		first_name: 'Vorname',
		last_name: 'Nachname',
		email: 'E-Mail',
		phone: 'Telefon',
		street: 'Strasse und Nr.',
		zip_city: 'PLZ und Ort',
	};
	const person = {};
	for (const [field, label] of Object.entries(labels)) {
		if (partial && !(field in body)) continue;
		const value = cleanLine(body[field]);
		if (!value) return { error: `Bitte füllen Sie «${label}» aus.` };
		if (value.length > FLYER_MAX_FIELD_LENGTH) {
			return { error: `«${label}» darf höchstens ${FLYER_MAX_FIELD_LENGTH} Zeichen lang sein.` };
		}
		if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			return { error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
		}
		// digits plus the usual separators, at least 9 digits (e.g. 079 123 45 67)
		if (field === 'phone' && (!/^\+?[\d\s()./-]+$/.test(value) || value.replace(/\D/g, '').length < 9)) {
			return { error: 'Bitte geben Sie eine gültige Telefonnummer ein.' };
		}
		person[field] = value;
	}
	if (!partial || 'note' in body) {
		const note = cleanText(body.note);
		if (note.length > FLYER_MAX_NOTE_LENGTH) {
			return { error: `Die Bemerkung darf höchstens ${FLYER_MAX_NOTE_LENGTH} Zeichen lang sein.` };
		}
		person.note = note || null;
	}
	return person;
}

async function handleFlyerAdmin(request, env, pathname) {
	if (pathname === '/api/admin/flyer') {
		if (request.method === 'GET') return listFlyerAdmin(env);
		return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET' });
	}

	if (pathname === '/api/admin/flyer/streets') {
		if (request.method === 'POST') return createFlyerStreet(request, env);
		return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'POST' });
	}

	const match = pathname.match(/^\/api\/admin\/flyer\/(signups|streets)\/(\d+)$/);
	if (!match) return json({ error: 'Nicht gefunden.' }, 404);
	const [, kind, rawId] = match;
	const id = Number(rawId);

	if (kind === 'signups') {
		if (request.method === 'PATCH') return updateFlyerSignup(request, env, id);
		if (request.method === 'DELETE') return deleteFlyerSignup(env, id);
	} else {
		if (request.method === 'PATCH') return updateFlyerStreet(request, env, id);
		if (request.method === 'DELETE') return deleteFlyerStreet(env, id);
	}
	return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'PATCH, DELETE' });
}

const FLYER_SIGNUP_COLUMNS =
	'id, created_at, first_name, last_name, email, phone, street, zip_city, note, picked_up_at, ip';
const FLYER_STREET_COLUMNS = 'id, name, zip, signup_id, geometry IS NOT NULL AS has_geometry';

async function listFlyerAdmin(env) {
	const [signups, streets] = await env.DB.batch([
		env.DB.prepare(`SELECT ${FLYER_SIGNUP_COLUMNS} FROM flyer_signups ORDER BY created_at DESC, id DESC`),
		env.DB.prepare(`SELECT ${FLYER_STREET_COLUMNS} FROM flyer_streets ORDER BY name COLLATE NOCASE, id`),
	]);
	return json({ signups: signups.results, streets: streets.results });
}

async function updateFlyerSignup(request, env, id) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}
	const person = readFlyerPerson(body, true);
	if (person.error) return json({ error: person.error }, 400);
	const assignments = Object.keys(person).map((f) => `${f} = ?`);
	const values = Object.values(person);

	// `picked_up: true/false` (checkbox in the admin panel) stores or clears the time.
	if ('picked_up' in body) {
		if (typeof body.picked_up !== 'boolean') return json({ error: 'Ungültiger Wert für «Abgeholt».' }, 400);
		assignments.push(body.picked_up ? "picked_up_at = datetime('now')" : 'picked_up_at = NULL');
	}

	if (assignments.length === 0) return json({ error: 'Keine Änderungen angegeben.' }, 400);

	const signup = await env.DB.prepare(
		`UPDATE flyer_signups SET ${assignments.join(', ')} WHERE id = ?
		 RETURNING ${FLYER_SIGNUP_COLUMNS}`,
	)
		.bind(...values, id)
		.first();
	if (!signup) return json({ error: 'Nicht gefunden.' }, 404);
	return json({ ok: true, signup });
}

async function deleteFlyerSignup(env, id) {
	// Free the streets explicitly rather than relying on ON DELETE SET NULL,
	// which only works while foreign keys are enforced.
	const [, deleted] = await env.DB.batch([
		env.DB.prepare('UPDATE flyer_streets SET signup_id = NULL WHERE signup_id = ?').bind(id),
		env.DB.prepare('DELETE FROM flyer_signups WHERE id = ?').bind(id),
	]);
	if (deleted.meta.changes === 0) return json({ error: 'Nicht gefunden.' }, 404);
	return json({ ok: true });
}

// Reads `name`, `zip` and `signup_id` from an admin request body. Fields left
// out are skipped; `signup_id: null` frees the street.
async function readFlyerStreet(body, env) {
	const street = {};
	if ('name' in body) {
		const name = cleanLine(body.name);
		if (!name) return { error: 'Der Strassenname darf nicht leer sein.' };
		if (name.length > FLYER_MAX_FIELD_LENGTH) {
			return { error: `Der Strassenname darf höchstens ${FLYER_MAX_FIELD_LENGTH} Zeichen lang sein.` };
		}
		street.name = name;
	}
	if ('zip' in body) {
		street.zip = cleanLine(body.zip).slice(0, FLYER_MAX_FIELD_LENGTH) || null;
	}
	if ('signup_id' in body) {
		if (body.signup_id === null || body.signup_id === '') {
			street.signup_id = null;
		} else {
			const signupId = Number(body.signup_id);
			const exists = await env.DB.prepare('SELECT 1 FROM flyer_signups WHERE id = ?').bind(signupId).first();
			if (!exists) return { error: 'Diese Anmeldung gibt es nicht.' };
			street.signup_id = signupId;
		}
	}
	return street;
}

async function createFlyerStreet(request, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}
	if (!('name' in body)) return json({ error: 'Der Strassenname darf nicht leer sein.' }, 400);
	const street = await readFlyerStreet(body, env);
	if (street.error) return json({ error: street.error }, 400);

	const created = await env.DB.prepare(
		`INSERT INTO flyer_streets (name, zip, signup_id) VALUES (?, ?, ?)
		 RETURNING ${FLYER_STREET_COLUMNS}`,
	)
		.bind(street.name, street.zip ?? null, street.signup_id ?? null)
		.first();
	return json({ ok: true, street: created }, 201);
}

async function updateFlyerStreet(request, env, id) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage.' }, 400);
	}
	const street = await readFlyerStreet(body, env);
	if (street.error) return json({ error: street.error }, 400);
	const fields = Object.keys(street);
	if (fields.length === 0) return json({ error: 'Keine Änderungen angegeben.' }, 400);

	const updated = await env.DB.prepare(
		`UPDATE flyer_streets SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?
		 RETURNING ${FLYER_STREET_COLUMNS}`,
	)
		.bind(...fields.map((f) => street[f]), id)
		.first();
	if (!updated) return json({ error: 'Nicht gefunden.' }, 404);
	return json({ ok: true, street: updated });
}

async function deleteFlyerStreet(env, id) {
	const { meta } = await env.DB.prepare('DELETE FROM flyer_streets WHERE id = ?').bind(id).run();
	if (meta.changes === 0) return json({ error: 'Nicht gefunden.' }, 404);
	return json({ ok: true });
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
