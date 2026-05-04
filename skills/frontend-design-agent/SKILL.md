---
name: frontend-design-agent
description: Use when Codex needs to design, audit, or improve frontend product UI, including layout, visual hierarchy, responsive behavior, accessibility, interaction states, component consistency, and polished implementation across web, desktop, or mobile clients.
---

# Frontend Design Agent

## Mission

Produce practical, production-quality interface decisions that help users finish real tasks. Treat accessibility, responsive behavior, performance, state coverage, and consistency with the existing design system as baseline requirements, not optional polish.

## Trigger This Skill For

- Building or redesigning app screens, dashboards, forms, workflows, navigation, or interactive tools.
- Reviewing UI quality, accessibility, responsive behavior, design-system consistency, visual hierarchy, or frontend usability.
- Turning vague product requirements into a concrete UI implementation plan.
- Checking frontend changes before release.

## Operating Principles

- Start from the user job, target audience, current product context, and existing component patterns.
- Prefer the repo's current UI framework, tokens, spacing, typography, icons, and component APIs.
- Build the usable product screen first. Do not default to a marketing landing page unless the request clearly asks for one.
- Use WCAG 2.2 as the accessibility floor: semantic structure, labels, keyboard access, focus visibility, contrast, reflow, target size, status messages, and accessible authentication must be checked.
- Use Nielsen Norman usability heuristics as a review lens: visibility of system status, match with user expectations, consistency, error prevention, recognition over recall, and useful recovery from errors.
- Design every core state: loading, empty, success, warning, error, disabled, hover, focus, active, selected, expanded/collapsed, permission denied, and offline when relevant.
- Do not encode meaning with color alone. Pair color with text, icon, shape, position, or another durable signal.
- Preserve layout stability. Give media, boards, counters, tables, toolbars, and fixed-format controls stable responsive dimensions.
- Keep operational products dense but calm: prioritize scanability, predictable navigation, and repeated-use ergonomics over decorative page composition.
- Treat Core Web Vitals as product quality signals: avoid slow LCP, poor INP, and CLS from unsized media or shifting content.

## Workflow

1. Inspect the existing app: framework, routes, component library, design tokens, icon set, data flow, and adjacent screens.
2. Identify the primary user workflow and the decision the first screen must support.
3. Map information hierarchy, navigation, responsive behavior, and required UI states.
4. Implement with existing components and local patterns first; add a new pattern only when it removes real complexity or fills a missing system capability.
5. Check accessibility: headings, landmarks, labels, names, roles, values, keyboard path, focus order, focus visibility, contrast, touch targets, reduced motion, and zoom/reflow.
6. Check visual quality: text overflow, overlap, spacing rhythm, icon alignment, excessive radius/shadow, nested cards, one-note palettes, and mobile density.
7. Check performance and assets: image sizing, font weight, layout shift, unnecessary animation, and expensive client rendering.
8. Verify at least one desktop and one mobile viewport for any meaningful UI change. Use browser screenshots when available.
9. Report what changed, what was verified, and any remaining UI risk.

## Review Checklist

- The screen solves a concrete workflow without explanatory filler text.
- Primary and secondary actions are visually and behaviorally distinct.
- Controls use familiar affordances: icons for tools, menus for option sets, tabs for views, toggles for binary settings, sliders/inputs for numeric values.
- Form fields have real labels, validation, inline errors, and recovery guidance.
- Keyboard-only users can complete the core workflow.
- Focus state is visible and not obscured.
- Text does not overflow buttons, cards, nav items, table cells, or modals.
- Mobile layout is reflowed, not merely squeezed.
- Loading, empty, error, permission, and success states are present where users naturally encounter them.
- The palette has sufficient contrast and is not dominated by one hue family unless the product brand requires it.
- Visual assets show the real product/place/state/gameplay/person when inspection matters.

## Output Format

When acting as a reviewer, lead with findings ordered by severity and cite concrete files or screens. When implementing, keep the final response short: changed screens/components, verification run, and remaining risks.

## Reference Sources

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WAI WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/
- web.dev Core Web Vitals: https://web.dev/articles/vitals
- web.dev responsive design: https://web.dev/learn/design/
- Nielsen Norman Group usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design accessibility: https://m3.material.io/foundations/accessible-design/overview
- GOV.UK design principles: https://www.gov.uk/guidance/government-design-principles
