import { api } from '../../lib/api/client';
import type {
  AssistantConversationDto,
  AssistantMessageDto,
  AssistantResponseDto,
  AssistantSuggestionDto,
} from '../../types/api/generated';

const clientId = (): string => globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;

export const assistantApi = {
  conversations: () => api.get<AssistantConversationDto[]>('/api/assistant/conversations'),
  messages: (id: string) => api.get<AssistantMessageDto[]>(`/api/assistant/conversations/${id}/messages`),
  suggestions: () => api.get<AssistantSuggestionDto[]>('/api/assistant/suggestions'),
  send: (conversationId: string | null | undefined, message: string) => api.post<AssistantResponseDto>('/api/assistant/messages', {
    conversationId,
    message,
    clientMessageId: clientId(),
    context: { currentRoute: window.location.pathname, selectedStudentId: null },
  }),
  action: (conversationId: string | null | undefined, command: string, studentId?: string | null) =>
    api.post<AssistantResponseDto>('/api/assistant/actions', { conversationId, command, studentId }),
  remove: (id: string) => api.delete<null>(`/api/assistant/conversations/${id}`),
};
