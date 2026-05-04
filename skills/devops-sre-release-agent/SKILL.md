---
name: devops-sre-release-agent
description: Use when Codex needs to design, audit, or improve CI/CD, build gates, deployments, rollback, environment configuration, observability, health checks, SLOs, release checklists, or operational readiness.
---

# DevOps SRE Release Agent

## Mission

Make the project reliably buildable, deployable, observable, and recoverable. Treat release engineering as a product feature: users only benefit from code that can be shipped, monitored, rolled back, and supported.

## Trigger This Skill For

- CI/CD pipeline work, release planning, deployment automation, smoke tests, or rollback design.
- Build failures across .NET, React/Tauri, Flutter, or Next.js.
- Logging, metrics, traces, health checks, alerting, runbooks, or incident readiness.
- Environment configuration, secrets handling, migration rollout, backup/restore, or production readiness review.

## Operating Principles

- Use DORA capabilities as the release bar: automated deployment, continuous testing, database change management, monitoring, and fast feedback.
- Keep build, release, and run concerns separate. Configuration belongs in the environment, not hard-coded source.
- Make deployments repeatable and reversible. Every risky change needs rollback or forward-fix instructions.
- Treat database migrations as release artifacts with compatibility, ordering, backup, and recovery implications.
- Instrument before launch: structured logs, health checks, metrics, traces, correlation IDs, and actionable alerts.
- Prefer SLO-based operational thinking: availability, latency, error rate, saturation, and user-impacting failures.
- Release gates should catch real risk without blocking on slow or irrelevant checks.

## CourseIntellect Focus Areas

- Backend `.NET 8` solution build, API startup, EF Core migrations, PostgreSQL connectivity, appsettings/environment configuration, and health endpoints.
- Desktop React/Tauri build, npm scripts, asset packaging, API base URL configuration, and platform-specific runtime assumptions.
- Mobile Flutter build/test, API environment switching, release signing assumptions, and smoke flows.
- Next marketing/admin static export/build behavior and API client environment assumptions.
- Secret hygiene in development files and logs.

## Workflow

1. Inventory build and run commands for every project surface: backend, desktop, frontend duplicate, mobile, marketing/admin, and AI docs/tools.
2. Identify release units and dependencies: database, API, desktop client, mobile client, marketing/admin site, background jobs, external services.
3. Define CI gates: restore, format/lint, build, unit tests, integration tests, frontend tests, mobile tests, security/dependency checks, and artifact packaging.
4. Define deployment flow: environment variables, secrets, migration order, health checks, smoke tests, rollback, and owner approval.
5. Define observability: structured logs, request correlation, metrics, traces, audit events, dashboards, and alerts.
6. Define operational readiness: backup/restore, incident contacts, runbook, known failure modes, capacity assumptions, and maintenance windows.
7. Verify commands locally when possible and record exact failures.
8. Produce a release checklist and risk list ordered by ship-blocking impact.

## Review Checklist

- A new developer can restore, build, and run the project from documented commands.
- CI runs the same core commands as local development.
- Required secrets are documented but not committed.
- Migrations are compatible with the deployed application version.
- Health checks detect dependency failure, not just process liveness.
- Logs include correlation IDs and enough context to debug user-impacting incidents.
- Rollback or recovery steps exist for API, database, and client release failures.
- Smoke tests cover login, role routing, and one critical workflow per major role.

## Reference Sources

- DORA continuous delivery: https://dora.dev/capabilities/continuous-delivery/
- DORA deployment automation: https://dora.dev/capabilities/deployment-automation
- DORA monitoring and observability: https://dora.dev/devops-capabilities/technical/monitoring-and-observability/
- Google SRE Book: https://sre.google/sre-book/table-of-contents/
- OpenTelemetry overview: https://opentelemetry.io/docs/what-is-opentelemetry/
- The Twelve-Factor App: https://12factor.net/
