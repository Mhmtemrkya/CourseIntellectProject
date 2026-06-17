import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Trophy, TrendingUp, FileText, Download, Eye, Clock3,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { useApp } from '../../context/AppContext';
import { fetchExamResults, fetchMyExamPapers } from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';

function buildFileUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${desktopApiBaseUrl}/${String(path).replace(/^\/+/, '')}`;
}

export default function StudentExamResults() {
  const { user } = useApp();
  const [records, setRecords] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [payload, paperList] = await Promise.all([
        fetchExamResults({ studentName: user?.name || '' }),
        fetchMyExamPapers({ studentName: user?.name || '', studentUsername: user?.username || '' }).catch(() => []),
      ]);
      setRecords(payload);
      setPapers(Array.isArray(paperList) ? paperList : []);
    } catch (err) {
      setError(err.message || 'Sınav sonuçları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.username]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const stats = useMemo(() => {
    const average = records.length ? Math.round(records.reduce((sum, item) => sum + Number(item.score || 0), 0) / records.length) : 0;
    const best = [...records].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
    return { average, best };
  }, [records]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-exam-results-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Sınav Sonuçlarım</h1>
        <p className="text-muted-foreground mt-1">Tüm sınav sonuçlarını tek yerde, ders bazında takip et.</p>
      </div>

      {error ? <ErrorBanner title="Sınav sonuçları alınamadı" message={error} onRetry={loadResults} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [stats.average, 'Genel Ortalama', BarChart3],
          [records.length, 'Toplam Kayıt', TrendingUp],
          [stats.best?.subject || 'Kayıt yok', 'En İyi Ders', Trophy],
        ].map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <Icon className="h-6 w-6 text-brand-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-brand-primary" />
          <h2 className="text-xl font-bold">Sınav Kağıtlarım (PDF)</h2>
        </div>
        {papers.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Sınavını bitirdiğinde kağıdın otomatik olarak burada PDF şeklinde oluşur; önizleyip indirebilirsin.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {papers.map((paper) => {
              const url = buildFileUrl(paper.downloadUrl);
              const ready = paper.status === 'Ready' && url;
              return (
                <Card key={paper.sessionId}>
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{paper.subject}</Badge>
                        {!ready ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <Clock3 className="h-3 w-3" /> Hazırlanıyor
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-semibold">{paper.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {paper.completedAtUtc ? new Date(paper.completedAtUtc).toLocaleString('tr-TR') : paper.className}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        href={ready ? url : undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!ready}
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold ${ready ? 'border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10' : 'pointer-events-none border-muted text-muted-foreground opacity-50'}`}
                      >
                        <Eye className="h-4 w-4" /> Önizle
                      </a>
                      <a
                        href={ready ? url : undefined}
                        download
                        aria-disabled={!ready}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white ${ready ? 'bg-brand-primary hover:opacity-90' : 'pointer-events-none bg-muted opacity-50'}`}
                      >
                        <Download className="h-4 w-4" /> İndir
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {records.length === 0 ? (
          <StudentEmptyState
            variant="exam"
            accent="green"
            title="Henüz sınav sonucunuz bulunmuyor"
            description="Girdiğiniz sınavların sonuçları ve analizleri burada görüntülenecek."
            primaryLabel="Deneme Sınavlarına Git"
            onPrimary={() => window.location.assign('/s/mock-exams')}
          />
        ) : records.map((item, index) => (
          <Card key={`${item.examTitle}-${index}`}>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{item.subject}</Badge>
                  <Badge>{item.type}</Badge>
                </div>
                <p className="font-semibold text-lg">{item.examTitle || item.title}</p>
                <p className="text-sm text-muted-foreground">{item.dateLabel || item.date}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-brand-primary">{item.score}</p>
                <p className="text-sm text-muted-foreground">{item.net} net</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
