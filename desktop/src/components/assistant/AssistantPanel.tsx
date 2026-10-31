import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Check, ExternalLink, History, MessageCircle, Pin, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, Trophy, X } from 'lucide-react';
import { Button } from '../ui/button';
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
import { clearStaleAssistantFocus, setAssistantFocus, useAssistantFocusValue } from '../../lib/assistantFocus';
import { errorMessage, isRecord } from '../../lib/errors';
import { diagnosisOf, formatPct } from '../../lib/insights';
import type {
  AssistantActionDto,
  AssistantBriefingDto,
  AssistantClientContext,
  AssistantConversationDto,
  AssistantMessageDto,
  AssistantResponseDto,
} from '../../types/api/generated';

interface ChatMessage { id: string; from: 'user' | 'assistant'; text: string; response?: AssistantResponseDto; feedback?: number | null }

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
const TONE_DOT: Record<string, string> = { warn: 'bg-amber-500', good: 'bg-emerald-500', info: 'bg-brand-primary' };

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
  if (message.sender === 'user') return { id: message.id, from: 'user', text: message.text };
  return {
    id: message.id,
    from: 'assistant',
    text: message.text,
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
 * SchoolAsist Asistan: her sayfadan açılan sohbet paneli. Cevaplar sunucudaki konuşma
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, portal, language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const push = useCallback((response: AssistantResponseDto | null) => {
    if (!response) return;
    setConversationId(response.conversationId);
    setMessages((current) => [...current, { id: response.messageId, from: 'assistant', text: response.text, response }]);
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setView('chat');
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'user', text: message }]);
    setBusy(true);
    try {
      push(await sendAssistantMessage(conversationId, message, context));
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'assistant', text: errorMessage(error) }]);
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
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'user', text: label }]);
    setBusy(true);
    try {
      push(await runAssistantAction(conversationId, action.command, studentId, context));
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), from: 'assistant', text: errorMessage(error) }]);
    } finally {
      setBusy(false);
    }
  }, [busy, context, conversationId, navigate, push]);

  const pickStudent = useCallback((studentId: string, name: string) => {
    void runAction({ type: 'send_command', label: name, route: null, command: 'summary', parameters: { studentId } }, name);
  }, [runAction]);

  const rate = useCallback((messageId: string, helpful: boolean) => {
    setMessages((current) => current.map((item) => (item.id === messageId ? { ...item, feedback: helpful ? 1 : -1 } : item)));
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

  return createPortal(
    <>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} data-testid="assistant-launcher"
          aria-label={t('Asistanı aç', 'Open assistant')}
          className="pointer-events-auto fixed bottom-5 right-5 z-[60] flex h-14 items-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-semibold text-white shadow-[0_18px_40px_-12px_hsl(var(--brand-primary)/0.7)] transition hover:scale-[1.03]">
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">{t('Asistan', 'Assistant')}</span>
        </button>
      ) : null}

      {open ? (
        <section role="dialog" aria-label={t('SchoolAsist Asistan', 'SchoolAsist Assistant')} data-testid="assistant-panel"
          className="pointer-events-auto fixed inset-x-2 bottom-2 top-16 z-[60] flex flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[min(640px,calc(100vh-6rem))] sm:w-[420px]">
          <header className="flex items-center gap-2 border-b bg-gradient-to-r from-brand-primary/15 to-transparent px-4 py-3">
            {view === 'history' ? (
              <Button size="icon" variant="ghost" aria-label={t('Sohbete dön', 'Back to chat')} onClick={() => setView('chat')}><ArrowLeft className="h-4 w-4" /></Button>
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-primary text-white"><Bot className="h-5 w-5" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">{view === 'history' ? t('Önceki sohbetler', 'Previous chats') : `SchoolAsist ${t('Asistan', 'Assistant')}`}</p>
              <p className="text-xs text-muted-foreground">{busy ? t('yazıyor…', 'typing…') : t('Çevrimiçi', 'Online')}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label={t('Önceki sohbetler', 'Previous chats')} title={t('Önceki sohbetler', 'Previous chats')} onClick={openHistory} data-testid="assistant-history">
              <History className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label={t('Yeni sohbet', 'New chat')} title={t('Yeni sohbet', 'New chat')} onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label={t('Kapat', 'Close')} onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
          </header>

          {view === 'history' ? (
            <div className="flex-1 overflow-y-auto p-3" data-testid="assistant-history-list">
              {history === null ? <p className="p-3 text-sm text-muted-foreground">{t('Yükleniyor…', 'Loading…')}</p> : null}
              {history?.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t('Bu portalda henüz kayıtlı sohbet yok.', 'No saved chats in this portal yet.')}</p> : null}
              {history?.map((item) => (
                <div key={item.id} className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-foreground/[0.05]">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void loadConversation(item.id)}>
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.lastMessageAtUtc ?? item.createdAtUtc).toLocaleString(english ? 'en-GB' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 opacity-60 group-hover:opacity-100" aria-label={t('Sohbeti sil', 'Delete chat')} onClick={() => removeConversation(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="space-y-2 rounded-2xl bg-foreground/[0.04] p-4 text-sm" data-testid="assistant-briefing">
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
              {messages.map((message) => (message.from === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-primary px-3.5 py-2 text-sm text-white">{message.text}</p>
                </div>
              ) : (
                <div key={message.id} className="flex gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-primary/15 text-brand-primary"><Bot className="h-4 w-4" /></div>
                  <div className="min-w-0 max-w-[88%] flex-1 space-y-2">
                    <p className={`w-fit max-w-full rounded-2xl rounded-tl-md px-3.5 py-2 text-sm leading-relaxed ${message.response?.type === 'permission_denied' ? 'bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'bg-foreground/[0.06]'}`}>{message.text}</p>
                    {message.response ? <ResponseBody response={message.response} english={english} self={student} onAction={runAction} onPickStudent={pickStudent} /> : null}
                    {message.response ? <FeedbackButtons value={message.feedback ?? null} english={english} onRate={(helpful) => rate(message.id, helpful)} /> : null}
                  </div>
                </div>
              )))}
              {busy ? (
                <div className="flex gap-2" aria-live="polite">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-primary/15 text-brand-primary"><Bot className="h-4 w-4" /></div>
                  <div className="flex items-center gap-1 rounded-2xl bg-foreground/[0.06] px-3.5 py-3">
                    {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 150}ms` }} />)}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {view === 'chat' && focus ? (
            <div className="flex items-center gap-2 border-t bg-brand-primary/[0.06] px-3 py-1.5 text-xs" data-testid="assistant-focus">
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
            <div className="flex gap-1.5 overflow-x-auto border-t px-3 py-2">
              {chips.map((chip) => (
                <button key={chip} type="button" onClick={() => void send(chip)}
                  className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-brand-primary hover:text-brand-primary">
                  {chip}
                </button>
              ))}
            </div>
          ) : null}

          <form className="flex items-center gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000}
              placeholder={english ? 'Ask something…' : student ? 'Bir şey sor…' : 'Sorunuzu yazın…'} aria-label={t('Mesaj', 'Message')}
              className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-brand-primary" />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={busy || !input.trim()} aria-label={t('Gönder', 'Send')}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      ) : null}
    </>,
    document.body,
  );
}

/** Cevap altında 👍/👎. "İşe yaramadı" işaretleri yöneticinin "Asistan Soruları" listesine düşer. */
function FeedbackButtons({ value, english, onRate }: { value: number | null; english: boolean; onRate: (helpful: boolean) => void }) {
  if (value !== null) {
    return <p className="text-[11px] text-muted-foreground">{english ? 'Thanks for the feedback.' : 'Geri bildiriminiz için teşekkürler.'}</p>;
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <button type="button" className="rounded-full p-1 transition hover:bg-foreground/[0.06] hover:text-emerald-600" aria-label={english ? 'Helpful' : 'İşe yaradı'} title={english ? 'Helpful' : 'İşe yaradı'} onClick={() => onRate(true)}>
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded-full p-1 transition hover:bg-foreground/[0.06] hover:text-rose-600" aria-label={english ? 'Not helpful' : 'İşe yaramadı'} title={english ? 'Not helpful' : 'İşe yaramadı'} onClick={() => onRate(false)}>
        <ThumbsDown className="h-3.5 w-3.5" />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.05] px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
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
        <div className="grid grid-cols-2 gap-1.5">
          {list(field(data, 'metrics')).map((metric) => <Stat key={str(field(metric, 'label'))} label={str(field(metric, 'label'))} value={str(field(metric, 'value'))} />)}
        </div>
      );
      break;
    case 'topic_insight':
      body = (
        <div className="space-y-1.5">
          {list(field(data, 'weakTopics')).map((topic) => {
            const diagnosis = diagnosisOf(str(field(topic, 'diagnosis')));
            return (
              <div key={`${str(field(topic, 'subject'))}-${str(field(topic, 'topic'))}`} className="rounded-xl border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{str(field(topic, 'topic'))}</p>
                    <p className="text-[11px] text-muted-foreground">{`${str(field(topic, 'subject'))} • ${formatPct(num(field(topic, 'successRate')))}`}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${diagnosis.tone}`}>{diagnosis.label}</span>
                </div>
                <p className="mt-1 text-xs">{self ? diagnosis.selfAdvice : diagnosis.advice}</p>
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
