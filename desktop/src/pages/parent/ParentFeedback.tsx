import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageSquareQuote, GraduationCap, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchStudents, fetchTeacherWeeklyReportsForParent } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { TeacherWeeklyReport } from '../../lib/api/reports';
import type { StudentSummaryDto } from '../../types/api/generated';

// /p/feedback: gerçek öğretmen geri bildirimi.
// Önceden bu sayfa fetchMeetingRequests + fetchQuestionThreads gösteriyordu;
// teacher weekly report endpoint'i yerine toplantı/soru akışları geliyordu.
// Şimdi /api/reports/teacher-weekly/parent kaynağına bağlandı.

function dateLabel(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return value;
  }
}

export default function ParentFeedback() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [reports, setReports] = useState<TeacherWeeklyReport[]>([]);
  const [children, setChildren] = useState<StudentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [reportList, studentList] = await Promise.all([
        // Sunucu parentUsername okumaz; süzme parentName ile yapılır.
        fetchTeacherWeeklyReportsForParent({ parentName: user?.name }).catch(() => null),
        fetchStudents().catch(() => null),
      ]);
      setReports(Array.isArray(reportList) ? reportList : []);
      setChildren(Array.isArray(studentList) ? studentList : []);
    } catch (err) {
      setError(errorMessage(err, 'Öğretmen geri bildirimleri alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const items = useMemo(() => {
    return (reports || []).map((report) => ({
      id: report.id || `${report.studentName}-${report.weeklyPeriodLabel}`,
      studentName: report.studentName || '',
      teacherName: report.teacherName || 'Öğretmen',
      subject: report.subject || '',
      summary: report.summary || '',
      // Eskiden var olmayan weekLabel/strengths/improvements okunuyordu; bu
      // bölümler hiç görünmüyordu. Rapor alanları: weeklyPeriodLabel,
      // highlights (güçlü yönler), supportNotes (gelişim alanları).
      weekLabel: report.weeklyPeriodLabel || dateLabel(report.createdAtUtc),
      strengths: report.highlights || '',
      improvements: report.supportNotes || '',
    }));
  }, [reports]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-feedback-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Öğretmen Geri Bildirimi</h1>
        <p className="text-muted-foreground mt-1">
          Çocuğunuzun öğretmenlerinin hazırladığı haftalık raporlar ve değerlendirmeler.
        </p>
      </div>

      {error ? <ErrorBanner title="Geri bildirimler alınamadı" message={error} onRetry={loadFeedback} /> : null}

      {items.length === 0 && !error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
            <p>Henüz yayınlanmış öğretmen raporu yok.</p>
            {children.length > 0 ? (
              <p className="text-xs">
                Aktif çocuklarınız: {children.map((c) => c.fullName).join(', ')}. Öğretmen
                yeni rapor oluşturduğunda burada görünecek.
              </p>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => navigate('/p/weekly-report')}>
              Haftalık Rapor Sayfasına Git
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-brand-accent" />
                {item.studentName ? `${item.studentName} • ` : ''}{item.subject || 'Genel değerlendirme'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {item.teacherName}
                </Badge>
                {item.weekLabel ? <Badge variant="outline">{item.weekLabel}</Badge> : null}
              </div>
              {item.summary ? (
                <p className="text-sm">{item.summary}</p>
              ) : null}
              {item.strengths ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">Güçlü Yönler</p>
                  <p className="text-emerald-700 dark:text-emerald-300 mt-1">{item.strengths}</p>
                </div>
              ) : null}
              {item.improvements ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Gelişim Alanları</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">{item.improvements}</p>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => navigate('/p/weekly-report')}>
                  <FileText className="h-3 w-3 mr-1" />
                  Tüm Raporlar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
