import { api } from './client';
import type {
  CreateQuestionBankItemRequest,
  QuestionBankItemDto,
  QuestionImportBulkUpdateRequest,
  QuestionImportCommitRequest,
  QuestionImportCommitResponse,
  QuestionImportHistoryItem,
  QuestionImportJobSnapshot,
  QuestionImportQuestionSnapshot,
  QuestionImportQuestionUpdateRequest,
  QuestionPracticeAttemptDto,
  QuestionPracticeStatsDto,
  SubmitQuestionPracticeAttemptRequest,
} from '../../types/api/generated';

export async function fetchQuestionBank(className?: string | null): Promise<QuestionBankItemDto[] | null> {
  const response = await api.get<QuestionBankItemDto[]>('/api/questionbank', {
    params: className ? { className } : undefined,
  });
  return response;
}

export async function fetchQuestionPracticeAttempts(studentUsername?: string | null): Promise<QuestionPracticeAttemptDto[] | null> {
  const response = await api.get<QuestionPracticeAttemptDto[]>('/api/questionbank/attempts', {
    params: studentUsername ? { studentUsername } : undefined,
  });
  return response;
}

export async function uploadQuestionImportFile(formData: FormData): Promise<QuestionImportJobSnapshot | null> {
  const response = await api.post<QuestionImportJobSnapshot>('/api/question-import/upload', formData);
  return response;
}

export async function fetchQuestionImportJob(importId: string): Promise<QuestionImportJobSnapshot | null> {
  const response = await api.get<QuestionImportJobSnapshot>(`/api/question-import/${importId}`);
  return response;
}

export async function fetchQuestionImportHistory(): Promise<QuestionImportHistoryItem[]> {
  const response = await api.get<QuestionImportHistoryItem[]>('/api/question-import/history');
  return Array.isArray(response) ? response : [];
}

export async function updateQuestionImportQuestion(
  importId: string,
  questionId: string,
  payload: QuestionImportQuestionUpdateRequest,
): Promise<QuestionImportQuestionSnapshot | null> {
  const response = await api.put<QuestionImportQuestionSnapshot>(`/api/question-import/${importId}/questions/${questionId}`, payload);
  return response;
}

export async function deleteQuestionImportQuestion(importId: string, questionId: string): Promise<void> {
  await api.delete(`/api/question-import/${importId}/questions/${questionId}`);
}

export async function duplicateQuestionImportQuestion(importId: string, questionId: string): Promise<QuestionImportQuestionSnapshot | null> {
  const response = await api.post<QuestionImportQuestionSnapshot>(`/api/question-import/${importId}/questions/${questionId}/duplicate`);
  return response;
}

export async function bulkUpdateQuestionImport(importId: string, payload: QuestionImportBulkUpdateRequest): Promise<QuestionImportJobSnapshot | null> {
  const response = await api.post<QuestionImportJobSnapshot>(`/api/question-import/${importId}/bulk-update`, payload);
  return response;
}

export async function commitQuestionImport(importId: string, payload: QuestionImportCommitRequest): Promise<QuestionImportCommitResponse | null> {
  const response = await api.post<QuestionImportCommitResponse>(`/api/question-import/${importId}/commit`, payload);
  return response;
}

export async function deleteQuestionImportJob(importId: string): Promise<void> {
  await api.delete(`/api/question-import/${importId}`);
}

export async function createQuestionBankItem(payload: CreateQuestionBankItemRequest): Promise<QuestionBankItemDto | null> {
  const response = await api.post<QuestionBankItemDto>('/api/questionbank', payload);
  return response;
}

export async function updateQuestionBankItem(id: string, payload: CreateQuestionBankItemRequest): Promise<QuestionBankItemDto | null> {
  const response = await api.put<QuestionBankItemDto>(`/api/questionbank/${id}`, payload);
  return response;
}

export async function deleteQuestionBankItem(id: string): Promise<void> {
  await api.delete(`/api/questionbank/${id}`);
}

export async function incrementQuestionUsage(id: string): Promise<QuestionBankItemDto | null> {
  const response = await api.post<QuestionBankItemDto>(`/api/questionbank/${id}/usage`);
  return response;
}

export async function submitQuestionPracticeAttempt(
  id: string,
  payload: SubmitQuestionPracticeAttemptRequest,
): Promise<QuestionPracticeAttemptDto | null> {
  const response = await api.post<QuestionPracticeAttemptDto>(`/api/questionbank/${id}/attempts`, payload);
  return response;
}

export interface PracticeStatsQuery {
  studentUsername?: string | null;
  className?: string | null;
}

export async function fetchQuestionPracticeStats(params?: PracticeStatsQuery): Promise<QuestionPracticeStatsDto | null> {
  const response = await api.get<QuestionPracticeStatsDto>('/api/questionbank/attempts/stats', { params });
  return response;
}

/** GET /api/wronganswers satırı (WrongAnswersController.GetList). */
export interface WrongAnswerItem {
  attemptId: string;
  questionId: string;
  studentName: string;
  studentUsername: string;
  subject: string;
  topic: string;
  difficulty: string;
  questionText: string;
  yourAnswer: string;
  correctAnswer: string;
  note: string;
  submittedAtUtc: string;
}

export interface WrongAnswerQuery {
  studentUsername?: string | null;
  studentName?: string | null;
}

export async function fetchWrongAnswers(params?: WrongAnswerQuery): Promise<WrongAnswerItem[] | null> {
  const response = await api.get<WrongAnswerItem[]>('/api/wronganswers', {
    params,
  });
  return response;
}

export async function clearWrongAnswers(params?: WrongAnswerQuery): Promise<void> {
  await api.delete('/api/wronganswers', {
    params,
  });
}
