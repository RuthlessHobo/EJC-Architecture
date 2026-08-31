# EJC Architecture — static site (v3)

Five pages, zero dependencies, self-hosted fonts. Deploy: drag folder into
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

## Careers page (added on `demo` branch)
- `careers.html` — native page: role listing (Draftsperson / Technologist),
  full role description, application form.
- Form posts to FormSubmit (same endpoint pattern as contact) with the CV as a
  PDF attachment (max 5 MB, enforced client-side); portfolio is a link field.
  `_next` redirects back to careers.html?sent=1 which renders the confirmation.
- Menu on all pages gained Careers <i>06</i> (+ preview image erf81n-r3) and the
  footer gained a Careers link; contact.html's duplicate "Contact 04" index was
  corrected to 05.
- NOTE: first FormSubmit post to ejc.archeduan@gmail.com triggers a one-time
  email activation from FormSubmit — send a test application and click the
  confirmation link before go-live.
