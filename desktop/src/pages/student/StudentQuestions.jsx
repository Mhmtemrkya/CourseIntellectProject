import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Search, Play, CheckCircle, Zap, Target, BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { DialogFooter } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { AnimatedCounter, CircularProgress } from '../../components/animations/AnimatedCounter';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  fetchQuestionBank,
  fetchStudyPlan,
  incrementQuestionUsage,
  saveStudyPlan,
  submitQuestionPracticeAttempt,
} from '../../lib/api/modules';
import { Textarea } from '../../components/ui/textarea';
import { desktopApiBaseUrl } from '../../lib/auth';

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

function isMultipleChoice(type = '') {
  return /secmeli|çoktan/i.test(type);
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
      <div className="absolute left-[-18px] top-[-22px] h-28 w-28 rounded-full bg-white/12" />
      <div className="absolute bottom-[-34px] right-[-24px] h-40 w-40 rounded-full bg-black/10" />
      <div className="absolute left-6 top-5 text-[54px] font-black tracking-[-0.08em] text-white/10">
        {getSubjectMark(safeSubject)}
      </div>
      <div className="mt-auto flex items-end gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-base font-bold text-white backdrop-blur-sm">
          {theme.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{safeSubject || 'Genel'}</div>
          <div className="truncate text-[11px] font-bold tracking-[0.18em] text-white/70">{getSubjectTagline(safeSubject)}</div>
          <div className="line-clamp-2 text-[22px] font-black leading-[1.02] tracking-tight">Soru Bankası</div>
        </div>
        <div className="h-14 w-2 rounded-full bg-white/35" />
      </div>
    </div>
  );
}

export default function StudentQuestions() {
  const { toast } = useToast();
  const { user } = useApp();
  const [questions, setQuestions] = useState([]);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchQuestionBank();
      setQuestions(payload);
    } catch (err) {
      setError(err.message || 'Soru bankası alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleOpenSet = async (set) => {
    setSelectedSet(set);
    setCurrentQuestionIndex(0);
    setShowSetSummary(false);
    setSelectedOption(null);
    setOpenEndedAnswer('');
    setSubmittedAnswers({});
    setSubmittedAttemptIds({});
    setResultSummary(null);
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
      ? `${String.fromCharCode(65 + selectedOption)} - ${selectedQuestion.options[selectedOption]}`
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
      const studyPlan = await fetchStudyPlan();
      await saveStudyPlan({
        studentName: user?.name || 'Ogrenci',
        planItemsSerialized: studyPlan?.planItemsSerialized ?? '[]',
        streakCount: studyPlan?.streakCount ?? 0,
        xpPoints: (studyPlan?.xpPoints ?? 0) + summary.totalXp,
        lastCompletedAt: studyPlan?.lastCompletedAt ?? null,
      });
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
      const studyPlan = await fetchStudyPlan();
      await saveStudyPlan({
        studentName: user?.name || 'Ogrenci',
        planItemsSerialized: studyPlan?.planItemsSerialized ?? '[]',
        streakCount: studyPlan?.streakCount ?? 0,
        xpPoints: (studyPlan?.xpPoints ?? 0) + summary.totalXp,
        lastCompletedAt: studyPlan?.lastCompletedAt ?? null,
      });
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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 relative" data-testid="student-questions-page">
      <motion.div variants={itemVariants}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-heading">Soru Bankası</h1>
              <p className="text-muted-foreground">Canlı backend soru arşivi</p>
            </div>
          </div>
          <Button
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
            onClick={handleRandomQuestion}
          >
            <Play className="h-4 w-4 mr-2" />
            Rastgele Soru Çöz
          </Button>
        </div>
      </motion.div>

      {error ? <ErrorBanner title="Soru bankası alınamadı" message={error} onRetry={loadQuestions} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['Toplam Soru', stats.totalQuestions, BookOpen, 'from-blue-500 to-cyan-500'],
          ['Çözülen', stats.solved, CheckCircle, 'from-green-500 to-emerald-500'],
          ['Başarı Oranı', `${stats.successRate}%`, Target, 'from-purple-500 to-pink-500'],
          ['Kazanılan XP', stats.xp, Zap, 'from-yellow-500 to-orange-500'],
        ].map(([label, value, Icon, gradient]) => (
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

      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#D9790B]" />
              Dersler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {subjects.map((subject) => {
                const percentage = subject.questions > 0 ? Math.round((subject.solved / subject.questions) * 100) : 0;
                return (
                  <div
                    key={subject.name}
                    onClick={() => setSelectedSubject(selectedSubject === subject.name ? 'all' : subject.name)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      selectedSubject === subject.name ? 'border-[#D9790B] bg-[#D9790B]/10 shadow-lg shadow-orange-500/20' : 'border-border hover:border-[#D9790B]/50'
                    }`}
                  >
                    <div className="text-center">
                      <p className="font-semibold">{subject.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{subject.solved}/{subject.questions}</p>
                      <Progress value={percentage} className="h-1.5 mt-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Konu ara..." className="pl-10 h-12 rounded-xl" />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        {filteredQuestionSets.length === 0 ? (
          <StudentEmptyState
            variant="question"
            accent="purple"
            title="Henüz soru çözmedin"
            description="Soru bankamızdan konu çalışmaya başlayın. Sana özel sorular ve çözümler burada olacak."
            primaryLabel="Soru Çözmeye Başla"
            onPrimary={loadQuestions}
          />
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuestionSets.map((set) => (
            <motion.div key={set.key} variants={itemVariants}>
              <Card className="cursor-pointer overflow-hidden border border-slate-200/80 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] transition-shadow hover:shadow-xl dark:border-white/10 dark:bg-slate-950">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                        {set.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {set.questions.length} soru
                      </p>
                    </div>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getSubjectTheme(set.subject).accent} text-sm font-bold text-white shadow-lg`}>
                      {set.questions.length}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 dark:border-white/10 dark:bg-slate-900">
                    <AutoCover subject={set.subject} />
                  </div>

                  <div className="flex border-t">
                    <Button variant="ghost" className="flex-1 rounded-none h-12 hover:bg-teal-50 dark:hover:bg-teal-900/20" onClick={() => handleOpenSet(set)}>
                      <Play className="h-4 w-4 mr-2" /> Seti Başlat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        )}
      </motion.div>

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
                        <div className="inline-flex rounded-full border border-white/20 bg-white/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                          Set Tamamlandı
                        </div>
                        <div className="mt-4 text-3xl font-black tracking-tight">
                          {selectedSet.title}
                        </div>
                        <div className="mt-3 max-w-xl text-sm leading-6 text-white/85">
                          Soruları tamamladın. Doğru sayın, bonusların ve kazandığın XP aşağıda anında işlendi.
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Doğru</div>
                            <div className="mt-1 text-2xl font-black">
                              <AnimatedCounter value={resultSummary?.correctCount ?? 0} />
                              <span className="ml-1 text-base font-semibold text-white/75">/ {selectedSet.questions.length}</span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Kazanılan XP</div>
                            <div className="mt-1 text-2xl font-black">
                              +<AnimatedCounter value={resultSummary?.totalXp ?? 0} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center lg:justify-end">
                        <div className="rounded-[26px] border border-white/20 bg-slate-950/18 p-4 backdrop-blur-md">
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
                        <div key={bonus} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">
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
    </motion.div>
  );
}
