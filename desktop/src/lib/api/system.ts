import { api } from './client';
import { isNotFoundError } from './shared';
import type {
  CreateSupportTicketBody,
  SiteContentDto,
  SupportTicketDto,
  SystemStatusDto,
  UpdateSiteContentRequest,
} from '../../types/api/generated';

export async function fetchMySupportTickets(): Promise<SupportTicketDto[] | null> {
  const response = await api.get<SupportTicketDto[]>('/api/support-tickets/mine');
  return response;
}

// Kurum sahibi tarafı (tenant-side) — admin tarafı için createSupportTicket var
export async function createMySupportTicket(payload: CreateSupportTicketBody): Promise<SupportTicketDto | null> {
  const response = await api.post<SupportTicketDto>('/api/support-tickets', payload);
  return response;
}

export async function fetchSystemStatus(): Promise<SystemStatusDto | null> {
  // Public endpoint — token gönderme zorunlu değil
  const response = await api.get<SystemStatusDto>('/api/system/status');
  return response;
}

export async function setSystemMaintenance({ enabled, message }: { enabled?: boolean; message?: string | null }): Promise<SystemStatusDto | null> {
  const response = await api.put<SystemStatusDto>('/api/system/maintenance', {
    enabled: Boolean(enabled),
    message: message || null,
  });
  return response;
}

export async function fetchSiteContentSection(sectionKey: string, language = 'tr'): Promise<SiteContentDto | null> {
  try {
    const response = await api.get<SiteContentDto>(`/api/sitecontents/${sectionKey}`, {
      params: { language },
    });
    return response;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function updateSiteContentSection(
  sectionKey: string,
  { language = 'tr', content, publish = true }: Partial<Pick<UpdateSiteContentRequest, 'language' | 'publish'>> & { content: unknown },
): Promise<SiteContentDto | null> {
  const response = await api.put<SiteContentDto>(`/api/sitecontents/${sectionKey}`, {
    language,
    content,
    publish,
  });
  return response;
}
