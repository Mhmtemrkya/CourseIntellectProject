import { api } from './client';
import type { QueryParams } from './client';
import type { LiveRoomOpenRequest } from '../../types/api/generated';

/** LiveRoomSessionsController.MapSession çıktısı. */
export interface LiveRoomSession {
  id: string;
  lessonTitle: string;
  teacherName: string;
  className: string;
  timeLabel: string;
  meetingLink: string;
  micOn: boolean;
  cameraOn: boolean;
  sharingOn: boolean;
  recordingOn: boolean;
  status: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  participants: string[];
  assets: Array<{ id: string; fileName: string; fileUrl: string; createdAtUtc: string }>;
  notes: Array<{ id: string; text: string; createdAtUtc: string }>;
}

// ============ Live Room Sessions ============
// Backend canlı ders modeli. Announcement LIVE_LESSON parse'ı yerine bu
// endpoint'ler kullanılır. Tenant scope backend tarafında uygulanır.
export async function fetchLiveRoomSessions(params: QueryParams = {}): Promise<LiveRoomSession[]> {
  const response = await api.get<LiveRoomSession[]>('/api/liveroomsessions', { params });
  return Array.isArray(response) ? response : [];
}

export async function openLiveRoomSession(payload: LiveRoomOpenRequest): Promise<LiveRoomSession | null> {
  const response = await api.post<LiveRoomSession>('/api/liveroomsessions/open', payload);
  return response;
}

export async function endLiveRoomSession(id: string): Promise<LiveRoomSession | null> {
  const response = await api.post<LiveRoomSession>(`/api/liveroomsessions/${id}/end`);
  return response;
}
