import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { AnimatedValue } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import ExamEntryGate from '../../components/student/ExamEntryGate';
import { useApp } from '../../context/AppContext';
import {
  checkinPlannedExam,
  classMatchesMine,
  completeExamSession,
  fetchPlannedExams,
  getMyClassName,
  submitExamSessionAnswer,
} from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';
import { isImageValue, stripOptionPrefix } from '../../lib/questionMedia';

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

function isMockExam(item) {
  const type = String(item?.type || '').trim().toLowerCase();
  return type === 'mockexam' || type.includes('deneme');
}

export default function StudentExams({ mockOnly = false }) {
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
  const [gateExam, setGateExam] = useState(null);

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [exams, myClass] = await Promise.all([
        fetchPlannedExams({ studentName: user?.name || '', studentUsername: user?.username || '' }),
        getMyClassName(user),
      ]);
      const list = Array.isArray(exams) ? exams : [];
      // Yalnızca öğrencinin kendi sınıfına atanmış (veya genel) sınav/denemeler görünür.
      setPlannedExams(list.filter((item) => classMatchesMine(item.className, myClass)));
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const upcomingExams = useMemo(() => plannedExams
    .filter((item) => (mockOnly ? isMockExam(item) : !isMockExam(item)))
    .map((item) => ({
      id: item.id,
      name: item.title,
      subject: item.subject,
      date: parseDate(item.dateLabel || item.date) || new Date(),
      type: item.type || (mockOnly ? 'Deneme' : 'Sınav'),
      className: item.className,
      questionCount: item.questionCount,
      duration: item.duration,
      dateLabel: item.dateLabel || item.date,
      startTime: item.startTime,
      lateEntryLimitMinutes: item.lateEntryLimitMinutes,
      requireCamera: item.requireCamera,
      requireFullscreen: item.requireFullscreen,
      blockTabChange: item.blockTabChange,
      blockCopyPaste: item.blockCopyPaste,
      liveLinkUrl: item.liveLinkUrl,
    })), [mockOnly, plannedExams]);

  const startExam = (exam) => {
    // Kamera veya canlı yayın zorunluysa önce giriş kapısını göster.
    if (exam.requireCamera || (exam.liveLinkUrl || '').trim()) {
      setGateExam(exam);
      return;
    }
    enterExam(exam, { joinedLive: false, cameraReady: false });
  };

  const enterExam = async (exam, gateResult = {}) => {
    if (exam.id) {
      try {
        await checkinPlannedExam(exam.id, {
          studentName: user?.name || '',
          studentUsername: user?.username || '',
          className: exam.className || '',
          joinedLive: !!gateResult.joinedLive,
          cameraReady: !!gateResult.cameraReady,
        });
      } catch {
        // Yoklama check-in başarısız olsa bile sınava girişi engelleme.
      }
    }

    const params = new URLSearchParams({
      title: exam.name || (mockOnly ? 'Deneme Sınavı' : 'Sınav'),
      subject: exam.subject || 'Genel',
      className: exam.className || '',
      questionCount: String(exam.questionCount || 20),
      durationSeconds: String(Number.parseInt(String(exam.duration || '').replace(/\D/g, ''), 10) * 60 || 5400),
      studentName: user?.name || '',
      studentUsername: user?.username || '',
      requireCamera: exam.requireCamera ? '1' : '0',
      requireFullscreen: exam.requireFullscreen ? '1' : '0',
      blockTabChange: exam.blockTabChange ? '1' : '0',
      blockCopyPaste: exam.blockCopyPaste ? '1' : '0',
    });
    if (exam.id) params.set('plannedExamId', exam.id);
    if ((exam.liveLinkUrl || '').trim()) params.set('liveLinkUrl', exam.liveLinkUrl.trim());
    setGateExam(null);
    navigate(`/s/solve?${params.toString()}`);
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
  };
  // İşe yarar sayaçlar: bugün, bu hafta ve çözülmeye hazır oturum sayısı.
  const nowRef = new Date();
  const startToday = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate());
  const endToday = new Date(startToday); endToday.setDate(startToday.getDate() + 1);
  const weekEnd = new Date(startToday); weekEnd.setDate(startToday.getDate() + 7);
  const examsToday = upcomingExams.filter((item) => item.date >= startToday && item.date < endToday).length;
  const examsThisWeek = upcomingExams.filter((item) => item.date >= startToday && item.date < weekEnd).length;
  const readySessions = upcomingExams.filter((item) => item.questionCount > 0).length;
  const pageCopy = mockOnly
    ? {
        title: 'Deneme Sınavları',
        description: 'Deneme sınavlarına gir, çözümünü gönder ve durumunu tek ekranda takip et.',
        totalLabel: 'Deneme',
        emptyTitle: 'Henüz deneme sınavı yok',
        emptyDescription: 'Sana uygun deneme sınavları yakında burada olacak. Kendini test etmeye hazır ol.',
        emptyAction: 'Denemeleri Yenile',
        testId: 'student-mock-exams-page',
      }
    : {
        title: 'Sınavlarım',
        description: 'Öğretmenin tarafından oluşturulan sınavlara gir, çözümünü gönder ve durumunu tek ekranda takip et.',
        totalLabel: 'Sınavlarım',
        emptyTitle: 'Henüz sınav yok',
        emptyDescription: 'Öğretmenin sınav oluşturduğunda burada görünecek. Listeyi yenileyerek yeni sınavları kontrol edebilirsin.',
        emptyAction: 'Sınavları Yenile',
        testId: 'student-exams-page',
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid={pageCopy.testId}>
      <div>
        <h1 className="text-3xl font-bold font-heading">{pageCopy.title}</h1>
        <p className="text-muted-foreground mt-1">{pageCopy.description}</p>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          [overallStats.totalExams, pageCopy.totalLabel],
          [examsThisWeek, 'Bu Hafta'],
          [examsToday, 'Bugün'],
          [readySessions, 'Hazır Oturum'],
        ].map(([value, label]) => (
          <div key={label} className="ci-metric-card rounded-2xl border border-foreground/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-3xl font-black tracking-tight"><AnimatedValue value={value} /></p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {upcomingExams.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-black">{pageCopy.emptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{pageCopy.emptyDescription}</p>
              <Button className="mt-5" onClick={loadExams}>{pageCopy.emptyAction}</Button>
            </CardContent>
          </Card>
        ) : upcomingExams.map((exam) => (
            <Card key={exam.id} className="rounded-2xl border-foreground/10 shadow-sm transition hover:border-foreground/20">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{exam.subject} • {exam.type}</p>
                    <h3 className="mt-1 text-lg font-black sm:text-xl">{exam.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {[exam.className, exam.date.toLocaleDateString('tr-TR'), formatDuration(exam.duration), exam.questionCount ? `${exam.questionCount} soru` : null].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <Button onClick={() => startExam(exam)} disabled={submitting} className="h-11 w-full shrink-0 rounded-xl bg-orange-500 px-6 font-black text-white hover:bg-orange-600 sm:w-32">
                    Sınava Gir
                  </Button>
                </div>
              </CardContent>
            </Card>
        ))}
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
            <div className="rounded-[28px] p-10 text-white ci-hero">
              <h2 className="text-center text-3xl font-black">Öğretmeninize Gönderildi</h2>
              <p className="mt-3 text-center text-foreground/85">
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
                  <div className="rounded-[28px] p-6 text-white ci-hero">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60">{session?.subject}</div>
                        <div className="mt-1 text-2xl font-black">{currentQuestion.topic}</div>
                      </div>
                      <div className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-semibold">
                        {currentIndex + 1}/{session.questions.length}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
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
                          <div className="flex-1 font-medium">
                            {isImageValue(stripOptionPrefix(option)) ? (
                              <img
                                src={buildImageUrl(stripOptionPrefix(option))}
                                alt={`${String.fromCharCode(65 + index)} şıkkı`}
                                loading="lazy"
                                className="max-h-40 w-auto rounded-lg object-contain"
                              />
                            ) : (
                              option
                            )}
                          </div>
                          {selected ? <span className="text-sm font-bold text-brand-primary">Seçildi</span> : null}
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

      {gateExam ? (
        <ExamEntryGate
          exam={gateExam}
          onCancel={() => setGateExam(null)}
          onEnter={(gateResult) => enterExam(gateExam, gateResult)}
        />
      ) : null}
    </motion.div>
  );
}
