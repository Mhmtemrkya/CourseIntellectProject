import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Search, Plus, Upload, Download, Trash2, BookOpen, Zap, Pencil, Wand2, BarChart3, Users, FileText, Lightbulb,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { desktopApiBaseUrl } from '../../lib/auth';
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  fetchClasses,
  fetchStudents,
  fetchQuestionBank,
  uploadFile,
  updateQuestionBankItem,
} from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const createQuestionDraft = () => ({
  id: `draft-${Math.random().toString(36).slice(2, 9)}`,
  question: '',
  subject: DEFAULT_SUBJECTS[0],
  topic: '',
  difficulty: 'Orta',
  type: 'Açık Uçlu',
  options: '',
  correctOptionIndex: '0',
  expectedAnswer: '',
  classTargets: ['Tüm Sınıflar'],
  imagePlacement: 'Top',
  questionSetKey: '',
  questionSetTitle: '',
  questionOrder: null,
  revealCorrectAnswerToStudent: false,
  imageFile: null,
  imagePath: '',
  solutionFile: null,
  solutionAssetPath: '',
  solutionAssetType: '',
});

const DEFAULT_SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce'];
const FALLBACK_CLASSES = [];

function normalizeQuestionType(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function isMultipleChoice(type = '') {
  const normalized = normalizeQuestionType(type);
  return normalized.includes('coktan') || normalized.includes('secmeli');
}

function isTrueFalse(type = '') {
  const normalized = normalizeQuestionType(type);
  return normalized.includes('dogru') || normalized.includes('yanlis');
}

function buildQuestionSetKey(item) {
  if (item.questionSetKey) return item.questionSetKey;
  const createdAt = item.createdAt ? new Date(item.createdAt) : null;
  const bucket = createdAt && !Number.isNaN(createdAt.getTime())
    ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')} ${String(createdAt.getHours()).padStart(2, '0')}:${Math.floor(createdAt.getMinutes() / 10)}`
    : (item.createdAt || '').slice(0, 16);
  const classes = [...(item.classTargets || [])].sort().join(',');
  return `${item.teacher}|${item.subject}|${item.topic}|${bucket}|${classes}`;
}

function buildQuestionSets(items) {
  const groups = new Map();
  [...items]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .forEach((item) => {
    const key = buildQuestionSetKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return Array.from(groups.entries()).map(([key, questions]) => ({
    key,
    title: questions[0]?.questionSetTitle || questions[0]?.topic || 'Soru Seti',
    subject: questions[0]?.subject || 'Genel',
    difficulty: questions[0]?.difficulty || 'Orta',
    questions: [...questions].sort((a, b) => {
      const aOrder = a.questionOrder ?? 9999;
      const bOrder = b.questionOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }),
    totalUsage: questions.reduce((sum, question) => sum + Number(question.usageCount || 0), 0),
  })).sort((a, b) => new Date(b.questions[0]?.createdAt || 0) - new Date(a.questions[0]?.createdAt || 0));
}

function resolveQuestionImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${desktopApiBaseUrl}${path}`;
  return `${desktopApiBaseUrl}/${path}`;
}

function getSubjectTheme(subject = '') {
  const normalized = decodeSubject(subject).toLowerCase();
  if (normalized.includes('mat')) return { gradient: 'from-blue-600 to-indigo-700', accent: 'bg-blue-600', soft: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (normalized.includes('fiz')) return { gradient: 'from-violet-600 to-purple-700', accent: 'bg-violet-600', soft: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (normalized.includes('kim')) return { gradient: 'from-orange-500 to-red-600', accent: 'bg-orange-500', soft: 'bg-orange-50 text-orange-700 border-orange-200' };
  if (normalized.includes('biy')) return { gradient: 'from-emerald-500 to-green-700', accent: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (normalized.includes('türk') || normalized.includes('turk')) return { gradient: 'from-rose-500 to-red-700', accent: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (normalized.includes('ing')) return { gradient: 'from-cyan-500 to-sky-700', accent: 'bg-cyan-500', soft: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
  return { gradient: 'from-teal-500 to-cyan-700', accent: 'bg-teal-500', soft: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function getSubjectMark(subject = '') {
  const normalized = decodeSubject(subject).toLowerCase();
  if (normalized.includes('mat')) return 'x²';
  if (normalized.includes('fiz')) return 'F';
  if (normalized.includes('kim')) return 'H₂O';
  if (normalized.includes('biy')) return 'DNA';
  if (normalized.includes('türk') || normalized.includes('turk')) return 'Aa';
  if (normalized.includes('ing')) return 'EN';
  return 'QB';
}

function getSubjectTagline(subject = '') {
  const normalized = decodeSubject(subject).toLowerCase();
  if (normalized.includes('mat')) return 'FORMÜL • PROBLEM • MANTIK';
  if (normalized.includes('fiz')) return 'HAREKET • ENERJİ • KUVVET';
  if (normalized.includes('kim')) return 'TEPKİME • MADDE • BAĞ';
  if (normalized.includes('biy')) return 'CANLI • HÜCRE • SİSTEM';
  if (normalized.includes('türk') || normalized.includes('turk')) return 'DİL • ANLAM • PARAGRAF';
  if (normalized.includes('ing')) return 'VOCAB • GRAMMAR • READING';
  return 'SET • PRATİK • TEKRAR';
}

function decodeSubject(subject = '') {
  return subject
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
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&');
}

function EmptyQuestionBankState({ onCreate, onImport }) {
  const floatingIcons = [
    { Icon: FileText, className: 'left-[16%] top-[76px]', color: 'text-orange-400 border-orange-400/25 shadow-orange-500/10' },
    { Icon: Wand2, className: 'right-[16%] top-[78px]', color: 'text-purple-400 border-purple-400/25 shadow-purple-500/10' },
    { Icon: Users, className: 'left-[22%] bottom-[44px]', color: 'text-sky-400 border-sky-400/25 shadow-sky-500/10' },
    { Icon: BarChart3, className: 'right-[22%] bottom-[48px]', color: 'text-emerald-400 border-emerald-400/25 shadow-emerald-500/10' },
  ];

  return (
    <motion.div variants={itemVariants} className="flex justify-center">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#070c16] px-6 py-9 text-center shadow-[0_30px_90px_-45px_rgba(0,0,0,0.8)] dark:bg-[#070c16]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_29%,rgba(249,115,22,0.16),transparent_25%),radial-gradient(circle_at_50%_45%,rgba(59,130,246,0.10),transparent_32%)]" />
        <div className="relative mx-auto h-[245px] max-w-3xl">
          <div className="absolute left-[13%] right-[13%] top-[106px] h-[90px] rounded-[50%] border border-dashed border-white/20" />
          <Brain className="absolute left-1/2 top-3 h-20 w-20 -translate-x-1/2 text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.35)]" />
          <div className="absolute left-1/2 top-[96px] h-[126px] w-[220px] -translate-x-1/2">
            <div className="absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 shadow-[0_-22px_55px_rgba(249,115,22,0.35)]">
              <Brain className="mx-auto mt-12 h-8 w-8 text-orange-300/80" />
            </div>
            <div className="absolute left-6 top-3 h-12 w-24 -rotate-[24deg] rounded-md border border-white/10 bg-gradient-to-br from-slate-500 to-slate-900" />
            <div className="absolute right-6 top-3 h-12 w-24 rotate-[24deg] rounded-md border border-white/10 bg-gradient-to-bl from-slate-500 to-slate-900" />
            <div className="absolute left-1/2 top-12 h-24 w-5 -translate-x-1/2 bg-gradient-to-b from-orange-400/70 to-transparent blur-sm" />
          </div>
          {floatingIcons.map(({ Icon, className, color }) => (
            <div key={className} className={`absolute ${className} flex h-14 w-14 items-center justify-center rounded-2xl border bg-white/[0.035] shadow-xl ${color}`}>
              <Icon className="h-7 w-7" />
            </div>
          ))}
        </div>
        <div className="relative">
          <h2 className="text-3xl font-black tracking-tight text-white">Henüz soru oluşturulmadı</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-300">
            Soru bankanızı oluşturmak için hemen yeni soru ekleyebilir veya içe aktararak arşivinizi zenginleştirebilirsiniz.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button onClick={onCreate} className="h-14 rounded-2xl bg-orange-500 px-9 text-base font-bold text-white shadow-[0_16px_35px_-18px_rgba(249,115,22,0.9)] hover:bg-orange-600">
              <Plus className="mr-2 h-5 w-5" />
              Yeni Soru Ekle
            </Button>
            <Button onClick={onImport} variant="outline" className="h-14 rounded-2xl border-white/15 bg-white/[0.02] px-9 text-base font-bold text-white hover:bg-white/10 hover:text-white">
              <Upload className="mr-2 h-5 w-5" />
              İçe Aktar
            </Button>
          </div>
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15">
              <Lightbulb className="h-6 w-6 text-blue-300" />
            </div>
            <p className="text-sm leading-6 text-slate-300">
              PDF veya JSON dosyalarından içe aktararak sorularınızı hızlıca sisteme ekleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function TeacherQuestionBank() {
  const { toast } = useToast();
  const { user } = useApp();
  const importInputRef = useRef(null);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [questionDrafts, setQuestionDrafts] = useState([createQuestionDraft()]);
  const [classOptions, setClassOptions] = useState(['Tüm Sınıflar']);
  const availableClassOptions = useMemo(
    () => (classOptions.length > 1 ? classOptions : ['Tüm Sınıflar', ...FALLBACK_CLASSES]),
    [classOptions],
  );

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [payload, students, apiClasses] = await Promise.all([
        fetchQuestionBank(),
        fetchStudents().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      setQuestions(payload);
      const classes = [...new Set([
        ...((apiClasses || []).map((item) => item?.trim()).filter((item) => item && item !== 'Tüm Sınıflar')),
        ...(students || [])
          .map((item) => item.className?.trim())
          .filter(Boolean),
        ...(payload || [])
          .flatMap((item) => item.classTargets || [])
          .map((item) => item?.trim())
          .filter((item) => item && item !== 'Tüm Sınıflar'),
        ...FALLBACK_CLASSES,
      ])].sort((a, b) => a.localeCompare(b, 'tr'));
      setClassOptions(['Tüm Sınıflar', ...(classes.length > 0 ? classes : FALLBACK_CLASSES)]);
    } catch (err) {
      setError(err.message || 'Soru bankası alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const subjects = useMemo(() => [...new Set(questions.map((item) => item.subject).filter(Boolean))], [questions]);
  const subjectOptions = useMemo(() => [...new Set([...DEFAULT_SUBJECTS, ...subjects])], [subjects]);
  const filteredQuestions = useMemo(() => questions.filter((item) => {
    const matchesSearch = `${item.questionText} ${item.topic}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || item.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  }), [questions, search, selectedSubject]);
  const filteredQuestionSets = useMemo(() => buildQuestionSets(filteredQuestions), [filteredQuestions]);
  const hasNoQuestions = !loading && !error && questions.length === 0;

  const stats = {
    total: questions.length,
    solvedUsage: questions.reduce((sum, item) => sum + Number(item.usageCount || 0), 0),
    activeSubjects: subjects.length,
  };

  const resetForm = () => {
    setQuestionDrafts([createQuestionDraft()]);
    setEditingQuestion(null);
  };

  const openEditDialog = (question) => {
    setEditingQuestion(question);
    setQuestionDrafts([{
      ...createQuestionDraft(),
      id: question.id,
      question: question.questionText || '',
      subject: question.subject || '',
      topic: question.topic || '',
      difficulty: question.difficulty || 'Orta',
      type: question.type || 'Açık Uçlu',
      options: (question.options || []).join('\n'),
      correctOptionIndex: String(question.correctOptionIndex ?? 0),
      expectedAnswer: question.expectedAnswer || '',
      classTargets: (question.classTargets || []).length > 0 ? question.classTargets : ['Tüm Sınıflar'],
      imagePlacement: question.imagePlacement || 'Top',
      questionSetKey: question.questionSetKey || '',
      questionSetTitle: question.questionSetTitle || '',
      questionOrder: question.questionOrder ?? 0,
      revealCorrectAnswerToStudent: !!question.revealCorrectAnswerToStudent,
      imagePath: question.imagePath || '',
      solutionAssetPath: question.solutionAssetPath || '',
      solutionAssetType: question.solutionAssetType || '',
    }]);
    setShowAddDialog(true);
  };

  const updateDraft = (id, key, value) => {
    setQuestionDrafts((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (key === 'type') {
        if (value === 'Çoktan Seçmeli') {
          return { ...item, type: value, expectedAnswer: '' };
        }
        if (value === 'Doğru / Yanlış') {
          return {
            ...item,
            type: value,
            options: '',
            correctOptionIndex: '0',
            expectedAnswer: item.expectedAnswer === 'Yanlış' ? 'Yanlış' : 'Doğru',
          };
        }
        return {
          ...item,
          type: value,
          options: '',
          correctOptionIndex: '0',
        };
      }
      return { ...item, [key]: value };
    }));
  };

  const toggleDraftClass = (draftId, className) => {
    setQuestionDrafts((prev) => prev.map((item) => {
      if (item.id !== draftId) return item;
      const selected = Array.isArray(item.classTargets) ? item.classTargets : ['Tüm Sınıflar'];
      if (className === 'Tüm Sınıflar') {
        return { ...item, classTargets: ['Tüm Sınıflar'] };
      }
      const next = new Set(selected.filter((entry) => entry !== 'Tüm Sınıflar'));
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return {
        ...item,
        classTargets: next.size > 0 ? [...next] : ['Tüm Sınıflar'],
      };
    }));
  };

  const addDraft = () => {
    setQuestionDrafts((prev) => [...prev, createQuestionDraft()]);
  };

  const removeDraft = (id) => {
    setQuestionDrafts((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const detectAssetType = (file) => {
    if (!file) return '';
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.mp4') || name.endsWith('.mov')) return 'Video';
    return 'Dosya';
  };

  const uploadDraftAssets = async (draft) => {
    let imagePath = draft.imagePath || null;
    let solutionAssetPath = draft.solutionAssetPath || null;
    let solutionAssetType = draft.solutionAssetType || null;

    if (draft.imageFile) {
      const imageForm = new FormData();
      imageForm.append('file', draft.imageFile);
      const uploaded = await uploadFile(imageForm, 'question-images');
      imagePath = uploaded.fileUrl || uploaded.fileName || draft.imageFile.name;
    }

    if (draft.solutionFile) {
      const solutionForm = new FormData();
      solutionForm.append('file', draft.solutionFile);
      const uploaded = await uploadFile(solutionForm, 'question-solutions');
      solutionAssetPath = uploaded.fileUrl || uploaded.fileName || draft.solutionFile.name;
      solutionAssetType = detectAssetType(draft.solutionFile);
    }

    return {
      imagePath,
      solutionAssetPath,
      solutionAssetType,
    };
  };

  const buildPayload = async (draft, setMeta = {}) => {
    const uploadedAssets = await uploadDraftAssets(draft);
    return {
      subject: draft.subject,
      topic: draft.topic,
      difficulty: draft.difficulty,
      type: draft.type,
      questionText: draft.question,
      teacher: user?.name || 'Öğretmen',
      imagePath: uploadedAssets.imagePath,
      imagePlacement: draft.imagePlacement || 'Top',
      options: isMultipleChoice(draft.type) ? draft.options.split('\n').map((item) => item.trim()).filter(Boolean) : [],
      correctOptionIndex: isMultipleChoice(draft.type) ? Number(draft.correctOptionIndex || 0) : null,
      classTargets: Array.isArray(draft.classTargets) && draft.classTargets.length > 0
        ? draft.classTargets
        : ['Tüm Sınıflar'],
      solutionAssetPath: uploadedAssets.solutionAssetPath,
      solutionAssetType: uploadedAssets.solutionAssetType,
      questionSetKey: setMeta.questionSetKey || draft.questionSetKey || null,
      questionSetTitle: setMeta.questionSetTitle || draft.questionSetTitle || draft.topic || null,
      questionOrder: setMeta.questionOrder ?? draft.questionOrder ?? null,
      revealCorrectAnswerToStudent: draft.revealCorrectAnswerToStudent,
      expectedAnswer: isTrueFalse(draft.type)
        ? (draft.expectedAnswer === 'Yanlış' ? 'Yanlış' : 'Doğru')
        : (draft.expectedAnswer || null),
    };
  };

  const handleSaveQuestion = async () => {
    if (questionDrafts.some((item) => !item.question || !item.subject || !item.topic)) {
      toast({
        title: 'Eksik bilgi',
        description: 'Her soru kartında soru metni, ders ve konu zorunlu.',
        variant: 'destructive',
      });
      return;
    }
    if (questionDrafts.some((item) => isMultipleChoice(item.type) && item.options.split('\n').map((entry) => entry.trim()).filter(Boolean).length < 2)) {
      toast({
        title: 'Eksik şık bilgisi',
        description: 'Çoktan seçmeli sorularda en az iki şık girmen gerekiyor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      if (editingQuestion) {
        const updated = await updateQuestionBankItem(editingQuestion.id, await buildPayload(questionDrafts[0], {
          questionSetKey: editingQuestion.questionSetKey,
          questionSetTitle: editingQuestion.questionSetTitle,
          questionOrder: editingQuestion.questionOrder ?? 0,
        }));
        setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast({
          title: 'Soru güncellendi',
          description: 'Kayıt backend üzerinde güncellendi.',
        });
      } else {
        const createdItems = [];
        const questionSetKey = `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const questionSetTitle = questionDrafts[0]?.topic || 'Soru Seti';
        for (const draft of questionDrafts) {
          const created = await createQuestionBankItem(await buildPayload(draft, {
            questionSetKey,
            questionSetTitle,
            questionOrder: questionDrafts.findIndex((item) => item.id === draft.id),
          }));
          createdItems.push(created);
        }
        setQuestions((prev) => [...createdItems.reverse(), ...prev]);
        toast({
          title: 'Soru seti eklendi',
          description: `${createdItems.length} soru backend’e kaydedildi.`,
        });
      }
      setShowAddDialog(false);
      resetForm();
    } catch (err) {
      toast({
        title: editingQuestion ? 'Soru güncellenemedi' : 'Soru eklenemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    try {
      await deleteQuestionBankItem(id);
      setQuestions((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: 'Soru silindi',
        description: 'Kayıt backend üzerinden kaldırıldı.',
      });
    } catch (err) {
      toast({
        title: 'Soru silinemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const downloadTextFile = (filename, content, type = 'application/json;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const payload = filteredQuestions.map((item) => ({
      subject: item.subject,
      topic: item.topic,
      difficulty: item.difficulty,
      type: item.type,
      questionText: item.questionText,
      options: item.options || [],
      expectedAnswer: item.expectedAnswer || '',
      classTargets: item.classTargets || [],
    }));
    downloadTextFile(
      `soru-bankasi-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
    );
    toast({
      title: 'Dışa aktarma hazır',
      description: `${payload.length} soru JSON olarak indirildi.`,
    });
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Dosya içinde soru listesi bulunamadı.');
      }

      const createdQuestions = [];
      for (const item of parsed) {
        const created = await createQuestionBankItem({
          subject: item.subject || 'Genel',
          topic: item.topic || 'Genel',
          difficulty: item.difficulty || 'Orta',
          type: item.type || 'Açık Uçlu',
          questionText: item.questionText || item.question || '',
          teacher: user?.name || 'Öğretmen',
          imagePath: null,
          imagePlacement: 'Top',
          options: Array.isArray(item.options) ? item.options : [],
          correctOptionIndex: item.correctOptionIndex ?? null,
          classTargets: Array.isArray(item.classTargets) && item.classTargets.length > 0 ? item.classTargets : ['Tüm Sınıflar'],
          solutionAssetPath: null,
          solutionAssetType: null,
          revealCorrectAnswerToStudent: !!item.revealCorrectAnswerToStudent,
          expectedAnswer: item.expectedAnswer || null,
        });
        createdQuestions.push(created);
      }

      setQuestions((prev) => [...createdQuestions, ...prev]);
      toast({
        title: 'İçe aktarma tamamlandı',
        description: `${createdQuestions.length} soru backend’e kaydedildi.`,
      });
    } catch (err) {
      toast({
        title: 'İçe aktarma başarısız',
        description: err.message || 'JSON formatını kontrol edin.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Soru bankası yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 relative" data-testid="teacher-question-bank-page">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-heading">Soru Bankası</h1>
              <p className="text-muted-foreground">Canlı soru arşivi ve öğretmen üretim ekranı</p>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white" onClick={handleImportClick}>
              <Upload className="h-4 w-4 mr-2" />
              İçe Aktar
            </Button>
            <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Dışa Aktar
            </Button>
            <Dialog
              open={showAddDialog}
              onOpenChange={(open) => {
                setShowAddDialog(open);
                if (!open) {
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Soru Ekle
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(94vw,1080px)] max-w-5xl max-h-[88vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingQuestion ? 'Soruyu Düzenle' : 'Yeni Soru Ekle'}</DialogTitle>
                  <DialogDescription>Soru bankasına kayıt ekleyin veya mevcut soruyu güncelleyin</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!editingQuestion ? (
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={addDraft}>
                        <Plus className="h-4 w-4 mr-2" />
                        Soru Kartı Ekle
                      </Button>
                    </div>
                  ) : null}
                  {questionDrafts.map((draft, index) => (
                    <div key={draft.id} className="space-y-4 rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{editingQuestion ? 'Soru Kaydı' : `Soru ${index + 1}`}</p>
                          <p className="text-sm text-muted-foreground">Görsel zorunlu değil; istersen görselsiz, istersen çözüm ekiyle kayıt oluştur.</p>
                        </div>
                        {!editingQuestion ? (
                          <Button variant="ghost" size="icon" onClick={() => removeDraft(draft.id)} disabled={questionDrafts.length === 1}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label>Soru Metni</Label>
                        <Textarea value={draft.question} onChange={(e) => updateDraft(draft.id, 'question', e.target.value)} className="min-h-[100px]" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ders</Label>
                          <Select value={draft.subject || subjectOptions[0]} onValueChange={(v) => updateDraft(draft.id, 'subject', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Ders seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjectOptions.map((subject) => (
                                <SelectItem key={`${draft.id}-${subject}`} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Konu</Label>
                          <Input value={draft.topic} onChange={(e) => updateDraft(draft.id, 'topic', e.target.value)} placeholder="Türev" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Zorluk</Label>
                          <Select value={draft.difficulty} onValueChange={(v) => updateDraft(draft.id, 'difficulty', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kolay">Kolay</SelectItem>
                              <SelectItem value="Orta">Orta</SelectItem>
                              <SelectItem value="Zor">Zor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tür</Label>
                          <Select value={draft.type} onValueChange={(v) => updateDraft(draft.id, 'type', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Açık Uçlu">Açık Uçlu</SelectItem>
                              <SelectItem value="Çoktan Seçmeli">Çoktan Seçmeli</SelectItem>
                              <SelectItem value="Doğru / Yanlış">Doğru / Yanlış</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Görsel Konumu</Label>
                          <Select value={draft.imagePlacement} onValueChange={(v) => updateDraft(draft.id, 'imagePlacement', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Top">Üstte</SelectItem>
                              <SelectItem value="Bottom">Altta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Hedef Sınıflar</Label>
                        <div className="rounded-2xl border bg-muted/30 p-3">
                          <div className="flex flex-wrap gap-2">
                            {availableClassOptions.map((className) => {
                              const selected = (draft.classTargets || []).includes(className);
                              return (
                                <Button
                                  key={`${draft.id}-${className}`}
                                  type="button"
                                  variant={selected ? 'default' : 'outline'}
                                  className="h-8 rounded-full px-3"
                                  onClick={() => toggleDraftClass(draft.id, className)}
                                >
                                  {className}
                                </Button>
                              );
                            })}
                          </div>
                          {availableClassOptions.length <= 1 ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Kayıtlı sınıf bulunamadı. Önce öğrenci kayıtlarından sınıf oluşturulduğunda burada listelenecek.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {isMultipleChoice(draft.type) ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Şıklar</Label>
                            <Textarea value={draft.options} onChange={(e) => updateDraft(draft.id, 'options', e.target.value)} placeholder="Her satıra bir seçenek yazın" />
                          </div>
                          <div className="space-y-2">
                            <Label>Doğru Şık Sırası</Label>
                            <Input value={draft.correctOptionIndex} onChange={(e) => updateDraft(draft.id, 'correctOptionIndex', e.target.value)} type="number" min="0" />
                          </div>
                        </div>
                      ) : isTrueFalse(draft.type) ? (
                        <div className="space-y-3">
                          <Label>Doğru Cevap</Label>
                          <div className="flex flex-wrap gap-2">
                            {['Doğru', 'Yanlış'].map((answer) => (
                              <Button
                                key={`${draft.id}-${answer}`}
                                type="button"
                                variant={draft.expectedAnswer === answer ? 'default' : 'outline'}
                                className="h-10 rounded-full px-5"
                                onClick={() => updateDraft(draft.id, 'expectedAnswer', answer)}
                              >
                                {answer}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">Öğrenci bu soru için sadece Doğru veya Yanlış seçer.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Beklenen Cevap</Label>
                          <Textarea value={draft.expectedAnswer} onChange={(e) => updateDraft(draft.id, 'expectedAnswer', e.target.value)} placeholder="Açık uçlu yanıt için öğretmen notu" />
                        </div>
                      )}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Soru Görseli (Opsiyonel)</Label>
                          <Input type="file" accept=".png,.jpg,.jpeg" onChange={(e) => updateDraft(draft.id, 'imageFile', e.target.files?.[0] || null)} />
                          {draft.imageFile || draft.imagePath ? <p className="text-xs text-muted-foreground">{draft.imageFile?.name || draft.imagePath}</p> : null}
                          {!draft.imageFile && !draft.imagePath ? <p className="text-xs text-muted-foreground">Bu alan boş kalabilir.</p> : null}
                        </div>
                        <div className="space-y-2">
                          <Label>Çözüm Eki</Label>
                          <Input type="file" accept=".pdf,.mp4,.mov,.ppt,.pptx,.doc,.docx" onChange={(e) => updateDraft(draft.id, 'solutionFile', e.target.files?.[0] || null)} />
                          {draft.solutionFile || draft.solutionAssetPath ? <p className="text-xs text-muted-foreground">{draft.solutionFile?.name || draft.solutionAssetPath}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
                  <Button onClick={handleSaveQuestion} disabled={saving}>{saving ? 'Kaydediliyor...' : editingQuestion ? 'Güncelle' : 'Kaydet'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {error ? <ErrorBanner title="Soru bankası alınamadı" message={error} onRetry={loadQuestions} /> : null}

      {hasNoQuestions ? (
        <EmptyQuestionBankState
          onCreate={() => setShowAddDialog(true)}
          onImport={handleImportClick}
        />
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          [stats.total, 'Toplam Soru', BookOpen, 'from-brand-primary to-brand-accent'],
          [stats.activeSubjects, 'Aktif Ders', Brain, 'from-green-500 to-emerald-500'],
          [stats.solvedUsage, 'Toplam Kullanım', Zap, 'from-yellow-500 to-orange-500'],
        ].map(([value, label, Icon, gradient]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Soru ara..." className="pl-10 h-12 rounded-xl" />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="flex flex-wrap gap-2">
          <Button variant={selectedSubject === 'all' ? 'default' : 'outline'} onClick={() => setSelectedSubject('all')}>Tümü</Button>
          {subjects.map((subject) => (
            <Button
              key={subject}
              variant={selectedSubject === subject ? 'default' : 'outline'}
              className={selectedSubject === subject ? `${getSubjectTheme(subject).accent} text-white` : getSubjectTheme(subject).soft}
              onClick={() => setSelectedSubject(subject)}
            >
              {decodeSubject(subject)}
            </Button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuestionSets.length === 0 ? (
            <Card className="col-span-full border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-950">
              <CardContent className="p-8 text-center text-muted-foreground">
                Bu filtrelere uygun soru bulunamadı.
              </CardContent>
            </Card>
          ) : filteredQuestionSets.map((set) => (
            <Card key={set.key} className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-950">
              <CardContent className="p-5 space-y-4">
                {(() => {
                  const safeSubject = decodeSubject(set.subject);
                  const safeTitle = decodeSubject(set.title);
                  return (
                    <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                      {safeTitle}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {set.questions.length} soru
                    </p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getSubjectTheme(safeSubject).accent} text-sm font-bold text-white shadow-lg`}>
                    {set.questions.length}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 dark:border-white/10 dark:bg-slate-900">
                  <div className={`relative flex h-44 overflow-hidden bg-gradient-to-br ${getSubjectTheme(safeSubject).gradient} p-5 text-white`}>
                    <div className="absolute left-[-18px] top-[-22px] h-28 w-28 rounded-full bg-white/12" />
                    <div className="absolute bottom-[-34px] right-[-24px] h-40 w-40 rounded-full bg-black/10" />
                    <div className="absolute left-6 top-5 text-[54px] font-black tracking-[-0.08em] text-white/10">
                      {getSubjectMark(safeSubject)}
                    </div>
                    <div className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/14 px-3 py-1 text-xs font-semibold text-white">
                      {set.questions.length} soru
                    </div>
                    <div className="mt-auto flex items-end gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-base font-bold text-white backdrop-blur-sm">
                        {getSubjectTheme(safeSubject).accent.includes('blue') ? '∑' : getSubjectTheme(safeSubject).accent.includes('rose') ? 'Aa' : getSubjectTheme(safeSubject).accent.includes('orange') ? '⚗' : getSubjectTheme(safeSubject).accent.includes('emerald') ? '🧬' : getSubjectTheme(safeSubject).accent.includes('violet') ? '⚡' : getSubjectTheme(safeSubject).accent.includes('cyan') ? 'EN' : 'QB'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{safeSubject}</div>
                        <div className="truncate text-[11px] font-bold tracking-[0.18em] text-white/70">{getSubjectTagline(safeSubject)}</div>
                        <div className="line-clamp-2 text-[22px] font-black leading-[1.02] tracking-tight">{safeTitle}</div>
                      </div>
                      <div className="h-14 w-2 rounded-full bg-white/35" />
                    </div>
                  </div>
                </div>
                    </>
                  );
                })()}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEditDialog(set.questions[0])}>
                    <Pencil className="h-4 w-4 text-brand-primary" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteQuestion(set.questions[0].id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
      </>
      )}
    </motion.div>
  );
}
