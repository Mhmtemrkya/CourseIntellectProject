import { isRecord } from './errors';
export const STAFF_BRANCH_CONFIGURATION_TYPE = 'staff-branches';
export const STAFF_BRANCH_SCOPE_KEY = 'teacher-branches';

export interface ScopedConfiguration {
  scopeKey?: string | null;
  payloadJson?: string | null;
}

export interface StaffBranchConfigurationPayload {
  configurationType: string;
  scopeKey: string;
  displayName: string;
  payloadJson: string;
}

export function readSavedStaffBranches(configurations: unknown): string[] {
  const list: unknown[] = Array.isArray(configurations) ? configurations : [];
  const item = list.find((entry): entry is ScopedConfiguration => isRecord(entry) && entry.scopeKey === STAFF_BRANCH_SCOPE_KEY);
  if (!item?.payloadJson) return [];
  try {
    const parsed: unknown = JSON.parse(item.payloadJson);
    const branches: unknown = isRecord(parsed) ? parsed.branches : undefined;
    return Array.isArray(branches)
      ? branches.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function mergeBranches(
  defaults: readonly string[] | null | undefined,
  saved: readonly string[] | null | undefined,
): string[] {
  return [...new Set([...(defaults || []), ...(saved || [])])]
    .sort((left, right) => left.localeCompare(right, 'tr'));
}

export function staffBranchConfigurationPayload(branches: readonly string[]): StaffBranchConfigurationPayload {
  return {
    configurationType: STAFF_BRANCH_CONFIGURATION_TYPE,
    scopeKey: STAFF_BRANCH_SCOPE_KEY,
    displayName: 'Öğretmen Branşları',
    payloadJson: JSON.stringify({ branches: mergeBranches([], branches) }),
  };
}
