import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, Play, Video, FileText, ArrowRight, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchContents, fetchMyContentEngagement, saveContentUserState } from '../../lib/api/modules';

const SUBJECT_TONES = ['from-sky-400 to-blue-600', 'from-violet-400 to-fuchsia-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-red-600', 'from-cyan-400 to-blue-500'];

function normalizeType(value = '') {
  const text = String(value).toLowerCase();
  if (text.includes('video')) return 'video';
  if (text.includes('pdf')) return 'pdf';
  return 'file';
}

export default function StudentFavorites() {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Tümü');

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
    } catch (err) {
      setError(err.message || 'Favoriler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const favorites = useMemo(() => {
    const favIds = new Set(states.filter((item) => item.favorite).map((item) => String(item.contentId).toLowerCase()));
    const stateById = new Map(states.map((item) => [String(item.contentId).toLowerCase(), item]));
    return contents
      .filter((item) => favIds.has(String(item.id).toLowerCase()))
      .map((item) => ({ ...item, userState: stateById.get(String(item.id).toLowerCase()) }));
  }, [contents, states]);

  const subjects = useMemo(() => ['Tümü', ...new Set(favorites.map((item) => item.subject).filter(Boolean))], [favorites]);

  const visible = useMemo(() => favorites.filter((item) => {
    const matchesSearch = `${item.title} ${item.subject} ${item.teacher}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = subject === 'Tümü' || item.subject === subject;
    return matchesSearch && matchesSubject;
  }), [favorites, search, subject]);

  const removeFavorite = async (item) => {
    const state = item.userState || {};
    setStates((prev) => prev.map((entry) => (String(entry.contentId).toLowerCase() === String(item.id).toLowerCase() ? { ...entry, favorite: false } : entry)));
    await saveContentUserState(item.id, {
      progress: Number(state.progress || item.progress || 0),
      liked: Boolean(state.liked),
      favorite: false,
      note: String(state.note || ''),
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Favori konuların yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="student-favorites-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white"><Star className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Favori Konularım</h1>
            <p className="text-sm text-muted-foreground">Yıldızladığın içeriklere buradan hızlıca ulaş.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/s/content')}>Tüm İçerikler <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
      </div>

      {error ? <ErrorBanner title="Favoriler yüklenemedi" message={error} onRetry={load} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Favorilerde ara..." className="h-11 rounded-xl pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {subjects.map((item) => (
            <button key={item} type="button" onClick={() => setSubject(item)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${subject === item ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/[0.05]'}`}>{item}</button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item, index) => {
            const type = normalizeType(item.fileType);
            const progress = Math.round(Number(item.userState?.progress ?? item.progress ?? 0));
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.035]">
                <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${SUBJECT_TONES[index % SUBJECT_TONES.length]}`}>
                  {type === 'video' ? <Video className="h-9 w-9 text-white" /> : <FileText className="h-9 w-9 text-white" />}
                  <button type="button" onClick={() => removeFavorite(item)} title="Favoriden çıkar" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/30 text-amber-200 backdrop-blur hover:bg-black/50">
                    <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subject}{item.teacher ? ` • ${item.teacher}` : ''}</p>
                  {progress > 0 ? (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]" style={{ width: `${progress}%` }} /></div>
                  ) : null}
                  <Button size="sm" className="mt-auto w-full" onClick={() => navigate('/s/content')}><Play className="mr-1 h-4 w-4" /> Aç</Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-foreground/10 p-12 text-center">
          <Star className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Henüz favori konun yok</p>
          <p className="mt-1 text-sm text-muted-foreground">İçerik sayfasında bir konuyu yıldızladığında burada görünür.</p>
          <Button className="mt-4" onClick={() => navigate('/s/content')}>İçeriklere Git</Button>
        </div>
      )}
    </motion.div>
  );
}
