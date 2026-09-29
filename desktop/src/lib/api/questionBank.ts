import { api } from './client';
import type {
  QuestionBankItemDto,
  QuestionImportBulkUpdateRequest,
  QuestionImportCommitRequest,
  QuestionImportCommitResponse,
  QuestionImportHistoryItem,
  QuestionImportJobSnapshot,
  QuestionImportQuestionSnapshot,
  QuestionImportQuestionUpdateRequest,
  QuestionPracticeAttemptDto,
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
