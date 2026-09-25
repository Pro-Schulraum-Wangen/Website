# Pro Schulraum Wangen

Independent, static campaign website supporting a Yes vote for the new
school and sports facility «Am Buechberg» in Wangen SZ (ballot vote on
29 November 2026).

Built with [Astro](https://astro.build). All content lives as
Markdown/YAML files in this repo. The only dynamic part is the story form
«Was macht Wangen besonders?» on the homepage: a small Cloudflare Worker
(`worker/index.js`) stores submissions in a Cloudflare D1 database – see
[Stories](#stories-was-macht-wangen-besonders) below.

## Run locally

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
anything there. To test the form, use the Cloudflare preview instead (see
below).

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

## Stories («Was macht Wangen besonders?»)

Visitors submit a short text (max. 1500 characters, plain text, line
breaks allowed) and optionally their name. Each submission is stored with
its IP address and the status `pending`. Only stories set to `approved`
appear on the homepage.

Rules enforced by the Worker (`worker/index.js`):

- at most 3 submissions per IP address within 24 hours
- 20–1500 characters, no links, consent checkbox required
- a hidden honeypot field silently drops simple bots

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

Open http://localhost:8787 and submit a story through the form on the
homepage.

### Create a story without the form

Handy for testing the display. Local:

```sh
npx wrangler d1 execute wangen-stories --local --command \
  "INSERT INTO stories (name, text, ip, status) VALUES ('Maria Muster', 'Die Chilbi auf dem Dorfplatz.' || char(10) || 'Jedes Jahr ein Highlight.', 'manual', 'approved')"
```

`char(10)` inserts a line break. Leave out `status` (or use `'pending'`)
to create a story that still needs approval.

### Review and approve stories

Locally, add `--local` to the commands below; for the live site, use
`--remote` or paste the SQL into the D1 console in the Cloudflare dashboard
(Storage & databases → D1 → wangen-stories → Console).

```sql
-- stories waiting for approval
SELECT id, created_at, name, text FROM stories WHERE status = 'pending';

-- approve / reject
UPDATE stories SET status = 'approved', reviewed_at = datetime('now') WHERE id = 5;
UPDATE stories SET status = 'rejected', reviewed_at = datetime('now') WHERE id = 6;

-- remove a story completely (e.g. on request)
DELETE FROM stories WHERE id = 7;
```

Example with Wrangler:

```sh
npx wrangler d1 execute wangen-stories --remote --command \
  "SELECT id, created_at, name, text FROM stories WHERE status = 'pending'"
```

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
  pages/            Routes (index, argumente, unterstuetzer, medien, mitmachen, datenschutz)
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
