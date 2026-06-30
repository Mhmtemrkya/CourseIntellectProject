import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bookmark, CheckCircle2, ClipboardList, Clock3, Download, FileDown,
  Flag, Grid2X2, Loader2, Maximize, MessageSquareText, NotebookPen, Save, Send, ShieldAlert, Sparkles, X,
} from 'lucide-react';
import { DrawingCanvas } from '../../features/solving/canvas/DrawingCanvas';
import CameraMonitor from '../../components/student/CameraMonitor';
import { useApp } from '../../context/AppContext';
import { desktopApiBaseUrl } from '../../lib/auth';
import {
  addSolutionTeacherReview,
  completeSolutionSession,
  fetchSolutionSession,
  saveSolutionAnswer,
  saveSolutionCanvasSnapshot,
  saveSolutionCanvasStroke,
  saveSolutionFlag,
  saveSolutionNote,
  startSolutionSession,
} from '../../lib/api/modules';

function buildImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${desktopApiBaseUrl}/${String(path).replace(/^\/+/, '')}`;
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const rest = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function ExamSolvingPage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveLabel, setAutosaveLabel] = useState('Hazır');
  const [error, setError] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [openAnswerDraft, setOpenAnswerDraft] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [summary, setSummary] = useState(null);
  const [panel, setPanel] = useState('solution');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [showViolation, setShowViolation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const normalizedRole = String(user?.role || '').toLowerCase();
  const canReview = ['teacher', 'admin', 'institutionadmin', 'idare'].some((role) => normalizedRole.includes(role));
  const isTeacherPreview = canReview && (searchParams.get('teacherPreview') === 'true' || normalizedRole.includes('teacher'));

  // Öğretmenin sınav oluştururken seçtiği güvenlik kuralları (öğrenci için).
  const requireCamera = searchParams.get('requireCamera') === '1' && !isTeacherPreview;
  const requireFullscreen = searchParams.get('requireFullscreen') === '1' && !isTeacherPreview;
  const blockTabChange = searchParams.get('blockTabChange') === '1' && !isTeacherPreview;
  const blockCopyPaste = searchParams.get('blockCopyPaste') === '1' && !isTeacherPreview;
  const liveLinkUrl = (searchParams.get('liveLinkUrl') || '').trim();
  const examActive = session?.status === 'Active' && !summary;

  const loadOrStart = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const existingSessionId = searchParams.get('sessionId');
      if (existingSessionId) {
        const loaded = await fetchSolutionSession(existingSessionId);
        setSession(loaded);
        setRemainingSeconds(loaded.durationSeconds || 3600);
        return;
      }

      const started = await startSolutionSession({
        title: searchParams.get('title') || 'TYT Matematik Deneme - 1',
        subject: searchParams.get('subject') || 'Matematik',
        studentUsername: searchParams.get('studentUsername') || user?.username || user?.email || 'demo-ogrenci',
        studentName: searchParams.get('studentName') || user?.name || 'Demo Öğrenci',
        className: searchParams.get('className') || user?.className || '',
        durationSeconds: Number(searchParams.get('durationSeconds') || 5400),
        isTeacherPreview,
        plannedExamId: searchParams.get('plannedExamId') || null,
        questionIds: searchParams.get('questionIds')?.split(',').filter(Boolean) || null,
        questionCount: Number(searchParams.get('questionCount') || 20),
      });
      setSession(started);
      setRemainingSeconds(started.durationSeconds || 3600);
      const next = new URLSearchParams(searchParams);
      next.set('sessionId', started.id);
      setSearchParams(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Çözüm oturumu başlatılamadı. Soru bankasında uygun soru olduğundan emin olun.');
    } finally {
      setLoading(false);
    }
  }, [isTeacherPreview, searchParams, setSearchParams, user?.className, user?.email, user?.name, user?.username]);

  useEffect(() => {
    loadOrStart();
  }, [loadOrStart]);

  useEffect(() => {
    if (!session || session.status !== 'Active') return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  // Kopyala/yapıştır ve sağ tık engeli.
  useEffect(() => {
    if (!blockCopyPaste || !examActive) return undefined;
    const prevent = (event) => event.preventDefault();
    const events = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'];
    events.forEach((name) => document.addEventListener(name, prevent));
    return () => events.forEach((name) => document.removeEventListener(name, prevent));
  }, [blockCopyPaste, examActive]);

  // Sekme/pencere değiştirme tespiti — uyarı gösterip ihlal sayar.
  useEffect(() => {
    if (!blockTabChange || !examActive) return undefined;
    const onVisibility = () => {
      if (document.hidden) {
        setViolationCount((value) => value + 1);
        setShowViolation(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [blockTabChange, examActive]);

  // Sayfadan ayrılma / yenileme uyarısı (sınavı bitirmeden çıkış).
  useEffect(() => {
    if (!examActive) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [examActive]);

  // Tam ekran durumunu takip et.
  useEffect(() => {
    if (!requireFullscreen) return undefined;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [requireFullscreen]);

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const guardedBack = useCallback(() => {
    if (examActive) {
      const confirmed = window.confirm('Sınav devam ediyor. Çıkmak için önce "Sınavı Bitir" demelisin. Yine de çıkmak istiyor musun?');
      if (!confirmed) return;
    }
    navigate(-1);
  }, [examActive, navigate]);

  const questions = session?.questions || [];
  const question = questions[currentIndex] || null;
  const answeredCount = questions.filter((item) => item.answer).length;
  const emptyCount = questions.length - answeredCount;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  useEffect(() => {
    setNoteDraft(question?.note || '');
    setOpenAnswerDraft(question?.answer?.openAnswer || '');
    setTeacherComment('');
  }, [question?.answer?.openAnswer, question?.attemptId, question?.note]);

  const refreshSession = useCallback(async () => {
    if (!session?.id) return;
    const loaded = await fetchSolutionSession(session.id);
    setSession(loaded);
  }, [session?.id]);

  const handleAnswer = async (optionIndex, openAnswer = null) => {
    if (!session?.id || !question || saving) return;
    try {
      setSaving(true);
      setAutosaveLabel('Cevap kaydediliyor...');
      const updated = await saveSolutionAnswer(session.id, {
        questionAttemptId: question.attemptId,
        selectedOptionIndex: optionIndex,
        openAnswer,
        timeSpentSeconds: question.timeSpentSeconds || 0,
      });
      setSession(updated);
      setAutosaveLabel('Kaydedildi');
    } catch (err) {
      setError(err.message || 'Cevap kaydedilemedi.');
      setAutosaveLabel('Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleFlag = async (flagType = 'Marked') => {
    if (!session?.id || !question) return;
    try {
      setAutosaveLabel('İşaret kaydediliyor...');
      const updated = await saveSolutionFlag(session.id, {
        questionAttemptId: question.attemptId,
        isFlagged: !question.isFlagged,
        flagType,
      });
      setSession(updated);
      setAutosaveLabel('İşaret kaydedildi');
    } catch (err) {
      setError(err.message || 'İşaret kaydedilemedi.');
    }
  };

  const handleNote = async () => {
    if (!session?.id || !question) return;
    try {
      setAutosaveLabel('Not kaydediliyor...');
      const updated = await saveSolutionNote(session.id, {
        questionAttemptId: question.attemptId,
        note: noteDraft,
      });
      setSession(updated);
      setAutosaveLabel('Not kaydedildi');
    } catch (err) {
      setError(err.message || 'Not kaydedilemedi.');
    }
  };

  const handleTeacherReview = async () => {
    if (!session?.id || !question || !teacherComment.trim()) return;
    try {
      setSaving(true);
      const updated = await addSolutionTeacherReview(session.id, {
        questionAttemptId: question.attemptId,
        comment: teacherComment.trim(),
      });
      setSession(updated);
      setTeacherComment('');
      setAutosaveLabel('Öğretmen yorumu kaydedildi');
    } catch (err) {
      setError(err.message || 'Öğretmen yorumu kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleStroke = async (stroke) => {
    if (!session?.id || !question) return;
    try {
      setAutosaveLabel('Çizim kaydediliyor...');
      await saveSolutionCanvasStroke(session.id, {
        questionAttemptId: question.attemptId,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity,
        pressure: stroke.pressure,
        pointsJson: JSON.stringify(stroke.points || []),
      });
      setAutosaveLabel('Çizim kaydedildi');
    } catch {
      setAutosaveLabel('Çizim yerel cachete kaldı');
    }
  };

  const handleSnapshot = async (dataUrl) => {
    if (!session?.id || !question) return;
    try {
      await saveSolutionCanvasSnapshot(session.id, {
        questionAttemptId: question.attemptId,
        dataUrl,
      });
      await refreshSession();
    } catch {
      setAutosaveLabel('Snapshot daha sonra senkronize edilecek');
    }
  };

  const finish = useCallback(async () => {
    if (!session?.id || saving) return;
    try {
      setSaving(true);
      const completed = await completeSolutionSession(session.id);
      setSummary(completed);
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Sınav bitirilemedi.');
    } finally {
      setSaving(false);
    }
  }, [refreshSession, saving, session?.id]);

  useEffect(() => {
    if (remainingSeconds === 0 && session?.status === 'Active' && !summary && !saving) {
      finish();
    }
  }, [finish, remainingSeconds, saving, session?.status, summary]);

  const imageUrl = buildImageUrl(question?.imagePath);
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  if (loading) {
    return (
      <div className="min-h-[78vh] rounded-[36px] bg-slate-950 p-10 text-white">
        <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
          <p className="text-slate-300">Çözüm ekranı hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="rounded-[36px] border border-red-400/20 bg-slate-950 p-10 text-white">
        <button type="button" onClick={() => navigate(-1)} className="mb-8 inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Geri dön
        </button>
        <div className="mx-auto max-w-2xl rounded-[32px] border border-foreground/10 bg-foreground/5 p-8 text-center">
          <X className="mx-auto h-12 w-12 text-red-300" />
          <h1 className="mt-4 text-2xl font-black">Oturum başlatılamadı</h1>
          <p className="mt-3 text-slate-300">{error}</p>
          <button type="button" onClick={loadOrStart} className="mt-6 rounded-2xl bg-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/25">
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {summary ? (
        <SubmissionSuccessModal
          summary={summary}
          onBackToExams={() => navigate('/s/exams')}
          onResults={() => navigate('/s/exam-results')}
        />
      ) : null}

      <CameraMonitor
        active={requireCamera && examActive}
        publish
        examId={searchParams.get('plannedExamId') || session?.plannedExamId || ''}
        studentUsername={searchParams.get('studentUsername') || user?.username || user?.email || ''}
        studentName={searchParams.get('studentName') || user?.name || 'Öğrenci'}
      />

      {requireFullscreen && !isFullscreen && examActive ? (
        <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100 backdrop-blur">
          <Maximize className="h-4 w-4" />
          Bu sınav tam ekran gerektiriyor.
          <button type="button" onClick={enterFullscreen} className="rounded-xl bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600">
            Tam Ekrana Geç
          </button>
        </div>
      ) : null}

      {showViolation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-[28px] border border-red-400/30 bg-[#1a0d12] p-7 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-black">Sınav ekranından ayrıldın</h2>
            <p className="mt-2 text-sm text-slate-300">
              Sınav sırasında başka sekme/pencereye geçmek yasaktır. Bu durum kaydedildi.
            </p>
            <p className="mt-2 text-sm font-bold text-red-200">Uyarı sayısı: {violationCount}</p>
            <button type="button" onClick={() => setShowViolation(false)} className="mt-5 w-full rounded-2xl bg-orange-500 px-5 py-3 font-black text-white hover:bg-orange-600">
              Sınava Devam Et
            </button>
          </div>
        </div>
      ) : null}
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-h-[82vh] overflow-hidden rounded-[36px] border border-foreground/10 bg-[#06101f] text-white shadow-2xl shadow-slate-950/20">
      <div className="grid min-h-[82vh] grid-cols-[86px_minmax(0,1fr)_300px]">
        <aside className="border-r border-foreground/10 bg-slate-950/80 p-4">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25">
            <Sparkles className="h-6 w-6" />
          </div>
          {[
            [ClipboardList, 'Soru Listesi', 'solution'],
            [NotebookPen, 'Notlar', 'note'],
            [Grid2X2, 'Kağıt', 'solution'],
          ].map(([Icon, label, targetPanel]) => (
            <button key={label} type="button" onClick={() => setPanel(targetPanel)} className="mb-4 flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 text-xs text-slate-300 hover:bg-foreground/10 hover:text-white">
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </aside>

        <main className="min-w-0 p-5">
          <header className="mb-5 flex items-center justify-between rounded-[28px] border border-foreground/10 bg-foreground/5 p-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <button type="button" onClick={guardedBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/10 bg-slate-950/60 text-slate-200 hover:bg-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-black">{session?.title}</h1>
                <p className="text-sm text-slate-400">{session?.subject} · {session?.className || 'Çözüm Oturumu'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full border-4 border-orange-400 p-1 text-center text-sm font-black leading-5 text-orange-200">
                {Math.ceil(remainingSeconds / 60)}
                <span className="block text-[10px]">dk</span>
              </div>
              <div className="min-w-[240px]">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Süre: {formatSeconds(remainingSeconds)}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <button type="button" onClick={finish} disabled={saving || !!summary} className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 disabled:opacity-60">
                Sınavı Bitir
              </button>
            </div>
          </header>

          <div className="space-y-5">
            <section className="rounded-[32px] border border-foreground/10 bg-slate-950/55 p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black shadow-lg shadow-orange-500/25">Soru {currentIndex + 1}</span>
                <span className="rounded-2xl bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">{question?.difficulty || 'Orta'}</span>
                <span className="text-sm text-slate-400">{question?.subject} / {question?.topic}</span>
                <button type="button" onClick={() => handleFlag('Marked')} className={`ml-auto rounded-2xl border px-3 py-2 text-sm ${question?.isFlagged ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-foreground/10 bg-foreground/5 text-slate-300'}`}>
                  <Flag className="mr-2 inline h-4 w-4" /> İşaretle
                </button>
              </div>

              <p className="max-w-5xl text-xl font-semibold leading-9 text-slate-50">{question?.questionText}</p>
              {imageUrl ? (
                <img src={imageUrl} alt="Soru görseli" className="mt-5 max-h-[440px] w-full rounded-3xl border border-foreground/10 object-contain" />
              ) : (
                <div className="mt-6 rounded-[28px] border border-foreground/10 bg-foreground/[0.03] p-10 text-center text-slate-400">
                  Bu soruda görsel yok. Çözümünü aşağıdaki çözüm kağıdına yazabilirsin.
                </div>
              )}

              {question?.options?.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {question.options.map((option, index) => {
                  const selected = question?.answer?.selectedOptionIndex === index;
                  return (
                    <button
                      key={`${option}-${index}`}
                      type="button"
                      onClick={() => handleAnswer(index)}
                      className={`rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${selected ? 'border-orange-400 bg-orange-500/20 text-orange-100 shadow-lg shadow-orange-500/15' : 'border-foreground/10 bg-foreground/5 text-slate-100 hover:border-orange-400/60'}`}
                    >
                      <span className="mr-3 text-orange-300">{optionLabels[index]})</span>
                      {String(option).replace(/^[A-F]\)\s*/i, '')}
                    </button>
                  );
                })}
                </div>
              ) : (
                <div className="mt-6 rounded-[24px] border border-foreground/10 bg-foreground/[0.035] p-4">
                  <label className="mb-3 block text-sm font-bold text-slate-200">Cevabın</label>
                  <textarea value={openAnswerDraft} onChange={(event) => setOpenAnswerDraft(event.target.value)} placeholder="Cevabını buraya yaz..." className="min-h-[120px] w-full resize-none rounded-2xl border border-foreground/10 bg-slate-950/65 p-4 text-white outline-none placeholder:text-slate-500 focus:border-orange-400" />
                  <button type="button" onClick={() => handleAnswer(-1, openAnswerDraft)} disabled={saving || !openAnswerDraft.trim()} className="mt-3 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white disabled:opacity-50">
                    <Save className="mr-2 inline h-4 w-4" /> Cevabı Kaydet
                  </button>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex rounded-[24px] border border-foreground/10 bg-foreground/5 p-1">
                {[
                  ['solution', 'Çözüm', NotebookPen],
                  ['note', 'Not Ekle', MessageSquareText],
                  ['review', 'Öğretmen Yorumu', Send],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPanel(key)}
                    className={`flex-1 rounded-[20px] px-3 py-3 text-sm font-bold ${panel === key ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-300 hover:bg-foreground/10'}`}
                  >
                    <Icon className="mr-2 inline h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {panel === 'solution' ? (
                <DrawingCanvas
                  key={question?.attemptId}
                  questionAttemptId={question?.attemptId}
                  initialSnapshotUrl={buildImageUrl(question?.snapshotUrl)}
                  onStrokeComplete={handleStroke}
                  onSnapshot={handleSnapshot}
                />
              ) : panel === 'note' ? (
                <div className="rounded-[28px] border border-foreground/10 bg-slate-950/80 p-5">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Bu soru için notunu yaz..."
                    className="min-h-[360px] w-full resize-none rounded-3xl border border-foreground/10 bg-slate-900/70 p-5 text-white outline-none placeholder:text-slate-500 focus:border-orange-400"
                  />
                  <button type="button" onClick={handleNote} className="mt-4 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">
                    <Save className="mr-2 inline h-4 w-4" /> Notu Kaydet
                  </button>
                </div>
              ) : (
                <div className="rounded-[28px] border border-foreground/10 bg-slate-950/80 p-5">
                  <div className="space-y-3">
                    {(question?.teacherReviews || []).length === 0 ? (
                      <p className="rounded-2xl bg-foreground/5 p-4 text-sm text-slate-400">Henüz öğretmen yorumu yok.</p>
                    ) : question.teacherReviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
                        <p className="text-sm text-slate-200">{review.comment}</p>
                        <p className="mt-2 text-xs text-slate-500">{review.teacherName}</p>
                      </div>
                    ))}
                  </div>
                  {canReview ? (
                    <>
                      <textarea
                        value={teacherComment}
                        onChange={(event) => setTeacherComment(event.target.value)}
                        placeholder="Öğrenci çözümüne yorum ekle..."
                        className="mt-4 min-h-[170px] w-full resize-none rounded-3xl border border-foreground/10 bg-slate-900/70 p-5 text-white outline-none placeholder:text-slate-500 focus:border-orange-400"
                      />
                      <button type="button" disabled={saving || !teacherComment.trim()} onClick={handleTeacherReview} className="mt-4 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white disabled:opacity-50">
                        <Send className="mr-2 inline h-4 w-4" /> Yorumu Kaydet
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <footer className="mt-5 flex items-center justify-between rounded-[28px] border border-foreground/10 bg-foreground/5 p-4">
            <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} className="rounded-2xl border border-foreground/10 px-5 py-3 font-bold text-slate-200 disabled:opacity-40">
              <ArrowLeft className="mr-2 inline h-4 w-4" /> Önceki Soru
            </button>
            <div className="text-center">
              <p className="font-black">{currentIndex + 1} / {questions.length}</p>
              <p className="text-xs text-slate-500">{autosaveLabel}</p>
            </div>
            <button type="button" disabled={currentIndex >= questions.length - 1} onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))} className="rounded-2xl bg-orange-500 px-5 py-3 font-black text-white disabled:opacity-40">
              Sonraki Soru <ArrowRight className="ml-2 inline h-4 w-4" />
            </button>
          </footer>
        </main>

        <aside className="border-l border-foreground/10 bg-slate-950/65 p-5">
          <div className="mb-5 rounded-[28px] border border-foreground/10 bg-foreground/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-orange-200">Sorular</h2>
              <FileDown className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-5 grid grid-cols-5 gap-3">
              {questions.map((item, index) => {
                const active = currentIndex === index;
                const answered = !!item.answer;
                return (
                  <button
                    key={item.attemptId}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`relative h-12 rounded-2xl border text-sm font-black transition ${active ? 'border-orange-400 bg-orange-500/20 text-orange-100' : answered ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-foreground/10 bg-foreground/5 text-slate-200'}`}
                  >
                    {index + 1}
                    {item.isFlagged ? <Bookmark className="absolute -right-1 -top-1 h-4 w-4 fill-orange-400 text-orange-400" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-5">
            <h3 className="mb-4 font-black text-slate-100">Sınav İlerlemen</h3>
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-purple-500/70 bg-purple-500/10 text-2xl font-black">
                %{progress}
              </div>
              <div className="space-y-3 text-sm text-slate-300">
                <p>Toplam Soru: <b className="text-white">{questions.length}</b></p>
                <p>Çözülen: <b className="text-emerald-300">{answeredCount}</b></p>
                <p>Kalan: <b className="text-orange-200">{emptyCount}</b></p>
              </div>
            </div>
          </div>
          {error ? <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
        </aside>
      </div>
    </motion.div>
    </>
  );
}

function SubmissionSuccessModal({ summary, onBackToExams, onResults }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[36px] border border-emerald-300/25 bg-[#071426] p-8 text-center text-white shadow-2xl shadow-emerald-950/40">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-400/15 ring-1 ring-emerald-300/30">
            <CheckCircle2 className="h-11 w-11 text-emerald-300" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-emerald-200/80">Teslim başarılı</p>
          <h2 className="mt-2 text-3xl font-black">Sınavınız öğretmeninize gönderilmiştir</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
            Cevapların kaydedildi ve sınav teslimleri ile öğrenci sınavları ekranında öğretmenin tarafından görüntülenebilir.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-[28px] border border-foreground/10 bg-foreground/[0.04] p-3">
            <MetricBox label="Doğru" value={summary.correct} />
            <MetricBox label="Yanlış" value={summary.wrong} />
            <MetricBox label="Boş" value={summary.empty} />
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={onBackToExams} className="rounded-2xl bg-orange-500 px-5 py-3 font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600">
              Sınavlarıma Dön
            </button>
            <button type="button" onClick={onResults} className="rounded-2xl border border-foreground/12 bg-foreground/5 px-5 py-3 font-black text-white hover:bg-foreground/10">
              Sonuçlarım
            </button>
            {summary.report?.downloadUrl ? (
              <a href={buildImageUrl(summary.report.downloadUrl)} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-300/30 px-5 py-3 font-black text-emerald-100 hover:bg-emerald-300/10">
                <Download className="mr-2 inline h-4 w-4" /> PDF
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-950/70 p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
    </div>
  );
}
