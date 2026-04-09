import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, ClipboardCheck, FileSpreadsheet, Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchPlannedExamSubmissions, fetchPlannedExams } from '../../lib/api/modules';

export default function TeacherExamWorkbench() {
  const { user } = useApp();
  const [plannedExams, setPlannedExams] = useState([]);
  const [submissionMap, setSubmissionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkbench = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const exams = await fetchPlannedExams({ teacherName: user?.name || '' });
      setPlannedExams(exams);
      const entries = await Promise.all(
        exams.map(async (exam) => [exam.id, await fetchPlannedExamSubmissions(exam.id).catch(() => [])]),
      );
      setSubmissionMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message || 'Sınav çalışma alanı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => { loadWorkbench(); }, [loadWorkbench]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-exam-workbench-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Sınav Teslimleri</h1>
        <p className="text-muted-foreground mt-1">Planladığın sınavlar, teslim eden öğrenciler ve hızlı not görünümü tek ekranda.</p>
      </div>
      {error ? <ErrorBanner title="Sınav çalışma alanı alınamadı" message={error} onRetry={loadWorkbench} /> : null}
      <div className="grid gap-6">
        {plannedExams.map((exam) => {
          const submissions = submissionMap[exam.id] || [];
          return (
            <Card key={exam.id} className="overflow-hidden border-0 shadow-sm">
              <div className="bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{exam.subject}</div>
                    <h2 className="mt-2 text-2xl font-black">{exam.title}</h2>
                    <p className="mt-2 text-sm text-white/80">{exam.className} • {exam.duration} • {exam.questionCount} soru</p>
                  </div>
                  <div className="rounded-3xl bg-white/12 px-4 py-3 text-right backdrop-blur">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Teslim</div>
                    <div className="mt-1 text-2xl font-black">{submissions.length}</div>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-4 p-6">
                {submissions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    Bu sınav için henüz teslim bulunmuyor.
                  </div>
                ) : submissions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold">{item.studentName}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(item.submittedAtUtc).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="gap-1">
                        <Trophy className="h-3.5 w-3.5" />
                        {item.score}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.net} net
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
