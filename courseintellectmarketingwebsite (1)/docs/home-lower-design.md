# Homepage continuation

The existing SchoolBrainExperience leads into three functional sections: daily flow, role explorer, and device continuity. All headings, buttons and modal copy are real HTML. Generated illustrations are independent transparent assets, not crops of the concept image.

## Assets

Five new built-in ImageGen illustrations: lessons, messages, finance, manager and devices. Original 1536×1024 alpha is preserved in lossless desktop WebP. Mobile versions are 900px wide with alpha preserved, roughly 60–130 KB each. Generation prompts and original source paths are recorded in home-lower-art-prompts.json. Existing independently generated role illustrations are reused for the other roles; mobile derivatives live alongside the new assets. Every illustration is lazy loaded.

## Interaction and motion

- Daily process panels open accessible Radix dialogs with existing product-highlight content and links to their respective role experiences.
- Ten roles begin with the manager. The role selector supports arrow keys, Home and End, and exposes the selected tab/panel relationships. Each role uses its complete existing feature catalog, searchable group titles and detail dialogs; compact cards contain no numerical badges.
- Entrance animations run once. Scroll-linked illustration lifts and thin connector paths continue the top scene. Role illustrations crossfade on selection. Reduced-motion preferences disable these movements. No additional WebGL scene, particle loop or continuous decorative animation was introduced.
- Registration, support, platform, role experience and download buttons point to their existing routes. All artwork data is explicitly labeled as representative demo content.

## Preview

Use /#gunluk-akis, /#rol-ozellikleri and /#her-ekranda to review each section directly. Existing role experience pages retain their original full capability layouts.

## Validation completed

- ESLint on modified TSX components; TypeScript checked by production compilation.
- Production static export: `npx next build --webpack`, all 48 pages. Turbopack encountered an environment port-binding restriction; Webpack completed successfully. Global shell surface selectors were moved out of CSS modules into site.css for compatibility with both compilers.
- Seven existing scene, GLB budget, role coverage and transparent-art asset checks passed.
- Browser checks on the static export using the deployed CSP: all ten role selections and their detail dialogs; three daily-flow dialogs; matching and empty search; Escape dismissal and focus restoration; arrow-key role selection; actual modal link navigation to the accounting experience.
- Layout checks at 1440, 768, 390 and 320px: no horizontal document overflow. At 320px manager cards share a 67px minimum height; at 768px they share 86px. Mobile artwork sources and loaded images verified. No captured browser console errors.
- Lower-section assets remained unloaded at the initial hero view, then loaded on approaching their sections. Real-device frame-rate profiling was not performed.
