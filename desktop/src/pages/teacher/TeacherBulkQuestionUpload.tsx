import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import {
  ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Copy,
  Download, Edit3, Eye, FileArchive, FileSpreadsheet, FileText, Filter, Grid2X2,
  History, Image as ImageIcon, LayoutList, Loader2, Save, Search, Send, Trash2,
  UploadCloud, X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { desktopApiBaseUrl, loadDesktopSession } from '../../lib/auth';
import {
  bulkUpdateQuestionImport,
  commitQuestionImport,
  deleteQuestionImportJob,
  deleteQuestionImportQuestion,
  duplicateQuestionImportQuestion,
  fetchQuestionImportHistory,
  fetchQuestionImportJob,
  updateQuestionImportQuestion,
  uploadQuestionImportFile,
} from '../../lib/api/modules';

const steps = [
  { key: 1, title: 'Dosya Yükleme', desc: 'Dosyanızı seçin' },
  { key: 2, title: 'İçerik Analizi', desc: 'Sorular ayrıştırılıyor' },
  { key: 3, title: 'Önizleme', desc: 'Soruları kontrol edin' },
  { key: 4, title: 'Düzenleme', desc: 'Kategorileri eşleştirin' },
  { key: 5, title: 'Aktarım', desc: 'Soru bankasına kaydedin' },
];

const allowedExtensions = '.pdf,.docx,.xlsx,.csv,.tsv,.txt,.zip,.png,.jpg,.jpeg,.webp';
const difficultyOptions = ['Kolay', 'Orta', 'Zor'];
const typeOptions = ['Çoktan Seçmeli', 'Açık Uçlu', 'Doğru / Yanlış'];
const targetOptions = ['Soru Bankası', 'Deneme Sınavı', 'Online Sınav', 'Ödev', 'Konu Anlatımı Sonu Testi'];

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status) {
  const map = {
    Pending: 'Bekliyor',
    Analyzing: 'Analiz Ediliyor',
    Ready: 'Hazır',
    NeedsReview: 'İnceleme Gerekli',
    Imported: 'Aktarıldı',
    PartiallyImported: 'Kısmi Aktarım',
  };
  return map[status] || status || 'Bekliyor';
}

function resolveFileUrl(fileUrl) {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  return `${desktopApiBaseUrl}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`;
}

function createEmptyEditDraft() {
  return {
    questionText: '',
    subject: '',
    grade: '',
    unit: '',
    topic: '',
    learningOutcome: '',
    difficulty: 'Orta',
    type: 'Çoktan Seçmeli',
    points: 1,
    correctAnswer: '',
    explanation: '',
    imageUrl: '',
    options: [],
  };
}

function toEditDraft(question) {
  return {
    ...createEmptyEditDraft(),
    questionText: question?.questionText || '',
    subject: question?.subject || 'Genel',
    grade: question?.grade || 'Tüm Sınıflar',
    unit: question?.unit || '',
    topic: question?.topic || 'Genel',
    learningOutcome: question?.learningOutcome || '',
    difficulty: question?.difficulty || 'Orta',
    type: question?.type || 'Çoktan Seçmeli',
    points: question?.points || 1,
    correctAnswer: question?.correctAnswer || '',
    explanation: question?.explanation || '',
    imageUrl: question?.imageUrl || '',
    options: Array.isArray(question?.options) ? question.options : [],
  };
}

function FileTypeIcon({ fileName = '' }) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'zip') return <FileArchive className="h-7 w-7 text-purple-300" />;
  if (['xlsx', 'csv', 'tsv'].includes(extension)) return <FileSpreadsheet className="h-7 w-7 text-emerald-300" />;
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return <ImageIcon className="h-7 w-7 text-sky-300" />;
  return <FileText className="h-7 w-7 text-orange-300" />;
}

