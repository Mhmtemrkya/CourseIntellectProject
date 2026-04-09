import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchExamResults } from '../../lib/api/modules';

export default function StudentExamResults() {
  const { user } = useApp();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchExamResults({ studentName: user?.name || '' });
      setRecords(payload);
    } catch (err) {
      setError(err.message || 'Sınav sonuçları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

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

      <div className="grid gap-4">
        {records.map((item, index) => (
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
