# EJC Architecture — Demo Site

A standalone, static demo website for EJC Architecture, generated from the
assets in `Website/`. It is fully self-contained in this `demo/` folder and
does not touch or affect the main website in any way.

- `index.html` — single-page portfolio site (no build step, no dependencies)
- `assets/` — web-optimised JPEG copies of the project images (max 1800px wide)

To preview locally, open `demo/index.html` in a browser, or serve the folder:

```
cd demo && python3 -m http.server 8000
```
