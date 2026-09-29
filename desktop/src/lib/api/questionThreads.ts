import { api } from './client';
import type {
  CreateQuestionThreadReplyRequest,
  CreateQuestionThreadRequest,
  QuestionThreadDto,
} from '../../types/api/generated';

export async function fetchQuestionThreads(): Promise<QuestionThreadDto[] | null> {
  const response = await api.get<QuestionThreadDto[]>('/api/questionthreads');
  return response;
}

export async function createQuestionThread(payload: CreateQuestionThreadRequest): Promise<QuestionThreadDto | null> {
  const response = await api.post<QuestionThreadDto>('/api/questionthreads', payload);
  return response;
}

export async function replyQuestionThread(id: string, payload: CreateQuestionThreadReplyRequest): Promise<QuestionThreadDto | null> {
  const response = await api.post<QuestionThreadDto>(`/api/questionthreads/${id}/replies`, payload);
  return response;
}
