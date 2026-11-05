import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Building2, CalendarDays, Check, Coins, ExternalLink, GraduationCap, History, MessageCircle, Pin, Presentation, RotateCcw, Send, ThumbsDown, ThumbsUp, Trash2, Trophy, Users, X, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import {
  deleteAssistantConversation,
  fetchAssistantBriefing,
  fetchAssistantConversations,
  fetchAssistantMessages,
  fetchAssistantSuggestions,
  runAssistantAction,
  sendAssistantFeedback,
  sendAssistantMessage,
} from '../../lib/api/modules';
import AssistantReportCard from './AssistantReportCard';
import MaydiMascot, { type MaydiResponseMood } from './MaydiMascot';
import MaydiLauncher from './MaydiLauncher';
import { maydiResponseMood } from './maydiReactions';
import { clearStaleAssistantFocus, setAssistantFocus, useAssistantFocusValue } from '../../lib/assistantFocus';
import { errorMessage, isRecord } from '../../lib/errors';
import { diagnosisOf, formatPct, questionPlan, topicReason } from '../../lib/insights';
import { foldTr } from '../../lib/foldTr';
import './AssistantPanel.css';
import type {
  AssistantActionDto,
  AssistantBriefingDto,
  AssistantClientContext,
  AssistantConversationDto,
  AssistantMessageDto,
  AssistantResponseDto,
} from '../../types/api/generated';

interface ChatMessage { id: string; from: 'user' | 'assistant'; text: string; createdAtUtc?: string; response?: AssistantResponseDto; feedback?: number | null; mascotMood?: MaydiResponseMood }

// ── Güvenli alan okuma (sunucu verisi `unknown` gelir) ──────────────────────
const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);
const str = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const money = (value: unknown) => `${num(value).toLocaleString('tr-TR')} ₺`;
const date = (value: unknown) => {
  const text = str(value);
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) || !text.includes('T') ? text : new Date(parsed).toLocaleDateString('tr-TR');
};
const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DAYS_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TONE_DOT: Record<string, string> = { warn: 'bg-amber-500', good: 'bg-emerald-500', info: 'bg-[hsl(var(--brand-primary-text))]' };

