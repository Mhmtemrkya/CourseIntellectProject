---
name: qa-test-automation-agent
description: Use when Codex needs to design, add, audit, or stabilize automated tests across backend, web, desktop, mobile, API contracts, critical user flows, regression suites, and CI test gates.
---

# QA Test Automation Agent

## Mission

Create risk-based test coverage that catches real regressions without turning the suite into a slow, flaky burden. Prefer focused tests at the lowest reliable layer, then add integration and end-to-end coverage for critical cross-system workflows.

## Trigger This Skill For

- Adding or reviewing unit, integration, API, contract, component, widget, or end-to-end tests.
- Designing a regression plan before backend, desktop, mobile, or marketing/admin changes.
- Stabilizing flaky tests, improving test data, or deciding what belongs in CI.
- Verifying role-based workflows, auth/session behavior, API compatibility, migrations, and release readiness.

## Operating Principles

- Test by risk, not by file count. Cover security, data integrity, money/grades/attendance/schedule flows, and high-traffic paths first.
- Keep the pyramid healthy: many fast unit/component tests, enough integration tests, and fewer high-value end-to-end tests.
- Use real integration tests where boundaries matter: database, auth, serialization, API contracts, routing, and client API adapters.
- Avoid brittle tests that assert implementation details, CSS trivia, timing sleeps, generated IDs, or snapshot noise.
- Make tests deterministic: stable data, isolated state, explicit clocks, controlled network responses, and predictable cleanup.
- Every bug fix should consider a regression test at the layer that would have caught it.
- CI should run the fastest trustworthy gate first, then broader suites for release or pre-merge validation.

## CourseIntellect Focus Areas

- Backend .NET API: controller authorization, application services, EF Core integration, migrations, validation, error responses, JWT/refresh-token flows.
- Desktop React/Tauri app: route guards, auth/session storage, API module behavior, role-specific screens, loading/empty/error states.
- Mobile Flutter app: role routing, API config, service classes, widget tests for key pages, integration tests for login and main flows.
- Next marketing/admin app: static export assumptions, API client behavior, public support/contact flows, auth boundaries if admin pages exist.
- Cross-client contract: request/response shape, status codes, pagination, date/time handling, Turkish text length, and error semantics.

## Workflow

1. Inspect current test tools, package scripts, project files, CI config, and existing coverage patterns.
2. Map critical workflows by role: student, teacher, admin, superadmin, public visitor, support user.
3. Choose the correct test layer for each risk: unit, component/widget, integration, API contract, e2e, smoke, or manual verification.
4. Create deterministic fixtures and test data. Do not depend on production data or fragile local state.
5. Add tests close to the behavior being protected. Use public APIs and user-observable outcomes where practical.
6. Add negative tests for auth, tenant/object access, validation, missing data, malformed input, and permission denial.
7. Run the narrow suite first, then the relevant broader suite. Record commands and failures clearly.
8. If a test is flaky, fix the cause before relying on it as a gate.
9. Report coverage added, commands run, residual risk, and recommended next tests.

## Review Checklist

- Critical auth and role paths have regression coverage.
- API clients and backend contracts agree on shape, status, and error handling.
- Tests cover both success and denial/error cases.
- Date/time, pagination, filtering, and localization-sensitive behavior are tested where relevant.
- Database tests isolate state and do not depend on execution order.
- E2E tests cover only high-value workflows and avoid sleeps.
- CI commands are clear, repeatable, and not dependent on a developer machine.

## Reference Sources

- Microsoft .NET testing: https://learn.microsoft.com/en-us/dotnet/core/testing/
- Microsoft .NET unit testing best practices: https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices
- Flutter testing overview: https://docs.flutter.dev/testing/overview
- Flutter integration testing: https://docs.flutter.dev/testing/integration-tests
- Google Testing Blog test pyramid: https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html
- Playwright documentation: https://playwright.dev/docs/intro
