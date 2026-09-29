import { api } from './client';
import type { ScheduleEntryDto, UpsertScheduleEntryRequest } from '../../types/api/generated';

export async function fetchScheduleEntries(): Promise<ScheduleEntryDto[] | null> {
  const response = await api.get<ScheduleEntryDto[]>('/api/schedule');
  return response;
}

export async function createScheduleEntry(payload: UpsertScheduleEntryRequest): Promise<ScheduleEntryDto | null> {
  const response = await api.post<ScheduleEntryDto>('/api/schedule', payload);
  return response;
}

export async function updateScheduleEntry(id: string, payload: UpsertScheduleEntryRequest): Promise<ScheduleEntryDto | null> {
  const response = await api.put<ScheduleEntryDto>(`/api/schedule/${id}`, payload);
  return response;
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  await api.delete(`/api/schedule/${id}`);
}
