# Pro Schulraum Wangen

Independent, static campaign website supporting a Yes vote for the new
school and sports facility «Am Buechberg» in Wangen SZ (ballot vote on
29 November 2026).

Built with [Astro](https://astro.build). All content lives as
Markdown/YAML files in this repo. The only dynamic part is the story form on the
page «Geschichten von Wangen» (`/geschichten-von-wangen/`): a small Cloudflare Worker
(`worker/index.js`) stores submissions in a Cloudflare D1 database – see
[Stories](#stories-geschichten-von-wangen) below.

## Run locally

|                           | `npm run dev` (4321) | `npm run preview:cf` (8787)                           |
| ------------------------- | -------------------- | ----------------------------------------------------- |
| Website                   | ✅                   | ✅                                                    |
| Form / posts              | ❌                   | ✅                                                    |
| Changes show immediately  | ✅                   | ❌ you have to stop and restart it (it rebuilds first) |

```sh
npm install
npm run dev
```

The site then runs at http://localhost:4321

```sh
npm run build     # production build into ./dist/
npm run preview   # test the build locally
```

`npm run dev` does not run the Worker, so the story form cannot send
anything there. To test the form, use `npm run preview:cf` instead
(http://localhost:8787).

About the database:

- `npm run dev` uses no database at all.
- `npm run preview:cf` uses a **local** test database in `.wrangler/` (not
  committed). Create its table once after cloning with
  `npm run db:migrate:local`. It survives restarts, and nothing you do there
  touches the live data.
- The live site uses the **remote** D1 database `wangen-stories`. Access it
  through the Cloudflare dashboard or with `--remote` (see
  [Stories](#stories-geschichten-von-wangen) below).

## Managing content

All content lives in `src/content/`. There is **no CMS** – edit files
directly, commit, push.

### Supporters with a photo card (`src/content/supporters/`)

One `.md` file per person, for supporters shown as a card with photo. Example:

```md
---
name: 'Maria Muster'
role: 'Wangen' # optional – e.g. place of residence or function
image: '../../assets/supporters/maria-muster.jpg' # optional
date: 2026-09-15
published: true
---
```

- Put photos under `src/assets/supporters/` and reference them relatively in
  the frontmatter (Astro optimizes the images automatically at build time).
- `published: false` hides an entry without deleting the file.

### Supporters shown as name + place (`src/content/supporter-names.yaml`)

A single YAML list for supporters who only want their name and place of
residence listed. Append one entry per person; see the comments in the file.
Both lists are merged and counted together on the site.

**Important:** only add people who have given their consent – the data
entered is publicly visible.

### Arguments (`src/content/arguments/`)

One `.md` file per argument. `order` controls the sort order (lower number =
higher up on the page). `summary` is the short teaser text, the rest of the
file is the full text (Markdown).

### Leserbriefe und Medien (`src/content/leserbriefe/`, shown at `/medien/`)

One `.md` file per letter/media contribution. `excerpt` is the short teaser
shown on the `/medien` overview, the rest of the file is the full text
(Markdown). `published: false` hides an entry without deleting the file –
see `beispiel-vorlage.md` for the expected format.

## Stories («Geschichten von Wangen»)

Visitors submit a short text (max. 1500 characters, plain text, line
breaks allowed) and optionally their name. Each submission is stored with
its IP address and the status `pending`. Only stories set to `approved`
appear on the page.

Rules enforced by the Worker (`worker/index.js`):

- at most 3 submissions per IP address within 24 hours
- 20–1500 characters, no links, consent checkbox required
- a hidden honeypot field silently drops simple bots

### Admin panel

`/admin/` lists every story (any status), lets you change a story's status
from a dropdown, and delete it (with a confirmation prompt). It's a plain
static page that talks to three endpoints in `worker/index.js`:

- `GET /api/admin/stories` – list all stories
- `PATCH /api/admin/stories/:id` – change status (`{ "status": "approved" }`)
- `DELETE /api/admin/stories/:id` – delete permanently

Approving a story here makes it appear on `/geschichten-von-wangen/`
within about a minute (the public list is cached for 60 seconds).

These endpoints only check that the request carries a
`Cf-Access-Authenticated-User-Email` header – they trust **Cloudflare
Access** to have put it there. This means `/admin/` and `/api/admin/*` are
wide open unless Access is configured for them in the Cloudflare dashboard
(one-time setup, see below); there is no separate login built into the
site itself.

**One-time setup in Cloudflare (Zero Trust → Access):**

1. If not done yet: **Zero Trust** → pick a team name when prompted (free).
2. **Settings → Authentication** → make sure **One-time PIN** is enabled
   (it is by default). This is what emails the login code – no mail setup
   needed, Cloudflare sends it.
3. **Access → Applications → Add an application → Self-hosted.**
   - Domain: `pro-schulraum-wangen.ch`, path `/admin*`.
   - Add a second path `/api/admin*` to the same application (or create a
     second application with the same policy) – both must be covered.
4. Add a policy: **Allow**, rule **Emails**, list every address that should
   get access (e.g. `info@philippbruhin.ch`).
5. Save.

After that, opening `/admin/` asks for an email address, sends a one-time
code to it, and only lets matching addresses through – before the request
ever reaches the Worker.

Locally (`npm run preview:cf`), there is no Cloudflare Access, so
`/api/admin/*` always answers `403 Nicht autorisiert.`. To test the panel
in the browser anyway, create a `.dev.vars` file in the repo root
(gitignored, never deployed) with:

```ini
SKIP_ADMIN_AUTH=true
```

and restart `npm run preview:cf`. Set it back to `false` (or delete the
file) when you're done – it only has any effect locally, but there's no
reason to leave it on.

Alternatively, without touching `.dev.vars`, you can hit the API directly
by sending the header yourself:

```sh
curl -H "Cf-Access-Authenticated-User-Email: test@example.com" http://localhost:8787/api/admin/stories
```

### Test locally

Once after cloning (or after deleting `.wrangler/`, or after changing
`database_id` in `wrangler.jsonc`), create the table in the local test
database:

```sh
npm run db:migrate:local
```

The local database is kept in `.wrangler/` (not committed) and survives
restarts – there is no need to recreate it each time. Then:

```sh
npm run preview:cf    # builds the site and starts the Worker locally
```

Open http://localhost:8787/geschichten-von-wangen/ and submit a story
through the form.

### Create a story without the form

Handy for testing the display. Local:

```sh
npx wrangler d1 execute wangen-stories --local --command \
  "INSERT INTO stories (name, text, ip, status) VALUES ('Maria Muster', 'Die Chilbi auf dem Dorfplatz.' || char(10) || 'Jedes Jahr ein Highlight.', 'manual', 'approved')"
```

`char(10)` inserts a line break. Leave out `status` (or use `'pending'`)
to create a story that still needs approval.

### Database changes

Schema changes go into a new numbered file in `migrations/` and are applied
with `npm run db:migrate:local` (test database) and
`npm run db:migrate:remote` (live database, before deploying code that
relies on the change).

## Deployment

This site runs as a **Cloudflare Worker with static assets**
(`pro-schulraum-wangen-ch`), connected to this GitHub repo. Every push to
`main` automatically builds and deploys to `pro-schulraum-wangen.ch`.
Configuration lives in `wrangler.jsonc`.

## Structure

```
src/
  content/          All content (Markdown/YAML) – see above
  components/       Reusable page building blocks (e.g. the cost calculator)
  layouts/          Shared page layout (header/footer)
  pages/            Routes (index, argumente, unterstuetzer, medien, mitmachen, geschichten-von-wangen, datenschutz)
  lib/              Small helpers shared between pages
  styles/           Global CSS
  assets/           Images (optimized by Astro)
worker/             Cloudflare Worker for the story form (/api/*)
migrations/         D1 database schema (SQL)
```

## License and rights

© 2026 Pro Schulraum Wangen. All rights reserved.

This repository is public so the campaign is transparent and so people can
propose improvements via pull request. It is **not** released under an
open-source license: reusing the code for other projects requires the
committee's permission.

Some material in this repository is not ours and carries its own rights:

- The project visualizations under `src/assets/visualizations/` are by
  Halter AG and Max Dudler and are protected by copyright (source: the
  municipal council's official message / "Botschaft").
- The factual texts are based on the public "Botschaft Neubau Schulanlage
  Wangen «Am Buechberg»" of the Gemeinde Wangen, 11 June 2026.
- Supporter photos belong to the respective people and are published with
  their consent.
