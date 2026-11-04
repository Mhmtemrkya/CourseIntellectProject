import { api } from './client';
import type {
  AssistantBriefingDto,
  AssistantClientContext,
  AssistantConversationDto,
  AssistantMessageDto,
  AssistantUnansweredDto,
  AssistantResponseDto,
  AssistantSuggestionDto,
} from '../../types/api/generated';

// ─── Maydi (SchoolAsist asistanı) ─────────────────────────────────────────────────────
// Portal: istemcinin bulunduğu panel; sunucu yalnız kullanıcının gerçek rolüyse kabul eder.

export const sendAssistantMessage = (conversationId: string | null, message: string, context: AssistantClientContext) =>
  api.post<AssistantResponseDto>('/api/assistant/messages', {
    conversationId,
    message,
    clientMessageId: crypto.randomUUID(),
    context,
  });

export const runAssistantAction = (conversationId: string, command: string, studentId: string | null, context: AssistantClientContext) =>
  api.post<AssistantResponseDto>('/api/assistant/actions', { conversationId, command, studentId, context });

export const fetchAssistantSuggestions = (portal: string, language: string) =>
  api.get<AssistantSuggestionDto[]>('/api/assistant/suggestions', { params: { portal, language } });

export const fetchAssistantBriefing = (portal: string, language: string) =>
  api.get<AssistantBriefingDto>('/api/assistant/briefing', { params: { portal, language } });

/** helpful: true = işe yaradı, false = yaramadı (yönetici "cevaplanamayan sorular"da görür). */
export const sendAssistantFeedback = (messageId: string, helpful: boolean) =>
  api.post<void>(`/api/assistant/messages/${messageId}/feedback`, { helpful });

export const fetchAssistantConversations = (portal: string) =>
  api.get<AssistantConversationDto[]>('/api/assistant/conversations', { params: { portal } });

export const fetchAssistantMessages = (conversationId: string) =>
  api.get<AssistantMessageDto[]>(`/api/assistant/conversations/${conversationId}/messages`);

export const deleteAssistantConversation = (conversationId: string) =>
  api.delete<void>(`/api/assistant/conversations/${conversationId}`);

export const fetchAssistantUnanswered = (days: number) =>
  api.get<AssistantUnansweredDto[]>('/api/assistant/unanswered', { params: { days } });

/** Rapor kartının PDF'i; sunucu yalnız kullanıcının kendi mesajını verir. */
export const fetchAssistantReportPdf = (messageId: string) =>
  api.get(`/api/assistant/messages/${messageId}/pdf`, { responseType: 'blob' });
/** Rapor kartının Excel dökümü (tablo sayısal hücrelerle + özet sayfası). */
export const fetchAssistantReportExcel = (messageId: string) =>
  api.get(`/api/assistant/messages/${messageId}/xlsx`, { responseType: 'blob' });

/** 6 sayfalık Öğrenci Başarı Raporu (profil ya da kullanıcı kimliği); Rapor Merkezi ve asistan aynı PDF'i kullanır. */
export const fetchStudentSuccessReportPdf = (studentId: string) =>
  api.get(`/api/assistant/students/${studentId}/success-report`, { responseType: 'blob' });
