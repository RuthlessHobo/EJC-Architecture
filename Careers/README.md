# EJC Architecture — Careers Page

`index.html` is a fully self-contained careers page (all images embedded), ready to
import into the EJC website as a single file or paste into a custom-code page element.

## Contents
- Hero + studio intro
- Open position: Draftsperson / Technologist (Pretoria)
- Full role description (qualifications, essential skills, behavioural attributes)
- Application form: name, contact, city, qualification, experience, Revit proficiency,
  council submission experience, CV upload (PDF), portfolio link + optional PDF upload,
  motivation, POPIA consent

## Before go-live
1. Wire the form to the site's form/CRM handler so submissions email the studio with
   the CV attached (the current submit handler is a preview stub — see the marked
   `PREVIEW MODE` comment in the `<script>` block at the bottom of `index.html`).
2. Confirm the applications email address for notifications.
3. `assets/` holds the optimized standalone images if the site builder prefers hosted
   images over the embedded ones.
4. The fullscreen menu's nav links (`/`, `/projects`, `/services`, `/featured`,
   `/contact`) are placeholders marked in the HTML — point them at the live
   site's real page URLs on import.
