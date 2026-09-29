import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Search, Play, CheckCircle, Target, BookOpen, XCircle, MinusCircle, TrendingUp,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { PremiumPanel, PremiumDonutChart, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  classMatchesMine,
  fetchQuestionBank,
  fetchQuestionPracticeStats,
  getMyClassName,
} from '../../lib/api/modules';
import { errorMessage, isRecord } from '../../lib/errors';
import type { QuestionBankItemDto, QuestionPracticeStatsDto } from '../../types/api/generated';
import type { IconComponent } from '../../types/ui';

interface QuestionSet {
  key: string;
  title: string;
  subject: string;
  difficulty: string;
  teacher: string;
  questions: QuestionBankItemDto[];
  imageCount: number;
  totalUsage: number;
}

interface SubjectProgress {
  name: string;
  questions: number;
  solved: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function isExamOnlyQuestion(item: QuestionBankItemDto): boolean {
  try {
    const metadata: unknown = JSON.parse(item.editorMetadataJson || '{}');
    return isRecord(metadata) && metadata.visibility === 'ExamOnly';
  } catch {
    return false;
  }
}

function buildQuestionSetKey(item: QuestionBankItemDto): string {
  if (item.questionSetKey) return item.questionSetKey;
  const createdAt = item.createdAt ? new Date(item.createdAt) : null;
  const bucket = createdAt && !Number.isNaN(createdAt.getTime())
    ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')} ${String(createdAt.getHours()).padStart(2, '0')}:${Math.floor(createdAt.getMinutes() / 10)}`
    : (item.createdAt || '').slice(0, 16);
  const classes = [...(item.classTargets || [])].sort().join(',');
  return `${item.teacher}|${item.subject}|${item.topic}|${bucket}|${classes}`;
}

function buildQuestionSets(items: readonly QuestionBankItemDto[]): QuestionSet[] {
  const groups = new Map<string, QuestionBankItemDto[]>();
  [...items]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .forEach((item) => {
    const key = buildQuestionSetKey(item);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
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
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    }),
    imageCount: questions.filter((item) => item.imagePath).length,
    totalUsage: questions.reduce((sum, item) => sum + Number(item.usageCount || 0), 0),
  })).sort((a, b) => new Date(b.questions[0]?.createdAt || 0).getTime() - new Date(a.questions[0]?.createdAt || 0).getTime());
}

function decodeSubject(subject = ''): string {
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

export default function StudentQuestions() {
  const { toast } = useToast();
  const { user } = useApp();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionBankItemDto[]>([]);
  const [practiceStats, setPracticeStats] = useState<QuestionPracticeStatsDto | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const username = user?.username || user?.email || (user?.name || 'ogrenci').toLowerCase().replaceAll(' ', '');
      const myClass = await getMyClassName(user);
      const [payload, statsPayload] = await Promise.all([
        fetchQuestionBank(myClass || undefined),
        fetchQuestionPracticeStats({ studentUsername: username }).catch(() => null),
      ]);
      // Sunucu sınıf filtresine ek olarak istemcide de kendi sınıfına göre süz.
      // Soru DTO'sunda `className` yok (eski süzgeç hep boş alanı okuyup her soruyu
      // geçiriyordu); hedef sınıflar classTargets'tadır, boşsa soru geneldir.
      // Hedefler tek tek eşleştirilir: "Tum Siniflar" hedefi de genel sayılır.
      setQuestions((payload || [])
        .filter((item) => !isExamOnlyQuestion(item))
        .filter((item) => item.classTargets.length === 0
          || item.classTargets.some((target) => classMatchesMine(target, myClass))));
      setPracticeStats(statsPayload);
    } catch (err) {
      setError(errorMessage(err, 'Soru bankası alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const subjects = useMemo(() => {
    const grouped = new Map<string, SubjectProgress>();
    questions.forEach((item) => {
      const current = grouped.get(item.subject) ?? { name: item.subject, questions: 0, solved: 0 };
      current.questions += 1;
      current.solved += Number(item.usageCount || 0) > 0 ? 1 : 0;
      grouped.set(item.subject, current);
    });
    return Array.from(grouped.values());
  }, [questions]);

  const filteredQuestions = useMemo(() => questions.filter((item) => {
    const matchesSearch = `${item.topic} ${item.questionText}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || item.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  }), [questions, search, selectedSubject]);
  const filteredQuestionSets = useMemo(() => buildQuestionSets(filteredQuestions), [filteredQuestions]);

  const stats = {
    totalQuestions: questions.length,
    solved: questions.filter((item) => Number(item.usageCount || 0) > 0).length,
    successRate: questions.length ? Math.round((questions.filter((item) => Number(item.usageCount || 0) > 0).length / questions.length) * 100) : 0,
    xp: questions.reduce((sum, item) => sum + Math.min(10, Number(item.usageCount || 0)), 0),
  };
  // "Toplam Soru" ve "Boş", sadece bu öğrencinin sayfasında görünen sorulara göre
  // hesaplanır (backend'in genel toplamı değil). Doğru/yanlış/net gerçek çözüm
  // verisinden (backend /attempts/stats) gelir.
  const totalCount = stats.totalQuestions;
  const correctCount = practiceStats?.correct ?? 0;
  const wrongCount = practiceStats?.wrong ?? 0;
  // Bu öğrencinin sayfasında çözülmüş soru sayısı (sayfadaki soru sayısını aşamaz).
  const solvedCount = Math.min(totalCount, practiceStats?.solved ?? stats.solved);
  // Boş = sayfadaki sorulardan henüz çözülmemiş olanlar.
  const blankCount = Math.max(0, totalCount - solvedCount);
  const netScore = practiceStats?.net ?? 0;
  const difficultyBreakdown = ([
    ['Kolay', 'bg-emerald-400'],
    ['Orta', 'bg-amber-400'],
    ['Zor', 'bg-rose-400'],
  ] satisfies ReadonlyArray<readonly [string, string]>).map(([level, color]) => ({ level, color, count: questions.filter((item) => (item.difficulty || 'Orta') === level).length }));
  const maxDifficulty = Math.max(1, ...difficultyBreakdown.map((entry) => entry.count));
  const recentSolved = questions.filter((item) => Number(item.usageCount || 0) > 0).slice(0, 5);

  const handleOpenSet = (set: QuestionSet) => {
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
    if (randomSet) handleOpenSet(randomSet);
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
        {([
          ['Toplam Soru', totalCount, BookOpen, 'from-sky-400 to-blue-600', 'Tüm branşlar'],
          ['Çözülen Soru', solvedCount, Target, 'from-violet-400 to-fuchsia-600', 'Bu zamana kadar'],
          ['Doğru', correctCount, CheckCircle, 'from-emerald-400 to-teal-600', totalCount ? `%${Math.round((correctCount / Math.max(1, solvedCount)) * 100)} doğru oranı` : 'Doğru cevap'],
          ['Yanlış', wrongCount, XCircle, 'from-rose-400 to-red-600', solvedCount ? `%${Math.round((wrongCount / Math.max(1, solvedCount)) * 100)} yanlış oranı` : 'Yanlış cevap'],
          ['Boş', blankCount, MinusCircle, 'from-slate-400 to-slate-600', 'Çözülmeyen soru'],
          ['Net', netScore >= 0 ? `+${netScore}` : `${netScore}`, TrendingUp, 'from-amber-400 to-orange-600', 'Net puan'],
        ] satisfies ReadonlyArray<readonly [string, string | number, IconComponent, string, string]>).map(([label, value, Icon, gradient, sub]) => (
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

    </motion.div>
  );
}
