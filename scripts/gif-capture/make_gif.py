#!/usr/bin/env python3
"""Combine PNG frames into an animated GIF."""
import os
import re
import sys
from pathlib import Path
from PIL import Image

FRAMES_DIR = Path(__file__).parent / "frames"
OUT = Path(__file__).parent.parent.parent / "public" / "demo.gif"

# Per-scene hold durations (ms for the last frame in each scene)
SCENE_HOLD = {
    "0000": 1200,   # default state — orientation pause
    "0001": 600,
    "0002": 600,
    "0003": 600,
    "0004": 900,    # scale family change
    "0005": 900,    # CAGED all shapes
    "0006": 700,
    "0007": 700,
    "0008": 700,
    "0009": 700,
    "0010": 800,    # all shapes again
    "0011": 900,    # interval display
    "0012": 700,
    "0013": 1200,   # loop hold
}
DEFAULT_FRAME_DUR = 100
DEFAULT_HOLD = 700

# 960x900 matches 1280x1200 capture at 75% scale (stays < 1MB)
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

    # Map scene prefix to representative frame (last in group wins)
    scene_frames = {}
    filename_pattern = re.compile(r"^\d{4}")
    for fp in frame_paths:
        if not filename_pattern.match(fp.stem):
            print(f"Warning: Skipping file with unexpected name: {fp.name}")
            continue
        prefix = fp.stem[:4]
        scene_frames[prefix] = fp

    for prefix, fp in sorted(scene_frames.items()):
        dur = SCENE_HOLD.get(prefix, DEFAULT_HOLD)
        img = Image.open(fp).convert("RGB")
        img = img.resize((DISPLAY_W, DISPLAY_H), Image.LANCZOS)
        img_p = img.quantize(colors=N_COLORS, method=Image.Quantize.FASTOCTREE, dither=0)
        images.append(img_p)
        durations.append(dur)
        print(f"  scene {prefix}: {fp.name} → {dur}ms")

    out_dir = os.path.dirname(OUT)
    os.makedirs(out_dir, exist_ok=True)

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