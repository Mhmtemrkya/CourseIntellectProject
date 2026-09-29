import { api } from './client';
import type { AuditBranchSummaryDto, AuditLogDto, AuditLogPageDto } from '../../types/api/generated';

export interface AuditLogListQuery {
  category?: string | null;
  take?: number;
}

/** GET /api/audit-logs/paged sorgusu. `source`: All | Action | Login. */
export interface AuditLogPagedQuery {
  category?: string | null;
  branchId?: string | null;
  search?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
  skip?: number;
  take?: number;
  source?: string;
  onlyFailedLogins?: boolean;
  actor?: string | null;
}

export interface PlatformAuditTenantRow {
  tenantId: string | null;
  tenantName: string;
  totalCount: number;
  last7DaysCount: number;
  lastActivityUtc: string | null;
}

export interface PlatformAuditBranchRow {
  branchId: string | null;
  branchName: string;
  totalCount: number;
  last7DaysCount: number;
  lastActivityUtc: string | null;
}

export interface PlatformAuditLogRow {
  id: string;
  tenantId: string | null;
  tenantName: string;
  branchId: string | null;
  branchName: string;
  actorName: string;
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAtUtc: string;
}

export interface PlatformAuditLogQuery {
  tenantId?: string | null;
  branchId?: string | null;
  category?: string | null;
  search?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
  skip?: number;
  take?: number;
}

export interface Paged<T> {
  items: T[];
  totalCount: number;
  skip: number;
  take: number;
}

export async function fetchAuditLogs(params?: AuditLogListQuery): Promise<AuditLogDto[]> {
  const response = await api.get<AuditLogDto[]>('/api/audit-logs', { params });
  return Array.isArray(response) ? response : [];
}

// Kayıt geçmişi: kategori/şube/tarih/arama/kaynak (All|Action|Login) + sayfalama.
// Giriş denemeleri ile idari işlemler tek zaman çizelgesinde birleştirilir.
export async function fetchAuditLogsPaged(params?: AuditLogPagedQuery): Promise<AuditLogPageDto> {
  const response = await api.get<AuditLogPageDto>('/api/audit-logs/paged', { params });
  return response && Array.isArray(response.items)
    ? response
    : { items: [], totalCount: 0, skip: 0, take: 0 };
}

// Kurum yöneticisi için şube bazında log özeti.
export async function fetchAuditBranchSummary(): Promise<AuditBranchSummaryDto[]> {
  const response = await api.get<AuditBranchSummaryDto[]>('/api/audit-logs/branch-summary');
  return Array.isArray(response) ? response : [];
}

// Platform (geliştirici) denetim merkezi.
export async function fetchPlatformAuditOverview(): Promise<PlatformAuditTenantRow[]> {
  const response = await api.get<PlatformAuditTenantRow[]>('/api/platformops/audit/overview');
  return Array.isArray(response) ? response : [];
}

export async function fetchPlatformAuditTenantBranches(tenantId: string): Promise<PlatformAuditBranchRow[]> {
  const response = await api.get<PlatformAuditBranchRow[]>(`/api/platformops/audit/tenants/${tenantId}/branches`);
  return Array.isArray(response) ? response : [];
}

export async function fetchPlatformAuditLogs(params?: PlatformAuditLogQuery): Promise<Paged<PlatformAuditLogRow>> {
  const response = await api.get<Paged<PlatformAuditLogRow>>('/api/platformops/audit/logs', { params });
  return response && Array.isArray(response.items)
    ? response
    : { items: [], totalCount: 0, skip: 0, take: 0 };
}
