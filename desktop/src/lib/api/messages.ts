import { api } from './client';
import type {
  CreateThreadRequest,
  MessageItemDto,
  MessageThreadDto,
  SendMessageRequest,
} from '../../types/api/generated';

export async function fetchThreads(): Promise<MessageThreadDto[] | null> {
  const response = await api.get<MessageThreadDto[]>('/api/messages/threads');
  return response;
}

export async function fetchThreadMessages(threadId: string): Promise<MessageItemDto[] | null> {
  const response = await api.get<MessageItemDto[]>(`/api/messages/threads/${threadId}`);
  return response;
}

export async function createThread(payload: CreateThreadRequest): Promise<MessageThreadDto | null> {
  const response = await api.post<MessageThreadDto>('/api/messages/threads', payload);
  return response;
}

export async function sendThreadMessage(threadId: string, payload: SendMessageRequest): Promise<MessageItemDto | null> {
  const response = await api.post<MessageItemDto>(`/api/messages/threads/${threadId}/messages`, payload);
  return response;
}

export async function deleteThreadMessageForMe(threadId: string, messageId: string): Promise<void> {
  await api.delete(`/api/messages/threads/${threadId}/messages/${messageId}/me`);
}
