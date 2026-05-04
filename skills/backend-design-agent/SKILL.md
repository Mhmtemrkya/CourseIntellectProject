---
name: backend-design-agent
description: Use when Codex needs to design, audit, or improve backend architecture, API contracts, data models, service boundaries, authorization, reliability, observability, migrations, or backend test strategy.
---

# Backend Design Agent

## Mission

Design backend changes as stable product contracts, not as accidental database CRUD. Balance domain correctness, security, reliability, operability, and maintainability before choosing implementation details.

## Trigger This Skill For

- API design, endpoint review, OpenAPI/schema work, DTO design, or error model changes.
- Domain modeling, service boundaries, data consistency, migrations, background jobs, queues, or caching decisions.
- Backend security review around authentication, authorization, validation, secrets, rate limiting, or audit trails.
- Reliability and operational design: timeouts, retries, health checks, logs, metrics, tracing, backup/restore, deployment rollback.

## Operating Principles

- Start with domain workflows, roles, sensitive data, invariants, and failure modes.
- Treat the API as a durable contract between clients and the system. Do not expose internal database shape by default.
- Preserve HTTP semantics: method choice, status codes, idempotency, caching, pagination, filtering, versioning, and content negotiation should be deliberate.
- Check authorization at function, object, and property levels. Route-level checks alone are not enough.
- Validate all input at the boundary, including body shape, content type, file size/type, identifiers, state transitions, and business rules.
- Keep secrets out of code, logs, URLs, client bundles, and screenshots. Use environment-based configuration.
- Design for retries and partial failure with idempotency keys, transaction boundaries, outbox/event patterns, timeouts, circuit breakers, and graceful degradation when appropriate.
- Make behavior observable: correlation IDs, structured logs, metrics, traces, audit events, and actionable health checks.
- Keep migrations backward compatible unless a coordinated downtime/release plan exists.
- Add tests at the boundary where risk lives: authorization matrix, validation, data consistency, concurrency, API contract, and regression paths.

## Workflow

1. Build context: product workflow, user roles, tenant boundaries, data classification, integrations, traffic shape, SLO/SLA expectations, and deployment environment.
2. Define the contract: resources, commands, request/response schemas, status codes, pagination/filtering/sorting, error format, versioning, and idempotency behavior.
3. Define the security model: authentication, authorization matrix, object/property-level access, rate limits, request size limits, SSRF and file handling defenses, and secret handling.
4. Define data and transaction boundaries: aggregate ownership, consistency model, concurrency strategy, locking, cache invalidation, migrations, and backward compatibility.
5. Define reliability behavior: timeouts, retries, circuit breakers, queue/background processing, dead-letter handling, health checks, backup/restore, and rollback.
6. Define observability: logs, audit records, metrics, traces, alert signals, and operational dashboards/runbooks.
7. Plan tests: unit for domain invariants, integration for data/API/security boundaries, contract tests for clients, and regression tests for critical workflows.
8. Produce a risk review: highest backend risks, required decisions, migration impact, and verification plan.

## Review Checklist

- Endpoints map to product workflows and domain concepts, not table names alone.
- Every protected endpoint has role, tenant, object, and property authorization where relevant.
- The backend enforces state transitions instead of trusting frontend workflow order.
- Sensitive data is excluded from URLs, logs, error details, and telemetry payloads.
- Error responses are consistent and do not leak internals.
- Retried operations are safe or explicitly non-idempotent.
- Long-running work has cancellation, timeout, progress, and failure handling.
- Migrations are reversible or have a clear fallback plan.
- Logs can answer who did what, to which resource, from where, and with what outcome.
- Tests cover the highest-risk auth, validation, and data consistency paths.

## Output Format

For design work, output: context assumptions, proposed API/data/service design, security controls, failure modes, tests, migration/deployment notes, and open decisions. For review work, lead with concrete findings ordered by severity.

## Reference Sources

- Microsoft REST API Guidelines: https://github.com/microsoft/api-guidelines
- Azure API design guidance: https://learn.microsoft.com/en-us/azure/architecture/microservices/design/api-design
- OpenAPI Specification: https://spec.openapis.org/oas/latest.html
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x00-header/
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- The Twelve-Factor App: https://12factor.net/
- Azure Cloud Design Patterns: https://learn.microsoft.com/en-us/azure/architecture/patterns/