function StepRail({ currentStep }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.9)]">
      <div className="grid gap-3 lg:grid-cols-5">
        {steps.map((step, index) => {
          const active = currentStep === step.key;
          const completed = currentStep > step.key;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-black ${active ? 'border-orange-400 bg-orange-500 text-white shadow-[0_0_26px_rgba(249,115,22,0.45)]' : completed ? 'border-blue-400 bg-blue-500 text-white' : 'border-foreground/15 bg-foreground/5 text-slate-300'}`}>
                {completed ? <Check className="h-5 w-5" /> : step.key}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{step.title}</p>
                <p className="truncate text-xs text-slate-400">{step.desc}</p>
              </div>
              {index < steps.length - 1 ? <div className="hidden h-px flex-1 bg-foreground/15 lg:block" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color = 'text-orange-300' }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export default function TeacherBulkQuestionUpload() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editDraft, setEditDraft] = useState(createEmptyEditDraft());
  const [bulkDraft, setBulkDraft] = useState({
    subject: '',
    grade: '',
    unit: '',
    topic: '',
    learningOutcome: '',
    difficulty: '',
    type: '',
    points: '',
  });
  const [target, setTarget] = useState(targetOptions[0]);
  const [busyAction, setBusyAction] = useState('');

  const questions = useMemo(() => job?.questions || [], [job?.questions]);
  const filteredQuestions = useMemo(() => questions.filter((question) => {
    const haystack = `${question.questionText} ${question.subject} ${question.topic} ${question.learningOutcome}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
    return matchesQuery && matchesDifficulty;
  }), [questions, query, difficultyFilter]);

  const selectedQuestions = useMemo(
    () => questions.filter((question) => selectedIds.includes(question.id)),
    [questions, selectedIds],
  );

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchQuestionImportHistory());
    } catch (error) {
      toast({
        title: 'Yükleme geçmişi alınamadı',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const refreshJob = useCallback(async (id = job?.id) => {
    if (!id) return;
    try {
      const latest = await fetchQuestionImportJob(id);
      setJob(latest);
      if (latest?.status === 'Ready' || latest?.status === 'NeedsReview') {
        setCurrentStep((prev) => Math.max(prev, latest.questions?.length > 0 ? 3 : 2));
      }
    } catch (error) {
      toast({
        title: 'Import durumu alınamadı',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  }, [job?.id, toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!job?.id) return undefined;
    const session = loadDesktopSession();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(new URL('/hubs/question-import', desktopApiBaseUrl).toString(), {
        accessTokenFactory: () => session?.accessToken || '',
      })
      .withAutomaticReconnect()
      .build();

    connection.on('QuestionImportProgress', (payload) => {
      if (payload?.id === job.id) {
        setJob(payload);
      }
    });

    connection.start()
      .then(() => connection.invoke('JoinImport', job.id))
      .catch(() => {});

    return () => {
      connection.invoke('LeaveImport', job.id).catch(() => {});
      connection.stop().catch(() => {});
    };
  }, [job?.id]);

  useEffect(() => {
    if (!job?.id || !['Pending', 'Analyzing'].includes(job.status)) return undefined;
    pollingRef.current = window.setInterval(() => refreshJob(job.id), 1500);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [job?.id, job?.status, refreshJob]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => questions.some((question) => question.id === id)));
  }, [questions]);

  const handleFile = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      setCurrentStep(2);
      const formData = new FormData();
      formData.append('file', file);
      const created = await uploadQuestionImportFile(formData);
      setJob(created);
      setSelectedIds((created.questions || []).map((question) => question.id));
      setCurrentStep((created.questions || []).length > 0 ? 3 : 2);
      await loadHistory();
      toast({
        title: 'Analiz tamamlandı',
        description: `${created.totalQuestions || 0} soru bulundu.`,
      });
    } catch (error) {
      setCurrentStep(1);
      toast({
        title: 'Dosya yüklenemedi',
        description: error.message || 'Dosya formatını kontrol edin.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openHistoryJob = async (item) => {
    setHistoryOpen(false);
    setCurrentStep(2);
    await refreshJob(item.id);
  };

  const removeHistoryJob = async (item) => {
    try {
      setBusyAction(`history-${item.id}`);
      await deleteQuestionImportJob(item.id);
      if (job?.id === item.id) setJob(null);
      await loadHistory();
      toast({ title: 'Yükleme geçmişten silindi' });
    } catch (error) {
      toast({
        title: 'Kayıt silinemedi',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const toggleQuestion = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const visibleIds = filteredQuestions.map((question) => question.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])]);
  };

  const openEdit = (question) => {
    setEditingQuestion(question);
    setEditDraft(toEditDraft(question));
  };

  const updateOption = (index, key, value) => {
    setEditDraft((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, [key]: value } : option
      )),
    }));
  };

  const saveEdit = async () => {
    if (!job?.id || !editingQuestion) return;
    try {
      setBusyAction('edit');
      const updated = await updateQuestionImportQuestion(job.id, editingQuestion.id, editDraft);
      setJob((prev) => ({
        ...prev,
        questions: prev.questions.map((question) => (question.id === updated.id ? updated : question)),
      }));
      setEditingQuestion(null);
      toast({ title: 'Soru güncellendi' });
    } catch (error) {
      toast({
        title: 'Soru güncellenemedi',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const duplicateQuestion = async (question) => {
    try {
      setBusyAction(`duplicate-${question.id}`);
      await duplicateQuestionImportQuestion(job.id, question.id);
      await refreshJob(job.id);
      toast({ title: 'Soru kopyalandı' });
    } catch (error) {
      toast({
        title: 'Soru kopyalanamadı',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const deleteQuestion = async (question) => {
    try {
      setBusyAction(`delete-${question.id}`);
      await deleteQuestionImportQuestion(job.id, question.id);
      await refreshJob(job.id);
      toast({ title: 'Soru kaldırıldı' });
    } catch (error) {
      toast({
        title: 'Soru kaldırılamadı',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const applyBulk = async () => {
    if (!job?.id) return;
    try {
      setBusyAction('bulk');
      const payload = {
        questionIds: selectedIds,
        ...Object.fromEntries(Object.entries(bulkDraft).map(([key, value]) => [key, value === '' ? null : value])),
        points: bulkDraft.points ? Number(bulkDraft.points) : null,
      };
      const updated = await bulkUpdateQuestionImport(job.id, payload);
      setJob(updated);
      setCurrentStep(5);
      toast({ title: 'Toplu düzenleme uygulandı' });
    } catch (error) {
      toast({
        title: 'Toplu düzenleme başarısız',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const commitSelected = async () => {
    if (!job?.id) return;
    try {
      setBusyAction('commit');
      const response = await commitQuestionImport(job.id, {
        questionIds: selectedIds.length > 0 ? selectedIds : questions.map((question) => question.id),
        target,
      });
      await refreshJob(job.id);
      await loadHistory();
      toast({
        title: 'Aktarım tamamlandı',
        description: `${response.importedCount || 0} soru kaydedildi, ${response.failedCount || 0} hata.`,
      });
    } catch (error) {
      toast({
        title: 'Aktarım yapılamadı',
        description: error.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction('');
    }
  };

  const downloadSource = () => {
    const url = resolveFileUrl(job?.fileUrl);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen space-y-5 bg-[hsl(var(--ci-card))] p-4 text-foreground md:p-6"
      data-testid="teacher-bulk-question-upload-page"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_6%,rgba(255,157,46,0.16),transparent_28%),radial-gradient(circle_at_70%_10%,rgba(77,163,255,0.14),transparent_26%)]" />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button type="button" onClick={() => navigate('/t/question-bank')} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Soru Bankası
              <ChevronRight className="h-4 w-4" />
              Toplu Soru Yükleme
            </button>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Toplu Soru Yükleme</h1>
            <p className="mt-1 text-sm text-slate-400">PDF, Word, Excel, CSV, ZIP ve görselleri analiz ederek soru bankasına aktarın.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => setHistoryOpen((prev) => !prev)}>
              <History className="mr-2 h-4 w-4" />
              Yükleme Geçmişi
            </Button>
            <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={downloadSource} disabled={!job?.fileUrl}>
              <Download className="mr-2 h-4 w-4" />
              Kaynak Dosya
            </Button>
          </div>
        </div>

        <StepRail currentStep={currentStep} />

        {historyOpen ? (
          <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.95)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Yükleme Geçmişi</p>
                <p className="text-xs text-slate-400">Geçmiş import işleriniz backend’den canlı alınır.</p>
              </div>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white" onClick={loadHistory}>Yenile</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-sm text-slate-400">Henüz yükleme kaydı yok.</div>
              ) : history.map((item) => (
                <div key={item.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <FileTypeIcon fileName={item.fileName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{item.fileName}</p>
                        <p className="text-xs text-slate-400">{formatDate(item.uploadedAtUtc)} • {formatBytes(item.sizeBytes)}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">{statusLabel(item.status)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>{item.totalQuestions} soru</span>
                    <span>{item.importedQuestionCount} aktarıldı</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" className="flex-1 bg-blue-600 text-white hover:bg-blue-500" onClick={() => openHistoryJob(item)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Aç
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white" onClick={() => removeHistoryJob(item)} disabled={busyAction === `history-${item.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') fileInputRef.current?.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  handleFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${dragging ? 'border-orange-300 bg-orange-500/10' : 'border-blue-400/40 bg-foreground/[0.025] hover:border-orange-400/70 hover:bg-orange-500/5'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={allowedExtensions}
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))]">
                  {uploading ? <Loader2 className="h-8 w-8 animate-spin text-orange-300" /> : <UploadCloud className="h-8 w-8 text-blue-300" />}
                </div>
                <p className="text-lg font-black text-white">Dosyanızı yükleyin</p>
                <p className="mt-2 text-sm text-slate-400">PDF, DOCX, XLSX, CSV, JPG, PNG veya ZIP</p>
                <Button className="mt-5 bg-orange-500 px-8 text-white hover:bg-orange-600" disabled={uploading}>
                  Dosya Seç
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
                {job ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground/5">
                          <FileTypeIcon fileName={job.fileName} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-black text-white">{job.fileName}</h2>
                          <p className="text-sm text-slate-400">{formatBytes(job.sizeBytes)} • {formatDate(job.uploadedAtUtc)} • {job.uploadedBy}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-200">{statusLabel(job.status)}</span>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-300">{job.status === 'Analyzing' ? 'İçerik analiz ediliyor...' : 'Analiz sonucu hazır'}</span>
                        <span className="font-black text-white">%{job.progress || 0}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 transition-all" style={{ width: `${job.progress || 0}%` }} />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Toplam Soru" value={job.totalQuestions || 0} icon={ClipboardCheck} color="text-orange-300" />
                      <MetricCard label="Bulunan Görsel" value={job.imageCount || 0} icon={ImageIcon} color="text-sky-300" />
                      <MetricCard label="Algılanan Tablo" value={job.tableCount || 0} icon={Grid2X2} color="text-blue-300" />
                      <MetricCard label="Formül İzi" value={job.formulaCount || 0} icon={FileText} color="text-purple-300" />
                    </div>

                    {job.totalQuestions === 0 ? (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                        Bu dosya saklandı ancak otomatik soru ayrıştırma için okunabilir metin bulunamadı. Görsel tabanlı PDF veya fotoğraflar için OCR sağlayıcısı bağlandığında aynı API gerçek OCR sonucunu işleyecek.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-[230px] flex-col justify-center rounded-xl border border-dashed border-foreground/10 p-6 text-center">
                    <p className="text-lg font-black text-white">Henüz import işi yok</p>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">Dosya yükleyin veya geçmişten bir import seçin. Bu alan yalnızca backend’den dönen canlı job verisini gösterir.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">Bulunan Sorular ({filteredQuestions.length})</h2>
                  <p className="text-sm text-slate-400">{selectedIds.length} soru seçili</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sorularda ara..." className="h-10 w-full border-foreground/10 bg-[hsl(var(--ci-card))] pl-9 text-foreground placeholder:text-slate-500 md:w-64" />
                  </div>
                  <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} className="h-10 rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                    <option value="all">Tüm Zorluklar</option>
                    {difficultyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={toggleAll}>
                    <Filter className="mr-2 h-4 w-4" />
                    Tümünü Seç
                  </Button>
                  <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
                    {viewMode === 'list' ? <Grid2X2 className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className={viewMode === 'grid' ? 'grid gap-3 lg:grid-cols-2' : 'space-y-3'}>
                {filteredQuestions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-slate-400">Gösterilecek soru yok.</div>
                ) : filteredQuestions.map((question) => {
                  const selected = selectedIds.includes(question.id);
                  return (
                    <div key={question.id} className={`rounded-2xl border p-4 transition ${selected ? 'border-orange-400 bg-orange-500/5 shadow-[0_0_30px_rgba(255,157,46,0.08)]' : 'border-foreground/10 bg-[hsl(var(--ci-card)/0.7)]'}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <button type="button" onClick={() => toggleQuestion(question.id)} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-orange-400 bg-orange-500 text-white' : 'border-foreground/20 text-transparent'}`}>
                          <Check className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-400/50 text-sm font-black text-orange-200">{question.order}</span>
                            <span className="rounded-full bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-200">{question.subject || 'Genel'}</span>
                            <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-200">{question.topic || 'Genel'}</span>
                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-200">{question.difficulty || 'Orta'}</span>
                            {question.importStatus === 'Imported' ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-200">Aktarıldı</span> : null}
                          </div>
                          <p className="text-base font-semibold leading-7 text-white">{question.questionText}</p>
                          {question.options?.length > 0 ? (
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                              {question.options.map((option) => (
                                <div key={`${question.id}-${option.label}`} className={`rounded-lg border px-3 py-2 text-sm ${option.isCorrect ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-foreground/10 bg-foreground/[0.025] text-slate-300'}`}>
                                  <span className="mr-2 font-black">{option.label}</span>
                                  {option.text}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {question.correctAnswer ? <p className="mt-3 text-sm font-bold text-emerald-300">Doğru Cevap: {question.correctAnswer}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-2 md:flex-col">
                          <Button size="icon" variant="outline" className="border-foreground/10 bg-foreground/5 text-slate-200 hover:bg-foreground/10 hover:text-white" onClick={() => openEdit(question)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="border-foreground/10 bg-foreground/5 text-slate-200 hover:bg-foreground/10 hover:text-white" onClick={() => duplicateQuestion(question)} disabled={busyAction === `duplicate-${question.id}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white" onClick={() => deleteQuestion(question)} disabled={busyAction === `delete-${question.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
              <h3 className="font-black text-white">Yükleme Özeti</h3>
              <div className="mt-5 flex items-center gap-4">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[conic-gradient(#30D158_0_72%,#FF9D2E_72%_88%,#ef4444_88%_100%)]">
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[hsl(var(--ci-card))]">
                    <span className="text-2xl font-black text-white">{job?.totalQuestions || 0}</span>
                    <span className="text-xs text-slate-400">Toplam</span>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <p className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Hazır: {questions.filter((item) => item.importStatus !== 'Failed').length}</p>
                  <p className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-orange-400" /> Seçili: {selectedIds.length}</p>
                  <p className="flex items-center gap-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-red-400" /> Hatalı: {job?.failedQuestionCount || 0}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
              <h3 className="font-black text-white">Toplu Düzenleme</h3>
              <div className="mt-4 space-y-3">
                {[
                  ['subject', 'Ders', 'Matematik'],
                  ['grade', 'Sınıf', '7. Sınıf'],
                  ['unit', 'Ünite', 'Üslü Sayılar'],
                  ['topic', 'Konu', 'Üs Alma İşlemi'],
                  ['learningOutcome', 'Kazanım', 'M.7.1.3'],
                  ['points', 'Puan', '1'],
                ].map(([key, label, placeholder]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs text-slate-400">{label}</span>
                    <Input value={bulkDraft[key]} onChange={(event) => setBulkDraft((prev) => ({ ...prev, [key]: event.target.value }))} placeholder={placeholder} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground placeholder:text-slate-600" />
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Zorluk</span>
                  <select value={bulkDraft.difficulty} onChange={(event) => setBulkDraft((prev) => ({ ...prev, difficulty: event.target.value }))} className="h-10 w-full rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                    <option value="">Değiştirme</option>
                    {difficultyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Soru Tipi</span>
                  <select value={bulkDraft.type} onChange={(event) => setBulkDraft((prev) => ({ ...prev, type: event.target.value }))} className="h-10 w-full rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                    <option value="">Değiştirme</option>
                    {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-500" onClick={applyBulk} disabled={!job?.id || selectedIds.length === 0 || busyAction === 'bulk'}>
                  {busyAction === 'bulk' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Seçilenlere Uygula
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
              <h3 className="font-black text-white">Aktarım</h3>
              <label className="mt-4 block">
                <span className="mb-1 block text-xs text-slate-400">Aktarım Hedefi</span>
                <select value={target} onChange={(event) => setTarget(event.target.value)} className="h-10 w-full rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                  {targetOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <Button className="mt-4 w-full bg-orange-500 text-white hover:bg-orange-600" onClick={commitSelected} disabled={!job?.id || questions.length === 0 || busyAction === 'commit'}>
                {busyAction === 'commit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Soru Bankasına Aktar
              </Button>
              <Button variant="outline" className="mt-3 w-full border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => navigate('/t/question-bank')}>
                Soru Bankasına Dön
              </Button>
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-400">{job ? `${questions.length} sorudan ${filteredQuestions.length} tanesi gösteriliyor.` : 'Import başlatmak için dosya seçin.'}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" disabled={currentStep <= 1} onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Geri
            </Button>
            <Button className="bg-orange-500 text-white hover:bg-orange-600" disabled={!job} onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}>
              Sonraki Adım
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {editingQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Soru Düzenle</h2>
                <p className="text-sm text-slate-400">Değişiklikler backend import job kaydına yazılır.</p>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white" onClick={() => setEditingQuestion(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs text-slate-400">Soru Metni</span>
                <Textarea value={editDraft.questionText} onChange={(event) => setEditDraft((prev) => ({ ...prev, questionText: event.target.value }))} className="min-h-[120px] border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
              </label>
              {[
                ['subject', 'Ders'],
                ['grade', 'Sınıf'],
                ['unit', 'Ünite'],
                ['topic', 'Konu'],
                ['learningOutcome', 'Kazanım'],
                ['points', 'Puan'],
                ['correctAnswer', 'Doğru Cevap'],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="mb-1 block text-xs text-slate-400">{label}</span>
                  <Input value={editDraft[key]} onChange={(event) => setEditDraft((prev) => ({ ...prev, [key]: key === 'points' ? Number(event.target.value || 0) : event.target.value }))} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
                </label>
              ))}
              <label>
                <span className="mb-1 block text-xs text-slate-400">Zorluk</span>
                <select value={editDraft.difficulty} onChange={(event) => setEditDraft((prev) => ({ ...prev, difficulty: event.target.value }))} className="h-10 w-full rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                  {difficultyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-400">Soru Tipi</span>
                <select value={editDraft.type} onChange={(event) => setEditDraft((prev) => ({ ...prev, type: event.target.value }))} className="h-10 w-full rounded-lg border border-foreground/10 bg-[hsl(var(--ci-card))] px-3 text-sm text-foreground">
                  {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs text-slate-400">Açıklama / Çözüm</span>
                <Textarea value={editDraft.explanation || ''} onChange={(event) => setEditDraft((prev) => ({ ...prev, explanation: event.target.value }))} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-bold text-white">Şıklar</p>
              {editDraft.options.map((option, index) => (
                <div key={`${option.label}-${index}`} className="grid gap-2 md:grid-cols-[80px_minmax(0,1fr)_120px]">
                  <Input value={option.label} onChange={(event) => updateOption(index, 'label', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
                  <Input value={option.text} onChange={(event) => updateOption(index, 'text', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
                  <Button variant="outline" className={`${option.isCorrect ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100' : 'border-foreground/10 bg-foreground/5 text-white'} hover:bg-foreground/10 hover:text-white`} onClick={() => {
                    setEditDraft((prev) => ({
                      ...prev,
                      correctAnswer: option.label,
                      options: prev.options.map((item, optionIndex) => ({ ...item, isCorrect: optionIndex === index })),
                    }));
                  }}>
                    Doğru
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => setEditingQuestion(null)}>Vazgeç</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveEdit} disabled={busyAction === 'edit'}>
                {busyAction === 'edit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
