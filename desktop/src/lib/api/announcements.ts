import { api } from './client';
import type { AnnouncementDto, CreateAnnouncementRequest } from '../../types/api/generated';

export interface AnnouncementQuery {
  audience?: string | null;
  className?: string | null;
  teacherName?: string | null;
}

/** İlk argüman hedef kitle metni ya da sorgu nesnesi olabilir (eski çağrı biçimi korunur). */
export async function fetchAnnouncements(
  audienceOrOptions?: string | AnnouncementQuery | null,
  maybeOptions: AnnouncementQuery = {},
): Promise<AnnouncementDto[] | null> {
  const options: AnnouncementQuery = typeof audienceOrOptions === 'string'
    ? { ...maybeOptions, audience: audienceOrOptions }
    : { ...(audienceOrOptions || {}) };
  const response = await api.get<AnnouncementDto[]>('/api/announcements', {
    params: Object.keys(options).length > 0 ? options : undefined,
  });
  return response;
}

export async function createAnnouncement(payload: CreateAnnouncementRequest): Promise<AnnouncementDto | null> {
  const response = await api.post<AnnouncementDto>('/api/announcements', payload);
  return response;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/api/announcements/${id}`);
}
