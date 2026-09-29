export const STAFF_BRANCH_CONFIGURATION_TYPE = 'staff-branches';
export const STAFF_BRANCH_SCOPE_KEY = 'teacher-branches';

export function readSavedStaffBranches(configurations) {
  const item = (Array.isArray(configurations) ? configurations : [])
    .find((entry) => entry.scopeKey === STAFF_BRANCH_SCOPE_KEY);
  if (!item?.payloadJson) return [];
  try {
    const parsed = JSON.parse(item.payloadJson);
    return Array.isArray(parsed.branches)
      ? parsed.branches.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function mergeBranches(defaults, saved) {
  return [...new Set([...(defaults || []), ...(saved || [])])]
    .sort((left, right) => left.localeCompare(right, 'tr'));
}

export function staffBranchConfigurationPayload(branches) {
  return {
    configurationType: STAFF_BRANCH_CONFIGURATION_TYPE,
    scopeKey: STAFF_BRANCH_SCOPE_KEY,
    displayName: 'Öğretmen Branşları',
    payloadJson: JSON.stringify({ branches: mergeBranches([], branches) }),
  };
}
