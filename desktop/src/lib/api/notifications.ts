import { api } from './client';
import type { CreateNotificationRequest, NotificationDto } from '../../types/api/generated';

export async function fetchNotifications(targetRole?: string | null): Promise<NotificationDto[] | null> {
  const response = await api.get<NotificationDto[]>('/api/notifications', {
    params: targetRole ? { targetRole } : undefined,
  });
  return response;
}

export async function createNotification(payload: CreateNotificationRequest): Promise<NotificationDto | null> {
  const response = await api.post<NotificationDto>('/api/notifications', payload);
  return response;
}

// --- Notifications (mark read) ---

export async function markNotificationRead(id: string): Promise<null> {
  const response = await api.put<null>(`/api/notifications/${id}/read`);
  return response;
}
