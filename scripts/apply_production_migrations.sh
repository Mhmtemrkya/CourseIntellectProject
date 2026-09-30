#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${COURSE_INTELLECT_DB:-}" ]]; then echo "COURSE_INTELLECT_DB is required." >&2; exit 1; fi
if [[ "${COURSE_INTELLECT_BACKUP_CONFIRMED:-}" != "YES" ]]; then echo "Set COURSE_INTELLECT_BACKUP_CONFIRMED=YES after taking a verified production backup." >&2; exit 1; fi
if [[ "${CONFIRM_PRODUCTION_MIGRATION:-}" != "APPLY" ]]; then echo "Set CONFIRM_PRODUCTION_MIGRATION=APPLY to continue." >&2; exit 1; fi

export DOTNET_ROLL_FORWARD="${DOTNET_ROLL_FORWARD:-Major}"
if [[ -n "${COURSE_INTELLECT_EF_TOOL:-}" ]]; then
  [[ "$COURSE_INTELLECT_EF_TOOL" == /* && -f "$COURSE_INTELLECT_EF_TOOL" \
     && -x "$COURSE_INTELLECT_EF_TOOL" && ! -L "$COURSE_INTELLECT_EF_TOOL" ]] \
    || { echo "COURSE_INTELLECT_EF_TOOL must be an absolute executable regular file." >&2; exit 1; }
  ef=("$COURSE_INTELLECT_EF_TOOL")
else
  ef=(dotnet ef)
fi

"${ef[@]}" database update \
  --project backend/CourseIntellect.Infrastructure \
  --startup-project backend/CourseIntellect.Infrastructure \
  --context CourseIntellectDbContext \
  --configuration Release \
  --no-build

"${ef[@]}" migrations list \
  --project backend/CourseIntellect.Infrastructure \
  --startup-project backend/CourseIntellect.Infrastructure \
  --context CourseIntellectDbContext \
  --configuration Release \
  --no-build

echo "Production migrations applied and listed successfully."
