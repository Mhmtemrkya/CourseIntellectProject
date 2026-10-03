# Platform presentation

The public `/platform/` and `/ozellikler/` routes share `components/site/platform-story.tsx`. The design is based on the approved platform concept, rebuilt as native headings, links, workflow previews and five independently generated illustrations. No region is cropped from the full-page concept image.

## Assets

`public/images/platform-art/` contains `hero`, `lessons`, `students`, `finance` and `devices`. The built-in image generation tool produced each illustration independently at 1536 × 1024, with genuine alpha and the supplied official logo as the hero/device reference. Original paths and complete prompts are retained in `platform-art-prompts.json`.

Desktop WebP copies are lossless; 900 px mobile versions use quality 92 with alpha quality 100. The mobile browser selects them through `<picture>`. Only the hero is loaded eagerly; remaining illustrations are lazy loaded. Native labels remain accessible and selectable. Screens and metrics in illustrations/workflow previews are representative demos.

## Motion and access

- Short, once-only entrance animations move illustrations into place.
- Hero and device artwork use restrained vertical scroll parallax.
- Scroll progress draws the process ribbon and information-flow connector.
- Process illustrations respond to hover; links lead to the corresponding real role pages.
- Motion does not hide server-rendered content. Reduced-motion preferences disable entrances, parallax and hover movement and show completed connectors.
- No WebGL canvas, continuous animation loop, new tracking request, dependency or API is added to this page.

The existing registration flow is reused; the call to action states that approval is required. Header and footer remain shared, with the platform routes using the existing light header palette.
