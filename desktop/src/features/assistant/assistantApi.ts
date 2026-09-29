import { api } from '../../lib/api/client';

const clientId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;

export const assistantApi = {
  conversations: () => api.get('/api/assistant/conversations'),
  messages: (id) => api.get(`/api/assistant/conversations/${id}/messages`),
  suggestions: () => api.get('/api/assistant/suggestions'),
  send: (conversationId, message) => api.post('/api/assistant/messages', {
    conversationId,
    message,
    clientMessageId: clientId(),
    context: { currentRoute: window.location.pathname, selectedStudentId: null },
  }),
  action: (conversationId, command, studentId) => api.post('/api/assistant/actions', { conversationId, command, studentId }),
  remove: (id) => api.delete(`/api/assistant/conversations/${id}`),
};
