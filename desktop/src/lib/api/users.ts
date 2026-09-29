import { api } from './client';
import type {
  AdminUserListItemDto,
  PagedResult,
  PassiveAccountDto,
  RolePolicyUpdateRequest,
  RoleSummaryDto,
} from '../../types/api/generated';

// --- User Directory (Admin) ---

export async function fetchUsers(page = 1, pageSize = 200): Promise<PagedResult<AdminUserListItemDto> | null> {
  const response = await api.get<PagedResult<AdminUserListItemDto>>('/api/users', { params: { page, pageSize } });
  return response;
}

export async function fetchUserRoles(): Promise<RoleSummaryDto[] | null> {
  const response = await api.get<RoleSummaryDto[]>('/api/users/roles');
  return response;
}

export async function updateUserStatus(username: string, status: string): Promise<null> {
  const response = await api.put<null>(`/api/users/${username}/status`, { status });
  return response;
}

// Pasif (deaktive) hesaplar — "Pasif Kayıtlar" ekranı.
export async function fetchPassiveAccounts(): Promise<PassiveAccountDto[]> {
  const response = await api.get<PassiveAccountDto[]>('/api/users/passive');
  return Array.isArray(response) ? response : [];
}

export async function assignPrimaryRole(username: string, primaryRole: string, departmentOrBranch?: string | null): Promise<null> {
  const response = await api.put<null>(`/api/users/${username}/primary-role`, { primaryRole, departmentOrBranch });
  return response;
}

export async function addExtraRole(username: string, roleName: string): Promise<null> {
  const response = await api.post<null>(`/api/users/${username}/extra-roles`, { roleName });
  return response;
}

export async function undoRoleAssignment(username: string): Promise<{ success: boolean } | null> {
  const response = await api.post<{ success: boolean }>(`/api/users/${username}/undo-role-assignment`);
  return response;
}

export async function updateRolePolicy(roleName: string, payload: RolePolicyUpdateRequest): Promise<null> {
  const response = await api.put<null>(`/api/users/roles/${roleName}`, payload);
  return response;
}
