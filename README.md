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

### Supporters with a photo card (`src/content/supporters/`)

One `.md` file per person, for supporters shown as a card with photo (and,
optionally, a quote). Example:

```md
---
name: 'Maria Muster'
role: 'Wangen' # optional – e.g. place of residence or function
image: '../../assets/supporters/maria-muster.jpg' # optional
quote: 'Short quote on why she supports the project.' # optional
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
  content/          All content (Markdown/YAML) – see above
  components/       Reusable page building blocks (e.g. the cost calculator)
  layouts/          Shared page layout (header/footer)
  pages/            Routes (index, argumente, unterstuetzer, videos, mitmachen, datenschutz)
  lib/              Small helpers shared between pages
  styles/           Global CSS
  assets/           Images (optimized by Astro)
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
