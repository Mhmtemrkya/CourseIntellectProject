import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { PremiumPanel, PremiumScoreCard } from '../../components/ui/premium-dashboard';
import { useApp } from '../../context/AppContext';
import { fetchExamResults } from '../../lib/api/modules';

const SCORE_TONES = ['brand', 'blue', 'emerald', 'violet', 'amber', 'rose'];

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export default function StudentExamResults() {
  const navigate = useNavigate();
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
    return { average };
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          [stats.average, 'Genel Ortalama', BarChart3, 'from-amber-400 to-orange-600'],
          [records.length, 'Toplam Kayıt', TrendingUp, 'from-sky-400 to-blue-600'],
        ].map(([value, label, Icon, gradient]) => (
          <Card key={label} className="ci-metric-card border-foreground/10">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.22)] ${gradient}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="truncate text-2xl font-black tracking-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 ? (
        <StudentEmptyState
          variant="exam"
          accent="green"
          title="Henüz sınav sonucunuz bulunmuyor"
          description="Girdiğiniz sınavların sonuçları ve analizleri burada görüntülenecek."
          primaryLabel="Deneme Sınavlarına Git"
          onPrimary={() => navigate('/s/mock-exams')}
        />
      ) : (
        <PremiumPanel title="Sonuç Geçmişi" description="Ders bazında tüm sınav sonuçların">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {records.map((item, index) => (
              <PremiumScoreCard
                key={`${item.examTitle}-${index}`}
                subject={`${item.subject} • ${item.type}`}
                score={item.score}
                grade={letterGrade(Number(item.score || 0))}
                date={`${item.dateLabel || item.date || ''}${item.net != null ? ` · ${item.net} net` : ''}`}
                tone={SCORE_TONES[index % SCORE_TONES.length]}
              />
            ))}
          </div>
        </PremiumPanel>
      )}
    </motion.div>
  );
}
