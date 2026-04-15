#!/usr/bin/env python3
"""
Combine captured PNG frames into an animated GIF.
Usage: python3 scripts/gif-capture/make_gif.py
"""
import sys
from pathlib import Path
from PIL import Image

FRAMES_DIR = Path(__file__).parent / "frames"
OUT = Path(__file__).parent.parent.parent / "public" / "demo.gif"

# Per-scene hold durations (ms for the LAST frame in each scene)
# scene prefix (first 4 digits of filename) -> last-frame hold ms
SCENE_HOLD = {
    "0000": 1200,   # default state — pause so viewer can orient
    "0001": 600,
    "0002": 600,
    "0003": 600,
    "0004": 900,    # scale type change — meaningful moment
    "0005": 900,    # CAGED all shapes
    "0006": 700,
    "0007": 700,
    "0008": 700,
    "0009": 700,
    "0010": 800,    # all shapes again
    "0011": 900,    # interval display
    "0012": 700,
    "0013": 1200,   # back to start — loop hold
}
DEFAULT_FRAME_DUR = 100    # ms between duplicate frames (effectively 0 for static dupes)
DEFAULT_HOLD = 700

# Target display size (stays legible at < 1 MB)
# 960×900 matches capture aspect ratio 1280×1200 at 75% scale
DISPLAY_W, DISPLAY_H = 960, 900
N_COLORS = 128


def make_gif():
    frame_paths = sorted(FRAMES_DIR.glob("*.png"))
    if not frame_paths:
        print("No frames found in", FRAMES_DIR)
        sys.exit(1)

    print(f"Found {len(frame_paths)} frames")

    images = []
    durations = []

    # Collect one representative frame per scene (the last in each group)
    scene_frames = {}
    for fp in frame_paths:
        prefix = fp.stem[:4]
        scene_frames[prefix] = fp  # last wins → last frame of scene

    for prefix, fp in sorted(scene_frames.items()):
        dur = SCENE_HOLD.get(prefix, DEFAULT_HOLD)
        img = Image.open(fp).convert("RGB")
        img = img.resize((DISPLAY_W, DISPLAY_H), Image.LANCZOS)
        img_p = img.quantize(colors=N_COLORS, method=Image.Quantize.FASTOCTREE, dither=0)
        images.append(img_p)
        durations.append(dur)
        print(f"  scene {prefix}: {fp.name} → {dur}ms")

    print(f"Saving GIF to {OUT} ...")
    images[0].save(
        OUT,
        format="GIF",
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        optimize=False,
    )
    size_kb = OUT.stat().st_size / 1024
    print(f"Done! {size_kb:.0f} KB → {OUT}")


if __name__ == "__main__":
    make_gif()
