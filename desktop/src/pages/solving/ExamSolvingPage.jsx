import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bookmark, CheckCircle2, ClipboardList, Clock3, Download, FileDown,
  Flag, Grid2X2, Loader2, MessageSquareText, NotebookPen, Save, Send, Sparkles, X,
} from 'lucide-react';
import { DrawingCanvas } from '../../features/solving/canvas/DrawingCanvas';
import { useApp } from '../../context/AppContext';
import { desktopApiBaseUrl } from '../../lib/auth';
import {
  completeSolutionSession,
  fetchSolutionSession,
  queueSolutionPdf,
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

function normalizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return ['A', 'B', 'C', 'D', 'E'].map((label) => `${label}) Seçenek`);
  }
  return options;
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
  const [teacherComment, setTeacherComment] = useState('');
  const [summary, setSummary] = useState(null);
  const [panel, setPanel] = useState('solution');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const isTeacherPreview = searchParams.get('teacherPreview') === 'true' || String(user?.role || '').toLowerCase().includes('teacher');

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

  const questions = session?.questions || [];
  const question = questions[currentIndex] || null;
  const answeredCount = questions.filter((item) => item.answer).length;
  const emptyCount = questions.length - answeredCount;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  useEffect(() => {
    setNoteDraft(question?.note || '');
    setTeacherComment('');
  }, [question?.attemptId, question?.note]);

  const refreshSession = useCallback(async () => {
    if (!session?.id) return;
    const loaded = await fetchSolutionSession(session.id);
    setSession(loaded);
  }, [session?.id]);

  const handleAnswer = async (optionIndex) => {
    if (!session?.id || !question || saving) return;
    try {
      setSaving(true);
      setAutosaveLabel('Cevap kaydediliyor...');
      const updated = await saveSolutionAnswer(session.id, {
        questionAttemptId: question.attemptId,
        selectedOptionIndex: optionIndex,
        openAnswer: null,
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

  const finish = async () => {
    if (!session?.id || saving) return;
    try {
      setSaving(true);
      const completed = await completeSolutionSession(session.id);
      const report = await queueSolutionPdf(session.id);
      setSummary({ ...completed, report });
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Sınav bitirilemedi.');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="mx-auto max-w-2xl rounded-[32px] border border-white/10 bg-white/5 p-8 text-center">
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-h-[82vh] overflow-hidden rounded-[36px] border border-white/10 bg-[#06101f] text-white shadow-2xl shadow-slate-950/20">
      <div className="grid min-h-[82vh] grid-cols-[86px_1fr_330px]">
        <aside className="border-r border-white/10 bg-slate-950/80 p-4">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25">
            <Sparkles className="h-6 w-6" />
          </div>
          {[
            [ClipboardList, 'Soru Listesi'],
            [NotebookPen, 'Notlar'],
            [Grid2X2, 'Kağıt'],
          ].map(([Icon, label]) => (
            <button key={label} type="button" className="mb-4 flex w-full flex-col items-center gap-2 rounded-2xl px-2 py-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white">
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </aside>

        <main className="min-w-0 p-5">
          <header className="mb-5 flex items-center justify-between rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-slate-200 hover:bg-white/10">
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
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <button type="button" onClick={finish} disabled={saving} className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 disabled:opacity-60">
                Sınavı Bitir
              </button>
            </div>
          </header>

          {summary ? (
            <div className="mb-5 rounded-[28px] border border-emerald-400/30 bg-emerald-500/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                  <div>
                    <h2 className="text-lg font-black">Çözüm tamamlandı</h2>
                    <p className="text-sm text-emerald-100/80">PDF raporu oluşturuldu ve öğretmen merkezine gönderildi.</p>
                  </div>
                </div>
                {summary.report?.downloadUrl ? (
                  <a href={buildImageUrl(summary.report.downloadUrl)} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-100">
                    <Download className="mr-2 inline h-4 w-4" /> PDF İndir
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-[32px] border border-white/10 bg-slate-950/55 p-6">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-black shadow-lg shadow-orange-500/25">Soru {currentIndex + 1}</span>
                <span className="rounded-2xl bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">{question?.difficulty || 'Orta'}</span>
                <span className="text-sm text-slate-400">{question?.subject} / {question?.topic}</span>
                <button type="button" onClick={() => handleFlag('Marked')} className={`ml-auto rounded-2xl border px-3 py-2 text-sm ${question?.isFlagged ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                  <Flag className="mr-2 inline h-4 w-4" /> İşaretle
                </button>
              </div>

              <p className="text-lg font-semibold leading-8 text-slate-50">{question?.questionText}</p>
              {imageUrl ? (
                <img src={imageUrl} alt="Soru görseli" className="mt-5 max-h-[360px] w-full rounded-3xl border border-white/10 object-contain" />
              ) : (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">
                  Bu soruda görsel yok. Çözümünü sağdaki kağıda yazabilirsin.
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {normalizeOptions(question?.options).map((option, index) => {
                  const selected = question?.answer?.selectedOptionIndex === index;
                  return (
                    <button
                      key={`${option}-${index}`}
                      type="button"
                      onClick={() => handleAnswer(index)}
                      className={`rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${selected ? 'border-orange-400 bg-orange-500/20 text-orange-100 shadow-lg shadow-orange-500/15' : 'border-white/10 bg-white/5 text-slate-100 hover:border-orange-400/60'}`}
                    >
                      <span className="mr-3 text-orange-300">{optionLabels[index]})</span>
                      {String(option).replace(/^[A-F]\)\s*/i, '')}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex rounded-[24px] border border-white/10 bg-white/5 p-1">
                {[
                  ['solution', 'Çözüm', NotebookPen],
                  ['note', 'Not Ekle', MessageSquareText],
                  ['review', 'Öğretmen Yorumu', Send],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPanel(key)}
                    className={`flex-1 rounded-[20px] px-3 py-3 text-sm font-bold ${panel === key ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-300 hover:bg-white/10'}`}
                  >
                    <Icon className="mr-2 inline h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {panel === 'solution' ? (
                <DrawingCanvas
                  questionAttemptId={question?.attemptId}
                  initialSnapshotUrl={question?.snapshotUrl}
                  onStrokeComplete={handleStroke}
                  onSnapshot={handleSnapshot}
                />
              ) : panel === 'note' ? (
                <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Bu soru için notunu yaz..."
                    className="min-h-[360px] w-full resize-none rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-white outline-none placeholder:text-slate-500 focus:border-orange-400"
                  />
                  <button type="button" onClick={handleNote} className="mt-4 rounded-2xl bg-orange-500 px-5 py-3 font-black text-white">
                    <Save className="mr-2 inline h-4 w-4" /> Notu Kaydet
                  </button>
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5">
                  <div className="space-y-3">
                    {(question?.teacherReviews || []).length === 0 ? (
                      <p className="rounded-2xl bg-white/5 p-4 text-sm text-slate-400">Henüz öğretmen yorumu yok.</p>
                    ) : question.teacherReviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-slate-200">{review.comment}</p>
                        <p className="mt-2 text-xs text-slate-500">{review.teacherName}</p>
                      </div>
                    ))}
                  </div>
                  {isTeacherPreview ? (
                    <>
                      <textarea
                        value={teacherComment}
                        onChange={(event) => setTeacherComment(event.target.value)}
                        placeholder="Öğrenci çözümüne yorum ekle..."
                        className="mt-4 min-h-[170px] w-full resize-none rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-white outline-none placeholder:text-slate-500 focus:border-orange-400"
                      />
                      <p className="mt-3 text-xs text-slate-500">Yorum API'si backendde hazır. Öğretmen inceleme merkezinden bu alan genişletilecek.</p>
                    </>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <footer className="mt-5 flex items-center justify-between rounded-[28px] border border-white/10 bg-white/5 p-4">
            <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} className="rounded-2xl border border-white/10 px-5 py-3 font-bold text-slate-200 disabled:opacity-40">
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

        <aside className="border-l border-white/10 bg-slate-950/65 p-5">
          <div className="mb-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
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
                    className={`relative h-12 rounded-2xl border text-sm font-black transition ${active ? 'border-orange-400 bg-orange-500/20 text-orange-100' : answered ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-200'}`}
                  >
                    {index + 1}
                    {item.isFlagged ? <Bookmark className="absolute -right-1 -top-1 h-4 w-4 fill-orange-400 text-orange-400" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
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
  );
}
