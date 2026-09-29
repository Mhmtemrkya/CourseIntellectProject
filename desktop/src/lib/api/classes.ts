import { api } from './client';
import type { CreateCompleteClassRequest, UpdateClassAssignmentsRequest } from '../../types/api/generated';

export interface CreateCompleteClassResult {
  name: string;
  code: string;
  teacherCount: number;
  studentCount: number;
  courseCount: number;
  modules: CreateCompleteClassRequest['modules'];
}

export interface DeleteClassResult {
  name: string;
  studentCount: number;
  staffCount: number;
  scheduleEntryCount: number;
  transferredTo: string | null;
  transferredStudentCount: number;
  deactivatedStudentCount: number;
}

export interface UpdateClassAssignmentsResult {
  name: string;
  studentCount: number;
  advisorTeacherId: string | null;
}

/** Eski sürümlerin sarmaladığı yanıt biçimleri de kabul edilir. */
type ClassListResponse = string[] | { items?: string[]; classes?: string[] };

export async function fetchClasses(): Promise<string[]> {
  const response = await api.get<ClassListResponse>('/api/classes');
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.classes)) {
    return response.classes;
  }
  return [];
}

export async function createClass(payload: string | { name?: string | null } | null | undefined): Promise<{ name: string } | null> {
  const name = typeof payload === 'string' ? payload : payload?.name;
  const response = await api.post<{ name: string }>('/api/classes', { name });
  return response;
}

export async function createCompleteClass(payload: CreateCompleteClassRequest): Promise<CreateCompleteClassResult | null> {
  const response = await api.post<CreateCompleteClassResult>('/api/classes/create-complete', payload);
  return response;
}

/** transferTo verilirse öğrenciler o sınıfa taşınır; verilmezse sınıfsız kalıp pasife alınır. */
export async function deleteClass(className: string, transferTo = ''): Promise<DeleteClassResult | null> {
  const query = transferTo ? `?transferTo=${encodeURIComponent(transferTo)}` : '';
  return api.delete<DeleteClassResult>(`/api/classes/${encodeURIComponent(className)}${query}`);
}

export async function updateClassAssignments(
  className: string,
  payload: UpdateClassAssignmentsRequest,
): Promise<UpdateClassAssignmentsResult | null> {
  const response = await api.put<UpdateClassAssignmentsResult>(`/api/classes/${encodeURIComponent(className)}/assignments`, payload);
  return response;
}
