import { api } from './client';
import type { ApprovalDecisionRequest, ApprovalRequestDto, CreateApprovalRequest } from '../../types/api/generated';

export interface ApprovalQuery {
  status?: string | null;
  category?: string | null;
}

export async function fetchApprovals(params?: ApprovalQuery): Promise<ApprovalRequestDto[]> {
  const response = await api.get<ApprovalRequestDto[]>('/api/approvals', { params });
  return Array.isArray(response) ? response : [];
}

export async function createApproval(payload: CreateApprovalRequest): Promise<ApprovalRequestDto | null> {
  const response = await api.post<ApprovalRequestDto>('/api/approvals', payload);
  return response;
}

export async function fetchMyApprovals(): Promise<ApprovalRequestDto[]> {
  const response = await api.get<ApprovalRequestDto[]>('/api/approvals/mine');
  return Array.isArray(response) ? response : [];
}

export async function decideApproval(id: string, payload: ApprovalDecisionRequest): Promise<ApprovalRequestDto | null> {
  const response = await api.post<ApprovalRequestDto>(`/api/approvals/${id}/decide`, payload);
  return response;
}
