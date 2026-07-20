import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, ChevronLeft, History, Loader2, MessageCircle, Plus, Send, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { assistantApi } from './assistantApi';

const welcome = { id: 'welcome', sender: 'assistant', type: 'text', text: 'Merhaba! Yetkiniz kapsamındaki okul, dershane ve sürücü kursu bilgilerine güvenli biçimde ulaşmanıza yardımcı olabilirim.' };
const errorText = (error) => error?.status === 429 ? 'Çok hızlı mesaj gönderdiniz. Lütfen kısa bir süre bekleyin.' : error?.message || 'Asistan servisine ulaşılamıyor.';

function StructuredData({ message, onAction }) {
  const data = message.data;
  if (!data) return null;
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.recent) ? data.recent : [];
  return <div className="mt-3 space-y-2">
    {data.fullName && <div className="rounded-xl border bg-background/80 p-3"><b>{data.fullName}</b>{data.className && <span className="text-muted-foreground"> · {data.className}</span>}{data.driving && <div className="mt-2 rounded-lg bg-[hsl(var(--brand-accent)/0.12)] p-2 text-xs">Ehliyet: {data.driving.licenseClass || '-'} · Kalan: {data.driving.remainingDrivingMinutes ?? Math.max(0, (data.driving.purchasedDrivingMinutes || 0) - (data.driving.usedDrivingMinutes || 0))} dk</div>}</div>}
    {typeof data.remaining === 'number' && <div className="rounded-xl border bg-background/80 p-3">Kalan ödeme: <b>{data.remaining.toLocaleString('tr-TR')} ₺</b></div>}
    {items.slice(0, 15).map((item, index) => <button key={item.id || item.studentId || index} type="button" onClick={() => item.studentId && onAction('get_attendance', item.studentId)} className={`w-full rounded-xl border bg-background/80 p-3 text-left text-xs ${item.studentId ? 'hover:border-[hsl(var(--brand-accent))]' : ''}`}><div className="font-semibold text-foreground">{item.fullName || item.title || item.examTitle || item.lesson || item.label || `Kayıt ${index + 1}`}</div><div className="mt-1 text-muted-foreground">{[item.className, item.subject, item.status, item.date, item.deadline, item.startsAt, item.score != null ? `${item.score} puan` : null, item.remaining != null ? `${item.remaining} ₺` : null].filter(Boolean).join(' · ')}</div></button>)}
    {message.actions?.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{message.actions.map((item, index) => <button key={index} type="button" onClick={() => onAction(item.command, item.parameters?.studentId, item.route)} className="rounded-full border border-[hsl(var(--brand-accent)/0.4)] bg-[hsl(var(--brand-accent)/0.12)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--brand-accent-text))] transition-colors hover:bg-[hsl(var(--brand-accent)/0.2)]">{item.label}</button>)}</div>}
  </div>;
}

