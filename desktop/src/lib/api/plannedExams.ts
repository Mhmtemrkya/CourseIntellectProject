import { api } from './client';
import type {
  PlannedExamCheckInRequest,
  PlannedExamCreateRequest,
  PlannedExamUpdateRequest,
  SavePlannedExamAttendanceRequest,
} from '../../types/api/generated';

export interface PlannedExamSource {
  questionId: string | null;
  title: string;
  type: string;
  subject: string | null;
  imagePath: string | null;
  imagePlacement: string | null;
}

/**
 * PlannedExamsController.MapResponse. Özet alanları (attendance*, resultCount,
 * averageScore) yalnız liste ucunda dolu; tekil uçlarda null.
 */
export interface PlannedExam {
  attendancePresent: number | null;
  attendanceTotal: number | null;
  resultCount: number | null;
  averageScore: number | null;
  id: string;
  title: string;
  type: string;
  className: string;
  subject: string;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  duration: string;
  lateEntryLimitMinutes: number;
  liveLinkUrl: string;
  requireCamera: boolean;
  requireFullscreen: boolean;
  blockTabChange: boolean;
  blockCopyPaste: boolean;
  totalPoint: number;
  questionCount: number;
  status: string;
  teacherName: string;
  sourceType: string;
  sources: PlannedExamSource[];
}

export interface PlannedExamQuery {
  className?: string | null;
  teacherName?: string | null;
  studentName?: string | null;
  studentUsername?: string | null;
}

/** PlannedExamsController.MapAttendanceEntry (listede yoklamasız öğrenciler "Absent" gelir). */
export interface PlannedExamAttendanceRow {
  studentUserId: string | null;
  studentUsername: string;
  studentName: string;
  className: string;
  joinedLive: boolean;
  cameraReady: boolean;
  checkedInAtUtc: string | null;
  status: string;
  manualOverride: boolean;
  updatedAtUtc: string | null;
}

export interface SubmissionAnswer {
  questionId: string;
  questionBankItemId: string | null;
  sortOrder: number;
  subject: string;
  topic: string;
  questionText: string;
  options: string[];
  selectedOptionIndex: number | null;
  selectedAnswerText: string;
  correctOptionIndex: number;
  correctAnswerText: string;
  isCorrect: boolean | null;
  answeredAtUtc: string | null;
}

/** Hem eski oturum (MapSubmission) hem çözüm oturumu (MapSolutionSubmission) bu şekilde döner. */
export interface PlannedExamSubmission {
  id: string;
  sessionId: string;
  studentName: string;
  studentUsername: string;
  score: number;
  net: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  submittedAtUtc: string;
  status: string;
  approvalStatus: string;
  answers: SubmissionAnswer[];
}

export async function fetchPlannedExams(params?: PlannedExamQuery): Promise<PlannedExam[] | null> {
  const response = await api.get<PlannedExam[]>('/api/plannedexams', { params });
  return response;
}

export async function createPlannedExam(payload: PlannedExamCreateRequest): Promise<PlannedExam | null> {
  const response = await api.post<PlannedExam>('/api/plannedexams', payload);
  return response;
}

// Sınav künyesi düzenleme (başlık, tür, sınıf, ders, tarih/saat, süre, durum...).
// Yalnız gönderilen alan değişir; yoklama ve soru kaynakları korunur.
export async function updatePlannedExam(id: string, payload: Partial<PlannedExamUpdateRequest>): Promise<PlannedExam | null> {
  const response = await api.put<PlannedExam>(`/api/plannedexams/${id}`, payload);
  return response;
}

export async function deletePlannedExam(id: string): Promise<null> {
  const response = await api.delete<null>(`/api/plannedexams/${id}`);
  return response;
}

export async function fetchPlannedExamSubmissions(id: string): Promise<PlannedExamSubmission[] | null> {
  const response = await api.get<PlannedExamSubmission[]>(`/api/plannedexams/${id}/submissions`);
  return response;
}

export async function checkinPlannedExam(id: string, payload: PlannedExamCheckInRequest): Promise<PlannedExamAttendanceRow | null> {
  const response = await api.post<PlannedExamAttendanceRow>(`/api/plannedexams/${id}/checkin`, payload);
  return response;
}

export async function fetchPlannedExamAttendance(id: string): Promise<PlannedExamAttendanceRow[] | null> {
  const response = await api.get<PlannedExamAttendanceRow[]>(`/api/plannedexams/${id}/attendance`);
  return response;
}

export async function savePlannedExamAttendance(id: string, payload: SavePlannedExamAttendanceRequest): Promise<PlannedExamAttendanceRow[] | null> {
  const response = await api.post<PlannedExamAttendanceRow[]>(`/api/plannedexams/${id}/attendance`, payload);
  return response;
}
