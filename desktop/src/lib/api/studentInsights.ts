import { api } from './client';
import type {
  ClassInsightDto,
  InsightNoteDto,
  InsightOverviewDto,
  ReviewInsightNoteRequest,
  StudentInsightDto,
} from '../../types/api/generated';

// ─── Öğrenci konu analizi ────────────────────────────────────────────────────
// Personel (öğretmen/rehber, kurum yöneticisi, şube müdürü). Sayılar ve teşhis
// deterministik analizden gelir; öğretmen notu yapay zekâ açıksa modelden, değilse şablondan.

export const fetchInsightOverview = () => api.get<InsightOverviewDto>('/api/insights');
export const fetchClassInsight = (className: string) =>
  api.get<ClassInsightDto>(`/api/insights/classes/${encodeURIComponent(className)}`);
export const fetchStudentInsight = (studentUserId: string) =>
  api.get<StudentInsightDto>(`/api/insights/students/${studentUserId}`);
export const requestInsightNote = (studentUserId: string) =>
  api.post<InsightNoteDto>(`/api/insights/students/${studentUserId}/note`, {});
export const reviewInsightNote = (noteId: string, payload: ReviewInsightNoteRequest) =>
  api.post<InsightNoteDto>(`/api/insights/notes/${noteId}/review`, payload);

/** Öğrencinin kendisi ve velinin çocukları (yalnız analiz + sabit öneriler; öğretmen notu yok). */
export const fetchMyInsight = () => api.get<StudentInsightDto>('/api/insights/me');
export const fetchChildrenInsights = () => api.get<StudentInsightDto[]>('/api/insights/children');
