import { api } from './client';
import type { QueryParams } from './client';
import type {
  AttendanceQrCheckInRequest,
  AttendanceQrOpenRequest,
  AttendanceQrSessionSnapshot,
} from '../../types/api/generated';

// ============ Attendance QR Sessions ============
// Öğretmen QR yoklama oturumları. LIVE_LESSON announcement parse'ı yerine kullanılır.
export async function fetchAttendanceQrSessions(params: QueryParams = {}): Promise<AttendanceQrSessionSnapshot[]> {
  const response = await api.get<AttendanceQrSessionSnapshot[]>('/api/attendance-qr-sessions', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchActiveAttendanceQrSessions(params: QueryParams = {}): Promise<AttendanceQrSessionSnapshot[]> {
  const response = await api.get<AttendanceQrSessionSnapshot[]>('/api/attendance-qr-sessions/active', { params });
  return Array.isArray(response) ? response : [];
}

export async function openAttendanceQrSession(payload: AttendanceQrOpenRequest): Promise<AttendanceQrSessionSnapshot | null> {
  const response = await api.post<AttendanceQrSessionSnapshot>('/api/attendance-qr-sessions/open', payload);
  return response;
}

export async function checkInAttendanceQrSession(payload: AttendanceQrCheckInRequest): Promise<AttendanceQrSessionSnapshot | null> {
  const response = await api.post<AttendanceQrSessionSnapshot>('/api/attendance-qr-sessions/check-in', payload);
  return response;
}

export async function closeAttendanceQrSession(id: string): Promise<AttendanceQrSessionSnapshot | null> {
  const response = await api.post<AttendanceQrSessionSnapshot>(`/api/attendance-qr-sessions/${id}/close`);
  return response;
}
