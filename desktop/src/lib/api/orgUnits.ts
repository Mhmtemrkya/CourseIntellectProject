import { api } from './client';
import type {
  CreateOrgUnitRequest,
  ManagerCandidateDto,
  MyScopeResponse,
  OrgUnitDto,
  ScopeRollupResponse,
  UpdateOrgUnitRequest,
} from '../../types/api/generated';

export async function fetchOrgUnits(): Promise<OrgUnitDto[]> {
  const response = await api.get<OrgUnitDto[]>('/api/org-units');
  return Array.isArray(response) ? response : [];
}

// Context switcher verisi: kullanıcının erişebildiği kurum/şube ağacı + aktif bağlam.
export async function fetchMyScope(): Promise<MyScopeResponse | null> {
  return api.get<MyScopeResponse>('/api/my-scope');
}

// Konsolide roll-up: erişilebilir tüm kurumların özet metrikleri + genel toplam.
export async function fetchMyScopeRollup(): Promise<ScopeRollupResponse | null> {
  return api.get<ScopeRollupResponse>('/api/my-scope/rollup');
}

// Şube sorumlusu adayları (personel + kurum yöneticileri, yalnız aktifler).
export async function fetchManagerCandidates(): Promise<ManagerCandidateDto[]> {
  const response = await api.get<ManagerCandidateDto[]>('/api/org-units/manager-candidates');
  return Array.isArray(response) ? response : [];
}

// Birimi pasif/aktif yapar (pasif birim seçim listelerinde görünmez, veri silinmez).
export async function setOrgUnitActive(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean } | null> {
  return api.put<{ id: string; isActive: boolean }>(`/api/org-units/${id}/active`, { isActive });
}

export async function createOrgUnit(payload: CreateOrgUnitRequest): Promise<OrgUnitDto | null> {
  const response = await api.post<OrgUnitDto>('/api/org-units', payload);
  return response;
}

export async function updateOrgUnit(id: string, payload: UpdateOrgUnitRequest): Promise<OrgUnitDto | null> {
  const response = await api.put<OrgUnitDto>(`/api/org-units/${id}`, payload);
  return response;
}

export async function backfillBranch(branchId: string): Promise<{ updated: number; message: string } | null> {
  const response = await api.post<{ updated: number; message: string }>('/api/org-units/backfill-branch', null, { params: { branchId } });
  return response;
}

export interface RepairSingleBranchResult {
  updated: number;
  repaired: boolean;
  /** Yalnız onarım uygulandığında gelir. */
  branchId?: string;
  /** Yalnız onarım uygulanamadığında gelir. */
  reason?: string;
}

export async function repairSingleBranchRecords(): Promise<RepairSingleBranchResult | null> {
  return api.post<RepairSingleBranchResult>('/api/org-units/repair-single-branch', {});
}

export async function deleteOrgUnit(id: string): Promise<void> {
  await api.delete(`/api/org-units/${id}`);
}
