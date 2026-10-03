# Independent asset generation

Built-in imagegen was used to create each object independently. The original
reference screenshot supplied lighting, palette and material direction; the
active design does not slice or reuse its pixels.

The exact prompt set is recorded in `cinematic-art-prompts.json`:

- `hall`: empty warm ivory atrium, reflective floor, architecture and plants.
- `core-platform`: transparent blue/gold chip pedestal and orange energy beam.
- `lessons`: transparent glass schedule and its own platform.
- `students`: transparent blue/green student figures and Demo 1 badge.
- `teachers`: transparent open book, blue pen, Matematik and Ödev hazır badges.
- `finance`: transparent orange/blue physical chart on a glass platform.
- `parents`: transparent notification bell and daily-summary card.
- `management`: transparent blue %92 ring and attendance card.
- `workspace`: independent transparent blank glass screen for desktop role UI.
- `workspace-mobile`: independently generated portrait glass screen for mobile.

All runtime files are lossless WebP assets under
`public/images/brain-cinematic-v3/`. The existing official logo is preserved;
it is not generated from or cropped out of the reference screenshot.
