# EJC Architecture — static site (v3)

Four pages, zero dependencies, self-hosted fonts. Deploy: drag folder into
Cloudflare Pages or `npx wrangler pages deploy .`

## Signature section
Home has a pinned sketch->render scroll sequence (`.stages`): the Klipsteen Villa
pencil sketch resolves into the final render as you scroll, with the SACAP-style
6-stage labels (Inception -> Close out) tracking progress. Sketch layer was
generated from the render (assets/img/villa-sketch.jpg) so the crossfade is
pixel-aligned. Swap both images to feature a different project.

## Real details in use
Eduan Coetzer — ejc.archeduan@gmail.com — 063 990 2222 — SACAP PSAT58497224 —
Instagram @ejc_arch. Reviews use the five names from the brand PDF with
placeholder quotes (marked for client sign-off).

## Before launch
- PROJECT NAMES are placeholders except Marabou Street (Kiepersol Estate,
  Klipsteen Villa, House Marula, Dusk Garden House, Bosveld Retreat) — rename
  per client.
- Hero video: trimmed from the 31s flythrough (first 14s). Re-trim in
  assets/video/hero.mp4 if a different pass is preferred.
- Review quotes + narrative copy: filler pending client approval.
- Contact form submit: TODO in js/main.js — wire to GHL endpoint / Worker webhook.
- bosveld-*.jpg are low-res (cropped phone screenshots) — request originals.
