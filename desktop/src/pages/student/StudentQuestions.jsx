import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Search, Play, CheckCircle, Zap, Target, BookOpen, XCircle, MinusCircle, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { DialogFooter } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import PremiumResourceCard from '../../components/ui/PremiumResourceCard';
import { PremiumPanel, PremiumDonutChart, PremiumStatusPill, CHART_COLORS } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { AnimatedCounter, CircularProgress } from '../../components/animations/AnimatedCounter';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  addStudyPlanXp,
  fetchQuestionBank,
  fetchQuestionPracticeStats,
  incrementQuestionUsage,
  submitQuestionPracticeAttempt,
} from '../../lib/api/modules';
import { Textarea } from '../../components/ui/textarea';
import { desktopApiBaseUrl } from '../../lib/auth';
import { collectNewBadges } from '../../lib/badges';
import BadgeUnlockModal from '../../components/badges/BadgeUnlockModal';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const difficultyColors = {
  Kolay: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
  Orta: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  Zor: 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
};

function buildQuestionBankSolveReward({ isCorrect, hasImage, hasSolutionAsset }) {
  let amount = isCorrect ? 18 : 6;
  const bonuses = [];

  if (isCorrect) {
    bonuses.push('Doğru cevap bonusu +18 XP');
  } else {
    bonuses.push('Deneme katılımı +6 XP');
  }

  if (hasImage) {
    amount += 4;
    bonuses.push('Resimli soru bonusu +4 XP');
  }

  if (hasSolutionAsset) {
    amount += 3;
    bonuses.push('Çözüm eki bonusu +3 XP');
  }

  return { amount, bonuses };
}

function isExamOnlyQuestion(item) {
  try {
    const metadata = JSON.parse(item?.editorMetadataJson || '{}');
    return metadata?.visibility === 'ExamOnly';
  } catch {
    return false;
  }
}

function isMultipleChoice(type = '') {
  return /secmeli|çoktan|doğru\s*\/\s*yanlış|dogru\s*\/\s*yanlis/i.test(type);
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
    teacher: questions[0]?.teacher || 'Öğretmen',
    questions: [...questions].sort((a, b) => {
      const aOrder = a.questionOrder ?? 9999;
      const bOrder = b.questionOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }),
    imageCount: questions.filter((item) => item.imagePath).length,
    totalUsage: questions.reduce((sum, item) => sum + Number(item.usageCount || 0), 0),
  })).sort((a, b) => new Date(b.questions[0]?.createdAt || 0) - new Date(a.questions[0]?.createdAt || 0));
}

