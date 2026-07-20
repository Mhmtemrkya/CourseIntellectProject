import { useEffect, useRef, useState } from 'react';
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
    {data.fullName && <div className="rounded-xl border bg-background/80 p-3"><b>{data.fullName}</b>{data.className && <span className="text-muted-foreground"> · {data.className}</span>}{data.driving && <div className="mt-2 rounded-lg bg-orange-500/10 p-2 text-xs">Ehliyet: {data.driving.licenseClass || '-'} · Kalan: {data.driving.remainingDrivingMinutes ?? Math.max(0, (data.driving.purchasedDrivingMinutes || 0) - (data.driving.usedDrivingMinutes || 0))} dk</div>}</div>}
    {typeof data.remaining === 'number' && <div className="rounded-xl border bg-background/80 p-3">Kalan ödeme: <b>{data.remaining.toLocaleString('tr-TR')} ₺</b></div>}
    {items.slice(0, 15).map((item, index) => <button key={item.id || item.studentId || index} type="button" onClick={() => item.studentId && onAction('get_attendance', item.studentId)} className={`w-full rounded-xl border bg-background/80 p-3 text-left text-xs ${item.studentId ? 'hover:border-orange-400' : ''}`}><div className="font-semibold text-foreground">{item.fullName || item.title || item.examTitle || item.lesson || item.label || `Kayıt ${index + 1}`}</div><div className="mt-1 text-muted-foreground">{[item.className, item.subject, item.status, item.date, item.deadline, item.startsAt, item.score != null ? `${item.score} puan` : null, item.remaining != null ? `${item.remaining} ₺` : null].filter(Boolean).join(' · ')}</div></button>)}
    {message.actions?.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{message.actions.map((item, index) => <button key={index} type="button" onClick={() => onAction(item.command, item.parameters?.studentId, item.route)} className="rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-300">{item.label}</button>)}</div>}
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

  return <section className={`flex flex-col overflow-hidden bg-background ${fullPage ? 'h-[calc(100vh-145px)] rounded-2xl border shadow-xl' : 'h-full'}`} aria-label="SchoolAsist Asistan">
    <header className="flex items-center gap-3 border-b bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white">
      {history && <button type="button" onClick={() => setHistory(false)} aria-label="Geri"><ChevronLeft /></button>}
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20"><Bot /></span>
      <div className="min-w-0 flex-1"><h2 className="font-bold">SchoolAsist Asistan</h2><p className="flex items-center gap-1 text-xs text-white/85"><ShieldCheck className="h-3 w-3" />Kural tabanlı · Güvenli erişim</p></div>
      <button type="button" onClick={() => setHistory((x) => !x)} className="rounded-lg p-2 hover:bg-white/15" aria-label="Geçmiş"><History className="h-5 w-5" /></button>
      <button type="button" onClick={newChat} className="rounded-lg p-2 hover:bg-white/15" aria-label="Yeni sohbet"><Plus className="h-5 w-5" /></button>
      {onClose && <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/15" aria-label="Kapat"><X className="h-5 w-5" /></button>}
    </header>
    {history ? <div className="flex-1 overflow-y-auto p-4"><h3 className="mb-3 font-semibold">Sohbet geçmişi</h3>{conversations.length === 0 && <p className="text-sm text-muted-foreground">Henüz sohbet yok.</p>}{conversations.map((row) => <div key={row.id} className="mb-2 flex rounded-xl border"><button type="button" onClick={() => openChat(row.id)} className="min-w-0 flex-1 p-3 text-left"><div className="truncate text-sm font-medium">{row.title}</div><div className="text-xs text-muted-foreground">{new Date(row.lastMessageAtUtc || row.createdAtUtc).toLocaleString('tr-TR')}</div></button><button type="button" onClick={() => remove(row.id)} className="p-3 text-muted-foreground hover:text-red-500" aria-label="Sil"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <>
      <div className="flex-1 overflow-y-auto p-4"><div className="space-y-4">{messages.map((message) => <div key={message.id || message.messageId} className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : ''}`}><span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${message.sender === 'user' ? 'order-2 bg-blue-500' : 'bg-orange-500'} text-white`}>{message.sender === 'user' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</span><div className={`max-w-[84%] rounded-2xl p-3 text-sm ${message.sender === 'user' ? 'bg-blue-500 text-white' : message.type === 'error' || message.type === 'permission_denied' ? 'border border-red-300 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100' : 'border bg-muted/40'}`}><p className="whitespace-pre-wrap leading-relaxed">{message.text}</p><StructuredData message={message} onAction={action} /></div></div>)}{loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-orange-500" />Bilgiler güvenli biçimde kontrol ediliyor…</div>}<div ref={endRef} /></div></div>
      <footer className="border-t p-3">{error && <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</div>}{messages.length <= 2 && <div className="mb-3 flex gap-2 overflow-x-auto">{suggestions.slice(0, 8).map((item) => <button key={item.label} type="button" onClick={() => send(item.label)} className="shrink-0 rounded-full border px-3 py-2 text-xs hover:border-orange-400">{item.label}</button>)}</div>}<div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} maxLength={1000} placeholder="Bir komut yazın…" className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-orange-500" /><button type="button" disabled={!input.trim() || loading} onClick={send} className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-white disabled:opacity-40" aria-label="Gönder"><Send className="h-5 w-5" /></button></div><p className="mt-2 text-center text-[10px] text-muted-foreground">Doğrudan SQL ve harici yapay zekâ kullanılmaz.</p></footer>
    </>}
  </section>;
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 font-semibold text-white shadow-2xl" aria-label="Asistanı aç"><MessageCircle className="h-5 w-5" /><span className="hidden sm:inline">Asistan</span></button>{open && <div className="fixed inset-0 z-50 bg-black/35" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><aside className="absolute inset-y-0 right-0 w-full max-w-[470px] bg-background shadow-2xl"><AssistantPanel onClose={() => setOpen(false)} /></aside></div>}</>;
}
