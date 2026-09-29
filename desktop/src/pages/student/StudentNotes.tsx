import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, Search, RefreshCw, Save, Cloud, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchContents, fetchMyContentEngagement, saveContentUserState } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { ContentDto, MyContentStateDto } from '../../types/api/generated';

type NoteRow = MyContentStateDto & { content: ContentDto };

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function StudentNotes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contents, setContents] = useState<ContentDto[]>([]);
  const [states, setStates] = useState<MyContentStateDto[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
  const [savingId, setSavingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [contentList, engagement] = await Promise.all([
        fetchContents(true),
        fetchMyContentEngagement().catch(() => []),
      ]);
      setContents(Array.isArray(contentList) ? contentList : []);
      setStates(Array.isArray(engagement) ? engagement : []);
      setLastSync(new Date());
    } catch (err) {
      setError(errorMessage(err, 'Notlar alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const notes = useMemo((): NoteRow[] => {
    const contentById = new Map(contents.map((item) => [String(item.id).toLowerCase(), item]));
    return states
      .filter((item) => String(item.note || '').trim().length > 0)
      .flatMap((item) => {
        const content = contentById.get(String(item.contentId).toLowerCase());
        return content ? [{ ...item, content }] : [];
      })
      .sort((a, b) => new Date(b.updatedAtUtc).getTime() - new Date(a.updatedAtUtc).getTime());
  }, [contents, states]);

  const visible = useMemo(() => notes.filter((item) => {
    const haystack = `${item.content.title} ${item.content.subject} ${item.note}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [notes, search]);

  const totalWords = useMemo(() => notes.reduce((sum, item) => sum + String(item.note || '').trim().split(/\s+/).filter(Boolean).length, 0), [notes]);

  const draftFor = (item: NoteRow): string => drafts[item.contentId] ?? item.note;

  const saveNote = async (item: NoteRow) => {
    const next = draftFor(item);
    setSavingId(item.contentId);
    try {
      await saveContentUserState(item.contentId, {
        progress: Number(item.progress || 0),
        liked: Boolean(item.liked),
        favorite: Boolean(item.favorite),
        note: String(next || ''),
      });
      setStates((prev) => prev.map((entry) => (entry.contentId === item.contentId ? { ...entry, note: next, updatedAtUtc: new Date().toISOString() } : entry)));
      setDrafts((prev) => { const copy = { ...prev }; delete copy[item.contentId]; return copy; });
      setLastSync(new Date());
      toast({ title: 'Not senkronize edildi', description: 'Notun tüm cihazlarına kaydedildi.' });
    } catch (err) {
      toast({ title: 'Not kaydedilemedi', description: errorMessage(err, 'Tekrar deneyin.'), variant: 'destructive' });
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Notların senkronize ediliyor...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="student-notes-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-600 text-white"><NotebookPen className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Notlarım</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cloud className="h-3.5 w-3.5 text-emerald-400" /> Bulutla senkron{lastSync ? ` • Son: ${formatDate(lastSync)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Yenile</Button>
          <Button variant="outline" onClick={() => navigate('/s/content')}>İçerikler <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Notlar yüklenemedi" message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['Toplam Not', notes.length],
          ['Kelime', totalWords],
          ['İçerik', contents.length],
          ['Senkron', 'Aktif'],
        ] satisfies ReadonlyArray<readonly [string, string | number]>).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
            <p className="text-2xl font-black tracking-tight">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Notlarda ara..." className="h-11 rounded-xl pl-9" />
      </div>

      {visible.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((item) => {
            const dirty = drafts[item.contentId] !== undefined && drafts[item.contentId] !== item.note;
            return (
              <div key={item.contentId} className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.content.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.content.subject}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(item.updatedAtUtc)}</span>
                </div>
                <Textarea
                  className="min-h-[110px] rounded-xl"
                  value={draftFor(item)}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [item.contentId]: event.target.value }))}
                />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {dirty ? <span className="text-amber-400">Kaydedilmemiş değişiklik</span> : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Senkron</>}
                  </span>
                  <Button size="sm" disabled={!dirty || savingId === item.contentId} onClick={() => saveNote(item)}>
                    <Save className="mr-1 h-4 w-4" /> {savingId === item.contentId ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-foreground/10 p-12 text-center">
          <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Henüz not almadın</p>
          <p className="mt-1 text-sm text-muted-foreground">Bir içeriği açıp “Ders Notları” sekmesinden not aldığında burada toplanır ve senkronlanır.</p>
          <Button className="mt-4" onClick={() => navigate('/s/content')}>İçeriklere Git</Button>
        </div>
      )}
    </motion.div>
  );
}
