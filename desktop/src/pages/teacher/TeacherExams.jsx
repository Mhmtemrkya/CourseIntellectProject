import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileQuestion, Plus, BarChart3, CheckCircle, Calendar, Trophy, Users, Target, Camera,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { TeacherEmptyState } from '../../components/teacher/TeacherEmptyState';
import { useApp } from '../../context/AppContext';
import { deletePlannedExam, fetchExamResults, fetchPlannedExams } from '../../lib/api/modules';
import { getResourceTheme } from '../../components/ui/PremiumResourceCard';
import ExamAttendanceDialog from '../../components/teacher/ExamAttendanceDialog';
import ExamLiveCameraDialog from '../../components/teacher/ExamLiveCameraDialog';


const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const SUBJECT_META = {
  Matematik: { gradient: 'from-sky-500 to-blue-600', tint: 'bg-sky-500/10 text-sky-700', mark: 'M', tagline: 'Soru akışı ve süre yönetimi' },
  'Türkçe': { gradient: 'from-teal-600 to-cyan-500', tint: 'bg-teal-500/10 text-teal-700', mark: 'TR', tagline: 'Dil, yorum ve paragraf dengesi' },
  Fizik: { gradient: 'from-violet-500 to-fuchsia-600', tint: 'bg-violet-500/10 text-violet-700', mark: 'F', tagline: 'Kuvvet ve hareket kontrolü' },
  Kimya: { gradient: 'from-emerald-500 to-teal-600', tint: 'bg-emerald-500/10 text-emerald-700', mark: 'K', tagline: 'Tepkime ve kavram odaklı set' },
  Biyoloji: { gradient: 'from-green-500 to-lime-600', tint: 'bg-lime-500/10 text-lime-700', mark: 'B', tagline: 'Sistemler ve süreç odaklı içerik' },
  'İngilizce': { gradient: 'from-amber-500 to-yellow-500', tint: 'bg-amber-500/10 text-amber-700', mark: 'EN', tagline: 'Kelime, okuma ve yapı pratiği' },
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

function subjectMeta(subject) {
  const safeSubject = decodeText(subject);
  return SUBJECT_META[safeSubject] || {
    gradient: 'from-slate-500 to-slate-700',
    tint: 'bg-slate-500/10 text-slate-700',
    mark: 'SN',
    tagline: 'Planlı sınav akışı',
  };
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
          <p className="text-muted-foreground mt-1">Sınav sonucu gir ve mevcut kayıtları incele</p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureGate module="exams" action="create">
            <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => navigate('/t/exams/create?mode=exam&type=Exam')}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sınav
            </Button>
          </FeatureGate>
          <Button variant="outline" onClick={() => navigate('/t/exam-workbench')}>Çalışma Alanı</Button>
          <FeatureGate module="grade-entry" action="enter">
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/t/grade-entry')}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sonuç
            </Button>
          </FeatureGate>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.total, 'Toplam Sonuç', FileQuestion, 'text-brand-primary'],
          [stats.completed, 'Tamamlanan', CheckCircle, 'text-green-600'],
          [stats.scheduled, 'Planlanan', Calendar, 'text-brand-primary'],
          [stats.avgScore, 'Ortalama', BarChart3, 'text-brand-accent'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
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
          {plannedExams.map((exam, index) => {
            const theme = getResourceTheme(exam.subject);
            return (
              <motion.div key={`${exam.title}-${index}`} variants={itemVariants}>
                <Card className="overflow-hidden rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-foreground/20">
                  <CardContent className="p-0">
                    <div className="relative overflow-hidden p-6" style={{ background: `radial-gradient(circle at 88% -20%, ${theme.hue}2e, transparent 50%), radial-gradient(circle at 0% 120%, rgba(255,157,46,0.08), transparent 40%)` }}>
                      <div className="absolute -right-3 -top-5 text-[88px] font-black leading-none" style={{ color: `${theme.hue}16` }}>
                        {theme.mark}
                      </div>
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em]" style={{ borderColor: `${theme.hue}38`, backgroundColor: `${theme.hue}1a`, color: theme.hue }}>
                            {exam.subject}
                          </div>
                          <h3 className="text-2xl font-black leading-tight">{exam.title}</h3>
                          <p className="mt-2 text-sm text-slate-400">{subjectMeta(exam.subject).tagline}</p>
                        </div>
                        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.05] px-4 py-3 text-right">
                          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Planlanan</div>
                          <div className="mt-1 text-base font-black text-white">{exam.dateLabel || exam.date}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 border-t border-foreground/[0.07] p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {[exam.className, exam.type, exam.sourceType].filter(Boolean).map((chip) => (
                          <span key={chip} className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{chip}</span>
                        ))}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          ['Soru Sayısı', exam.questionCount],
                          ['Süre', exam.duration],
                          ['İçerik', exam.sources?.length || 0],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.04] p-4">
                            <div className="text-sm text-slate-500">{label}</div>
                            <div className="mt-2 text-2xl font-black text-white">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300" onClick={() => setLiveCameraExam(exam)}><Camera className="mr-1.5 h-4 w-4" />Canlı Kamera</Button>
                        <Button variant="outline" className="rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300" onClick={() => setAttendanceExam(exam)}>Yoklama</Button>
                        <Button variant="outline" className="rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300" onClick={() => deletePlannedExam(exam.id).then(() => setPlannedExams((prev) => prev.filter((item) => item.id !== exam.id)))}>Sil</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {plannedExams.length === 0 ? (
            <TeacherEmptyState
              variant="exam"
              accent="green"
              title="Henüz sınav oluşturulmamış"
              description="Öğrencilerin başarısını ölçmek için ilk sınavını oluştur ve değerlendirme sürecini başlat."
              primaryLabel="Sınav Oluştur"
              onPrimary={() => navigate('/t/exams/create?mode=exam&type=Exam')}
              secondaryLabel="Sınav Şablonları"
              onSecondary={() => navigate('/t/question-bank')}
              tipDescription="Hazır soru kaynaklarını kullanarak hızlıca sınav oluşturabilir veya tamamen kendi sınavını tasarlayabilirsin."
            />
          ) : null}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          {groupedResults.map((exam, index) => {
            const theme = getResourceTheme(decodeText(exam.subject));
            return (
              <motion.div key={exam.key || `${exam.title}-${index}`} variants={itemVariants}>
                <Card className="overflow-hidden rounded-[24px] border border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] transition hover:border-foreground/20">
                  <CardContent className="p-0">
                    <div className="relative overflow-hidden p-6" style={{ background: `radial-gradient(circle at 88% -20%, ${theme.hue}2e, transparent 50%), radial-gradient(circle at 0% 120%, rgba(255,157,46,0.08), transparent 40%)` }}>
                      <div className="absolute -right-3 -top-5 text-[88px] font-black leading-none" style={{ color: `${theme.hue}16` }}>
                        {theme.mark}
                      </div>
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em]" style={{ borderColor: `${theme.hue}38`, backgroundColor: `${theme.hue}1a`, color: theme.hue }}>
                            {decodeText(exam.subject)}
                          </div>
                          <h3 className="text-2xl font-black leading-tight">{decodeText(exam.title)}</h3>
                          <p className="mt-2 text-sm text-slate-400">{exam.className} • {exam.dateLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.05] px-4 py-3 text-right">
                          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ortalama</div>
                          <div className="mt-1 text-2xl font-black" style={{ color: theme.hue }}>{exam.averageScore}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 border-t border-foreground/[0.07] p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{decodeText(exam.type)}</span>
                        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{exam.participantCount} teslim</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          [Users, 'Katılım', exam.participantCount],
                          [Trophy, 'En Yüksek', exam.highestScore],
                          [Target, 'Ortalama Net', exam.averageNet],
                        ].map(([Icon, label, value]) => (
                          <div key={label} className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.04] p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Icon className="h-4 w-4" style={{ color: theme.hue }} />
                              {label}
                            </div>
                            <div className="mt-2 text-2xl font-black text-white">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-white">Teslim Edenler</p>
                            <p className="text-xs text-slate-500">Öğrencilerin puan ve net özeti</p>
                          </div>
                          <Badge className="border-foreground/10 bg-foreground/[0.06] text-slate-300 hover:bg-foreground/[0.06]">{exam.items.length} kayıt</Badge>
                        </div>
                        <div className="space-y-2">
                          {exam.items.slice(0, 4).map((item) => (
                            <div key={`${item.studentName}-${item.date}-${item.score}`} className="flex items-center justify-between rounded-xl border border-foreground/[0.06] bg-foreground/[0.04] px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{decodeText(item.studentName)}</p>
                                <p className="text-xs text-slate-500">{item.net} net</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black" style={{ color: theme.hue }}>{item.score}</p>
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">puan</p>
                              </div>
                            </div>
                          ))}
                          {exam.items.length > 4 ? (
                            <p className="pt-1 text-xs text-slate-500">+{exam.items.length - 4} öğrenci daha</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" className="rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-200 hover:border-orange-400/40 hover:bg-orange-400/10 hover:text-orange-200" onClick={() => navigate('/t/exam-workbench')}>
                          Sonuçları Aç
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {groupedResults.length === 0 ? (
            <TeacherEmptyState
              variant="exam"
              accent="green"
              title="Henüz gösterilecek sonuç yok"
              description="Sınav sonuçları kaydedildiğinde başarı özetleri ve değerlendirme kayıtları burada görünecek."
              primaryLabel="Sonuç Gir"
              onPrimary={() => navigate('/t/grade-entry')}
              secondaryLabel="Planlı Sınav"
              onSecondary={() => navigate('/t/exams/create?mode=exam&type=Exam')}
              tipDescription="Sonuç girdikçe sınıf başarılarını ve öğrenci gelişimini bu ekrandan takip edebilirsin."
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {attendanceExam ? (
        <ExamAttendanceDialog exam={attendanceExam} onClose={() => setAttendanceExam(null)} />
      ) : null}

      {liveCameraExam ? (
        <ExamLiveCameraDialog exam={liveCameraExam} onClose={() => setLiveCameraExam(null)} />
      ) : null}
    </motion.div>
  );
}
