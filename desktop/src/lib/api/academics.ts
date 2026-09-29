import { api } from './client';
import type {
  AdminAnalyticsResponse,
  AttendanceEntryDto,
  CreateExamResultRequest,
  CreateHomeworkAssignmentRequest,
  CreateHomeworkSubmissionRequest,
  ExamResultDto,
  HomeworkAssignmentDto,
  SaveAttendanceRequest,
  UpdateExamResultRequest,
} from '../../types/api/generated';

/** Sonuç/yoklama listelerinin ortak süzgeci. */
export interface StudentClassQuery {
  studentName?: string | null;
  className?: string | null;
}

export async function fetchHomework(): Promise<HomeworkAssignmentDto[] | null> {
  const response = await api.get<HomeworkAssignmentDto[]>('/api/homework');
  return response;
}

export async function createHomework(payload: CreateHomeworkAssignmentRequest): Promise<HomeworkAssignmentDto | null> {
  const response = await api.post<HomeworkAssignmentDto>('/api/homework', payload);
  return response;
}

export async function deleteHomework(id: string): Promise<void> {
  await api.delete(`/api/homework/${id}`);
}

export async function submitHomework(id: string, payload: CreateHomeworkSubmissionRequest): Promise<HomeworkAssignmentDto | null> {
  const response = await api.post<HomeworkAssignmentDto>(`/api/homework/${id}/submit`, payload);
  return response;
}

export async function fetchExamResults(params?: StudentClassQuery): Promise<ExamResultDto[] | null> {
  const response = await api.get<ExamResultDto[]>('/api/examresults', {
    params,
  });
  return response;
}

export async function createExamResult(payload: CreateExamResultRequest): Promise<ExamResultDto | null> {
  const response = await api.post<ExamResultDto>('/api/examresults', payload);
  return response;
}

// Girilmiş sonucun düzeltilmesi/silinmesi. Yetki backend'de: sonuç girebilen
// roller (Admin/Öğretmen, rehberlik branşı hariç) + exams.edit / exams.delete.
export async function updateExamResult(id: string, payload: UpdateExamResultRequest): Promise<ExamResultDto | null> {
  return api.put<ExamResultDto>(`/api/examresults/${id}`, payload);
}

export async function deleteExamResult(id: string): Promise<{ id: string } | null> {
  return api.delete<{ id: string }>(`/api/examresults/${id}`);
}

export async function fetchAttendance(params?: StudentClassQuery): Promise<AttendanceEntryDto[] | null> {
  const response = await api.get<AttendanceEntryDto[]>('/api/attendance', {
    params,
  });
  return response;
}

export async function saveAttendance(payload: SaveAttendanceRequest): Promise<AttendanceEntryDto[] | null> {
  const response = await api.post<AttendanceEntryDto[]>('/api/attendance', payload);
  return response;
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  await api.delete(`/api/attendance/${id}`);
}

export interface AdminAnalyticsQuery {
  period?: string;
  from?: string | null;
  to?: string | null;
}

export async function fetchAdminAnalytics({ period = 'week', from, to }: AdminAnalyticsQuery = {}): Promise<AdminAnalyticsResponse | null> {
  const params: { period: string; from?: string; to?: string } = { period };
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await api.get<AdminAnalyticsResponse>('/api/admin/analytics', { params });
  return response;
}
