import { api } from './client';
import type {
  CheckInVisitorRequest,
  UpdateVisitorRequest,
  VisitorDto,
  VisitorHostOptionDto,
  VisitorListDto,
  VisitorLookupDto,
  VisitorStudentOptionDto,
} from '../../types/api/generated';

// ─── Ziyaretçi takibi ────────────────────────────────────────────────────────
// İdari personel (danışma/sekreterlik), kurum yöneticisi ve şube müdürü.

export interface VisitorQuery {
  fromUtc?: string | null;
  toUtc?: string | null;
  search?: string | null;
  status?: 'inside' | 'left' | '' | null;
}

export const fetchVisitors = (query: VisitorQuery = {}) => api.get<VisitorListDto>('/api/visitors', {
  params: Object.fromEntries(Object.entries(query).filter(([, value]) => value)),
});
export const fetchVisitorHosts = () => api.get<VisitorHostOptionDto[]>('/api/visitors/hosts');
export const searchVisitorStudents = (search: string) => api.get<VisitorStudentOptionDto[]>('/api/visitors/students', { params: { search } });
export const lookupVisitors = (q: string) => api.get<VisitorLookupDto[]>('/api/visitors/lookup', { params: { q } });
export const checkInVisitor = (payload: CheckInVisitorRequest) => api.post<VisitorDto>('/api/visitors', payload);
export const checkOutVisitor = (id: string) => api.post<VisitorDto>(`/api/visitors/${id}/checkout`, {});
export const updateVisitor = (id: string, payload: UpdateVisitorRequest) => api.put<VisitorDto>(`/api/visitors/${id}`, payload);
export const deleteVisitor = (id: string) => api.delete<null>(`/api/visitors/${id}`);
