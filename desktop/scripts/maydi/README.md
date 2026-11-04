# Maydi animations

The original supplied 3D scene is rendered offline. The app uses transparent WebP atlases,
so it does not need Three.js, WebGL, external requests, or a 3D rendering loop.

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  -b /path/to/Maydi/output/states/maydi_states.blend \
  --python desktop/scripts/maydi/render_maydi.py -- output/maydi-animation/frames
python3 desktop/scripts/maydi/pack_maydi.py output/maydi-animation/frames
```

The packer requires Pillow and checks that every rendered pose fits inside the frame.
CPU rendering is the default; `--metal` opts into Metal on supported Macs.
The source scene is never saved or modified.

`MaydiMascot` accepts `size` (height in px), `thinking`, `spinSignal` (increment to turn),
`entranceSignal` (increment to rise, turn and wink), `platform` (a translucent base),
`responseId` / `responseMood` (a new response plays its presentation), `affectionSignal`
(positive feedback), `mood` (an explicit pose), and `animated` (false for message avatars).
It is decorative: accessible names belong to the containing controls. Reduced-motion
preferences and hidden tabs stop animation. The floating launcher and header button
trigger a single 360° turn on pointer entry or keyboard focus; the header also supports click.

The launcher shows only the mascot and platform; its name remains an accessible label.
`MaydiLauncher` plays the 750 ms rise, 1650 ms turn and 540 ms wink on the first page and
eligible pathname changes, with at least 15 seconds between automatic entrances.
There is no repeating entrance timer on the same page. Opening/closing chat does not
replay the entrance; hidden tabs and reduced motion suppress it. A short reveal clip
at the platform surface makes the mascot emerge from inside the base.

The turn includes a thin tapered cyan orbit around the lower body, with soft glow and
blue reflections. It is baked into the 48-frame atlas with correct front/back occlusion;
no extra runtime effects are needed. The trail fades in over the first 15% of the turn
and fades out over the last 25%. Idle, wink, thinking and happy poses have no orbit.
Use `--spin-preview` when rendering to review three orbit frames before a full export.

Assets and a standalone preview live in `desktop/public/mascots/maydi/`.
`atlas.json` describes the frame grid for reuse in other clients.
The preview uses `mascot.css`, copied from the component stylesheet by the packer.

The six reference poses are normal, speaking (mouth movement and sound waves), happy
(joy rays), thinking (curious eyes and a question mark), guiding (pointing glove and
list bubble), and love (floating pink hearts). Each non-idle pose has a 12-frame,
4 × 3 atlas and a still WebP for reduced motion. The original model supplies all faces
and props; there are no visible pose labels in the interface.

Busy requests show thinking; ordinary answers show speaking; instructions/navigation
show guiding; `action_result` responses show happy; positive feedback and standalone
appreciation such as "Teşekkür ederim" or "Sağ ol" show love. Acknowledgements last four
seconds, queue during pending requests and are not replaced by an arriving answer.
The avatar beside a liked reply also keeps the heart pose, so feedback is visible
where it was given. Saved likes do not replay the transient header animation.
Reactions return to idle after 2.2–4.2 seconds. Reduced motion uses still expressions.
Open `preview.html?expressions=1` to cycle through all six poses; clicking advances one.
Use `--expressions-preview` for posters or `--expressions-only` for all expression loops
when rendering, then run the packer to update the app assets and atlas metadata.

`review.html` is the manual inspection screen: all six poses have selectable cards
and a large persistent view, with separate wink, turn and entrance controls. The
optional sequence advances every 4.8 seconds; selecting a card stops the sequence.
It supports light/dark backgrounds, narrow screens and reduced motion. This screen
does not perform assistant actions or send notifications to real users.

The chat itself uses `AssistantPanel.css`: a 360 × 560 px shell constrained to the
viewport, with palettes inherited from the application's light/dark class. The
composer, summary cards, feedback and history use this scoped surface system.
Message timestamps are retained when loading history and grouped by local day.
