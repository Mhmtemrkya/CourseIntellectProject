import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, ChevronRight, Clock3, FileQuestion, Layers3, Send, Target,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import {
  completeExamSession,
  fetchPlannedExams,
  startExamSession,
  submitExamSessionAnswer,
} from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';

const SUBJECT_COLORS = {
  Matematik: { gradient: 'from-sky-500 to-blue-600', tint: 'bg-sky-500/10 text-sky-700', mark: 'M', tagline: 'Sayısal akış ve hız kontrolü' },
  'Türkçe': { gradient: 'from-teal-600 to-cyan-500', tint: 'bg-teal-500/10 text-teal-700', mark: 'TR', tagline: 'Dil, yorum ve paragraf odaklı set' },
  Fizik: { gradient: 'from-violet-500 to-fuchsia-600', tint: 'bg-violet-500/10 text-violet-700', mark: 'F', tagline: 'Kuvvet ve hareket dengelemesi' },
  Kimya: { gradient: 'from-emerald-500 to-teal-600', tint: 'bg-emerald-500/10 text-emerald-700', mark: 'K', tagline: 'Tepkime ve kavram pratiği' },
  Biyoloji: { gradient: 'from-green-500 to-lime-600', tint: 'bg-lime-500/10 text-lime-700', mark: 'B', tagline: 'Sistemler ve süreç takibi' },
  'İngilizce': { gradient: 'from-amber-500 to-yellow-500', tint: 'bg-amber-500/10 text-amber-700', mark: 'EN', tagline: 'Kelime ve okuma akışı' },
};

function subjectMeta(subject) {
  return SUBJECT_COLORS[subject] || {
    gradient: 'from-slate-500 to-slate-700',
    tint: 'bg-slate-500/10 text-slate-700',
    mark: 'SN',
    tagline: 'Planlanan sınav akışı',
  };
}

function parseDate(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parts = String(value).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!parts) return null;
  const [, day, month, year] = parts;
  return new Date(`${year.length === 2 ? `20${year}` : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T09:00:00`);
}

function buildImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const trimmed = String(path).replace(/^\/+/, '');
  return `${desktopApiBaseUrl}/${trimmed}`;
}

function formatDuration(value) {
  if (!value) return '45 dk';
  return value;
}

