import { api } from './client';
import type {
  AddClubMemberRequest,
  ClubActivityDto,
  ClubDetailDto,
  ClubMemberDto,
  ClubOverviewDto,
  ClubPersonOptionDto,
  ClubSummaryDto,
  SaveClubActivityRequest,
  SaveClubRequest,
  UpdateClubMemberRequest,
} from '../../types/api/generated';

// ─── Öğrenci kulüpleri ───────────────────────────────────────────────────────
// Yönetici kulüp açar; danışman öğretmen üye/etkinlik yönetir; öğrenci katılma
// isteği gönderir; veli çocuğunun kulüplerini görür. Yetki sunucuda.

export const fetchClubOverview = (academicYear?: string | null) =>
  api.get<ClubOverviewDto>('/api/clubs', { params: academicYear ? { academicYear } : {} });
export const fetchMyClubs = () => api.get<ClubSummaryDto[]>('/api/clubs/mine');
export const fetchUpcomingClubActivities = () => api.get<ClubActivityDto[]>('/api/clubs/activities/upcoming');
export const fetchClubDetail = (id: string) => api.get<ClubDetailDto>(`/api/clubs/${id}`);
export const fetchClubTeacherOptions = () => api.get<ClubPersonOptionDto[]>('/api/clubs/teachers');
export const searchClubStudents = (id: string, search: string) =>
  api.get<ClubPersonOptionDto[]>(`/api/clubs/${id}/student-options`, { params: { search } });

export const createClub = (payload: SaveClubRequest) => api.post<ClubSummaryDto>('/api/clubs', payload);
export const updateClub = (id: string, payload: SaveClubRequest) => api.put<ClubSummaryDto>(`/api/clubs/${id}`, payload);
export const deleteClub = (id: string) => api.delete<null>(`/api/clubs/${id}`);

export const addClubMember = (id: string, payload: AddClubMemberRequest) => api.post<ClubMemberDto>(`/api/clubs/${id}/members`, payload);
export const updateClubMember = (id: string, memberId: string, payload: UpdateClubMemberRequest) =>
  api.put<ClubMemberDto | null>(`/api/clubs/${id}/members/${memberId}`, payload);
export const requestClubJoin = (id: string, note: string) => api.post<ClubMemberDto>(`/api/clubs/${id}/join`, { note });
export const leaveClub = (id: string) => api.delete<null>(`/api/clubs/${id}/join`);

export const createClubActivity = (id: string, payload: SaveClubActivityRequest) =>
  api.post<ClubActivityDto>(`/api/clubs/${id}/activities`, payload);
export const updateClubActivity = (id: string, activityId: string, payload: SaveClubActivityRequest) =>
  api.put<ClubActivityDto>(`/api/clubs/${id}/activities/${activityId}`, payload);
export const deleteClubActivity = (id: string, activityId: string) => api.delete<null>(`/api/clubs/${id}/activities/${activityId}`);
