import { api } from './client';
import type {
  ExamSessionAnswerRequest,
  ExamSessionStartRequest,
  StudentExamPaperResponse,
} from '../../types/api/generated';

/** ExamSessionsController.MapSession. */
export interface ExamSession {
  id: string;
  examTitle: string;
  title: string;
  subject: string;
  studentName: string;
  studentUsername: string;
  className: string;
  status: string;
  durationSeconds: number;
  startedAtUtc: string;
  completedAtUtc: string | null;
  questions: Array<{
    id: string;
    subject: string;
    topic: string;
    questionText: string;
    imagePath: string | null;
    imagePlacement: string | null;
    options: string[];
    sortOrder: number;
    selectedOptionIndex: number | null;
    openAnswer: string | null;
    requiresManualReview: boolean;
  }>;
}

/** ExamSessionsController.BuildCompletionResponse. */
export interface ExamSessionCompletion {
  sessionId: string;
  examTitle: string;
  title: string;
  subject: string;
  studentName: string;
  className: string;
  score: number;
  net: number;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  pendingReview: number;
  completedAtUtc: string;
}

export interface ExamApprovalResult {
  message: string;
  examResultId: string | null;
  score?: number;
  assessmentLabel?: string;
}

export async function fetchMyExamPapers(params?: { studentName?: string | null; studentUsername?: string | null }): Promise<StudentExamPaperResponse[] | null> {
  const response = await api.get<StudentExamPaperResponse[]>('/api/solution-sessions/my-papers', { params });
  return response;
}

export async function startExamSession(payload: ExamSessionStartRequest): Promise<ExamSession | null> {
  const response = await api.post<ExamSession>('/api/examsessions/start', payload);
  return response;
}

export async function submitExamSessionAnswer(sessionId: string, payload: ExamSessionAnswerRequest): Promise<ExamSession | null> {
  const response = await api.post<ExamSession>(`/api/examsessions/${sessionId}/answers`, payload);
  return response;
}

export async function completeExamSession(sessionId: string): Promise<ExamSessionCompletion | null> {
  const response = await api.post<ExamSessionCompletion>(`/api/examsessions/${sessionId}/complete`);
  return response;
}

export async function approveExamSubmission(sessionId: string): Promise<ExamApprovalResult | null> {
  const response = await api.post<ExamApprovalResult>(`/api/examsessions/${sessionId}/approve`);
  return response;
}