function renderQuestionImage(path) {
  if (!path) return null;
  const resolvedPath = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : path.startsWith('/')
      ? `${desktopApiBaseUrl}${path}`
      : `${desktopApiBaseUrl}/${path}`;
  return (
    <img
      src={resolvedPath}
      alt="Soru görseli"
      className="h-full w-full object-cover"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}

function getSubjectTheme(subject = '') {
  const normalized = decodeSubject(subject).toLowerCase();
  if (normalized.includes('mat')) return { gradient: 'from-blue-600 to-indigo-700', accent: 'bg-blue-600', icon: '∑' };
  if (normalized.includes('fiz')) return { gradient: 'from-violet-600 to-purple-700', accent: 'bg-violet-600', icon: '⚡' };
  if (normalized.includes('kim')) return { gradient: 'from-orange-500 to-red-600', accent: 'bg-orange-500', icon: '⚗' };
  if (normalized.includes('biy')) return { gradient: 'from-emerald-500 to-green-700', accent: 'bg-emerald-500', icon: '🧬' };
  if (normalized.includes('türk') || normalized.includes('turk')) return { gradient: 'from-rose-500 to-red-700', accent: 'bg-rose-500', icon: 'Aa' };
  if (normalized.includes('ing')) return { gradient: 'from-cyan-500 to-sky-700', accent: 'bg-cyan-500', icon: 'EN' };
  return { gradient: 'from-teal-500 to-cyan-700', accent: 'bg-teal-500', icon: 'QB' };
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

function AutoCover({ subject }) {
  const safeSubject = decodeSubject(subject);
  const theme = getSubjectTheme(safeSubject);
  return (
    <div className={`relative flex h-44 overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} p-5 text-white`}>
      <div className="absolute left-[-18px] top-[-22px] h-28 w-28 rounded-full bg-foreground/12" />
      <div className="absolute bottom-[-34px] right-[-24px] h-40 w-40 rounded-full bg-black/10" />
      <div className="absolute left-6 top-5 text-[54px] font-black tracking-[-0.08em] text-foreground/10">
        {getSubjectMark(safeSubject)}
      </div>
      <div className="mt-auto flex items-end gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/20 bg-foreground/15 text-base font-bold text-white backdrop-blur-sm">
          {theme.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-foreground/80">{safeSubject || 'Genel'}</div>
          <div className="truncate text-[11px] font-bold tracking-[0.18em] text-foreground/70">{getSubjectTagline(safeSubject)}</div>
          <div className="line-clamp-2 text-[22px] font-black leading-[1.02] tracking-tight">Soru Bankası</div>
        </div>
        <div className="h-14 w-2 rounded-full bg-foreground/35" />
      </div>
    </div>
  );
}

export default function StudentQuestions() {
  const { toast } = useToast();
  const { user } = useApp();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [practiceStats, setPracticeStats] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSetSummary, setShowSetSummary] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [openEndedAnswer, setOpenEndedAnswer] = useState('');
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [submittedAttemptIds, setSubmittedAttemptIds] = useState({});
  const [resultSummary, setResultSummary] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const username = user?.username || user?.email || (user?.name || 'ogrenci').toLowerCase().replaceAll(' ', '');
      const [payload, statsPayload] = await Promise.all([
        fetchQuestionBank(),
        fetchQuestionPracticeStats({ studentUsername: username }).catch(() => null),
      ]);
      setQuestions((payload || []).filter((item) => !isExamOnlyQuestion(item)));
      setPracticeStats(statsPayload);
    } catch (err) {
      setError(err.message || 'Soru bankası alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const subjects = useMemo(() => {
    const grouped = new Map();
    questions.forEach((item) => {
      if (!grouped.has(item.subject)) {
        grouped.set(item.subject, { name: item.subject, questions: 0, solved: 0 });
      }
      const current = grouped.get(item.subject);
      current.questions += 1;
      current.solved += Number(item.usageCount || 0) > 0 ? 1 : 0;
    });
    return Array.from(grouped.values());
  }, [questions]);

  const filteredQuestions = useMemo(() => questions.filter((item) => {
    const matchesSearch = `${item.topic} ${item.questionText}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || item.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  }), [questions, search, selectedSubject]);
  const filteredQuestionSets = useMemo(() => buildQuestionSets(filteredQuestions), [filteredQuestions]);
  const selectedQuestion = selectedSet?.questions?.[currentQuestionIndex] ?? null;

  const stats = {
    totalQuestions: questions.length,
    solved: questions.filter((item) => Number(item.usageCount || 0) > 0).length,
    successRate: questions.length ? Math.round((questions.filter((item) => Number(item.usageCount || 0) > 0).length / questions.length) * 100) : 0,
    xp: questions.reduce((sum, item) => sum + Math.min(10, Number(item.usageCount || 0)), 0),
  };
  const remaining = Math.max(0, stats.totalQuestions - stats.solved);
  // Gerçek çözüm kırılımı (backend /attempts/stats). Veri yoksa güvenli varsayılan.
  const totalCount = practiceStats?.total ?? stats.totalQuestions;
  const solvedCount = practiceStats?.solved ?? stats.solved;
  const correctCount = practiceStats?.correct ?? 0;
  const wrongCount = practiceStats?.wrong ?? 0;
  const blankCount = practiceStats?.blank ?? remaining;
  const netScore = practiceStats?.net ?? 0;
  const difficultyBreakdown = [
    ['Kolay', 'bg-emerald-400'],
    ['Orta', 'bg-amber-400'],
    ['Zor', 'bg-rose-400'],
  ].map(([level, color]) => ({ level, color, count: questions.filter((item) => (item.difficulty || 'Orta') === level).length }));
  const maxDifficulty = Math.max(1, ...difficultyBreakdown.map((entry) => entry.count));
  const recentSolved = questions.filter((item) => Number(item.usageCount || 0) > 0).slice(0, 5);

  const handleOpenSet = async (set) => {
    const questionIds = set.questions.map((question) => question.id).filter(Boolean);
    if (questionIds.length === 0) {
      toast({
        title: 'Soru bulunamadı',
        description: 'Bu sette çözülebilir soru yok.',
        variant: 'destructive',
      });
      return;
    }

    const params = new URLSearchParams({
      title: set.title || 'Soru Bankası Seti',
      subject: set.subject || 'Genel',
      questionIds: questionIds.join(','),
      questionCount: String(questionIds.length),
      durationSeconds: String(Math.max(900, questionIds.length * 180)),
    });
    navigate(`/s/solve?${params.toString()}`);
  };

  const handleRandomQuestion = () => {
    if (!filteredQuestionSets.length) {
      toast({
        title: 'Soru bulunamadı',
        description: 'Mevcut filtreye uygun soru yok.',
        variant: 'destructive',
      });
      return;
    }
    const randomSet = filteredQuestionSets[Math.floor(Math.random() * filteredQuestionSets.length)];
    handleOpenSet(randomSet);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion) return;

    const isChoiceQuestion = isMultipleChoice(selectedQuestion.type);
    const hasChoice = isChoiceQuestion && selectedOption !== null;
    const hasOpenEnded = !isChoiceQuestion && openEndedAnswer.trim();

    if (!hasChoice && !hasOpenEnded) {
      toast({
        title: 'Cevap bekleniyor',
        description: 'Lütfen soruyu yanıtlayın.',
        variant: 'destructive',
      });
      return;
    }

    const answerValue = hasChoice
      ? selectedQuestion.options[selectedOption]
      : openEndedAnswer.trim();

    setSubmittedAnswers((prev) => ({
      ...prev,
      [selectedQuestion.id]: {
        answer: answerValue,
        submittedAt: new Date().toISOString(),
        isCorrect: isChoiceQuestion
          ? selectedOption === selectedQuestion.correctOptionIndex
          : answerValue.trim().toLowerCase() === (selectedQuestion.expectedAnswer || '').trim().toLowerCase(),
      },
    }));

    if (!submittedAttemptIds[selectedQuestion.id]) {
      try {
        await submitQuestionPracticeAttempt(selectedQuestion.id, {
          studentName: user?.name || 'Ogrenci',
          studentUsername: user?.username || user?.email || (user?.name || 'ogrenci').toLowerCase().replaceAll(' ', ''),
          answerText: answerValue,
        });
        setSubmittedAttemptIds((prev) => ({ ...prev, [selectedQuestion.id]: true }));
      } catch {
        // ignore attempt sync errors
      }
    }

    try {
      const updated = await incrementQuestionUsage(selectedQuestion.id);
      setQuestions((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch {
      // ignore usage sync errors
    }

    if (currentQuestionIndex < (selectedSet?.questions.length ?? 1) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setOpenEndedAnswer('');
      return;
    }

    const summary = selectedSet.questions.reduce((acc, question) => {
      const isCorrect = Boolean(
        question.type && isMultipleChoice(question.type)
          ? submittedAnswers[question.id]?.isCorrect ?? (question.id === selectedQuestion.id
            ? selectedOption === question.correctOptionIndex
            : false)
          : submittedAnswers[question.id]?.isCorrect ?? (question.id === selectedQuestion.id
            ? answerValue.trim().toLowerCase() === (question.expectedAnswer || '').trim().toLowerCase()
            : false),
      );
      const reward = buildQuestionBankSolveReward({
        isCorrect,
        hasImage: Boolean(question.imagePath),
        hasSolutionAsset: Boolean(question.solutionAssetPath),
      });
      if (isCorrect) acc.correctCount += 1;
      acc.totalXp += reward.amount;
      acc.bonuses.push(...reward.bonuses);
      return acc;
    }, { correctCount: 0, totalXp: 0, bonuses: [] });

    const uniqueBonuses = [...new Set(summary.bonuses)];
    setResultSummary({
      correctCount: summary.correctCount,
      totalXp: summary.totalXp,
      bonuses: uniqueBonuses,
    });

    try {
      const planState = await addStudyPlanXp(summary.totalXp);
      const unlockedNow = collectNewBadges(planState?.xpPoints, user);
      if (unlockedNow.length) setNewBadges(unlockedNow);
    } catch {
      // ignore xp sync errors
    }

    setShowSetSummary(true);
  };

  const handleSkipQuestion = async () => {
    if (!selectedQuestion) return;

    setSubmittedAnswers((prev) => ({
      ...prev,
      [selectedQuestion.id]: {
        answer: 'Atlandı',
        submittedAt: new Date().toISOString(),
        isCorrect: false,
        skipped: true,
      },
    }));

    if (currentQuestionIndex < (selectedSet?.questions.length ?? 1) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setOpenEndedAnswer('');
      return;
    }

    const summary = selectedSet.questions.reduce((acc, question) => {
      const currentSubmission = question.id === selectedQuestion.id
        ? { isCorrect: false }
        : submittedAnswers[question.id];
      const isCorrect = Boolean(currentSubmission?.isCorrect);
      const reward = buildQuestionBankSolveReward({
        isCorrect,
        hasImage: Boolean(question.imagePath),
        hasSolutionAsset: Boolean(question.solutionAssetPath),
      });
      if (isCorrect) acc.correctCount += 1;
      acc.totalXp += reward.amount;
      acc.bonuses.push(...reward.bonuses);
      return acc;
    }, { correctCount: 0, totalXp: 0, bonuses: [] });

    const uniqueBonuses = [...new Set(summary.bonuses)];
    setResultSummary({
      correctCount: summary.correctCount,
      totalXp: summary.totalXp,
      bonuses: uniqueBonuses,
    });

    try {
      const planState = await addStudyPlanXp(summary.totalXp);
      const unlockedNow = collectNewBadges(planState?.xpPoints, user);
      if (unlockedNow.length) setNewBadges(unlockedNow);
    } catch {
      // ignore xp sync errors
    }

    setShowSetSummary(true);
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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 relative" data-testid="student-questions-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-600 text-white"><Brain className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-black tracking-tight">Soru Bankası</h1>
            <p className="text-sm text-muted-foreground">Binlerce soru ile konularını pekiştir, eksiklerini tamamla.</p>
          </div>
        </div>
        <Button className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={handleRandomQuestion}>
          <Play className="mr-2 h-4 w-4" />Rastgele Soru Çöz
        </Button>
      </div>

      {error ? <ErrorBanner title="Soru bankası alınamadı" message={error} onRetry={loadQuestions} /> : null}

      {/* 6 stat kartı */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Toplam Soru', totalCount, BookOpen, 'from-sky-400 to-blue-600', 'Tüm branşlar'],
          ['Çözülen Soru', solvedCount, Target, 'from-violet-400 to-fuchsia-600', 'Bu zamana kadar'],
          ['Doğru', correctCount, CheckCircle, 'from-emerald-400 to-teal-600', totalCount ? `%${Math.round((correctCount / Math.max(1, solvedCount)) * 100)} doğru oranı` : 'Doğru cevap'],
          ['Yanlış', wrongCount, XCircle, 'from-rose-400 to-red-600', solvedCount ? `%${Math.round((wrongCount / Math.max(1, solvedCount)) * 100)} yanlış oranı` : 'Yanlış cevap'],
          ['Boş', blankCount, MinusCircle, 'from-slate-400 to-slate-600', 'Çözülmeyen soru'],
          ['Net', netScore >= 0 ? `+${netScore}` : `${netScore}`, TrendingUp, 'from-amber-400 to-orange-600', 'Net puan'],
        ].map(([label, value, Icon, gradient, sub]) => (
          <div key={label} className="ci-metric-card flex flex-col gap-2 rounded-2xl border border-foreground/10 p-3.5">
            <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white ${gradient}`}><Icon className="h-4 w-4" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-2xl font-black tracking-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Sol */}
        <div className="space-y-5 xl:col-span-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Soru, konu veya kazanım ara..." className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] py-2.5 pl-9 pr-3 text-sm outline-none" />
          </div>

          <PremiumPanel title="Branşlara Göre" description="Branş bazında çözüm durumu">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {subjects.map((subject, index) => {
                const percentage = subject.questions > 0 ? Math.round((subject.solved / subject.questions) * 100) : 0;
                const active = selectedSubject === subject.name;
                return (
                  <button
                    key={subject.name}
                    onClick={() => setSelectedSubject(active ? 'all' : subject.name)}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${active ? 'border-[hsl(var(--brand-accent)/0.5)] bg-[hsl(var(--brand-accent)/0.08)]' : 'border-foreground/10 bg-foreground/[0.035] hover:bg-[hsl(var(--brand-accent)/0.05)]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white ${['from-sky-400 to-blue-600', 'from-violet-400 to-fuchsia-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-red-600', 'from-cyan-400 to-blue-500'][index % 6]}`}><BookOpen className="h-4 w-4" /></span>
                      <p className="truncate text-sm font-semibold">{decodeSubject(subject.name)}</p>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{subject.solved}/{subject.questions} çözüldü</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]" style={{ width: `${percentage}%` }} /></div>
                  </button>
                );
              })}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Kazanım Testleri" description="Kazanımlarına göre test çöz, eksiklerini gör." contentClassName="space-y-2.5">
            {filteredQuestionSets.length ? filteredQuestionSets.slice(0, 6).map((set) => (
              <div key={set.key} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><BookOpen className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{decodeSubject(set.subject)}</p>
                  <p className="truncate text-xs text-muted-foreground">{set.title}</p>
                </div>
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                  <p className="font-semibold text-foreground">{set.questions.length} Soru</p>
                  <p>{set.totalUsage} çözüm</p>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => handleOpenSet(set)}>Testlere Git →</Button>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Bu filtrede test bulunmuyor.</div>}
          </PremiumPanel>

          {filteredQuestionSets.length ? (
            <PremiumPanel title="Önerilen Testler" description="Senin için önerilen testler">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {filteredQuestionSets.slice(0, 5).map((set, index) => (
                  <div key={`sug-${set.key}`} className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white ${['from-sky-400 to-blue-600', 'from-violet-400 to-fuchsia-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-red-600'][index % 5]}`}><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{decodeSubject(set.subject)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{set.title}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{set.questions.length} Soru</p>
                    <Button size="sm" className="w-full text-xs" onClick={() => handleOpenSet(set)}>Çöz →</Button>
                  </div>
                ))}
              </div>
            </PremiumPanel>
          ) : null}
        </div>

        {/* Sağ ray */}
        <div className="space-y-5">
          <PremiumPanel title="Çözüm İstatistiklerim" description="Doğru / yanlış / boş dağılımı">
            <PremiumDonutChart
              segments={[
                { label: 'Doğru', value: correctCount, color: '#10B981' },
                { label: 'Yanlış', value: wrongCount, color: '#F43F5E' },
                { label: 'Boş', value: blankCount, color: '#F59E0B' },
              ]}
              centerValue={solvedCount}
              centerLabel="Çözülen Soru"
            />
          </PremiumPanel>

          <PremiumPanel title="Zorluk Seviyelerine Göre" description="Soru havuzu dağılımı">
            <div className="space-y-3">
              {difficultyBreakdown.map((entry) => (
                <div key={entry.level}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${entry.color}`} />{entry.level}</span>
                    <span className="font-semibold text-muted-foreground">{entry.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className={`h-full rounded-full ${entry.color}`} style={{ width: `${Math.round((entry.count / maxDifficulty) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Son Çözülen Sorular" description="Son çözüm aktivitelerin" contentClassName="space-y-2.5">
            {recentSolved.length ? recentSolved.map((item, index) => (
              <div key={item.id || index} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><BookOpen className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{decodeSubject(item.subject)} - {item.topic || 'Konu'}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.usageCount} çözüm</p>
                </div>
                <PremiumStatusPill tone="done">Çözüldü</PremiumStatusPill>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Henüz çözülmüş soru yok.</div>}
          </PremiumPanel>
        </div>
      </div>

      <Dialog
        open={!!selectedSet}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSet(null);
            setCurrentQuestionIndex(0);
            setShowSetSummary(false);
            setSelectedOption(null);
            setOpenEndedAnswer('');
            setSubmittedAttemptIds({});
            setResultSummary(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedSet?.title}</DialogTitle>
          </DialogHeader>
          {selectedSet && selectedQuestion ? (
            <div className="space-y-4">
              {!showSetSummary ? (
                <>
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedQuestion.subject}</Badge>
                    <Badge className={difficultyColors[selectedQuestion.difficulty] || difficultyColors.Orta}>{selectedQuestion.difficulty}</Badge>
                    <Badge>{selectedQuestion.type}</Badge>
                    <Badge variant="outline">{currentQuestionIndex + 1}/{selectedSet.questions.length}</Badge>
                  </div>
                  <p className="text-base leading-7">{selectedQuestion.questionText}</p>
                  {selectedQuestion.imagePath ? (
                    <div className="overflow-hidden rounded-xl border bg-muted">
                      <div className="h-[260px] w-full">
                        {renderQuestionImage(selectedQuestion.imagePath)}
                      </div>
                    </div>
                  ) : null}
                  {isMultipleChoice(selectedQuestion.type) ? (
                    <div className="space-y-3">
                      {selectedQuestion.options.map((option, index) => (
                        <button
                          type="button"
                          key={`${selectedQuestion.id}-${index}`}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            selectedOption === index ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : ''
                          }`}
                          onClick={() => setSelectedOption(index)}
                        >
                          {String.fromCharCode(65 + index)}. {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        value={openEndedAnswer}
                        onChange={(e) => setOpenEndedAnswer(e.target.value)}
                        className="min-h-[140px]"
                        placeholder="Açık uçlu cevabınızı buraya yazın..."
                      />
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={handleSkipQuestion}>
                      Soruyu Atla
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmitAnswer}>
                      {currentQuestionIndex === selectedSet.questions.length - 1 ? 'Seti Bitir' : 'Sonraki Soru'}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[28px] border border-emerald-200/70 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white shadow-[0_24px_60px_-28px_rgba(16,185,129,0.6)]">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex rounded-full border border-foreground/20 bg-foreground/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">
                          Set Tamamlandı
                        </div>
                        <div className="mt-4 text-3xl font-black tracking-tight">
                          {selectedSet.title}
                        </div>
                        <div className="mt-3 max-w-xl text-sm leading-6 text-foreground/85">
                          Soruları tamamladın. Doğru sayın, bonusların ve kazandığın XP aşağıda anında işlendi.
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <div className="rounded-2xl border border-foreground/20 bg-foreground/12 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">Doğru</div>
                            <div className="mt-1 text-2xl font-black">
                              <AnimatedCounter value={resultSummary?.correctCount ?? 0} />
                              <span className="ml-1 text-base font-semibold text-foreground/75">/ {selectedSet.questions.length}</span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-foreground/20 bg-foreground/12 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">Kazanılan XP</div>
                            <div className="mt-1 text-2xl font-black">
                              +<AnimatedCounter value={resultSummary?.totalXp ?? 0} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center lg:justify-end">
                        <div className="rounded-[26px] border border-foreground/20 bg-slate-950/18 p-4 backdrop-blur-md">
                          <CircularProgress
                            value={Math.round((((resultSummary?.correctCount ?? 0) / Math.max(1, selectedSet.questions.length)) * 100))}
                            size={156}
                            strokeWidth={12}
                            color="#ffffff"
                            bgColor="rgba(255,255,255,0.16)"
                            label="Başarı"
                            className="text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {resultSummary?.bonuses?.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {resultSummary.bonuses.map((bonus) => (
                        <div key={bonus} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm dark:border-foreground/10 dark:bg-slate-950 dark:text-slate-300">
                          {bonus}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    {selectedSet.questions.map((question, index) => (
                      <div key={question.id} className="rounded-xl border p-4">
                        <div className="text-xs font-semibold text-muted-foreground">Soru {index + 1}</div>
                        <div className="mt-1 text-sm font-medium line-clamp-2">{question.questionText}</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-sm text-muted-foreground">{submittedAnswers[question.id]?.answer || 'Cevap kaydı bulunamadı.'}</div>
                          <Badge className={submittedAnswers[question.id]?.isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                            {submittedAnswers[question.id]?.isCorrect ? 'Doğru' : 'Yanlış'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentQuestionIndex(0);
                        setShowSetSummary(false);
                        setSelectedOption(null);
                        setOpenEndedAnswer('');
                        setSubmittedAnswers({});
                        setSubmittedAttemptIds({});
                        setResultSummary(null);
                      }}
                    >
                      Tekrar Çöz
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setSelectedSet(null)}>
                      Kapat
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {newBadges.length > 0 && (
        <BadgeUnlockModal badges={newBadges} onClose={() => setNewBadges([])} />
      )}
    </motion.div>
  );
}
