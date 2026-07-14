#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${COURSE_INTELLECT_DB:-}" ]]; then echo "COURSE_INTELLECT_DB is required." >&2; exit 1; fi
if [[ "${COURSE_INTELLECT_BACKUP_CONFIRMED:-}" != "YES" ]]; then echo "Set COURSE_INTELLECT_BACKUP_CONFIRMED=YES after taking a verified production backup." >&2; exit 1; fi
if [[ "${CONFIRM_PRODUCTION_MIGRATION:-}" != "APPLY" ]]; then echo "Set CONFIRM_PRODUCTION_MIGRATION=APPLY to continue." >&2; exit 1; fi

export DOTNET_ROLL_FORWARD="${DOTNET_ROLL_FORWARD:-Major}"
dotnet ef database update \
  --project backend/CourseIntellect.Infrastructure \
  --startup-project backend/CourseIntellect.Infrastructure \
  --context CourseIntellectDbContext \
  --no-build

dotnet ef migrations list \
  --project backend/CourseIntellect.Infrastructure \
  --startup-project backend/CourseIntellect.Infrastructure \
  --context CourseIntellectDbContext \
  --no-build

echo "Production migrations applied and listed successfully."
