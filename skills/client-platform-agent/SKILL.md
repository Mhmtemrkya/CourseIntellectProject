---
name: client-platform-agent
description: Use when Codex needs to coordinate behavior across React/Tauri desktop, Flutter mobile, Next.js web, API clients, routing, auth/session state, platform configuration, offline/error handling, and cross-client product consistency.
---

# Client Platform Agent

## Mission

Keep every client surface consistent with the backend contract and with each other. Focus on runtime behavior, state management, auth/session correctness, route protection, platform configuration, and cross-client workflow parity.

## Trigger This Skill For

- Changes touching desktop React/Tauri, mobile Flutter, Next.js web, or shared API behavior.
- API client modules, auth state, token refresh, route guards, role redirects, storage, or environment configuration.
- Fixing behavior that works on one client but breaks on another.
- Reviewing loading/error/offline/session-expired states across clients.

## Operating Principles

- Treat backend API behavior as the source contract, then make each client adapter explicit and consistent.
- Auth must be coherent across login, token storage, refresh, logout, expiration, role routing, and permission denial.
- Avoid duplicating business rules differently in each client. Keep client logic to presentation, routing, state, and safe validation where possible.
- Every network call should have loading, success, empty, error, retry, and unauthorized behavior where relevant.
- Platform configuration must be explicit: API base URL, environment, build mode, Tauri runtime assumptions, mobile emulator/device URLs, and static web export limitations.
- Cross-client date/time, localization, pagination, and error handling must match the backend contract.
- Do not hide backend authorization gaps with client-only checks.

## CourseIntellect Focus Areas

- `desktop/src/lib/api/modules.js` and auth/session utilities.
- `desktop/src/App.js` route structure and role-specific page access.
- Flutter services and pages under `mobile/lib`, especially API config, role routing, and support/admin/student/teacher flows.
- Next marketing/admin API client and static export assumptions.
- Shared workflows: login, dashboard routing, course/schedule views, support tickets, admin/superadmin operations.

## Workflow

1. Inventory client surfaces and their API clients, auth stores, route guards, and environment configuration.
2. Map the backend contract for the workflow: endpoints, DTOs, status codes, auth requirements, and errors.
3. Compare client implementations for shape drift, role behavior, token handling, date parsing, pagination, and failure states.
4. Decide where logic belongs: backend, shared API adapter, client page, component, service class, or platform config.
5. Implement or recommend the smallest consistent change across affected clients.
6. Verify at least the changed platform and any other client sharing the same contract.
7. Report platform-specific residual risks.

## Review Checklist

- Login, refresh, logout, and expired-session behavior are consistent.
- Role guards match backend authorization and do not expose restricted workflows.
- API errors are normalized into user-safe client states.
- Clients do not assume a different DTO shape or date/time format.
- Mobile emulator/device API base URL is handled intentionally.
- Tauri desktop build/runtime behavior does not depend on browser-only assumptions.
- Static exported Next pages do not rely on unavailable server runtime behavior.
- Loading, empty, error, retry, and permission states exist for critical workflows.

## Reference Sources

- React documentation: https://react.dev/
- Flutter documentation: https://docs.flutter.dev/
- Tauri documentation: https://tauri.app/
- Next.js documentation: https://nextjs.org/docs
- MDN Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x00-header/
