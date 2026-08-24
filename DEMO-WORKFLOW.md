# Client Demo Workflow (Cloudflare Pages)

You don't need a second "demo site" per client — Cloudflare Pages has this built in.
Every deploy to a **non-production branch** gets its own permanent preview URL, free,
on the same project. Production stays untouched until you promote.

## If the project deploys from a connected Git repo
1. Keep `main` as the production branch (→ live domain).
2. Create a long-lived `demo` branch. Push work-in-progress there.
3. Cloudflare auto-builds it at a stable URL: `https://demo.<project>.pages.dev`
   (plus a unique per-deploy URL like `https://<hash>.<project>.pages.dev`).
4. Send the client the `demo.` URL. When they approve, merge `demo` → `main`
   and the live site updates.

## If you deploy by direct upload (wrangler / drag-and-drop)
Same idea — the `--branch` flag decides live vs demo:

```sh
# demo deploy (client preview, live site untouched):
npx wrangler pages deploy ./site-folder --project-name=<project> --branch=demo

# production deploy (after approval):
npx wrangler pages deploy ./site-folder --project-name=<project> --branch=main
```

## Notes
- Preview URLs are public-but-unguessable by default. To lock them down,
  enable Access protection on preview deployments:
  Cloudflare dashboard → Pages project → Settings → General → "Enable access policy"
  (client logs in with a one-time email code).
- This works per client, per project — no extra hosting, no extra cost.
- The same pattern applies to every Remy Systems client site on Pages.

## Your actual EJC setup (Workers, not Pages)

The live site runs as a Cloudflare **Worker** (`ejcarchitecture-v1.rhyne-schmidt55.workers.dev`),
so branch previews work slightly differently. Two options, simplest first:

### Option A — a named demo worker (recommended)
From a checkout of the `demo` branch:

```sh
git fetch origin demo && git checkout demo
npx wrangler deploy --name ejcarchitecture-demo
```

That publishes `https://ejcarchitecture-demo.rhyne-schmidt55.workers.dev` — a
separate URL the client can browse, while `ejcarchitecture-v1` stays live and
untouched. When they approve, merge `demo` into `site` and deploy the main
worker as usual.

### Option B — Worker preview versions
`npx wrangler versions upload` creates a preview version of the SAME worker at
`https://<version-id>-ejcarchitecture-v1.rhyne-schmidt55.workers.dev` without
promoting it. `npx wrangler versions deploy` promotes it live after approval.
More moving parts — Option A is easier to explain to clients.

### Branch layout for this repo
- `site`  — approved source of the live site (deploy `-v1` from here)
- `demo`  — client-preview branch (careers page currently lives here)
- `main`  — project assets (photos, docs, logos)
