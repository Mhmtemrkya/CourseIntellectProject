import { api } from './client';
import type {
  AdminDocumentDto,
  AdminTaskDto,
  CreateDocumentRequest,
  CreateTaskRequest,
} from '../../types/api/generated';

/** GET /api/admin/overview sayaçları. */
export interface AdminOverview {
  pendingApprovals: number;
  pendingLeaves: number;
  openTasks: number;
  overdueTasks: number;
  expiringDocuments: number;
  assignedAssets: number;
  recentAudit: number;
}

export interface AdminTaskQuery {
  status?: string | null;
  assignee?: string | null;
}

export interface AdminDocumentQuery {
  category?: string | null;
  direction?: string | null;
  status?: string | null;
}

/** Yanıt gelmezse boş nesne döner (eski davranış); alanlar bu yüzden opsiyonel. */
export async function fetchAdminOverview(): Promise<Partial<AdminOverview>> {
  const response = await api.get<AdminOverview>('/api/admin/overview');
  return response || {};
}

export async function fetchAdminTasks(params?: AdminTaskQuery): Promise<AdminTaskDto[]> {
  const response = await api.get<AdminTaskDto[]>('/api/admin-tasks', { params });
  return Array.isArray(response) ? response : [];
}

export async function fetchMyAdminTasks(): Promise<AdminTaskDto[]> {
  const response = await api.get<AdminTaskDto[]>('/api/admin-tasks/mine');
  return Array.isArray(response) ? response : [];
}

export async function createAdminTask(payload: CreateTaskRequest): Promise<AdminTaskDto | null> {
  const response = await api.post<AdminTaskDto>('/api/admin-tasks', payload);
  return response;
}

export async function updateAdminTaskStatus(id: string, status: string, reason: string | null = null): Promise<AdminTaskDto | null> {
  const response = await api.post<AdminTaskDto>(`/api/admin-tasks/${id}/status`, { status, reason });
  return response;
}

export async function fetchAdminDocuments(params?: AdminDocumentQuery): Promise<AdminDocumentDto[]> {
  const response = await api.get<AdminDocumentDto[]>('/api/admin-documents', { params });
  return Array.isArray(response) ? response : [];
}

export async function createAdminDocument(payload: CreateDocumentRequest): Promise<AdminDocumentDto | null> {
  const response = await api.post<AdminDocumentDto>('/api/admin-documents', payload);
  return response;
}

export async function archiveAdminDocument(id: string): Promise<AdminDocumentDto | null> {
  const response = await api.post<AdminDocumentDto>(`/api/admin-documents/${id}/archive`);
  return response;
}
