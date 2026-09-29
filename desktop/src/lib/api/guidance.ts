import { api } from './client';
import type {
  GuidanceAppointment,
  GuidanceGoal,
  GuidanceInventoryAssignment,
  GuidanceRiskReview,
  GuidanceSessionRecord,
  StudyPlanStateDto,
  UpdateStudyPlanStateRequest,
} from '../../types/api/generated';

// Rehberlik uçları gövde olarak doğrudan entity alır; sunucu kimlik, kurum ve
// zaman damgalarını kendisi doldurur. Bu yüzden istek tipleri Partial'dır.

/** GET /api/guidance/overview satırı (vaka merkezi risk listesi). */
export interface GuidanceOverviewRow {
  studentName: string;
  className: string;
  schoolNumber: string;
  parentName: string;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  riskReasons: string[];
  lastExamAverage: number | null;
  previousExamAverage: number | null;
  homeworkRate: number | null;
  lastSessionAtUtc: string | null;
  lastReviewAtUtc: string | null;
  needsAttention: boolean;
}

/** GET /api/guidance/student-file. */
export interface GuidanceStudentFile {
  profile: {
    fullName: string;
    className: string;
    schoolNumber: string;
    parentName: string;
    parentPhone: string;
    programType: string;
  };
  exams: Array<{ examTitle: string; subject: string; dateLabel: string; score: number; net: number; type: string }>;
  classExamAverages: Array<{ examTitle: string; average: number }>;
  attendance: Array<{ lessonDate: string; status: string; lesson: string }>;
  homework: { total: number; submitted: number };
  sessions: GuidanceSessionRecord[];
  goal: GuidanceGoal | null;
  inventories: GuidanceInventoryAssignment[];
  appointments: GuidanceAppointment[];
  studyPlan: StudyPlanStateDto;
}

export interface GuidanceAvailability {
  counselor: string;
  slots: Array<{ id: string; slot: string; available: boolean }>;
}

/** GET /api/guidance/class-report. */
export interface GuidanceClassReport {
  totalSessions: number;
  sessionsByTopic: Array<{ topic: string; count: number }>;
  sessionsByType: Array<{ type: string; count: number }>;
  sessionsByMonth: Array<{ month: string; count: number }>;
  appointments: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
  };
}

// --- Rehberlik (Guidance) ---

export async function fetchGuidanceOverview(): Promise<GuidanceOverviewRow[]> {
  const response = await api.get<GuidanceOverviewRow[]>('/api/guidance/overview');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceCounselors(): Promise<Array<{ fullName: string }>> {
  const response = await api.get<Array<{ fullName: string }>>('/api/guidance/counselors');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceStudentFile(student: string): Promise<GuidanceStudentFile | null> {
  return api.get<GuidanceStudentFile>('/api/guidance/student-file', { params: { student } });
}

export async function createGuidanceSession(payload: Partial<GuidanceSessionRecord>): Promise<GuidanceSessionRecord | null> {
  return api.post<GuidanceSessionRecord>('/api/guidance/sessions', payload);
}

export async function updateGuidanceSession(id: string, payload: Partial<GuidanceSessionRecord>): Promise<GuidanceSessionRecord | null> {
  return api.patch<GuidanceSessionRecord>(`/api/guidance/sessions/${id}`, payload);
}

export async function deleteGuidanceSession(id: string): Promise<{ deleted: boolean } | null> {
  return api.delete<{ deleted: boolean }>(`/api/guidance/sessions/${id}`);
}

export async function fetchGuidanceFollowUps(): Promise<GuidanceSessionRecord[]> {
  const response = await api.get<GuidanceSessionRecord[]>('/api/guidance/follow-ups');
  return Array.isArray(response) ? response : [];
}

export async function fetchGuidanceAvailability(counselor?: string | null): Promise<GuidanceAvailability | null> {
  return api.get<GuidanceAvailability>('/api/guidance/availability', {
    params: counselor ? { counselor } : undefined,
  });
}

export async function saveGuidanceAvailability(slots: string[]): Promise<Array<{ id: string; slot: string }> | null> {
  return api.put<Array<{ id: string; slot: string }>>('/api/guidance/availability', { slots });
}

export async function fetchGuidanceAppointments(mine = false): Promise<GuidanceAppointment[]> {
  const response = await api.get<GuidanceAppointment[]>('/api/guidance/appointments', { params: { mine } });
  return Array.isArray(response) ? response : [];
}

export async function createGuidanceAppointment(payload: Partial<GuidanceAppointment>): Promise<GuidanceAppointment | null> {
  return api.post<GuidanceAppointment>('/api/guidance/appointments', payload);
}

export async function decideGuidanceAppointment(
  id: string,
  { approved, note = '' }: { approved: boolean; note?: string | null },
): Promise<GuidanceAppointment | null> {
  return api.patch<GuidanceAppointment>(`/api/guidance/appointments/${id}/decide`, { approved, note });
}

export async function completeGuidanceAppointment(id: string): Promise<GuidanceAppointment | null> {
  return api.patch<GuidanceAppointment>(`/api/guidance/appointments/${id}/complete`, {});
}

export async function saveGuidanceGoal(studentName: string, payload: Partial<GuidanceGoal>): Promise<GuidanceGoal | null> {
  return api.put<GuidanceGoal>(`/api/guidance/goals/${encodeURIComponent(studentName)}`, payload);
}

export async function createGuidanceRiskReview(payload: Partial<GuidanceRiskReview>): Promise<GuidanceRiskReview | null> {
  return api.post<GuidanceRiskReview>('/api/guidance/risk-reviews', payload);
}

export async function fetchGuidanceInventories(student?: string | null): Promise<GuidanceInventoryAssignment[]> {
  const response = await api.get<GuidanceInventoryAssignment[]>('/api/guidance/inventories', {
    params: student ? { student } : undefined,
  });
  return Array.isArray(response) ? response : [];
}

export async function assignGuidanceInventory(payload: Partial<GuidanceInventoryAssignment>): Promise<GuidanceInventoryAssignment | null> {
  return api.post<GuidanceInventoryAssignment>('/api/guidance/inventories', payload);
}

export async function completeGuidanceInventory(id: string, answersJson: string): Promise<GuidanceInventoryAssignment | null> {
  return api.patch<GuidanceInventoryAssignment>(`/api/guidance/inventories/${id}/complete`, { answersJson });
}

export async function fetchGuidanceStudyPlan(student: string): Promise<StudyPlanStateDto | null> {
  return api.get<StudyPlanStateDto>('/api/guidance/study-plan', { params: { student } });
}

export async function updateGuidanceStudyPlan(payload: UpdateStudyPlanStateRequest): Promise<StudyPlanStateDto | null> {
  return api.put<StudyPlanStateDto>('/api/guidance/study-plan', payload);
}

export async function fetchGuidanceClassReport(className?: string | null): Promise<GuidanceClassReport | null> {
  return api.get<GuidanceClassReport>('/api/guidance/class-report', {
    params: className ? { className } : undefined,
  });
}
