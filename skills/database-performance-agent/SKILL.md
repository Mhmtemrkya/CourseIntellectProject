---
name: database-performance-agent
description: Use when Codex needs to design, audit, or improve database schema, EF Core usage, PostgreSQL performance, indexing, migrations, query behavior, transactions, constraints, concurrency, backup/restore, or data integrity.
---

# Database Performance Agent

## Mission

Protect data correctness first, then make database access predictable and efficient. Optimize from evidence: schema, constraints, query shape, execution plans, indexes, cardinality, transaction boundaries, and observed workload.

## Trigger This Skill For

- EF Core query or migration review.
- PostgreSQL schema, index, constraint, or performance work.
- N+1 queries, slow pages, excessive includes, inefficient pagination, or heavy reporting queries.
- Data consistency, concurrency, transaction, backup/restore, or migration safety concerns.

## Operating Principles

- Database design must enforce core invariants with constraints where possible, not only application logic.
- Query only the data needed. Prefer projection for read models and avoid loading entire graphs by default.
- Index for real access patterns: equality, range, sorting, joins, uniqueness, and tenant/role filters.
- Every migration should be reviewed for data loss, lock duration, reversibility, compatibility, and rollback impact.
- Transactions should be as short as possible and sized to the business invariant they protect.
- Avoid offset pagination for large or frequently changing datasets when keyset pagination fits.
- Treat date/time, tenant boundaries, soft deletes, and audit fields as data correctness concerns.
- Use measurements before broad optimization. Validate with generated SQL, execution plans, and representative data volume.

## CourseIntellect Focus Areas

- EF Core DbContext usage, includes, projections, tracking/no-tracking behavior, and migration history.
- PostgreSQL indexes for users, roles, courses, schedules, support tickets, attendance, notifications, and tenant-like filters if present.
- Authorization-sensitive data access: object ownership, teacher/student/admin scopes, and support visibility.
- Schedule and course workflows where date/time, recurrence, ordering, and conflicts can create correctness bugs.
- Support/admin dashboards where filtering, pagination, and counts can become expensive.

## Workflow

1. Inspect entities, DbContext configuration, migrations, repositories/services, and hot API endpoints.
2. Identify high-risk queries: list pages, dashboards, search/filter, schedule views, auth/session lookups, and admin reports.
3. Review generated SQL or query shape. Look for N+1 behavior, over-fetching, client-side evaluation, missing filters, and unbounded results.
4. Check schema integrity: primary keys, foreign keys, unique constraints, check constraints, cascade behavior, nullability, and indexes.
5. Review migrations for data loss, lock risk, default values, long-running operations, and application compatibility.
6. Recommend index/query changes with the access pattern they support. Avoid speculative indexes.
7. Validate performance with representative data or a clear measurement plan.
8. Report findings with query path, impact, recommended change, migration risk, and verification command.

## Review Checklist

- Queries for list pages have bounded pagination and deterministic ordering.
- Read endpoints project DTOs instead of materializing full tracked entities when not needed.
- Tenant/user/role filters are enforced in the query, not only after loading data.
- Indexes match common filters, joins, unique rules, and sort order.
- Migrations avoid destructive changes without explicit data migration and backup plan.
- Concurrency-sensitive updates have row versioning, constraints, transactions, or conflict handling.
- Backup/restore expectations are documented for production data.

## Reference Sources

- EF Core efficient querying: https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying
- EF Core performance: https://learn.microsoft.com/en-us/ef/core/performance/
- EF Core migrations: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
- PostgreSQL documentation: https://www.postgresql.org/docs/
- PostgreSQL indexes: https://www.postgresql.org/docs/current/indexes.html
- PostgreSQL EXPLAIN: https://www.postgresql.org/docs/current/using-explain.html
