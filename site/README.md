# ejcarch.co.za

The deployable site. This directory is the Cloudflare Pages build output root —
deploy `site/`, not the repository root.

Until now the only copy of this code was the zip on the laptop and whatever was
live on Pages. This is that site, mirrored from the live deployment on
2 September 2026 and optimised. **If the laptop zip has newer content than what
was live that day, reconcile it before deploying.**

## Deploying

Upload the contents of this directory to Cloudflare Pages exactly as before. The
only new file that matters to Pages is `_headers`, which must sit at the deploy
root to take effect.

## What was changed, and why

Full measurements are in the pull request. In short:

| | Before | After |
|---|---|---|
| Homepage, desktop, fully scrolled | 9.17 MB | 6.38 MB |
| Homepage, mobile | 1.19 MB | 0.94 MB |
| Whole site | 31.6 MB | 22.1 MB |

- **`_headers`** — Pages was sending `max-age=0, must-revalidate` on all ~150
  assets, so every repeat visit re-checked every file. This was the single
  biggest win and it changes nothing about how the site looks.
- **WebP** — every JPEG now has a WebP twin, offered through `<picture>` with
  the JPEG kept as the fallback. Both are in this directory on purpose.
- **Hero** — the poster was lazy-loaded (so it started late) *and* fetched twice,
  once as JPEG by `<video poster>` and once as WebP by the `<img>`. It is now one
  preloaded WebP.
- **Video** — re-encoded 7.74 MB → 4.42 MB, and it no longer downloads at all
  below 820px, where the stylesheet hides it anyway.
- **Two broken CSS paths** — `../img/` should have been `../assets/img/`. The
  paper texture behind the stages section and the mobile hero background were
  both 404ing, which meant **mobile visitors saw an empty hero**.
- **Layout stability** — all 190 `<img>` tags now carry `width`/`height`.
- **Links** — internal links pointed at `page.html`; Pages 307-redirects those to
  `/page`. They now point at the final URL.
- **Animation loops** — four `requestAnimationFrame` loops ran forever, one of
  them forcing a layout every frame. They now idle when nothing is moving, which
  is what made scrolling feel heavy on slower machines.

## Re-running the optimiser

After hand-editing any HTML here, run:

```sh
pip install Pillow
python3 tools/optimize_site.py
```

It is idempotent — it re-applies the `width`/`height` attributes, `<picture>`
wrappers, poster and link rewrites to anything new, and leaves everything else
alone. `--html` skips the slow image and video work.

**Adding a new image**: drop the JPEG in `assets/img/` (with a `-s` variant if it
belongs in a `srcset`), reference it, then re-run the optimiser to generate its
WebP and fill in its dimensions.

Note that `assets/video/hero.mp4.optimised` is a marker file that stops the video
being re-encoded — and losing quality — on every run. Delete it if you replace
the video.

## How this is deployed

The site is a static-asset Cloudflare **Worker** (`ejcarchitecture-v1`), not a
Pages project — `ejcarch.co.za` is bound to it as a custom domain. `wrangler.jsonc`
at the repository root holds the config.

```sh
npx wrangler versions upload   # upload a version, get a preview URL, production untouched
npx wrangler versions deploy   # promote a verified version to production
```

Prefer that two-step over `wrangler deploy`: it gives you a real URL to check
before any visitor sees the change.
