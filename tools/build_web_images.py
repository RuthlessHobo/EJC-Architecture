#!/usr/bin/env python3
"""Build web-ready image derivatives for the EJC Architecture site.

The files under `Website/` are print/archive masters: uncompressed PNGs up to
23 MB and 13000 px wide. Serving those directly is what makes the site slow.
This script leaves the masters untouched and writes a parallel `Website/web/`
tree of responsive WebP derivatives plus a `manifest.json` the site builds its
`<picture>`/`srcset` markup from.

Usage:
    python3 tools/build_web_images.py            # build changed/missing only
    python3 tools/build_web_images.py --force    # rebuild everything
    python3 tools/build_web_images.py --include-wip

Requires Pillow (`pip install Pillow`).
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

# Masters are far larger than Pillow's decompression-bomb default. They are our
# own files, so lift the guard rather than skipping them.
Image.MAX_IMAGE_PIXELS = None

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "Website"
OUT = SRC / "web"

SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}
# Internal working folders, not published on the site.
WIP_DIRS = {"WIP", "_CX"}

# Ladder of rendered widths. A derivative is only emitted when the master is at
# least this wide, so we never upscale.
WIDTHS = (640, 1280, 1920, 2560)

# Line art (floorplans, elevations) shows WebP ringing on sharp edges far more
# than a render does, so it gets a higher quality target.
Q_PHOTO = 80
Q_LINEART = 88
LINEART_PREFIXES = ("4_", "5_")

# Width of the inline blur-up placeholder embedded in the manifest.
LQIP_WIDTH = 24

# `N_` filename prefix -> the role the image plays on a project page.
ROLE_BY_PREFIX = {
    "1": "intro-sketch",
    "2": "render",
    "4": "plan",
    "5": "elevation",
    "6": "axo-view",
    "7": "axo-cut",
}


def slugify(text: str) -> str:
    """Lowercase ASCII slug. Masters use spaces and `&`, which break URLs."""
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text)
    return text.strip("-").lower()


def split_order_prefix(stem: str) -> tuple[int, str, str]:
    """Split a `N_Name` stem into (sort order, prefix digit, remaining name)."""
    match = re.match(r"^(\d+)_(.*)$", stem)
    if not match:
        return 99, "", stem
    return int(match.group(1)), match.group(1), match.group(2)


def encode(image: Image.Image, width: int, quality: int) -> bytes:
    height = max(1, round(image.height * width / image.width))
    resized = image.resize((width, height), Image.LANCZOS)
    buffer = io.BytesIO()
    # method=6 is the slowest/densest WebP search; these run once, so take it.
    resized.save(buffer, "WEBP", quality=quality, method=6)
    return buffer.getvalue()


def load_master(path: Path) -> Image.Image:
    """Open a master, normalising to RGB or RGBA (palette images may hide alpha)."""
    image = Image.open(path)
    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        return image.convert("RGBA")
    return image.convert("RGB")


def build(force: bool, include_wip: bool) -> int:
    if not SRC.is_dir():
        sys.exit(f"Source directory not found: {SRC}")

    masters: list[Path] = []
    for path in sorted(SRC.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        relative = path.relative_to(SRC)
        if relative.parts[0] == "web":  # our own output
            continue
        if not include_wip and WIP_DIRS.intersection(relative.parts):
            continue
        masters.append(path)

    if not masters:
        sys.exit("No source images found.")

    projects: dict[str, dict] = {}
    master_bytes = 0
    output_bytes = 0
    encoded = 0
    skipped = 0

    for path in masters:
        relative = path.relative_to(SRC)
        project_dir = relative.parts[0]
        project_slug = slugify(project_dir)
        order, prefix, name = split_order_prefix(path.stem)
        image_slug = slugify(name) or slugify(path.stem)

        quality = Q_LINEART if path.name.startswith(LINEART_PREFIXES) else Q_PHOTO

        with load_master(path) as master:
            width, height = master.size
            master_size = path.stat().st_size
            master_bytes += master_size

            target_dir = OUT / project_slug
            target_dir.mkdir(parents=True, exist_ok=True)

            # Never upscale; always emit at least the master's own width.
            widths = [w for w in WIDTHS if w <= width] or [width]

            sources = []
            for target_width in widths:
                target = target_dir / f"{image_slug}-{target_width}.webp"
                if force or not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
                    target.write_bytes(encode(master, target_width, quality))
                    encoded += 1
                else:
                    skipped += 1
                size = target.stat().st_size
                output_bytes += size
                sources.append(
                    {
                        "width": target_width,
                        "height": max(1, round(height * target_width / width)),
                        "bytes": size,
                        "src": f"{project_slug}/{target.name}",
                    }
                )

            lqip = base64.b64encode(encode(master, LQIP_WIDTH, 45)).decode("ascii")

        entry = {
            "slug": image_slug,
            "role": ROLE_BY_PREFIX.get(prefix, "other"),
            "order": order,
            "master": relative.as_posix(),
            "width": width,
            "height": height,
            "aspectRatio": round(width / height, 4),
            "masterBytes": master_size,
            "lqip": f"data:image/webp;base64,{lqip}",
            "sources": sources,
        }

        project = projects.setdefault(
            project_slug,
            {"slug": project_slug, "name": project_dir, "images": []},
        )
        project["images"].append(entry)

        saving = 1 - sum(s["bytes"] for s in sources) / master_size
        print(
            f"  {relative.as_posix():<64} {master_size / 1048576:6.1f} MB "
            f"-> {len(widths)} widths, largest "
            f"{max(s['bytes'] for s in sources) / 1024:6.0f} KB  ({saving:.1%} smaller)"
        )

    for project in projects.values():
        project["images"].sort(key=lambda i: (i["order"], i["slug"]))

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generatedBy": "tools/build_web_images.py",
        "widths": list(WIDTHS),
        "format": "webp",
        "projects": [projects[k] for k in sorted(projects)],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(
        f"\n{len(masters)} masters ({master_bytes / 1048576:.0f} MB) -> "
        f"{output_bytes / 1048576:.1f} MB of derivatives "
        f"({1 - output_bytes / master_bytes:.1%} smaller). "
        f"{encoded} encoded, {skipped} already current."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="rebuild every derivative")
    parser.add_argument(
        "--include-wip",
        action="store_true",
        help=f"also process the internal {'/'.join(sorted(WIP_DIRS))} folders",
    )
    args = parser.parse_args()
    return build(force=args.force, include_wip=args.include_wip)


if __name__ == "__main__":
    raise SystemExit(main())
