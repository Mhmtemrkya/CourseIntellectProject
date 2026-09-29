import { api } from './client';
import type { PlatformConfigurationDto } from '../../types/api/generated';

/** Kurum özelleştirme kaydının payloadJson içeriği (alanlar kurumdan kuruma değişebilir). */
export interface TenantBranding {
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  appName?: string | null;
  tenantName?: string | null;
}

export interface UploadedLogo {
  logoUrl: string;
  width: number;
  height: number;
  size: number;
}

// --- Tenant Branding ---

/**
 * Kurumun marka ayarları. Sunucu yapılandırma kaydını döner; içindeki
 * payloadJson çözülür. Çözülemezse null.
 */
export async function fetchTenantBranding(tenantId?: string | null): Promise<TenantBranding | null> {
  const response = await api.get<PlatformConfigurationDto>('/api/platformconfigurations/branding', {
    params: tenantId ? { tenantId } : undefined,
  });
  if (!response) return null;
  if (response.payloadJson) {
    try {
      return JSON.parse(response.payloadJson) as TenantBranding;
    } catch {
      return null;
    }
  }
  // payloadJson boşsa kaydın kendisi döner (eski davranış); marka alanı taşımaz.
  return response as unknown as TenantBranding;
}

export async function saveTenantBranding(
  tenantId: string | null | undefined,
  brandingPayload: { logoUrl?: string | null } | null | undefined,
): Promise<PlatformConfigurationDto | null> {
  if (!tenantId) {
    throw new Error('Tenant branding kaydi icin tenantId zorunludur.');
  }

  return api.put<PlatformConfigurationDto>('/api/platformconfigurations/branding', {
    logoUrl: brandingPayload?.logoUrl || '',
  });
}

export async function uploadTenantLogo(file: Blob): Promise<UploadedLogo | null> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<UploadedLogo>('/api/platformconfigurations/branding/logo', formData);
}

export async function removeTenantLogo(): Promise<null> {
  return api.delete<null>('/api/platformconfigurations/branding/logo');
}
