import { api } from './client';
import type {
  AddTeacherReviewRequest,
  CanvasSnapshotSavedResult,
  PdfReportResponse,
  SaveCanvasSnapshotRequest,
  SaveCanvasStrokeRequest,
  SaveQuestionFlagRequest,
  SaveSolutionAnswerRequest,
  SaveStudentNoteRequest,
  SolutionSessionResponse,
  SolutionSummaryResponse,
  StartSolutionSessionRequest,
  TeacherExamPaperReportResponse,
} from '../../types/api/generated';

// --- Exam / Question Solving ---

export async function startSolutionSession(payload: StartSolutionSessionRequest): Promise<SolutionSessionResponse | null> {
  const response = await api.post<SolutionSessionResponse>('/api/solution-sessions/start', payload);
  return response;
}

export async function fetchSolutionSession(sessionId: string): Promise<SolutionSessionResponse | null> {
  const response = await api.get<SolutionSessionResponse>(`/api/solution-sessions/${sessionId}`);
  return response;
}

export async function saveSolutionAnswer(sessionId: string, payload: SaveSolutionAnswerRequest): Promise<SolutionSessionResponse | null> {
  const response = await api.post<SolutionSessionResponse>(`/api/solution-sessions/${sessionId}/answers`, payload);
  return response;
}

export async function saveSolutionFlag(sessionId: string, payload: SaveQuestionFlagRequest): Promise<SolutionSessionResponse | null> {
  const response = await api.post<SolutionSessionResponse>(`/api/solution-sessions/${sessionId}/flags`, payload);
  return response;
}

export async function saveSolutionNote(sessionId: string, payload: SaveStudentNoteRequest): Promise<SolutionSessionResponse | null> {
  const response = await api.post<SolutionSessionResponse>(`/api/solution-sessions/${sessionId}/notes`, payload);
  return response;
}

export async function saveSolutionCanvasStroke(sessionId: string, payload: SaveCanvasStrokeRequest): Promise<{ saved: boolean } | null> {
  const response = await api.post<{ saved: boolean }>(`/api/solution-sessions/${sessionId}/canvas/strokes`, payload);
  return response;
}

export async function saveSolutionCanvasSnapshot(sessionId: string, payload: SaveCanvasSnapshotRequest): Promise<CanvasSnapshotSavedResult | null> {
  const response = await api.post<CanvasSnapshotSavedResult>(`/api/solution-sessions/${sessionId}/canvas/snapshot`, payload);
  return response;
}

export async function completeSolutionSession(sessionId: string): Promise<SolutionSummaryResponse | null> {
  const response = await api.post<SolutionSummaryResponse>(`/api/solution-sessions/${sessionId}/complete`);
  return response;
}

export async function queueSolutionPdf(sessionId: string): Promise<PdfReportResponse | null> {
  const response = await api.post<PdfReportResponse>(`/api/solution-sessions/${sessionId}/pdf`);
  return response;
}

export async function addSolutionTeacherReview(sessionId: string, payload: AddTeacherReviewRequest): Promise<SolutionSessionResponse | null> {
  const response = await api.post<SolutionSessionResponse>(`/api/solution-sessions/${sessionId}/reviews`, payload);
  return response;
}

export async function fetchTeacherPdfReports(): Promise<TeacherExamPaperReportResponse[]> {
  const response = await api.get<TeacherExamPaperReportResponse[]>('/api/teacher/pdf-reports');
  return Array.isArray(response) ? response : [];
}
