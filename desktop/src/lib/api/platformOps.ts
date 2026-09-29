import { api } from './client';
import type { RoleEntitlement } from '../entitlements';
import type {
  AddRegistrationBlocklistRequest,
  CreateSupportTicketRequest,
  PlatformOverviewDto,
  RegistrationBlocklistEntryDto,
  SupportTicketDto,
  TenantWorkspaceDto,
  UpdateSupportTicketRequest,
  UpsertPlatformPackageRequest,
  UpsertTenantWorkspaceRequest,
} from '../../types/api/generated';

/** TenantFeaturesController.BuildResponse öğesi. */
export interface TenantFeature {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface TenantFeaturesResponse {
  features: TenantFeature[];
}

/** Paket kaydı; `payloadJson` = `{ roles: { rol: { modules: {...} } } }` metni. */
export interface PlatformPackageRow {
  id: string;
  packageId: string;
  name: string;
  payloadJson: string;
  updatedAtUtc: string;
}

/** GET /api/platform-packages/my-entitlements. */
export type MyEntitlementsResponse =
  | { unrestricted: true }
  | { unrestricted: false; roles: Record<string, RoleEntitlement> };

export async function fetchPlatformTenants(): Promise<TenantWorkspaceDto[] | null> {
  const response = await api.get<TenantWorkspaceDto[]>('/api/platformops/tenants');
  return response;
}

export async function fetchTenantFeatures(tenantId: string): Promise<TenantFeaturesResponse | null> {
  const response = await api.get<TenantFeaturesResponse>(`/api/tenant-features/tenants/${tenantId}`);
  return response;
}

export async function saveTenantFeatures(tenantId: string, features: Record<string, boolean>): Promise<TenantFeaturesResponse | null> {
  const response = await api.put<TenantFeaturesResponse>(`/api/tenant-features/tenants/${tenantId}`, { features });
  return response;
}

export async function fetchMyTenantFeatures(): Promise<TenantFeaturesResponse | null> {
  const response = await api.get<TenantFeaturesResponse>('/api/tenant-features/my');
  return response;
}

// ─── Paket yetkileri (paket → rol → sayfa → işlem) ──────────────────────────

export async function fetchPlatformPackages(): Promise<PlatformPackageRow[] | null> {
  const response = await api.get<PlatformPackageRow[]>('/api/platform-packages');
  return response;
}

export async function savePlatformPackage(packageId: string, payload: UpsertPlatformPackageRequest): Promise<PlatformPackageRow | null> {
  const response = await api.put<PlatformPackageRow>(`/api/platform-packages/${encodeURIComponent(packageId)}`, payload);
  return response;
}

export async function deletePlatformPackage(packageId: string): Promise<void> {
  await api.delete(`/api/platform-packages/${encodeURIComponent(packageId)}`);
}

export async function fetchMyEntitlements(): Promise<MyEntitlementsResponse | null> {
  const response = await api.get<MyEntitlementsResponse>('/api/platform-packages/my-entitlements');
  return response;
}

export async function fetchPlatformOverview(): Promise<PlatformOverviewDto | null> {
  const response = await api.get<PlatformOverviewDto>('/api/platformops/overview');
  return response;
}

export async function upsertPlatformTenant(payload: UpsertTenantWorkspaceRequest, id?: string | null): Promise<TenantWorkspaceDto | null> {
  const response = await api.put<TenantWorkspaceDto>('/api/platformops/tenants', payload, {
    params: id ? { id } : undefined,
  });
  return response;
}

export async function approveTenant(id: string): Promise<TenantWorkspaceDto | null> {
  const response = await api.put<TenantWorkspaceDto>(`/api/platformops/tenants/${id}/approve`);
  return response;
}

export async function rejectTenant(id: string, reason?: string | null): Promise<TenantWorkspaceDto | null> {
  const response = await api.put<TenantWorkspaceDto>(`/api/platformops/tenants/${id}/reject`, null, {
    params: reason ? { reason } : undefined,
  });
  return response;
}

// ─── Kurum kaydı kuyruğu: kara liste ve şüpheli işareti ─────────────────────

export async function fetchRegistrationBlocklist(): Promise<RegistrationBlocklistEntryDto[] | null> {
  const response = await api.get<RegistrationBlocklistEntryDto[]>('/api/platformops/registration-blocklist');
  return response;
}

export async function addRegistrationBlocklistEntry(payload: AddRegistrationBlocklistRequest): Promise<RegistrationBlocklistEntryDto | null> {
  const response = await api.post<RegistrationBlocklistEntryDto>('/api/platformops/registration-blocklist', payload);
  return response;
}

export async function removeRegistrationBlocklistEntry(id: string): Promise<void> {
  await api.delete(`/api/platformops/registration-blocklist/${id}`);
}

/** Kurulum belgesini yeniden üretir; kurum parolasını belirlemişse 400 ALREADY_ACTIVATED. */
export async function regenerateSetupDocument(id: string): Promise<TenantWorkspaceDto | null> {
  const response = await api.post<TenantWorkspaceDto>(`/api/platformops/tenants/${id}/setup-document`);
  return response;
}

export async function setApplicationSuspicious(id: string, value: boolean, reason?: string | null): Promise<TenantWorkspaceDto | null> {
  const response = await api.put<TenantWorkspaceDto>(`/api/platformops/tenants/${id}/suspicious`, null, {
    params: { value, ...(reason ? { reason } : {}) },
  });
  return response;
}

export async function fetchSupportTickets(): Promise<SupportTicketDto[] | null> {
  const response = await api.get<SupportTicketDto[]>('/api/platformops/support-tickets');
  return response;
}

export async function createSupportTicket(payload: CreateSupportTicketRequest): Promise<SupportTicketDto | null> {
  const response = await api.post<SupportTicketDto>('/api/platformops/support-tickets', payload);
  return response;
}

export async function updateSupportTicket(id: string, payload: UpdateSupportTicketRequest): Promise<SupportTicketDto | null> {
  const response = await api.put<SupportTicketDto>(`/api/platformops/support-tickets/${id}`, payload);
  return response;
}
