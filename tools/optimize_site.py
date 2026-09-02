#!/usr/bin/env python3
"""Apply the load-speed optimisations to site/ in place.

Safe to re-run: every step checks whether it has already been applied, so this
can be run again after hand-editing the HTML and it will only fill in what is
missing.

    python3 tools/optimize_site.py            # assets + markup
    python3 tools/optimize_site.py --html     # markup only (fast)
    python3 tools/optimize_site.py --assets   # images + video only

Requires Pillow. Video re-encoding additionally needs ffmpeg, either on PATH or
via the imageio-ffmpeg package; it is skipped with a warning if absent.
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

Image.MAX_IMAGE_PIXELS = None

SITE = Path(__file__).resolve().parent.parent / "site"

# The one image that paints the hero on first render. It must not be lazy-loaded
# and it gets a preload hint, because it is the LCP element on every page that
# shows it.
HERO_IMAGE = "assets/img/hero-poster.jpg"

# WebP quality. The site's JPEGs are already well tuned, so this is chosen to
# beat them on size without visible loss; anything a WebP cannot beat keeps its
# JPEG (see build_webp).
WEBP_QUALITY = 80

# Background loop behind the hero text. CRF 26 at full resolution roughly halves
# the file while staying clean on a large display.
VIDEO_CRF = 26


def ffmpeg_exe() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# assets
# --------------------------------------------------------------------------- #


def build_webp() -> dict[str, bool]:
    """Write a .webp beside every .jpg that is genuinely smaller than the JPEG.

    Returns a map of jpeg path (site-relative, posix) -> whether a WebP won.

    A <source type="image/webp"> applies to every entry in the srcset, so an
    image only gets one if *all* of its variants have a WebP. The site's small
    `-s` crops are detailed line work that WebP encodes larger than JPEG at the
    default quality, and letting one of those fail would keep the whole image --
    including its heavyweight full-size variant -- on JPEG. So step the quality
    down until the WebP wins; at the size these variants are displayed the
    difference is not visible, and it unlocks the ~20% saving on the big files.
    """
    wins: dict[str, bool] = {}
    saved = lost = 0
    for jpg in sorted(SITE.rglob("*.jpg")):
        webp = jpg.with_suffix(".webp")
        rel = jpg.relative_to(SITE).as_posix()
        target = jpg.stat().st_size
        if not webp.exists():
            with Image.open(jpg) as im:
                rgb = im.convert("RGB")
                for quality in (WEBP_QUALITY, 72, 64, 56):
                    rgb.save(webp, "WEBP", quality=quality, method=6)
                    if webp.stat().st_size < target:
                        break
        if webp.stat().st_size < target:
            wins[rel] = True
            saved += target - webp.stat().st_size
        else:
            webp.unlink()
            wins[rel] = False
            lost += 1
    print(
        f"  webp: {sum(wins.values())} images ({saved / 1048576:.2f} MB saved)"
        + (f", {lost} kept as JPEG (WebP never won)" if lost else "")
    )
    return wins


def build_video() -> None:
    src = SITE / "assets/video/hero.mp4"
    if not src.exists():
        return
    marker = src.with_suffix(".mp4.optimised")
    if marker.exists():
        print("  video: already optimised")
        return
    exe = ffmpeg_exe()
    if not exe:
        print("  video: SKIPPED (ffmpeg not found)")
        return
    before = src.stat().st_size
    tmp = src.with_suffix(".tmp.mp4")
    subprocess.run(
        [exe, "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
         "-an",                          # the loop is silent; drop the track
         "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "slow",
         "-pix_fmt", "yuv420p",
         "-movflags", "+faststart",      # moov atom first, so playback can start early
         str(tmp)],
        check=True,
    )
    tmp.replace(src)
    marker.write_text("re-encoded by tools/optimize_site.py\n")
    print(f"  video: {before / 1048576:.2f} MB -> {src.stat().st_size / 1048576:.2f} MB")


# --------------------------------------------------------------------------- #
# markup
# --------------------------------------------------------------------------- #


def image_size(rel: str) -> tuple[int, int] | None:
    path = SITE / rel
    if not path.exists():
        return None
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def first_src(tag: str) -> str | None:
    m = re.search(r'\bsrc="([^"]+)"', tag)
    return m.group(1) if m else None


def rewrite_img(tag: str, wins: dict[str, bool], is_hero: bool) -> str:
    """Add intrinsic dimensions, and fix loading strategy on the hero image."""
    src = first_src(tag)
    if not src:
        return tag

    # width/height: reserve layout space so the page stops jumping as images land.
    if not re.search(r"\bwidth=", tag):
        size = image_size(src)
        if size:
            tag = tag[:-1].rstrip() + f' width="{size[0]}" height="{size[1]}">'

    if is_hero:
        # The hero paints above the fold. Lazy-loading hides it from the preload
        # scanner and pushes back the largest contentful paint.
        tag = tag.replace(' loading="lazy"', "")
        tag = tag.replace(' decoding="async"', ' decoding="sync"')
        if "fetchpriority" not in tag:
            tag = re.sub(r"<img\b", '<img fetchpriority="high"', tag, count=1)
    return tag


def wrap_picture(tag: str, wins: dict[str, bool]) -> str:
    """Offer WebP ahead of the JPEG, keeping the original <img> as the fallback."""
    src = first_src(tag)
    if not src or not src.endswith(".jpg"):
        return tag

    candidates = [src]
    srcset = re.search(r'\bsrcset="([^"]+)"', tag)
    if srcset:
        candidates = [p.strip().split()[0] for p in srcset.group(1).split(",") if p.strip()]
    # Only swap in WebP when every variant of this image actually got smaller.
    if not all(wins.get(c) for c in candidates):
        return tag

    webp_attr = (
        re.sub(r"\.jpg(\s|,|$)", r".webp\1", srcset.group(1))
        if srcset
        else src.replace(".jpg", ".webp")
    )
    sizes = re.search(r'\bsizes="([^"]+)"', tag)
    sizes_attr = f' sizes="{html.escape(sizes.group(1), quote=True)}"' if sizes else ""
    return (
        f'<picture><source type="image/webp" srcset="{webp_attr}"{sizes_attr}>'
        f"{tag}</picture>"
    )


# A <picture> this script wrote on an earlier run. Unwrapping these first makes
# the whole pass idempotent: every image is reduced back to a bare <img>, then
# rebuilt from current data.
OURS = re.compile(r'<picture><source type="image/webp"[^>]*>(<img\b[^>]*>)</picture>')


def rewrite_html(path: Path, wins: dict[str, bool]) -> tuple[int, int, int]:
    text = path.read_text(encoding="utf-8")
    original = text
    text = OURS.sub(r"\1", text)

    sized = wrapped = 0
    hero_seen = False

    def on_img(m: re.Match) -> str:
        nonlocal sized, wrapped, hero_seen
        tag = m.group(0)
        src = first_src(tag) or ""
        # Only the first hero-poster <img> on a page is the LCP candidate.
        is_hero = src == HERO_IMAGE and not hero_seen
        if is_hero:
            hero_seen = True
        before = tag
        tag = rewrite_img(tag, wins, is_hero)
        if tag != before:
            sized += 1
        after = wrap_picture(tag, wins)
        if after != tag:
            wrapped += 1
        return after

    text = re.sub(r"<img\b[^>]*>", on_img, text)

    # A <video poster> cannot sit inside <picture>, so it keeps fetching the JPEG
    # while the hero <img> fetches the WebP -- the hero image downloaded twice.
    # Pointing the poster at the same WebP the <picture> chooses makes it one
    # shared download. Below 820px the stylesheet hides the video, but the poster
    # is fetched anyway, so this matters most on mobile.
    def fix_poster(m: re.Match) -> str:
        src = m.group(1)
        return f'poster="{src[:-4]}.webp"' if wins.get(src) else m.group(0)

    text = re.sub(r'poster="([^"]+\.jpg)"', fix_poster, text)

    # Cloudflare Pages serves extensionless URLs and 307s the .html form, so every
    # internal link currently costs an extra round trip. Point them at the final URL.
    links = len(re.findall(r'href="([\w-]+)\.html((?:#[\w-]+)?)"', text))
    text = re.sub(r'href="([\w-]+)\.html((?:#[\w-]+)?)"',
                  lambda m: f'href="{"/" if m.group(1) == "index" and not m.group(2) else m.group(1)}{m.group(2)}"',
                  text)

    # Preload the hero so it starts downloading alongside the stylesheet instead
    # of when the parser reaches it. It must name the file the browser will
    # actually choose: where a WebP won, <picture> takes the WebP, and preloading
    # the JPEG would fetch the hero twice. A browser without WebP support skips a
    # preload it cannot decode and falls back to the <img> as normal.
    if hero_seen:
        text = re.sub(r'\n\s*<link rel="preload" as="image"[^>]*>', "", text)
        if wins.get(HERO_IMAGE):
            hint = (f'<link rel="preload" as="image" type="image/webp" '
                    f'href="{HERO_IMAGE[:-4]}.webp" fetchpriority="high">')
        else:
            hint = f'<link rel="preload" as="image" href="{HERO_IMAGE}" fetchpriority="high">'
        text = text.replace(
            '<link rel="stylesheet" href="css/style.css">',
            f'{hint}\n  <link rel="stylesheet" href="css/style.css">',
            1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
    return sized, wrapped, links


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--html", action="store_true", help="markup only")
    ap.add_argument("--assets", action="store_true", help="images and video only")
    args = ap.parse_args()
    do_assets = args.assets or not args.html
    do_html = args.html or not args.assets

    if not SITE.is_dir():
        sys.exit(f"site directory not found: {SITE}")

    wins: dict[str, bool] = {}
    if do_assets:
        print("assets:")
        wins = build_webp()
        build_video()
    else:
        for jpg in SITE.rglob("*.jpg"):
            wins[jpg.relative_to(SITE).as_posix()] = jpg.with_suffix(".webp").exists()

    if do_html:
        print("markup:")
        for page in sorted(SITE.glob("*.html")):
            sized, wrapped, links = rewrite_html(page, wins)
            print(f"  {page.name:<28} {sized:3d} sized, {wrapped:3d} webp, {links:3d} links cleaned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