export function AssistantPanel({ onClose, fullPage = false }) {
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([welcome]);
  const [suggestions, setSuggestions] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [history, setHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const refreshHistory = () => assistantApi.conversations().then(setConversations).catch(() => {});
  useEffect(() => { assistantApi.suggestions().then(setSuggestions).catch(() => setError('Hazır komutlar yüklenemedi. Mesaj yazmaya devam edebilirsiniz.')); refreshHistory(); }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading]);

  const newChat = () => { setConversationId(null); setMessages([welcome]); setHistory(false); setError(''); };
  const openChat = async (id) => { setLoading(true); try { const rows = await assistantApi.messages(id); setConversationId(id); setMessages(rows.length ? rows : [welcome]); setHistory(false); } catch (e) { setError(errorText(e)); } finally { setLoading(false); } };
  const send = async (preset) => {
    const text = (typeof preset === 'string' ? preset : input).trim();
    if (!text || loading) return;
    setMessages((old) => [...old, { id: `local-${Date.now()}`, sender: 'user', type: 'text', text }]); setInput(''); setLoading(true); setError('');
    try { const response = await assistantApi.send(conversationId, text); setConversationId(response.conversationId); setMessages((old) => [...old, { ...response, sender: 'assistant' }]); refreshHistory(); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  };
  const action = async (command, studentId, route) => {
    if (route) { navigate(route); onClose?.(); return; }
    if (!command || !conversationId || loading) return;
    setLoading(true); setError('');
    try { const response = await assistantApi.action(conversationId, command, studentId); setMessages((old) => [...old, { ...response, sender: 'assistant' }]); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  };
  const remove = async (id) => { await assistantApi.remove(id); setConversations((old) => old.filter((x) => x.id !== id)); if (id === conversationId) newChat(); };

  // Başlıktaki ikon butonları aynı davranışa sahip; sınıfı tek yerde tutuyoruz.
  const headerButton = 'grid h-9 w-9 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return <section className={`flex flex-col overflow-hidden bg-background ${fullPage ? 'h-[calc(100vh-145px)] rounded-2xl border shadow-xl' : 'h-full'}`} aria-label="SchoolAsist Asistan">
    <header className="flex items-center gap-3 bg-[hsl(var(--brand-primary))] px-4 py-3.5 text-white">
      {history && <button type="button" onClick={() => setHistory(false)} className={headerButton} aria-label="Geri"><ChevronLeft className="h-5 w-5" /></button>}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent))] shadow-sm"><Bot className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-bold tracking-tight">SchoolAsist Asistan</h2>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/70"><ShieldCheck className="h-3 w-3 shrink-0" />Kural tabanlı · Güvenli erişim</p>
      </div>
      <button type="button" onClick={() => setHistory((x) => !x)} className={headerButton} aria-label="Geçmiş" aria-pressed={history}><History className="h-[18px] w-[18px]" /></button>
      <button type="button" onClick={newChat} className={headerButton} aria-label="Yeni sohbet"><Plus className="h-[18px] w-[18px]" /></button>
      {onClose && <button type="button" onClick={onClose} className={headerButton} aria-label="Kapat"><X className="h-[18px] w-[18px]" /></button>}
    </header>
    {history ? <div className="flex-1 overflow-y-auto p-4"><h3 className="mb-3 font-semibold">Sohbet geçmişi</h3>{conversations.length === 0 && <p className="text-sm text-muted-foreground">Henüz sohbet yok.</p>}{conversations.map((row) => <div key={row.id} className="mb-2 flex rounded-xl border"><button type="button" onClick={() => openChat(row.id)} className="min-w-0 flex-1 p-3 text-left"><div className="truncate text-sm font-medium">{row.title}</div><div className="text-xs text-muted-foreground">{new Date(row.lastMessageAtUtc || row.createdAtUtc).toLocaleString('tr-TR')}</div></button><button type="button" onClick={() => remove(row.id)} className="p-3 text-muted-foreground hover:text-red-500" aria-label="Sil"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <>
      <div className="flex-1 overflow-y-auto bg-muted/20 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isUser = message.sender === 'user';
            const isError = message.type === 'error' || message.type === 'permission_denied';
            return <div key={message.id || message.messageId} className={`flex gap-2.5 ${isUser ? 'justify-end' : ''}`}>
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-sm ${isUser ? 'order-2 bg-[hsl(var(--brand-primary-text))]' : 'bg-[hsl(var(--brand-accent))]'}`}>
                {isUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                isUser ? 'rounded-tr-sm bg-[hsl(var(--brand-primary-text))] text-white'
                  : isError ? 'rounded-tl-sm border border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100'
                    : 'rounded-tl-sm border bg-background'}`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <StructuredData message={message} onAction={action} />
              </div>
            </div>;
          })}
          {loading && <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--brand-accent))]" />Bilgiler güvenli biçimde kontrol ediliyor…</div>}
          <div ref={endRef} />
        </div>
      </div>
      <footer className="border-t bg-background p-3">
        {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
        {messages.length <= 2 && <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{suggestions.slice(0, 8).map((item) => <button key={item.label} type="button" onClick={() => send(item.label)} className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--brand-accent))] hover:text-foreground">{item.label}</button>)}</div>}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
            rows={1}
            maxLength={1000}
            placeholder="Bir komut yazın…"
            aria-label="Asistana mesaj"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-[hsl(var(--brand-accent))] focus:ring-1 focus:ring-[hsl(var(--brand-accent)/0.35)]"
          />
          <button
            type="button"
            disabled={!input.trim() || loading}
            onClick={() => send()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent))] text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent))] focus-visible:ring-offset-2"
            aria-label="Gönder"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Doğrudan SQL ve harici yapay zekâ kullanılmaz.</p>
      </footer>
    </>}
  </section>;
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  // Açıkken Escape kapatsın ve arkadaki sayfa kaymasın.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // DİKKAT: Portal şart. `.app-shell > *` kuralı (index.css) her doğrudan
  // çocuğa `position: relative` dayatiyor ve Tailwind'in `fixed` sınıfını
  // ezdiği için buton flex akışına dönüp tam boy uzuyordu; panelin arka planı
  // da tam ekran kaplayamadığı için panel görünmez oluyordu. body'ye taşıyoruz.
  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Asistanı aç"
        aria-expanded={open}
        aria-controls="schoolasist-assistant-panel"
        className={`group fixed bottom-6 right-6 z-[60] inline-flex h-14 items-center gap-2.5 rounded-full
          bg-[hsl(var(--brand-accent))] pl-4 pr-4 text-white
          shadow-[0_8px_24px_hsl(var(--brand-accent)/0.35),0_2px_6px_hsl(0_0%_0%/0.12)]
          ring-1 ring-white/20 transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-[0_12px_32px_hsl(var(--brand-accent)/0.45),0_3px_8px_hsl(0_0%_0%/0.16)]
          active:translate-y-0 active:scale-[0.97]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-background
          motion-reduce:transition-none motion-reduce:hover:translate-y-0
          ${open ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'}`}
      >
        <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2.2} />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Asistan</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px] animate-in fade-in duration-200"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <aside
            id="schoolasist-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-label="SchoolAsist Asistan"
            className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l bg-background
              shadow-[-8px_0_40px_hsl(0_0%_0%/0.18)]
              animate-in slide-in-from-right duration-300 motion-reduce:animate-none"
          >
            <AssistantPanel onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>,
    document.body,
  );
}