export default function StudentExams() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [plannedExams, setPlannedExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeExam, setActiveExam] = useState(null);
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryState, setDeliveryState] = useState(null);

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const exams = await fetchPlannedExams({ studentName: user?.name || '', studentUsername: user?.username || '' });
      setPlannedExams(exams);
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.username]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const upcomingExams = useMemo(() => plannedExams.map((item) => ({
    id: item.id,
    name: item.title,
    subject: item.subject,
    date: parseDate(item.dateLabel || item.date) || new Date(),
    type: item.type || 'Deneme',
    className: item.className,
    questionCount: item.questionCount,
    duration: item.duration,
  })), [plannedExams]);

  const startExam = async (exam) => {
    try {
      setSubmitting(true);
      setActiveExam(exam);
      const started = await startExamSession({
        plannedExamId: exam.id,
        examTitle: exam.name,
        subject: exam.subject,
        studentName: user?.name || '',
        studentUsername: user?.username || '',
        questionCount: exam.questionCount || 10,
      });
      setSession(started);
      setCurrentIndex(0);
    } catch (err) {
      setActiveExam(null);
      setError(err.message || 'Sınav oturumu başlatılamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async (optionIndex) => {
    if (!session || submitting) return;
    try {
      setSubmitting(true);
      const question = session.questions[currentIndex];
      const updated = await submitExamSessionAnswer(session.id, {
        questionId: question.id,
        selectedOptionIndex: optionIndex,
      });
      setSession(updated);
      if (currentIndex < updated.questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err) {
      setError(err.message || 'Cevap kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const finishExam = async () => {
    if (!session || submitting) return;
    try {
      setSubmitting(true);
      const completion = await completeExamSession(session.id);
      setDeliveryState(completion);
      window.setTimeout(() => {
        setActiveExam(null);
        setSession(null);
        setCurrentIndex(0);
        setDeliveryState(null);
        loadExams();
        navigate('/s/dashboard');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Sınav tamamlanamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const overallStats = {
    totalExams: upcomingExams.length,
    bestSubject: upcomingExams[0]?.subject || 'Henüz yok',
  };

  const currentQuestion = session?.questions?.[currentIndex] || null;
  const progress = session?.questions?.length ? ((currentIndex + 1) / session.questions.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Sınav verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-exams-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Sınavlarım</h1>
        <p className="text-muted-foreground mt-1">Gerçek sınav akışına gir, çözümünü gönder ve durumunu tek ekranda takip et.</p>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [overallStats.totalExams, 'Sınavlarım', FileQuestion, 'text-brand-primary'],
          [upcomingExams.filter((item) => item.type.toLowerCase().includes('deneme')).length, 'Deneme', Target, 'text-green-600'],
          [overallStats.bestSubject, 'Odak Ders', Calendar, 'text-brand-accent'],
          [upcomingExams.filter((item) => item.questionCount > 0).length, 'Hazır Oturum', Layers3, 'text-blue-600'],
        ].map(([value, label, Icon, color]) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {upcomingExams.map((exam) => {
          const theme = subjectMeta(exam.subject);
          return (
            <Card key={exam.id} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} p-6 text-white`}>
                  <div className="absolute -right-3 -top-5 text-[88px] font-black leading-none text-white/10">{theme.mark}</div>
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                        {exam.subject}
                      </div>
                      <h3 className="text-2xl font-black leading-tight">{exam.name}</h3>
                      <p className="mt-2 text-sm text-white/85">{theme.tagline}</p>
                    </div>
                    <div className="rounded-3xl bg-white/12 px-4 py-3 text-right backdrop-blur">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Planlanan</div>
                      <div className="mt-1 text-base font-semibold">{exam.date.toLocaleDateString('tr-TR')}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.tint}`}>{exam.className}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{exam.type}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Metric icon={Layers3} label="Soru Sayısı" value={exam.questionCount} tone="text-brand-primary" />
                    <Metric icon={Clock3} label="Süre" value={formatDuration(exam.duration)} tone="text-brand-accent" />
                    <Metric icon={Target} label="Sınav Tipi" value={exam.type} tone="text-green-600" />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => startExam(exam)} disabled={submitting}>
                      Sınava Gir
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeExam} onOpenChange={(open) => {
        if (!open && !submitting) {
          setActiveExam(null);
          setSession(null);
          setCurrentIndex(0);
          setDeliveryState(null);
        }
      }}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-[1100px] max-h-[92vh] overflow-y-auto">
          {deliveryState ? (
            <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-teal-600 p-10 text-white">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
                <Send className="h-10 w-10" />
              </div>
              <h2 className="mt-6 text-center text-3xl font-black">Öğretmeninize Gönderildi</h2>
              <p className="mt-3 text-center text-white/85">
                Sınavın teslim edildi. Son değerlendirme öğretmen ekranında görünecek.
              </p>
            </div>
          ) : currentQuestion ? (
            <>
              <DialogHeader>
                <DialogTitle>{session?.title || activeExam?.name}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-5">
                  <div className="rounded-[28px] bg-slate-950 p-6 text-white">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{session?.subject}</div>
                        <div className="mt-1 text-2xl font-black">{currentQuestion.topic}</div>
                      </div>
                      <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                        {currentIndex + 1}/{session.questions.length}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="rounded-[28px] border bg-background p-6">
                    <p className="text-xl font-bold leading-8">{currentQuestion.questionText}</p>
                    {currentQuestion.imagePath ? (
                      <img
                        src={buildImageUrl(currentQuestion.imagePath)}
                        alt="Soru görseli"
                        className="mt-5 max-h-[260px] w-full rounded-[24px] object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {currentQuestion.options.map((option, index) => {
                      const selected = currentQuestion.selectedOptionIndex === index;
                      return (
                        <button
                          type="button"
                          key={`${currentQuestion.id}-${index}`}
                          onClick={() => submitAnswer(index)}
                          disabled={submitting}
                          className={`flex items-center gap-4 rounded-[22px] border px-5 py-5 text-left transition ${
                            selected
                              ? 'border-brand-primary bg-brand-primary/5'
                              : 'border-border bg-card hover:border-brand-primary/40'
                          }`}
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-brand-primary text-white' : 'bg-muted text-foreground'}`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <div className="flex-1 font-medium">{option}</div>
                          {selected ? <CheckCircle2 className="h-5 w-5 text-brand-primary" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border bg-card p-5">
                    <div className="text-sm font-semibold text-muted-foreground">Sınav Özeti</div>
                    <div className="mt-3 text-2xl font-black">{activeExam?.name}</div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between"><span>Sınıf</span><span className="font-semibold">{activeExam?.className}</span></div>
                      <div className="flex items-center justify-between"><span>Süre</span><span className="font-semibold">{formatDuration(activeExam?.duration)}</span></div>
                      <div className="flex items-center justify-between"><span>Soru</span><span className="font-semibold">{activeExam?.questionCount}</span></div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border bg-card p-5">
                    <div className="text-sm font-semibold text-muted-foreground">Sorular</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {session.questions.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
                            index === currentIndex
                              ? 'bg-brand-primary text-white'
                              : item.selectedOptionIndex != null
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full" onClick={currentIndex < session.questions.length - 1 ? () => setCurrentIndex((prev) => prev + 1) : finishExam} disabled={submitting}>
                    {currentIndex < session.questions.length - 1 ? 'Sonraki Soru' : 'Sınavı Bitir ve Gönder'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center"><LoadingDots /></div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Metric({
  icon: Icon, label, value, tone,
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