function messageDate(timestamp?: string): Date | null {
  const parsed = timestamp ? new Date(timestamp) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function dayLabel(timestamp: string | undefined, english: boolean): string {
  const parsed = messageDate(timestamp);
  if (!parsed) return '';
  const today = new Date();
  if (parsed.toDateString() === today.toDateString()) return english ? 'Today' : 'Bugün';
  today.setDate(today.getDate() - 1);
  if (parsed.toDateString() === today.toDateString()) return english ? 'Yesterday' : 'Dün';
  return parsed.toLocaleDateString(english ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function MessageTime({ timestamp, english }: { timestamp?: string; english: boolean }) {
  const parsed = messageDate(timestamp);
  return parsed ? <time className="maydi-chat__time" dateTime={parsed.toISOString()} title={parsed.toLocaleString(english ? 'en-GB' : 'tr-TR')}>
    {parsed.toLocaleTimeString(english ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' })}
  </time> : null;
}

function metricIcon(label: string): LucideIcon {
  const text = foldTr(label);
  if (/ogretmen|teacher/.test(text)) return GraduationCap;
  if (/devamsiz|absen/.test(text)) return CalendarDays;
  if (/ogrenci|student/.test(text)) return Users;
  if (/sinif|class/.test(text)) return Presentation;
  return BarChart3;
}

function suggestionPresentation(label: string): { label: string; icon: LucideIcon } {
  const text = foldTr(label);
  const shorter: Record<string, string> = {
    'bu ay tahsilat': 'Tahsilat', 'bugun devamsiz olanlar': 'Devamsızlık',
    'institution summary': 'Overview', "this month's collections": 'Collections', 'absentees today': 'Attendance',
  };
  const icon = /tahsil|odeme|borc|collection|payment/.test(text) ? Coins
    : /devamsiz|yoklama|attendance|absen/.test(text) ? CalendarDays
      : /kurum|institution|overview/.test(text) ? Building2 : MessageCircle;
  return { label: shorter[text] ?? label, icon };
}

/** Kullanıcının bulunduğu portal: önce adres (çok rollü kullanıcı için), sonra rol. */
function portalOf(pathname: string, role: string | undefined): string | null {
  if (pathname.startsWith('/s/')) return 'student';
  if (pathname.startsWith('/p/')) return 'parent';
  if (pathname.startsWith('/t/') || pathname.startsWith('/g/')) return 'teacher';
  switch (role) {
    case 'student': return 'student';
    case 'parent': return 'parent';
    case 'teacher':
    case 'counselor': return 'teacher';
    case 'finance': return 'accounting';
    case 'administrative': return 'administrative';
    case 'admin': return 'admin';
    default: return null; // platform yöneticisi, yemekhane: asistan yok
  }
}

/** Kayıtlı mesajı (geçmiş) canlı cevap biçimine çevirir; kartlar aynı şekilde çizilir. */
function fromHistory(conversationId: string, message: AssistantMessageDto): ChatMessage {
  if (message.sender === 'user') return { id: message.id, from: 'user', text: message.text, createdAtUtc: message.createdAtUtc };
  return {
    id: message.id,
    from: 'assistant',
    text: message.text,
    createdAtUtc: message.createdAtUtc,
    feedback: message.feedback,
    response: {
      conversationId,
      messageId: message.id,
      type: message.type,
      text: message.text,
      data: message.data,
      actions: message.actions ?? [],
      suggestions: message.suggestions ?? [],
      intent: message.intent,
    },
  };
}

/**
 * Maydi (SchoolAsist asistanı): her sayfadan açılan sohbet paneli. Cevaplar sunucudaki konuşma
 * katmanından gelir (sayılar veritabanından); her rol yalnız kendi portalının sorularını sorabilir.
 * Panel açılınca role göre günlük brifing gösterir; ekranda bir öğrenciye bakılıyorsa
 * ("son baktığınız öğrenci") sorular ad yazılmadan o öğrenciye yönelir.
 */
export function AssistantPanel() {
  const { user } = useApp();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const portal = portalOf(location.pathname, user?.role);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<AssistantBriefingDto | null>(null);
  const [history, setHistory] = useState<AssistantConversationDto[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mascotSpin, setMascotSpin] = useState(0);
  const [mascotAffection, setMascotAffection] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const english = language === 'en';
  const student = portal === 'student';
  const t = (tr: string, en: string) => (english ? en : tr);

  // Ekran bağlamı yalnız oluştuğu sayfada geçerli; öğrenci kendi portalında başkasını hedefleyemez.
  const rawFocus = useAssistantFocusValue();
  const focus = rawFocus && rawFocus.route === location.pathname && !student ? rawFocus : null;
  useEffect(() => {
    clearStaleAssistantFocus(location.pathname);
  }, [location.pathname]);

  const context = useMemo((): AssistantClientContext => ({
    currentRoute: location.pathname,
    selectedStudentId: focus?.studentId ?? null,
    selectedStudentName: focus?.studentName || null,
    portal,
    language,
  }), [focus?.studentId, focus?.studentName, language, location.pathname, portal]);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setView('chat');
  }, []);

  // Portal ya da dil değişince yeni sohbet (veli portalındaki sohbet öğretmen portalına taşınmaz).
  useEffect(() => {
    reset();
    setBriefing(null);
  }, [portal, language, reset]);

  useEffect(() => {
    if (!open || !portal) return;
    fetchAssistantSuggestions(portal, language)
      .then((items) => setSuggestions((items ?? []).map((item) => item.label)))
      .catch(() => setSuggestions([]));
    fetchAssistantBriefing(portal, language)
      .then((result) => setBriefing(result ?? null))
      .catch(() => setBriefing(null));
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open, portal, language]);

  useEffect(() => {
    if (wasOpen.current && !open) {
      document.querySelector<HTMLButtonElement>('[data-testid="assistant-launcher"]')?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [messages, busy]);

  const push = useCallback((response: AssistantResponseDto | null, requestText = '') => {
    if (!response) return;
    setConversationId(response.conversationId);
    setMessages((current) => [...current, { id: response.messageId, from: 'assistant', text: response.text, createdAtUtc: new Date().toISOString(), response, mascotMood: maydiResponseMood(response, requestText) }]);
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setView('chat');
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'user', text: message, createdAtUtc: new Date().toISOString() }]);
    setBusy(true);
    try {
      push(await sendAssistantMessage(conversationId, message, context), message);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'assistant', text: errorMessage(error), createdAtUtc: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [busy, context, conversationId, push]);

  const runAction = useCallback(async (action: AssistantActionDto, label: string) => {
    if (action.type === 'navigate' && action.route) {
      navigate(action.route);
      return;
    }
    if (!conversationId || !action.command || busy) return;
    const studentId = str(field(action.parameters, 'studentId')) || null;
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'user', text: label, createdAtUtc: new Date().toISOString() }]);
    setBusy(true);
    try {
      push(await runAssistantAction(conversationId, action.command, studentId, context));
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'assistant', text: errorMessage(error), createdAtUtc: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [busy, context, conversationId, navigate, push]);

  const pickStudent = useCallback((studentId: string, name: string) => {
    void runAction({ type: 'send_command', label: name, route: null, command: 'summary', parameters: { studentId } }, name);
  }, [runAction]);

  const rate = useCallback((messageId: string, helpful: boolean) => {
    setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, feedback: helpful ? 1 : -1 } : item)));
    if (helpful) setMascotAffection((current) => current + 1);
    sendAssistantFeedback(messageId, helpful).catch(() => undefined);
  }, []);

  const openHistory = useCallback(() => {
    if (!portal) return;
    setView('history');
    setHistory(null);
    fetchAssistantConversations(portal).then((items) => setHistory(items ?? [])).catch(() => setHistory([]));
  }, [portal]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const rows = await fetchAssistantMessages(id);
      setMessages((rows ?? []).map((row) => fromHistory(id, row)));
      setConversationId(id);
      setView('chat');
    } catch (error) {
      setMessages([{ id: crypto.randomUUID(), from: 'assistant', text: errorMessage(error) }]);
      setView('chat');
    }
  }, []);

  const removeConversation = useCallback((id: string) => {
    setHistory((current) => (current ?? []).filter((item) => item.id !== id));
    if (id === conversationId) reset();
    deleteAssistantConversation(id).catch(() => undefined);
  }, [conversationId, reset]);

  if (!user || !portal) return null;

  const lastSuggestions = [...messages].reverse().find((item) => item.from === 'assistant')?.response?.suggestions ?? [];
  const focusChips = focus
    ? (portal === 'accounting' ? [t('Ödeme durumu', 'Payment status')] : [t('Devamsızlığı nasıl?', 'Attendance?'), t('Sınav sonuçları', 'Exam results'), t('Zayıf olduğu konular', 'Weak topics')])
    : [];
  const chips = messages.length === 0 ? [...focusChips, ...suggestions] : lastSuggestions;
  const firstName = user.name.split(' ')[0] ?? '';
  const latestResponseMessage = [...messages].reverse().find((message) => message.response);
  const latestResponse = latestResponseMessage?.response;
  const spinMascot = () => setMascotSpin((current) => current + 1);

  return createPortal(
    <>
      <MaydiLauncher routeKey={`${user.id}:${location.pathname}`} visible={!open}
        label={t("Maydi'yi aç", 'Open Maydi')} onOpen={() => setOpen(true)} />

      {open ? (
        <section role="dialog" aria-label="Maydi" data-testid="assistant-panel"
          className="maydi-chat" onKeyDown={(event) => {
            if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
          }}>
          <header className="maydi-chat__header">
            {view === 'history' ? (
              <button type="button" className="maydi-chat__icon-button" aria-label={t('Sohbete dön', 'Back to chat')} onClick={() => setView('chat')}><ArrowLeft size={16} /></button>
            ) : (
              <button type="button" onClick={spinMascot} onPointerEnter={spinMascot} onFocus={spinMascot}
                className="maydi-chat__avatar-button"
                aria-label={t("Maydi'yi döndür", 'Make Maydi spin')}>
                <MaydiMascot size={48} thinking={busy} spinSignal={mascotSpin}
                  responseId={latestResponse?.messageId} responseMood={latestResponseMessage?.mascotMood ?? maydiResponseMood(latestResponse)} affectionSignal={mascotAffection} />
              </button>
            )}
            <div className="maydi-chat__identity">
              <h2>{view === 'history' ? t('Önceki sohbetler', 'Previous chats') : 'Maydi'}</h2>
              <p><span className={`maydi-chat__status ${busy ? 'maydi-chat__status--busy' : ''}`} />{busy ? t('yazıyor…', 'typing…') : t('Çevrimiçi', 'Online')}</p>
            </div>
            <div className="maydi-chat__header-actions">
              <button type="button" className="maydi-chat__icon-button" aria-label={t('Önceki sohbetler', 'Previous chats')} title={t('Önceki sohbetler', 'Previous chats')} onClick={openHistory} data-testid="assistant-history"><History size={16} /></button>
              <button type="button" className="maydi-chat__icon-button" aria-label={t('Yeni sohbet', 'New chat')} title={t('Yeni sohbet', 'New chat')} onClick={reset}><RotateCcw size={16} /></button>
              <button type="button" className="maydi-chat__icon-button" aria-label={t('Kapat', 'Close')} title={t('Kapat', 'Close')} onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
          </header>

          {view === 'history' ? (
            <div className="maydi-chat__thread maydi-chat__history" data-testid="assistant-history-list">
              {history === null ? <p className="p-3 text-sm text-muted-foreground">{t('Yükleniyor…', 'Loading…')}</p> : null}
              {history?.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t('Bu portalda henüz kayıtlı sohbet yok.', 'No saved chats in this portal yet.')}</p> : null}
              {history?.map((item) => (
                <div key={item.id} className="maydi-chat__history-row">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void loadConversation(item.id)}>
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.lastMessageAtUtc ?? item.createdAtUtc).toLocaleString(english ? 'en-GB' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </button>
                  <button type="button" className="maydi-chat__icon-button" aria-label={t('Sohbeti sil', 'Delete chat')} onClick={() => removeConversation(item.id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={scrollRef} className="maydi-chat__thread" role="log" aria-label={t('Sohbet mesajları', 'Chat messages')}>
              {messages.length === 0 ? (
                <div className="maydi-chat__briefing" data-testid="assistant-briefing">
                  <p className="flex items-center gap-2 font-semibold">
                    <MessageCircle className="h-4 w-4 shrink-0 text-brand-primary" />
                    {briefing?.greeting ?? t(`Merhaba ${firstName}!`, `Hi ${firstName}!`)}
                  </p>
                  {briefing?.items.map((item) => (item.ask ? (
                    <button key={item.text} type="button" onClick={() => void send(item.ask ?? '')}
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-foreground/[0.05]">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone] ?? TONE_DOT.info}`} />
                      <span className="flex-1">{item.text}</span>
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <p key={item.text} className="flex items-start gap-2 px-2 py-1.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone] ?? TONE_DOT.info}`} />
                      <span>{item.text}</span>
                    </p>
                  )))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    {t(student
                      ? 'Bana kendi cümlelerinle sorabilirsin; yalnız kendi portalınla ilgili bilgileri paylaşırım.'
                      : 'Sorunuzu kendi cümlelerinizle yazabilirsiniz; yalnız kendi portalınızla ilgili bilgileri paylaşırım.',
                    'Ask me in your own words — I only answer about your own portal.')}
                  </p>
                </div>
              ) : null}
              {messages.map((message, index) => {
                const day = dayLabel(message.createdAtUtc, english);
                const newDay = day && day !== dayLabel(messages[index - 1]?.createdAtUtc, english);
                return <Fragment key={message.id}>
                  {newDay ? <div className="maydi-chat__day"><span>{day}</span></div> : null}
                  {message.from === 'user' ? (
                    <div className="maydi-chat__user-row">
                      <p className="maydi-chat__bubble maydi-chat__bubble--user">{message.text}</p>
                      <MessageTime timestamp={message.createdAtUtc} english={english} />
                    </div>
                  ) : (
                    <div className="maydi-chat__assistant-row">
                      <MaydiMascot size={30} mood={message.feedback === 1 || message.mascotMood === 'love' ? 'love' : 'idle'} animated={false} className="maydi-chat__message-avatar" />
                      <div className="maydi-chat__message-content">
                        <p className={`maydi-chat__bubble maydi-chat__bubble--assistant ${message.response?.type === 'permission_denied' ? 'maydi-chat__bubble--warning' : ''}`}>{message.text}</p>
                        {message.response ? <div className="maydi-chat__response"><ResponseBody response={message.response} english={english} self={student} onAction={runAction} onPickStudent={pickStudent} /></div> : null}
                        <div className="maydi-chat__message-meta">
                          <MessageTime timestamp={message.createdAtUtc} english={english} />
                          {message.response ? <FeedbackButtons value={message.feedback ?? null} english={english} onRate={(helpful) => rate(message.id, helpful)} /> : null}
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>;
              })}
              {busy ? (
                <div className="maydi-chat__assistant-row" aria-live="polite">
                  <MaydiMascot size={30} mood="thinking" animated={false} />
                  <div className="maydi-chat__typing" role="status">
                    <span className="maydi-chat__typing-dots" aria-hidden="true">{[0, 1, 2].map((dot) => <span key={dot} style={{ animationDelay: `${dot * 150}ms` }} />)}</span>
                    <span>{t('Kayıtlara bakıyorum…', 'Checking the records…')}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {view === 'chat' && focus ? (
            <div className="maydi-chat__focus" data-testid="assistant-focus">
              <Pin className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
              <span className="min-w-0 flex-1 truncate">
                {t('Ekrandaki öğrenci: ', 'Student on screen: ')}<strong>{focus.studentName || t('seçili öğrenci', 'selected student')}</strong>
              </span>
              <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" aria-label={t('Bağlamı kaldır', 'Clear context')} onClick={() => setAssistantFocus(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {view === 'chat' && chips.length > 0 && !busy ? (
            <div className="maydi-chat__suggestions" aria-label={t('Önerilen sorular', 'Suggested questions')}>
              {[...new Set(chips)].map((chip) => {
                const presentation = suggestionPresentation(chip);
                const Icon = presentation.icon;
                return <button key={chip} type="button" title={chip} onClick={() => void send(chip)} className="maydi-chat__suggestion">
                  <Icon size={13} /><span>{presentation.label}</span>
                </button>;
              })}
            </div>
          ) : null}

          <form className="maydi-chat__composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
            <div className="maydi-chat__composer-field">
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000}
                placeholder={t('Maydi’ye sor…', 'Ask Maydi…')} aria-label={t('Mesaj', 'Message')} autoComplete="off" />
              <button type="submit" className="maydi-chat__send" disabled={busy || !input.trim()} aria-label={t('Gönder', 'Send')} title={t('Gönder', 'Send')}><Send size={17} /></button>
            </div>
          </form>
        </section>
      ) : null}
    </>,
    document.body,
  );
}

/** Cevap altında 👍/👎. "İşe yaramadı" işaretleri yöneticinin "Maydi Soruları" listesine düşer. */
function FeedbackButtons({ value, english, onRate }: { value: number | null; english: boolean; onRate: (helpful: boolean) => void }) {
  if (value !== null) {
    return <p className="maydi-chat__feedback-note">{english ? 'Thanks for the feedback.' : 'Geri bildiriminiz için teşekkürler.'}</p>;
  }
  return (
    <div className="maydi-chat__feedback">
      <button type="button" aria-label={english ? 'Helpful' : 'İşe yaradı'} title={english ? 'Helpful' : 'İşe yaradı'} onClick={() => onRate(true)}>
        <ThumbsUp size={13} />
      </button>
      <button type="button" aria-label={english ? 'Not helpful' : 'İşe yaramadı'} title={english ? 'Not helpful' : 'İşe yaramadı'} onClick={() => onRate(false)}>
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}

function ActionButtons({ actions, onAction }: { actions: AssistantActionDto[]; onAction: (action: AssistantActionDto, label: string) => void }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button key={`${action.type}-${action.label}`} type="button" onClick={() => onAction(action, action.label)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${action.type === 'confirm_action' ? 'border-brand-primary bg-brand-primary text-white' : 'bg-background hover:border-brand-primary hover:text-brand-primary'}`}>
          {action.type === 'navigate' ? <ExternalLink className="h-3 w-3" /> : action.type === 'confirm_action' ? <Check className="h-3 w-3" /> : null}
          {action.label}
        </button>
      ))}
    </div>
  );
}

function MiniTable({ rows }: { rows: Array<[string, string, string?]> }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border">
      {rows.map(([left, middle, right], index) => (
        <div key={`${left}-${index}`} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs last:border-b-0">
          <span className="min-w-0 truncate font-medium">{left}</span>
          <span className="shrink-0 text-muted-foreground">{middle}</span>
          {right ? <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{right}</span> : null}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="maydi-chat__stat">
      {Icon ? <Icon size={20} /> : null}
      <div>
        <p className="maydi-chat__stat-label">{label}</p>
        <p className="maydi-chat__stat-value">{value}</p>
      </div>
    </div>
  );
}

/** Yanıt türüne göre kart. Bilinmeyen tür yalnız metin olarak kalır. */
function ResponseBody({ response, english, self, onAction, onPickStudent }: {
  response: AssistantResponseDto;
  english: boolean;
  /** Öğrenci kendi analizine bakıyor: öneriler "sen" diliyle. */
  self: boolean;
  onAction: (action: AssistantActionDto, label: string) => void;
  onPickStudent: (studentId: string, name: string) => void;
}) {
  const data = response.data;
  const items = list(field(data, 'items'));
  let body: JSX.Element | null = null;

  switch (response.type) {
    case 'student_summary':
      body = (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-primary font-bold text-white">{str(field(data, 'fullName')).slice(0, 1)}</div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{str(field(data, 'fullName'))}</p>
            <p className="text-xs text-muted-foreground">{[str(field(data, 'className')), str(field(data, 'studentNumberMasked'))].filter((part) => part && part !== '-').join(' • ')}</p>
          </div>
        </div>
      );
      break;
    case 'student_selection':
    case 'student_list':
      body = items.length === 0 ? null : (
        <div className="overflow-hidden rounded-xl border">
          {items.slice(0, 12).map((item) => {
            const id = str(field(item, 'studentId'));
            const name = str(field(item, 'fullName'));
            const remaining = field(item, 'remaining');
            return (
              <button key={id || name} type="button" onClick={() => id && onPickStudent(id, name)}
                className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-xs transition last:border-b-0 hover:bg-foreground/[0.04]">
                <span className="min-w-0 truncate font-medium">{name}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  {remaining !== undefined ? money(remaining) : str(field(item, 'className'))}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            );
          })}
          {items.length > 12 ? <p className="px-3 py-1.5 text-[11px] text-muted-foreground">{`+${items.length - 12}`}</p> : null}
        </div>
      );
      break;
    case 'attendance_summary':
      body = num(field(data, 'total')) === 0 ? null : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label={english ? 'Records' : 'Kayıt'} value={str(field(data, 'total'))} />
            <Stat label={english ? 'Absent' : 'Devamsız'} value={str(field(data, 'absent'))} />
            <Stat label={english ? 'Late' : 'Geç'} value={str(field(data, 'late'))} />
          </div>
          <MiniTable rows={list(field(data, 'recent')).slice(0, 5).map((row) => [str(field(row, 'lesson')), date(field(row, 'date')), str(field(row, 'status'))])} />
        </div>
      );
      break;
    case 'exam_results':
      body = <MiniTable rows={items.slice(0, 6).map((row) => [`${str(field(row, 'subject'))} — ${str(field(row, 'examTitle'))}`, str(field(row, 'date')), str(field(row, 'score'))])} />;
      break;
    case 'homework_list':
      body = <MiniTable rows={items.slice(0, 6).map((row) => [`${str(field(row, 'subject'))} — ${str(field(row, 'title'))}`, str(field(row, 'deadline'))])} />;
      break;
    case 'schedule': {
      const today = num(field(data, 'today'));
      const todays = items.filter((row) => num(field(row, 'dayOfWeek')) === today);
      const shown = todays.length > 0 ? todays : items;
      body = <MiniTable rows={shown.slice(0, 8).map((row) => [`${str(field(row, 'startTime'))} ${str(field(row, 'lesson'))}`, `${(english ? DAYS_EN : DAYS)[num(field(row, 'dayOfWeek'))] ?? ''} • ${str(field(row, 'className'))}`])} />;
      break;
    }
    case 'announcement_list':
      body = <MiniTable rows={items.slice(0, 5).map((row) => [str(field(row, 'title')), str(field(row, 'date'))])} />;
      break;
    case 'payment_summary':
      body = (
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label={english ? 'Total' : 'Toplam'} value={money(field(data, 'total'))} />
          <Stat label={english ? 'Paid' : 'Ödenen'} value={money(field(data, 'paid'))} />
          <Stat label={english ? 'Remaining' : 'Kalan'} value={money(field(data, 'remaining'))} />
        </div>
      );
      break;
    case 'library_loans':
      body = <MiniTable rows={items.slice(0, 6).map((row) => [str(field(row, 'title')), str(field(row, 'deadline')), str(field(row, 'status'))])} />;
      break;
    case 'finance_overview':
      body = (
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label={english ? 'Collected' : 'Tahsil edilen'} value={money(field(data, 'collectedThisMonth'))} />
          <Stat label={english ? 'Open debt' : 'Açık borç'} value={money(field(data, 'openDebt'))} />
          <Stat label={english ? 'Overdue' : 'Vadesi geçen'} value={str(field(data, 'overdueInstallments'))} />
        </div>
      );
      break;
    case 'institution_summary':
      body = (
        <div className="maydi-chat__summary" data-testid="assistant-summary">
          <p className="maydi-chat__summary-title"><BarChart3 size={15} />{english ? 'Institution summary' : 'Kurum özeti'}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {list(field(data, 'metrics')).map((metric) => {
              const label = str(field(metric, 'label'));
              return <Stat key={label} label={label} value={str(field(metric, 'value'))} icon={metricIcon(label)} />;
            })}
          </div>
        </div>
      );
      break;
    case 'topic_insight':
      body = (
        <div className="space-y-1.5">
          {list(field(data, 'weakTopics')).map((topic) => {
            const diagnosis = diagnosisOf(str(field(topic, 'diagnosis')));
            const priority = num(field(topic, 'priority'));
            const plan = questionPlan(num(field(topic, 'suggestedQuestions')));
            return (
              <div key={`${str(field(topic, 'subject'))}-${str(field(topic, 'topic'))}`} className="rounded-xl border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{priority > 0 ? `${priority}. ` : ''}{str(field(topic, 'topic'))}</p>
                    <p className="text-[11px] text-muted-foreground">{`${str(field(topic, 'subject'))} • ${formatPct(num(field(topic, 'successRate')))}`}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${diagnosis.tone}`}>{diagnosis.label}</span>
                </div>
                <p className="mt-1 text-xs">{self ? diagnosis.selfAdvice : diagnosis.advice}</p>
                {plan ? <p className="mt-0.5 text-xs font-medium">{plan}</p> : null}
                {num(field(topic, 'solved')) > 0 ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{`Neden: ${topicReason({ solved: num(field(topic, 'solved')), wrong: num(field(topic, 'wrong')), blank: num(field(topic, 'blank')), successRate: num(field(topic, 'successRate')) })}`}</p>
                ) : null}
              </div>
            );
          })}
          {list(field(data, 'strongTopics')).length > 0 ? (
            <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <Trophy className="h-3 w-3 text-emerald-600" />
              {list(field(data, 'strongTopics')).map((topic) => <span key={str(field(topic, 'topic'))} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">{str(field(topic, 'topic'))}</span>)}
            </p>
          ) : null}
        </div>
      );
      break;
    case 'report':
      body = <AssistantReportCard messageId={response.messageId} data={data} english={english} />;
      break;
    case 'how_to':
      body = (
        <ol className="space-y-1.5 rounded-xl border p-3 text-sm">
          {list(field(data, 'steps')).map((step, index) => (
            <li key={str(step)} className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-primary text-[11px] font-bold text-white">{index + 1}</span>
              <span>{str(step)}</span>
            </li>
          ))}
        </ol>
      );
      break;
    case 'transport_status': {
      const route = field(data, 'route');
      body = route ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label={english ? 'Route' : 'Hat'} value={str(field(route, 'routeName'))} />
          <Stat label={english ? 'Stop' : 'Durak'} value={str(field(route, 'stopName'))} />
        </div>
      ) : null;
      break;
    }
    default:
      body = null;
  }

  return (
    <>
      {body}
      <ActionButtons actions={response.actions} onAction={onAction} />
    </>
  );
}
