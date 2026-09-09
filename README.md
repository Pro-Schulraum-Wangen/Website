# Pro Schulraum Wangen

Independent, static campaign website supporting a Yes vote for the new
school and sports facility «Am Buechberg» in Wangen SZ (ballot vote on
29 November 2026).

Built with [Astro](https://astro.build). No backend, no database – all
content lives as Markdown/YAML files in this repo.

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

## Managing content

All content lives in `src/content/`. There is **no CMS** – edit files
directly, commit, push.

### Supporters (`src/content/supporters/`)

One `.md` file per person. Example:

```md
---
name: 'Maria Muster'
role: 'Elternrat' # optional
image: '../../assets/supporters/maria-muster.jpg' # optional
quote: 'Short quote on why she supports the project.' # optional
date: 2026-09-15
published: true
---
```

- **With `image`**: the person appears as a card with a photo (and quote, if
  present) on the homepage and the supporters page.
- **Without `image`**: the person automatically appears only in the plain
  name list.
- Put photos under `src/assets/supporters/` and reference them relatively in
  the frontmatter (Astro optimizes the images automatically at build time).
- `published: false` hides an entry without deleting the file.

The `_beispiel-*.md` files are placeholder/demo content – delete them or
replace them with real people before going live. **Important:** only add
people who have given their consent (name, and optionally photo and quote,
will be publicly visible).

### Arguments (`src/content/arguments/`)

One `.md` file per argument. `order` controls the sort order (lower number =
higher up on the page). `summary` is the short teaser text, the rest of the
file is the full text (Markdown).

### Blog (`src/content/blog/`)

One `.md` file per post. `draft: true` hides a post without deleting it. The
URL is derived from the filename, e.g. `mein-post.md` → `/blog/mein-post/`.

### Videos (`src/content/videos.yaml`)

A YAML list, not a folder of individual files. `youtubeId` is the part of
the YouTube URL after `v=`. See the comments in the file for an example.

## Deployment

This site is set up for **Cloudflare Pages**, connected to this GitHub repo.
Every push to `main` automatically deploys to `pro-schulraum-wangen.ch`,
and every pull request gets its own preview URL. See the setup notes sent
separately, or the Cloudflare dashboard under the "pro-schulraum-wangen"
project.

## Structure

```
src/
  content/         All content (Markdown/YAML) – see above
  layouts/          Shared page layout (header/footer)
  pages/            Routes (index, argumente, unterstuetzer, videos, blog, mitmachen)
  styles/           Global CSS
  assets/           Images (optimized by Astro)
```
