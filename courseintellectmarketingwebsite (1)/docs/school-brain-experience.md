# SchoolAsist independent cinematic assets

The active design uses ten separately generated high-resolution assets: an
empty atrium, central chip platform, six process illustrations, and desktop/mobile
empty glass workspaces. The supplied concept is a style reference only. No
reference-sheet image, image crop, sprite viewBox or clipped reference logo is
used by the active component. The rejected sheet-based assets were removed.
The central logo uses the existing official `public/images/logo.png` unchanged.
The supplied GLB and optimized variants remain available, but the active hero
uses independently composited illustrations rather than a WebGL scene.

`school-cinematic-art.tsx` drives a reversible scroll timeline. The logo rises
from its own platform; six individually rendered process islands appear in
sequence. SVG energy connections reveal with the relevant island and carry
moving light packets. The core retreats and scales down while the teacher book
approaches. Other roles crossfade to a matching glass workspace containing real
role-specific HTML demo content. Role CTAs, all eleven feature catalogs, search
and detail dialogs remain working. Mobile uses the same independent objects in
two columns and a separately generated portrait workspace.

The scene moves through transform/opacity animations; it does not animate the
core's layout width or position each frame. CSS packet/orbit animation pauses
when offscreen or the tab is hidden. Reduced motion disables these animations,
removes pinned scrolling, and retains accessible feature previews and links.
Generated imagery has empty alt text because real headings, role copy and
accessible process links provide the meaningful content. Invisible hotspots
are inert. Image errors expose a fallback and retry action.

All project assets are under `public/images/brain-cinematic-v3/`. Generation used
the built-in imagegen tool with one generation per asset; exact prompts and output
provenance are recorded in `cinematic-art-prompts.md` and the adjacent JSON.
Lossless WebP conversion preserves alpha and every visible pixel of the source
PNGs. RGB under fully transparent pixels is omitted by WebP and has no displayed
content. Source PNGs remain in the task's generated-image archive.

Initial hall and chip images total 2,807,646 bytes; process assets are mounted
only after scrolling begins. The asset test bounds initial bytes, the complete
set, resolution and genuine transparency. No remote service, WASM decoder or
external texture fetch is used at runtime. The existing CSP stays unchanged.

This work is local and does not deploy the website. Matching the reference's
visual direction is not a guarantee of pixel identity or frame rate on every
device. Review the actual saved browser screenshots against the concept.

Verification on 2026-10-02: production build, ESLint and 11 Node tests passed.
All eleven role pages were opened at 1440×900 and 390×844; each first feature
dialog opened and closed, with no horizontal overflow or broken loaded image.
Browser proof files are in the task visualization folder under
`schoolasist-brain-experience/independent-cinematic/`.
