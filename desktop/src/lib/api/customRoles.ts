import { api } from './client';
import type { CustomRoleDto, UpsertCustomRoleRequest } from '../../types/api/generated';

export interface RoleModuleCatalogItem {
  key: string;
  label: string;
  enforced: boolean;
}

/** GET /api/custom-roles/module-catalog. */
export interface RoleModuleCatalog {
  groups: Array<{ title: string; items: RoleModuleCatalogItem[] }>;
}

/**
 * GET /api/custom-roles/my. Özel rolü olmayan kullanıcıda yalnız `modules: null` gelir;
 * `modules`/`permissions` null → rol kısıtsız.
 */
export interface MyCustomRole {
  name?: string | null;
  modulesRestricted?: boolean;
  modules: string[] | null;
  permissions?: string[] | null;
}

// ── Özel roller (kurum yöneticisi tanımlar; modül erişimi API'de zorlanır) ──
export async function fetchCustomRoles(): Promise<CustomRoleDto[] | null> { return api.get<CustomRoleDto[]>('/api/custom-roles'); }

// Yetki matrisinin kaynağı: role verilebilecek sayfa kataloğu (sunucudan gelir,
// istemcide sabit liste tutulmaz — kaydederken de aynı katalogla doğrulanır).
export async function fetchRoleModuleCatalog(): Promise<RoleModuleCatalog | null> { return api.get<RoleModuleCatalog>('/api/custom-roles/module-catalog'); }

export async function fetchMyCustomRole(): Promise<MyCustomRole | null> { return api.get<MyCustomRole>('/api/custom-roles/my'); }

export async function createCustomRole(payload: UpsertCustomRoleRequest): Promise<CustomRoleDto | null> { return api.post<CustomRoleDto>('/api/custom-roles', payload); }

export async function updateCustomRole(id: string, payload: UpsertCustomRoleRequest): Promise<CustomRoleDto | null> { return api.put<CustomRoleDto>(`/api/custom-roles/${id}`, payload); }

export async function deleteCustomRole(id: string): Promise<null> { return api.delete<null>(`/api/custom-roles/${id}`); }
