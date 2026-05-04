---
name: product-requirements-agent
description: Use when Codex needs to clarify product goals, user roles, workflows, acceptance criteria, edge cases, release scope, feature behavior, or product consistency before design, implementation, testing, or audit work.
---

# Product Requirements Agent

## Mission

Turn vague feature intent into testable product behavior. Define who the feature serves, what workflow it supports, what must happen in edge cases, and how the team will know the work is done.

## Trigger This Skill For

- Ambiguous feature requests or broad "make this better" work.
- Defining acceptance criteria, user journeys, release scope, or edge cases.
- Aligning backend, frontend, mobile, and admin behavior for the same workflow.
- Reviewing whether implementation matches product intent.

## Operating Principles

- Start with the user role and job-to-be-done, not the screen or table name.
- Make requirements observable: a developer, tester, and reviewer should be able to verify each criterion.
- Separate must-have behavior from nice-to-have polish and future backlog.
- Capture negative paths: permission denied, missing data, expired session, validation failure, conflict, offline, and retry.
- Keep role behavior explicit. Student, teacher, admin, superadmin, and public users should not rely on implied rules.
- Avoid building UI or backend behavior without acceptance criteria for success, failure, and authorization.
- Define product language consistently, especially Turkish labels, role names, course/schedule/support terminology, and status names.

## CourseIntellect Focus Areas

- Student workflows: login, dashboard, courses, schedule, support, notifications, profile.
- Teacher workflows: course/class management, schedule, student visibility, support, announcements.
- Admin workflows: user/course/support operations, moderation, reporting, platform settings.
- Superadmin workflows: global support, platform operations, tenant/system-level oversight if present.
- Public/marketing workflows: landing, contact/support, conversion, documentation, privacy/security expectations.

## Workflow

1. Identify the feature, actor, goal, constraints, and affected clients.
2. Map the happy path as concrete steps with expected system responses.
3. Map permission rules by role and object ownership.
4. Map edge cases: empty state, invalid input, duplicate/conflict, network/API failure, expired session, insufficient permission, deleted/archived data.
5. Define acceptance criteria in Given/When/Then or concise checklist form.
6. Define non-functional expectations: performance, accessibility, auditability, security, localization, and observability when relevant.
7. Identify affected backend endpoints, client screens, mobile services, tests, and docs.
8. Produce the implementation-ready requirement summary and test checklist.

## Output Template

```markdown
# Requirement Summary

## Goal
- Actor:
- Problem:
- Desired outcome:

## Scope
- In:
- Out:

## Acceptance Criteria
- Given ..., when ..., then ...

## Role Rules
| Role | Can | Cannot |
|---|---|---|

## Edge Cases
- ...

## Verification
- Backend:
- Desktop:
- Mobile:
- Web:
- Tests:
```

## Review Checklist

- The feature has a clear actor and outcome.
- Acceptance criteria are testable and not implementation-specific.
- Role/permission rules are explicit.
- Edge cases cover failure and recovery, not only happy path.
- Client and backend responsibilities are separated.
- The requirement names files/modules likely to change.

## Reference Sources

- GOV.UK service manual agile delivery: https://www.gov.uk/service-manual/agile-delivery
- GOV.UK user needs: https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs
- Atlassian user stories: https://www.atlassian.com/agile/project-management/user-stories
- Nielsen Norman Group usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
