import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { deletePlannedExam, fetchExamResults, fetchPlannedExams } from '../../lib/api/modules';
import ExamAttendanceDialog from '../../components/teacher/ExamAttendanceDialog';
import ExamLiveCameraDialog from '../../components/teacher/ExamLiveCameraDialog';
import ExamManagementSheet from '../../components/exams/ExamManagementSheet';


const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function decodeText(value = '') {
  return String(value || '')
    .replaceAll('&#xFC;', 'ü')
    .replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç')
    .replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı')
    .replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö')
    .replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş')
    .replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ')
    .replaceAll('&#x11E;', 'Ğ')
    .replaceAll('&uuml;', 'ü')
    .replaceAll('&Uuml;', 'Ü')
    .replaceAll('&ccedil;', 'ç')
    .replaceAll('&Ccedil;', 'Ç')
    .replaceAll('&ouml;', 'ö')
    .replaceAll('&Ouml;', 'Ö')
    .replaceAll('&scedil;', 'ş')
    .replaceAll('&Scedil;', 'Ş')
    .replaceAll('&nbsp;', ' ');
}

export default function TeacherExams() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [examResults, setExamResults] = useState([]);
  const [plannedExams, setPlannedExams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceExam, setAttendanceExam] = useState(null);
  const [liveCameraExam, setLiveCameraExam] = useState(null);
  const [managedExam, setManagedExam] = useState(null);

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [results, planned] = await Promise.all([
        fetchExamResults(),
        fetchPlannedExams({ teacherName: user?.name }).catch(() => []),
      ]);
      setExamResults(results);
      setPlannedExams(planned);
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const filteredExams = useMemo(() => examResults.filter((item) => (
    `${item.examTitle} ${item.subject} ${item.studentName}`.toLowerCase().includes(searchQuery.toLowerCase())
  )), [examResults, searchQuery]);

  const groupedResults = useMemo(() => {
    const groups = new Map();
    filteredExams.forEach((item) => {
      const key = [
        item.examTitle,
        item.className,
        item.subject,
        item.dateLabel || item.date,
      ].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: item.examTitle,
          subject: item.subject,
          className: item.className,
          dateLabel: item.dateLabel || item.date,
          type: item.type,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    });

    return Array.from(groups.values()).map((group) => {
      const scores = group.items.map((item) => Number(item.score || 0));
      const nets = group.items.map((item) => Number(item.net || 0));
      return {
        ...group,
        participantCount: group.items.length,
        averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        averageNet: nets.length ? (nets.reduce((sum, value) => sum + value, 0) / nets.length).toFixed(1) : '0.0',
      };
    });
  }, [filteredExams]);

  const stats = {
    total: examResults.length + plannedExams.length,
    completed: examResults.length,
    scheduled: plannedExams.length,
    avgScore: examResults.length ? Math.round(examResults.reduce((sum, item) => sum + Number(item.score || 0), 0) / examResults.length) : 0,
  };

  const copyExam = async (exam) => {
    const summary = [
      exam.title,
      exam.subject,
      exam.className,
      exam.dateLabel || exam.date,
      exam.duration,
      exam.questionCount ? `${exam.questionCount} soru` : null,
    ].filter(Boolean).join(' • ');
    await navigator.clipboard.writeText(summary);
  };

  const removeExam = async (exam) => {
    if (!exam?.id) return;
    await deletePlannedExam(exam.id);
    setPlannedExams((prev) => prev.filter((item) => item.id !== exam.id));
  };

  const managedActions = managedExam?.kind === 'planned'
    ? [
        { label: 'Görüntüle', close: false },
        { label: 'Düzenle', onClick: () => navigate('/t/exam-workbench') },
        { label: 'Sonuç Gir', onClick: () => navigate('/t/grade-entry') },
        { label: 'Sonuçları İncele', onClick: () => navigate('/t/exam-workbench') },
        { label: 'Kamera', onClick: () => setLiveCameraExam(managedExam.exam) },
        { label: 'Yoklama', onClick: () => setAttendanceExam(managedExam.exam) },
        { label: 'PDF', onClick: () => window.print() },
        { label: 'Kopyala', onClick: () => copyExam(managedExam.exam) },
        { label: 'Sil', destructive: true, onClick: () => removeExam(managedExam.exam) },
      ]
    : [
        { label: 'Görüntüle', close: false },
        { label: 'Sonuçları İncele', onClick: () => navigate('/t/exam-workbench') },
        { label: 'PDF', onClick: () => window.print() },
        { label: 'Kopyala', onClick: () => copyExam(managedExam?.exam || {}) },
      ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Sınav verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teacher-exams-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
          <p className="text-muted-foreground mt-1">Sınav sonucu gir ve mevcut kayıtları incele</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FeatureGate module="exams" action="create">
            <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => navigate('/t/exams/create?mode=exam&type=Exam')}>
              Yeni Sınav
            </Button>
          </FeatureGate>
          <Button variant="outline" onClick={() => navigate('/t/exam-workbench')}>Çalışma Alanı</Button>
          <FeatureGate module="grade-entry" action="enter">
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/t/grade-entry')}>
              Yeni Sonuç
            </Button>
          </FeatureGate>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [stats.total, 'Toplam Sınav'],
          [stats.completed, 'Tamamlanan'],
          [stats.scheduled, 'Planlanan'],
          [stats.avgScore, 'Ortalama'],
        ].map(([value, label]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card className="h-full">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-black">{value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <Input placeholder="Sınav ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </motion.div>

      <Tabs defaultValue="planned">
        <TabsList className="mb-4">
          <TabsTrigger value="planned">Yaklaşan Sınavlar</TabsTrigger>
          <TabsTrigger value="completed">Sonuçlar</TabsTrigger>
        </TabsList>
        <TabsContent value="planned" className="space-y-4">
          {plannedExams.map((exam, index) => (
              <motion.div key={`${exam.title}-${index}`} variants={itemVariants}>
                <Card className="rounded-2xl border-foreground/10 shadow-sm transition hover:border-foreground/20">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{exam.subject} • {exam.type}</p>
                        <h3 className="mt-1 truncate text-lg font-black sm:text-xl">{exam.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {[exam.className, exam.dateLabel || exam.date, exam.duration, exam.questionCount ? `${exam.questionCount} soru` : null].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <Button className="w-full shrink-0 sm:w-28" onClick={() => setManagedExam({ exam, kind: 'planned' })}>Yönet</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
          ))}
          {plannedExams.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-black">Henüz sınav oluşturulmamış</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Öğrencilerin başarısını ölçmek için ilk sınavını oluştur.</p>
                <Button className="mt-5" onClick={() => navigate('/t/exams/create?mode=exam&type=Exam')}>Sınav Oluştur</Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          {groupedResults.map((exam, index) => (
              <motion.div key={exam.key || `${exam.title}-${index}`} variants={itemVariants}>
                <Card className="rounded-2xl border-foreground/10 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{decodeText(exam.subject)} • Tamamlandı</p>
                        <h3 className="mt-1 truncate text-lg font-black sm:text-xl">{decodeText(exam.title)}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {exam.className} • {exam.dateLabel} • {exam.participantCount} katılım • Ortalama {exam.averageScore}
                        </p>
                      </div>
                      <Button className="w-full shrink-0 sm:w-28" onClick={() => setManagedExam({ exam, kind: 'completed' })}>Yönet</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
          ))}
          {groupedResults.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center">
                <h3 className="text-xl font-black">Henüz gösterilecek sonuç yok</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Sonuçlar kaydedildiğinde başarı özetleri burada görünecek.</p>
                <Button className="mt-5" onClick={() => navigate('/t/grade-entry')}>Sonuç Gir</Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {attendanceExam ? (
        <ExamAttendanceDialog exam={attendanceExam} onClose={() => setAttendanceExam(null)} />
      ) : null}

      {liveCameraExam ? (
        <ExamLiveCameraDialog exam={liveCameraExam} onClose={() => setLiveCameraExam(null)} />
      ) : null}

      <ExamManagementSheet
        exam={managedExam?.exam}
        open={Boolean(managedExam)}
        onOpenChange={(open) => !open && setManagedExam(null)}
        actions={managedActions}
      />
    </motion.div>
  );
}
