# Deploying Motif to Cloudflare

Motif is a static site: one HTML page plus a favicon, a 404 page and a `_headers` file, all in `public/`. `python3 build.py` (or `npm run build`) regenerates `public/` from `src/`, and the built folder is committed, so Cloudflare can deploy it even without running a build.

Cloudflare serves it over HTTPS, which browsers require before they allow the microphone.

There are two ways to host it. Use **Workers** unless you already have a Pages project: it is what Cloudflare now recommends for new static sites, and this repo is already configured for it (`wrangler.jsonc`).

## Option 1: Cloudflare Workers, connected to GitHub (recommended)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick `sion-jaison/music-theory`.
2. Settings:
   - **Project name:** `motif` (it must match `"name"` in `wrangler.jsonc`, or change that file to match).
   - **Build command:** `npm run build` (optional: `public/` is already committed and up to date).
   - **Deploy command:** `npx wrangler deploy` (the default).
   - **Production branch:** the branch you want live, usually `main`. Merge this work into it first, or pick the feature branch for a preview.
3. Save and deploy. The site appears at `https://motif.<your-subdomain>.workers.dev`.

Every push to the production branch redeploys it; pushes to other branches can get their own preview URLs if you turn on preview deployments.

## Option 2: Cloudflare Workers from your computer

```
npm install
npx wrangler login          # once, opens the browser
npm run preview             # optional: the real Cloudflare runtime on http://localhost:8787
npm run deploy              # builds public/ and uploads it
```

## Option 3: Cloudflare Pages

**Connected to GitHub:** **Workers & Pages → Create → Pages → Connect to Git**, pick the repo, then:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `python3 build.py` (or leave empty: `public/` is committed) |
| Build output directory | `public` |

Pages reads `_headers` from the output folder the same way Workers does. Pages does not use `wrangler.jsonc` because it has no `pages_build_output_dir` key; the dashboard settings above are what count.

**Without Git:** run `python3 build.py`, then in **Workers & Pages → Create → Pages → Upload assets**, drag in the `public` folder.

## Custom domain

In the project's **Settings → Domains & Routes** (Workers) or **Custom domains** (Pages), add your domain. Cloudflare issues the HTTPS certificate automatically.

## What the headers do (`src/site/_headers`)

- `Permissions-Policy`: the microphone and MIDI keyboards are allowed for this site only; camera, location and payments are switched off.
- `Content-Security-Policy`: scripts and styles may only be the page's own (inline) code, fonts only from Google Fonts, and no other site may frame the page.
- `Cache-Control: no-cache` on the page, so a new deploy reaches learners on their next visit.

If you add an outside service (analytics, a backend, another font host), add its address to the matching `Content-Security-Policy` directive, or the browser will block it.

## Checking a deploy

Open the site, go to **Toolbox → Listen**, turn on the mic, and play or sing a note and a chord. If the mic button says the mic is blocked, check that the address starts with `https://` and that the browser's site settings allow the microphone.

## Keeping `public/` current

`npm test` rebuilds `public/` before running the tests. After changing anything in `src/`, run `npm run build` (or `npm test`) and commit `public/` with your change, so a deploy without a build step still ships the latest version.
