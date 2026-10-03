# Role illustration replacement — 2026-10-02

The generic blank screen and three task rows in the cinematic hero are replaced
by nine individually generated role illustrations. The existing teacher book is
retained. All ten current roles use the same responsive illustration component,
with role-specific imagery, a native title and a crossfade/rise on role changes.
The homepage scroll story and individual role pages share this component.

Built-in imagegen generated every new asset separately. No source screenshot is
cut or reused. Each final asset is a transparent 1536×1024 lossless WebP under
`public/images/brain-role-art/`; the visible RGB pixels and alpha were verified
against the generated PNG. Each asset is below 2 MB. Only the active illustration
(and briefly the outgoing illustration during transition) is mounted.

- Yönetici: attendance ring, team connections, weekly heatmap and performance bars.
- Veli: student diary, growth ring and communication tiles.
- Öğrenci: personal learning path, timetable, planner and progress.
- Muhasebe: financial ribbons, bars, invoices and receipts.
- İdari Personel: daily planner, task tiles and clock.
- Rehberlik: development dossier, relationship map and appointments.
- Şube Müdürü: branch hub, local team network and academic overview.
- Yemekhane: meal tray, weekly menu and nutrition/allergen symbols.
- Servis Şoförü: route map, bus, stops and arrival symbols.

Exact prompts, generated source locations and runtime filenames are recorded in
`role-art-prompts.json`. Values in illustrations are decorative demo content;
actual role feature catalogs and their accessible dialogs remain in HTML.

Validation: production build and 12 Node tests passed; ESLint reported no errors
and an existing unused `ShieldCheck` warning in the inactive 3D scene file.
All ten role pages loaded their own image at desktop 1440×900 and mobile 390×844,
with no horizontal overflow or old task-row panel in the DOM. Screenshots and
browser results are in the task visualization directory under
`schoolasist-brain-experience/role-illustrations/`.

The cinematic role tab bar is removed from both the homepage and role detail
heroes. The scroll sequence begins with Yönetici, followed by Öğretmen and the
remaining roles. Homepage feature and device previews also default to Yönetici.
