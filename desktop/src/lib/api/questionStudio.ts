import { api } from './client';
import type { QuestionStudioDraftRequest, QuestionStudioDraftSnapshot } from '../../types/api/generated';

// --- Question Studio ---

export async function fetchQuestionStudioDrafts(): Promise<QuestionStudioDraftSnapshot[]> {
  const response = await api.get<QuestionStudioDraftSnapshot[]>('/api/question-studio/drafts');
  return Array.isArray(response) ? response : [];
}

export async function saveQuestionStudioDraft(payload: QuestionStudioDraftRequest): Promise<QuestionStudioDraftSnapshot | null> {
  const response = await api.post<QuestionStudioDraftSnapshot>('/api/question-studio/drafts', payload);
  return response;
}

export async function deleteQuestionStudioDraft(id: string): Promise<void> {
  await api.delete(`/api/question-studio/drafts/${id}`);
}
