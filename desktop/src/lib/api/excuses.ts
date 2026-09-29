import { api } from './client';
import type {
  ExcuseRequestCreateRequest,
  ExcuseRequestDecisionRequest,
  ExcuseRequestSnapshot,
} from '../../types/api/generated';

// ============ Excuse Requests ============
// Veli mazeret bildirimleri tenant scope'lu kalıcı saklanır.
export async function fetchExcuseRequests(): Promise<ExcuseRequestSnapshot[]> {
  const response = await api.get<ExcuseRequestSnapshot[]>('/api/excuse-requests');
  return Array.isArray(response) ? response : [];
}

export async function fetchMyExcuseRequests(): Promise<ExcuseRequestSnapshot[]> {
  const response = await api.get<ExcuseRequestSnapshot[]>('/api/excuse-requests/my');
  return Array.isArray(response) ? response : [];
}

export async function createExcuseRequest(payload: ExcuseRequestCreateRequest): Promise<ExcuseRequestSnapshot | null> {
  const response = await api.post<ExcuseRequestSnapshot>('/api/excuse-requests', payload);
  return response;
}

export async function decideExcuseRequest(id: string, payload: ExcuseRequestDecisionRequest): Promise<ExcuseRequestSnapshot | null> {
  const response = await api.put<ExcuseRequestSnapshot>(`/api/excuse-requests/${id}/decision`, payload);
  return response;
}
