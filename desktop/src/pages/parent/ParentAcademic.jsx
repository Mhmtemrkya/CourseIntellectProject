import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, TrendingUp, TrendingDown, Minus, CalendarCheck, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchParentAcademic } from '../../lib/api/modules';

export default function ParentAcademic() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setChildren(await fetchParentAcademic());
    } catch (err) {
      setError(err.message || 'Akademik özet alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-academic-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><GraduationCap className="h-7 w-7 text-brand-primary" />Akademik Özet</h1>
        <p className="text-muted-foreground mt-1">Çocuğunuz nasıl gidiyor — sınav ortalaması, net trendi, devam oranı ve son sınavlar.</p>
      </div>
      {error ? <ErrorBanner title="Akademik özet alınamadı" message={error} onRetry={load} /> : null}

      {children.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Görüntülenecek öğrenci bulunamadı.</CardContent></Card>
      ) : children.map((child) => {
        const Trend = child.netTrend > 0 ? TrendingUp : child.netTrend < 0 ? TrendingDown : Minus;
        const trendTone = child.netTrend > 0 ? 'text-emerald-600' : child.netTrend < 0 ? 'text-red-600' : 'text-muted-foreground';
        return (
          <Card key={child.studentName}>
            <CardHeader><CardTitle>{child.studentName}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Sınav Ort.', child.averageScore, Target],
                  ['Net Ort.', child.averageNet, Target],
                  ['Devam', `%${child.attendanceRate}`, CalendarCheck],
                  ['Net Trend', `${child.netTrend > 0 ? '+' : ''}${child.netTrend}`, Trend, trendTone],
                ].map(([label, value, Icon, tone]) => (
                  <div key={label} className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${tone || ''}`} />{label}</div>
                    <p className={`mt-1 text-2xl font-bold ${tone || ''}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 font-semibold">Son Sınavlar</p>
                {(child.recentExams || []).length === 0 ? <p className="text-sm text-muted-foreground">Sınav kaydı yok.</p>
                  : (
                    <div className="space-y-2">
                      {child.recentExams.map((exam, idx) => (
                        <div key={`${exam.title}-${idx}`} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                          <div>
                            <span className="font-semibold">{exam.title || exam.subject}</span>
                            <span className="ml-2 text-muted-foreground"><Badge variant="outline">{exam.subject}</Badge> {exam.date}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-brand-primary">{exam.score}</span>
                            <span className="ml-2 text-muted-foreground">{exam.net} net</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}
