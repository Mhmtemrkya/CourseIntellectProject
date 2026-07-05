import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPen, Search } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchGuidanceOverview, fetchGuidanceStudentFile } from '../../lib/api/modules';

const TOPIC_LABELS = {
  motivasyon: 'Motivasyon',
  'sinav-kaygisi': 'Sınav Kaygısı',
  aile: 'Aile',
  arkadas: 'Arkadaş İlişkileri',
  akademik: 'Akademik',
  diger: 'Diğer',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Tüm öğrencilerin görüşme kayıtlarını dosyalarından toplayıp tek listede sunar.
export default function GuidanceSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const students = await fetchGuidanceOverview();
      // Görüşmesi olabilecek öğrencileri paralel ama sınırlı şekilde çek.
      const withSessions = students.filter((s) => s.lastSessionAtUtc);
      const files = await Promise.all(
        withSessions.slice(0, 40).map((s) => fetchGuidanceStudentFile(s.studentName).catch(() => null)),
      );
      const all = files
        .filter(Boolean)
        .flatMap((file) => (file.sessions || []).map((session) => ({ ...session, className: file.profile?.className || session.className })));
      all.sort((a, b) => new Date(b.sessionAtUtc) - new Date(a.sessionAtUtc));
      setSessions(all);
    } catch (err) {
      setError(err?.message || 'Görüşmeler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => sessions.filter((s) => !search
    || s.studentName.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))
    || (TOPIC_LABELS[s.topic] || s.topic).toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))), [sessions, search]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="guidance-sessions">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Görüşme Kayıtları</h1>
          <p className="text-sm text-muted-foreground">Tüm öğrencilerdeki görüşme geçmişiniz. Yeni kayıt için öğrenci dosyasını kullanın.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Öğrenci veya konu ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" />
        </div>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Görüşme kaydı yok. Vaka Merkezi'nden bir öğrenci seçip görüşme ekleyin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => (
            <div key={session.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="font-bold hover:underline"
                  onClick={() => navigate(`/g/student/${encodeURIComponent(session.studentName)}`)}
                >
                  {session.studentName}
                </button>
                {session.className ? <span className="text-xs text-muted-foreground">{session.className}</span> : null}
                <Badge className="rounded-lg bg-brand-accent text-white">{TOPIC_LABELS[session.topic] || session.topic}</Badge>
                <Badge variant="outline" className="rounded-lg capitalize">{session.sessionType}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(session.sessionAtUtc)}</span>
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{session.note}</p>
              {session.followUpAtUtc && !session.followUpDone ? (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-lg border-amber-500/30 text-amber-500">Takip: {formatDate(session.followUpAtUtc)}</Badge>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => navigate(`/g/student/${encodeURIComponent(session.studentName)}`)}>
                    Dosyayı Aç →
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
