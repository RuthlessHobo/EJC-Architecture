# The phone sketch video — `site/assets/video/stages-draw-m.mp4`

On phones the house ("stages") section is not pinned and does not scrub with
scroll. When it comes into view it plays a short pencil-drawing video, then the
shading and colour render wipe in over it (see the "Mobile stages" block in
`site/css/style.css` and `initMobileStages` in `site/js/main.js`).

The video is **rendered from the desktop drawing itself**, not drawn by hand,
so if the strokes in `index.html` (`svg.stages__draw`) change, re-render it.

## What it is

| | |
|---|---|
| Source | the 392 `line`/`path` strokes in `svg.stages__draw`, with the same `.gd` / `.pn` / `.ht` colours, widths and opacities as `style.css` |
| Crop | a band 640 units wide from the centre of the 1673×940 plate (viewBox `516.5 0 640 940`), full height |
| Size | 1526×2240 px (2.384 px per plate unit) |
| Pencil filter | the desktop `#pencil` filter rescaled to this size: `feTurbulence baseFrequency="0.0084"`, `feDisplacementMap scale="6.2"` (desktop is 0.02 / 2.6 on a ~0.96 px/unit plate) |
| Paper | `assets/img/stages2-paper.webp` tiled at `background-size: 1490px` |
| Length | 139 frames at 30 fps (4.63 s); the last ~3% holds the finished drawing |
| Encode | `ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -profile:v high -level 5.1 -movflags +faststart -an stages-draw-m.mp4` (≈370 KB) |

**Placement on the page depends on the crop.** The CSS sizes the video to the
plate's height with `aspect-ratio: 1526 / 2240` and centres it, which lands it
exactly where `object-fit: cover` puts the sketch and render on any portrait
screen. Change the crop and you must change that aspect ratio to match.

## Timing (time `t` runs 0→1 over the video)

Each stroke's start is set by where it sits across what an iPhone Pro Max
actually shows (plate x 620–1053), not across the whole desktop plate:

| Strokes | Start | Stagger across the view | Draw time |
|---|---|---|---|
| `.gd` construction guides | 0.00 | 0.16 (in desktop order) | 0.07 |
| `.pn` pencil linework | 0.08 | 0.56 (left to right) | 0.12 |
| `.ht` hatching | 0.42 | 0.40 (left to right) | 0.10 |

Each stroke draws by animating `stroke-dashoffset` from 1 to 0 (all strokes
carry `pathLength="1"`).

## How to re-render

1. Build a page that is just the paper background plus the `svg.stages__draw`
   markup, with the viewBox, filter and stroke styles above, and a
   `setT(t)` function that sets each stroke's `stroke-dashoffset` from the
   timing table.
2. Load it in headless Chrome at 1526×2240, device scale 1. For each of the 139
   frames call `setT(min(1, k / (138 × 0.97)))` and save a PNG screenshot.
3. Encode with the ffmpeg line above and replace the file.

Use Google Chrome rather than Chromium for anything that needs to *play* the
result: Chromium builds cannot decode H.264.

## Why a blob, not a `src` URL

Cloudflare's static assets answer byte-range requests with `200` and the whole
file, and iOS Safari will not play a video served that way. `main.js` fetches
the file whole and plays it from a blob URL, where Safari serves ranges itself.
