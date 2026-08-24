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
