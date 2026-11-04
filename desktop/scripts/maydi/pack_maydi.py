"""Pack Blender frames into portable transparent WebP assets and a small review GIF.

python3 desktop/scripts/maydi/pack_maydi.py output/maydi-animation/frames
Requires Pillow. Rendering/packing are build-time tools; the app has no new dependencies.
"""
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
frames = Path(sys.argv[1]).resolve()
target = ROOT / "desktop/public/mascots/maydi"
target.mkdir(parents=True, exist_ok=True)
SIZE = (256, 320)


def load(name):
    im = Image.open(frames / (name + ".png")).convert("RGBA")
    assert im.size == SIZE, (name, im.size)
    bounds = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    assert bounds and bounds[0] > 2 and bounds[1] > 2 and bounds[2] < 254 and bounds[3] < 318, (name, bounds)
    return im


def save(im, name):
    im.save(target / (name + ".webp"), quality=88, method=6, exact=True)


EXPRESSIONS = ("speaking", "happy", "thinking", "guiding", "love")
for name in ("idle", *EXPRESSIONS):
    save(load(name), name)

for name in EXPRESSIONS:
    atlas = Image.new("RGBA", (256 * 4, 320 * 3))
    for i in range(12):
        atlas.paste(load("%s_%02d" % (name, i)), (256 * (i % 4), 320 * (i // 4)))
    save(atlas, name + "-loop")

spin = [load("spin_%02d" % i) for i in range(48)]
wink = [load("wink_%02d" % i) for i in range(6)]
for name, images, columns in (("spin", spin, 8), ("wink", wink, 6)):
    rows = (len(images) + columns - 1) // columns
    atlas = Image.new("RGBA", (256 * columns, 320 * rows))
    for i, frame in enumerate(images):
        atlas.paste(frame, (256 * (i % columns), 320 * (i // columns)))
    save(atlas, name)

# Discrete keyframes visit every cell, including row boundaries, without interpolation.
css_path = ROOT / "desktop/src/components/assistant/MaydiMascot.css"
css = css_path.read_text()
keyframes = "@keyframes maydi-spin {\n" + "\n".join(
    "  %.6f%% { background-position: %.6f%% %.6f%%; }" % (i / 48 * 100, i % 8 / 7 * 100, i // 8 / 5 * 100)
    for i in range(48)
) + "\n  100% { background-position: 100% 100%; }\n}"
css = re.sub(r"@keyframes maydi-spin \{.*?\n\}", lambda _: keyframes, css, flags=re.S)
expression_keyframes = "@keyframes maydi-expression {\n" + "\n".join(
    "  %.6f%% { background-position: %.6f%% %.6f%%; }" % (i / 12 * 100, i % 4 / 3 * 100, i // 4 / 2 * 100)
    for i in range(12)
) + "\n  100% { background-position: 100% 100%; }\n}"
css = re.sub(r"@keyframes maydi-expression \{.*?\n\}", lambda _: expression_keyframes, css, flags=re.S)
css_path.write_text(css)
shutil.copyfile(css_path, target / "mascot.css")

metadata = {
    "frameWidth": 256, "frameHeight": 320,
    "spin": {"columns": 8, "rows": 6, "frames": 48, "durationMs": 1650,
             "effect": "tapered-cyan-orbit", "fadeInMs": 248, "fadeOutMs": 413},
    "wink": {"columns": 6, "rows": 1, "frames": 6, "durationMs": 540},
    "expressions": {name: {"poster": name + ".webp", "atlas": name + "-loop.webp",
                            "columns": 4, "rows": 3, "frames": 12} for name in EXPRESSIONS},
    "source": "Maydi/output/states/maydi_states.blend",
}
(target / "atlas.json").write_text(json.dumps(metadata, indent=2) + "\n")

# Review GIF has a neutral background; production WebPs retain alpha transparency.
sequence = [load("idle")] + wink + [wink[-1]] + list(reversed(wink)) + [load("idle")] + spin + [load("happy"), load("idle")]
durations = [1100] + [45] * 6 + [90] + [45] * 6 + [550] + [35] * 48 + [850, 650]
review = []
for frame in sequence:
    canvas = Image.new("RGB", SIZE, "#eef3fb")
    canvas.paste(frame, mask=frame.getchannel("A"))
    review.append(canvas)
preview = frames.parent / "maydi-preview.gif"
review[0].save(preview, save_all=True, append_images=review[1:], duration=durations, loop=0, disposal=2)
print("Assets:", target)
print("Preview:", preview)
for asset in sorted(target.glob("*.webp")):
    print(asset.name, asset.stat().st_size, "bytes")
