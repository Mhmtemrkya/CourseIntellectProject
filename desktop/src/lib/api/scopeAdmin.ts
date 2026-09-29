import { api } from './client';
import type {
  AddGrantRequest,
  CreateScopeGroupRequest,
  ScopeGroupDto,
  ScopeTenantLiteDto,
  ScopeUserDto,
  UserGrantDto,
} from '../../types/api/generated';

// ── Kapsam yönetimi (platform admin): grup ağacı + kurum→grup + kullanıcı grant'ları ──
export async function fetchScopeGroups(): Promise<ScopeGroupDto[] | null> { return api.get<ScopeGroupDto[]>('/api/scope-admin/groups'); }

export async function createScopeGroup(payload: CreateScopeGroupRequest): Promise<ScopeGroupDto | null> { return api.post<ScopeGroupDto>('/api/scope-admin/groups', payload); }

export async function deleteScopeGroup(id: string): Promise<null> { return api.delete<null>(`/api/scope-admin/groups/${id}`); }

export async function fetchScopeTenants(): Promise<ScopeTenantLiteDto[] | null> { return api.get<ScopeTenantLiteDto[]>('/api/scope-admin/tenants'); }

export async function assignTenantGroup(tenantId: string, groupId: string | null | undefined): Promise<null> {
  return api.put<null>(`/api/scope-admin/tenants/${tenantId}/group`, { groupId: groupId || null });
}

export async function searchScopeUsers(search?: string | null): Promise<ScopeUserDto[] | null> {
  return api.get<ScopeUserDto[]>('/api/scope-admin/users', { params: search ? { search } : undefined });
}

export async function fetchUserGrants(userId: string): Promise<UserGrantDto[] | null> { return api.get<UserGrantDto[]>(`/api/scope-admin/users/${userId}/grants`); }

export async function addUserGrant(userId: string, payload: AddGrantRequest): Promise<UserGrantDto | null> { return api.post<UserGrantDto>(`/api/scope-admin/users/${userId}/grants`, payload); }

export async function removeUserGrant(grantId: string): Promise<null> { return api.delete<null>(`/api/scope-admin/grants/${grantId}`); }
