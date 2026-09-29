import { api } from './client';
import type {
  CreateDutyRequest,
  CreateDutyResult,
  DutyResponse,
  DutyStatsResponse,
  SetTimetableRequest,
  TeacherDutyLoadDto,
  TimetableSlotResponse,
  UpdateDutyRequest,
} from '../../types/api/generated';

export interface DutyQuery {
  from?: string | null;
  to?: string | null;
  dutyType?: string | null;
}

export interface TimetableQuery {
  teacherUserId?: string | null;
  teacherName?: string | null;
}

// --- Öğretmen Nöbetleri ---
export async function createDuty(payload: CreateDutyRequest): Promise<CreateDutyResult | null> {
  const response = await api.post<CreateDutyResult>('/api/duties', payload);
  return response;
}

export async function fetchMyDuties(scope?: string | null): Promise<DutyResponse[]> {
  const response = await api.get<DutyResponse[]>('/api/duties/mine', { params: scope ? { scope } : undefined });
  return Array.isArray(response) ? response : [];
}

export async function fetchMyDutyStats(): Promise<DutyStatsResponse | null> {
  const response = await api.get<DutyStatsResponse>('/api/duties/mine/stats');
  return response;
}

export async function fetchDuties(params?: DutyQuery): Promise<DutyResponse[]> {
  const response = await api.get<DutyResponse[]>('/api/duties', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchDutyLoad(monthStart?: string | null): Promise<TeacherDutyLoadDto[]> {
  const response = await api.get<TeacherDutyLoadDto[]>('/api/duties/load', { params: monthStart ? { monthStart } : undefined });
  return Array.isArray(response) ? response : [];
}

export async function updateDuty(id: string, payload: UpdateDutyRequest): Promise<DutyResponse | null> {
  const response = await api.put<DutyResponse>(`/api/duties/${id}`, payload);
  return response;
}

export async function setDutyStatus(id: string, status: string): Promise<DutyResponse | null> {
  const response = await api.post<DutyResponse>(`/api/duties/${id}/status`, { status });
  return response;
}

export async function deleteDuty(id: string): Promise<void> {
  await api.delete(`/api/duties/${id}`);
}

export async function cancelDutySeries(groupId: string): Promise<{ cancelled: number } | null> {
  const response = await api.post<{ cancelled: number }>(`/api/duties/group/${groupId}/cancel`);
  return response;
}

// --- Öğretmen Ders Programı (timetable) ---
export async function fetchTeacherTimetable(params?: TimetableQuery): Promise<TimetableSlotResponse[]> {
  const response = await api.get<TimetableSlotResponse[]>('/api/timetable', { params });
  return Array.isArray(response) ? response : [];
}

export async function setTeacherTimetable(payload: SetTimetableRequest): Promise<TimetableSlotResponse[]> {
  const response = await api.post<TimetableSlotResponse[]>('/api/timetable', payload);
  return Array.isArray(response) ? response : [];
}

export async function deleteTimetableSlot(id: string): Promise<void> {
  await api.delete(`/api/timetable/${id}`);
}
