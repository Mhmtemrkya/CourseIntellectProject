import { api } from './client';
import type {
  SaveSubjectGroupRequest,
  SubjectGroupDto,
  SubjectGroupOverviewDto,
  SubjectGroupTeacherOptionDto,
} from '../../types/api/generated';

// ─── Zümreler ────────────────────────────────────────────────────────────────
// Yönetim kurum yöneticisi + şube müdürü (şube filtresiyle kendi şubesi);
// öğretmen yalnız üyesi olduğu zümreleri görür.

export const fetchSubjectGroupOverview = (academicYear?: string | null) =>
  api.get<SubjectGroupOverviewDto>('/api/subject-groups', { params: academicYear ? { academicYear } : {} });

export const fetchSubjectGroupTeachers = (academicYear?: string | null) =>
  api.get<SubjectGroupTeacherOptionDto[]>('/api/subject-groups/teachers', { params: academicYear ? { academicYear } : {} });

export const fetchMySubjectGroups = () => api.get<SubjectGroupDto[]>('/api/subject-groups/mine');

export const createSubjectGroup = (payload: SaveSubjectGroupRequest) =>
  api.post<SubjectGroupDto>('/api/subject-groups', payload);

export const updateSubjectGroup = (id: string, payload: SaveSubjectGroupRequest) =>
  api.put<SubjectGroupDto>(`/api/subject-groups/${id}`, payload);

export const deleteSubjectGroup = (id: string) => api.delete<null>(`/api/subject-groups/${id}`);
