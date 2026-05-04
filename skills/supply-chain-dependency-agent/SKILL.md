---
name: supply-chain-dependency-agent
description: Use when Codex needs to audit or improve dependency hygiene, lockfiles, package updates, known vulnerabilities, SBOMs, licenses, transitive dependencies, build provenance, and software supply-chain risk across .NET, npm, Flutter, and other project ecosystems.
---

# Supply Chain Dependency Agent

## Mission

Reduce third-party and build-chain risk without causing careless upgrades. Track what the software contains, which dependencies are vulnerable or stale, which licenses matter, and whether builds are reproducible enough for release confidence.

## Trigger This Skill For

- Dependency audits, package updates, CVE triage, lockfile review, or license checks.
- SBOM generation, Dependency-Track planning, CycloneDX/SPDX discussion, or release supply-chain evidence.
- Reviewing npm, NuGet, Flutter/Dart, Next.js, Tauri, or toolchain dependency risk.
- Investigating security advisories or deciding whether to upgrade, pin, replace, or remove a package.

## Operating Principles

- Inventory first: identify direct and transitive dependencies, package managers, lockfiles, runtime images, build tools, and generated artifacts.
- Do not blindly update everything. Prioritize reachable vulnerabilities, internet exposure, exploit availability, package criticality, and update blast radius.
- Keep lockfiles consistent and committed for reproducible builds.
- Prefer official package managers and verified sources. Watch for typosquatting, abandoned packages, suspicious maintainership changes, and install scripts.
- Separate dev-only risk from runtime risk, but do not ignore build-time compromise.
- Use SBOMs for visibility and repeatable release evidence.
- Every dependency change needs build/test verification and rollback awareness.

## CourseIntellect Focus Areas

- NuGet packages in backend projects and .NET tooling.
- npm dependencies in desktop React/Tauri, frontend duplicate, and Next marketing/admin app.
- Flutter/Dart packages in `mobile`.
- Tauri/native build dependencies and platform-specific packaging risk.
- AI tooling dependencies if `courseintellect-ai` becomes executable code.

## Workflow

1. Inventory manifests and lockfiles: `.csproj`, `packages.lock.json`, `package.json`, lockfiles, `pubspec.yaml`, tool manifests, Dockerfiles, CI config.
2. Identify dependency role: runtime, dev/test, build, transitive, native, security-sensitive, or abandoned.
3. Check known vulnerabilities with available package-manager tools or configured scanners.
4. Prioritize findings by reachability, exposure, severity, exploit maturity, package role, and remediation effort.
5. Recommend action: upgrade, pin, remove, replace, configure, isolate, accept risk, or monitor.
6. Verify with restore/build/test commands for each affected ecosystem.
7. If release evidence is needed, generate or recommend SBOMs and store them with artifacts.
8. Report changes, risk rationale, verification, and remaining accepted risks.

## Review Checklist

- Each ecosystem has a manifest and lockfile strategy.
- Dependency changes are minimal and justified.
- Vulnerability severity is not accepted without reachability and exposure analysis.
- Build scripts and postinstall hooks are reviewed when risk is elevated.
- Abandoned or low-trust packages are flagged.
- License concerns are surfaced for production dependencies.
- SBOM generation is available for release artifacts when needed.
- Build and test commands pass after updates.

## Reference Sources

- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP Dependency-Track: https://owasp.org/www-project-dependency-track/
- OWASP Dependency Graph and SBOM Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Graph_SBOM_Cheat_Sheet.html
- CycloneDX: https://cyclonedx.org/
- SPDX: https://spdx.dev/
- npm audit documentation: https://docs.npmjs.com/cli/commands/npm-audit
- NuGet audit documentation: https://learn.microsoft.com/en-us/nuget/concepts/auditing-packages
