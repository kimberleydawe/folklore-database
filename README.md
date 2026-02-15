# Folklore Database

A static site that presents folklore entries on an interactive map. Built with **Hugo (extended)** and **Leaflet.js** (OpenStreetMap, marker clustering). No backend; deploys to GitHub Pages.

## Prerequisites

- **Hugo Extended** (required for SCSS via Hugo Pipes). Install:
  - macOS: `brew install hugo`
  - Windows: [Hugo releases](https://github.com/gohugoio/hugo/releases) — choose the **extended** build.
  - Or: `go install -tags extended github.com/gohugoio/hugo/v2@latest`
- Git (for deployment and local dev)

## Local development

From the project root:

```bash
hugo server
```

Then open [http://localhost:1313](http://localhost:1313). The map page is at `/map/`.

## Build

```bash
hugo
```

Output is in the `public/` directory. For production (e.g. GitHub Pages), ensure `baseURL` in `hugo.toml` matches your site URL (see below).

## Adding a new entry

1. Create a new file under `content/map/` with a URL-friendly name (e.g. `my-place.md`). The path `content/map/my-place.md` will become `/map/my-place/`.

2. Use this front matter (required unless marked optional):

```yaml
title: "Entry title"
lat: 52.5
lng: -7.5
place: "Place name"
county: "County"
region: "Region"
tags:
  - tag1
  - tag2
sources:
  - "Author (Year). Title. Place: Publisher."
# optional:
images:
  - src: /img/photo.jpg
    alt: Description
    caption: Caption text
draft: false
```

3. Write the body in Markdown below the front matter.

4. Run `hugo` (or `hugo server`) so the new entry appears on the map and in `/map/index.json`.

## Deployment (GitHub Pages)

1. **Repository**: Push this project to a GitHub repository (e.g. `folklore-database`).

2. **Pages settings**:
   - Go to **Settings → Pages**.
   - Under **Build and deployment**, set **Source** to **GitHub Actions**.

3. **Workflow**: The workflow in `.github/workflows/deploy.yml` runs on push to `main`. It:
   - Builds Hugo (extended) with `baseURL` set to `https://<owner>.github.io/<repo>/`.
   - Uploads the `public/` directory as a Pages artifact and deploys.

4. **baseURL**: If you use a custom domain or a user/org site (`username.github.io`), update `baseURL` in `hugo.toml` and, if needed, set `HUGO_BASEURL` in the workflow so links and the map index resolve correctly.

After the first successful run, the site will be available at `https://<owner>.github.io/<repo>/`.

## Project structure (key files)

- `hugo.toml` / `config.toml` — site config (Hugo 0.110+ uses `hugo.toml`; older versions use `config.toml`)
- `layouts/_default/baseof.html` — base layout (header, footer, dark mode)
- `layouts/index.html` — home page
- `layouts/map/list.html` — map page (card + results panel)
- `layouts/map/single.html` — entry page (title, meta, tags, gallery, sources, related)
- `layouts/map/list.json.json` — template for `/map/index.json`
- `assets/js/map.js` — Leaflet map, clustering, filters, URL state
- `assets/js/entry.js` — back-to-map link, related places from index
- `assets/scss/main.scss` — styles (Hugo Pipes)
- `content/map/*.md` — folklore entries (8 samples included)
- `.github/workflows/deploy.yml` — build and deploy to GitHub Pages

## Tech notes

- **Map**: Leaflet with free OpenStreetMap tiles; Leaflet.markercluster for clustering.
- **Filters**: Search (title, place, county, region, tags) and tag chips; state in `q=` and `tags=` query params.
- **Related places**: On entry pages, computed client-side from `/map/index.json` by shared tags (top 6).
- **Back to map**: Entry page “Back to map” link preserves `q` and `tags` when coming from `/map/` with filters.

No API keys or paid services are used.
