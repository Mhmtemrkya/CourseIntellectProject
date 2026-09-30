import { api } from './client';
import { isRecord } from '../errors';
import type { StudyPlanStateDto, UpdateStudyPlanStateRequest } from '../../types/api/generated';

// --- Study Plans ---
// Plan öğeleri sunucuda serileştirilmiş JSON olarak tutulur (planItemsSerialized);
// öğenin şeklini çalışma planı ekranı belirler.

/** SignalR "studyPlanUpdated" yükü gibi doğrulanmamış veriyi plan durumuna daraltır. */
export function isStudyPlanState(value: unknown): value is StudyPlanStateDto {
  return isRecord(value) && typeof value.planItemsSerialized === 'string';
}

export async function fetchStudyPlan(): Promise<StudyPlanStateDto | null> {
  const response = await api.get<StudyPlanStateDto>('/api/studyplans');
  return response;
}

export async function saveStudyPlan(payload: UpdateStudyPlanStateRequest): Promise<StudyPlanStateDto | null> {
  const response = await api.put<StudyPlanStateDto>('/api/studyplans', payload);
  return response;
}

export async function addStudyPlanItem(item: unknown): Promise<StudyPlanStateDto | null> {
  const response = await api.post<StudyPlanStateDto>('/api/studyplans/items', { item });
  return response;
}

export async function setStudyPlanItemDone(itemId: string, done: boolean): Promise<StudyPlanStateDto | null> {
  const response = await api.patch<StudyPlanStateDto>(`/api/studyplans/items/${itemId}/done`, { done });
  return response;
}

export async function deleteStudyPlanItem(itemId: string): Promise<StudyPlanStateDto | null> {
  const response = await api.delete<StudyPlanStateDto>(`/api/studyplans/items/${itemId}`);
  return response;
}
