import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList,
  Clock3, Flame, Lightbulb, ListChecks, Pencil, Play, Plus, Quote, Sparkles,
  Target, Timer, Trash2, TrendingUp, Wand2, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  addStudyPlanItem,
  addStudyPlanXp,
  deleteStudyPlanItem,
  fetchExamResults,
  fetchHomework,
  fetchPlannedExams,
  fetchStudyPlan,
  saveStudyPlan,
} from '../../lib/api/modules';
import { collectNewBadges } from '../../lib/badges';
import { studyPlanRealtime } from '../../lib/realtime/studyPlanRealtime';
import BadgeUnlockModal from '../../components/badges/BadgeUnlockModal';

const SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce', 'Tarih', 'Coğrafya', 'Genel'];

const SUBJECT_COLORS = {
  Matematik: '#FF8A00',
  'Türkçe': '#8B5CF6',
  Fizik: '#2563EB',
  Kimya: '#22C55E',
  Biyoloji: '#10B981',
  'İngilizce': '#3B82F6',
  Tarih: '#F43F5E',
  'Coğrafya': '#06B6D4',
  Genel: '#EF4444',
};

const QUOTES = [
  ['Başarı, küçük çabaların her gün tekrarlanmasıdır.', 'Robert Collier'],
  ['Disiplin, hedefler ile başarı arasındaki köprüdür.', 'Jim Rohn'],
  ['Bugünün işini yarına bırakma.', 'Benjamin Franklin'],
  ['Küçük adımlar, büyük yolculukların başlangıcıdır.', 'Lao Tzu'],
  ['Öğrenmek, hiç bitmeyen bir hazinedir.', 'Sadi Şirazi'],
  ['Yapabileceğine inan, yolu yarılamış olursun.', 'Theodore Roosevelt'],
  ['Mükemmellik bir eylem değil, alışkanlıktır.', 'Aristoteles'],
];

const TASK_XP = 20;
const GOAL_XP = 50;

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function toIsoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
}

function formatMinutes(total) {
  const minutes = Math.max(0, Math.round(total));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}d`;
  return rest > 0 ? `${hours}s ${rest}d` : `${hours}s`;
}

// Backend'de PlanItemsSerialized serbest JSON tutar; eski kayıtlar da
// (date/type alanı olmayan) görev olarak normalize edilir.
function normalizeItems(raw) {
  let parsed = [];
  try {
    parsed = JSON.parse(raw || '[]');
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) parsed = [];

  const tasks = [];
  const goals = [];
  parsed.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const type = item.type || (item.target != null ? 'goal' : 'task');
    if (type === 'goal') {
      goals.push({
        id: String(item.id || ''),
        type: 'goal',
        title: String(item.title || 'Hedef'),
        target: Math.max(1, Number(item.target) || 1),
        current: Math.max(0, Number(item.current) || 0),
        unit: String(item.unit || ''),
        createdAt: item.createdAt || new Date().toISOString(),
      });
      return;
    }
    const duration = Number(item.durationMinutes)
      || parseInt(String(item.duration || ''), 10)
      || 45;
    const status = item.status === 'done' || item.done === true
      ? 'done'
      : item.status === 'active' ? 'active' : 'pending';
    tasks.push({
      id: String(item.id || ''),
      type: 'task',
      title: String(item.title || 'Görev'),
      subject: String(item.subject || 'Genel'),
      topic: String(item.topic || item.reason || ''),
      date: String(item.date || (item.createdAt || '').slice(0, 10) || toIsoDate(new Date())),
      startTime: String(item.startTime || ''),
      endTime: String(item.endTime || ''),
      durationMinutes: duration,
      status,
      source: String(item.source || 'manual'),
      createdAt: item.createdAt || new Date().toISOString(),
    });
  });
  return { tasks, goals };
}

function nextStreak(state) {
  const last = state?.lastCompletedAt ? new Date(state.lastCompletedAt) : null;
  const streak = Number(state?.streakCount) || 0;
  if (!last) return 1;
  const today = toIsoDate(new Date());
  const lastDay = toIsoDate(last);
  if (lastDay === today) return Math.max(1, streak);
  const yesterday = toIsoDate(new Date(Date.now() - 86400000));
  return lastDay === yesterday ? streak + 1 : 1;
}

function endTimeFor(startTime, durationMinutes) {
  if (!startTime) return '';
  const [h, m] = startTime.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const total = h * 60 + (m || 0) + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const STATUS_META = {
  done: { label: 'Tamamlandı', className: 'text-emerald-500', dot: 'bg-emerald-500' },
  active: { label: 'Devam Ediyor', className: 'text-orange-500', dot: 'bg-orange-500' },
  pending: { label: 'Bekliyor', className: 'text-muted-foreground', dot: 'bg-slate-400' },
};

export default function StudentStudyPlan() {
  const { user } = useApp();
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [homework, setHomework] = useState([]);
  const [plannedExams, setPlannedExams] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [taskDialog, setTaskDialog] = useState(false);
  const [goalDialog, setGoalDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: '', subject: 'Matematik', topic: '', startTime: '09:00', durationMinutes: 45,
  });
  const [goalForm, setGoalForm] = useState({ title: '', target: 10, current: 0, unit: '' });

  const applyState = useCallback((planState) => {
    const normalized = normalizeItems(planState?.planItemsSerialized);
    setState(planState);
    setTasks(normalized.tasks);
    setGoals(normalized.goals);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [planState, homeworkList, examList, resultList] = await Promise.all([
        fetchStudyPlan(),
        fetchHomework().catch(() => []),
        fetchPlannedExams().catch(() => []),
        fetchExamResults({ studentName: user?.name || '' }).catch(() => []),
      ]);
      applyState(planState);
      setHomework(Array.isArray(homeworkList) ? homeworkList : []);
      setPlannedExams(Array.isArray(examList) ? examList : []);
      setExamResults(Array.isArray(resultList) ? resultList : []);
    } catch (err) {
      setError(err.message || 'Çalışma planı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [applyState, user]);

  useEffect(() => {
    load();
  }, [load]);

  // SignalR canlı senkronizasyon: mobilde (veya başka sekmede) yapılan
  // her plan değişikliği anında bu sayfaya yansır.
  useEffect(() => studyPlanRealtime.subscribe((planState) => {
    applyState(planState);
  }), [applyState]);

  const persist = useCallback(async (nextTasks, nextGoals, overrides = {}) => {
    const payload = {
      studentName: user?.name || '',
      planItemsSerialized: JSON.stringify([...nextTasks, ...nextGoals]),
      streakCount: overrides.streakCount ?? state?.streakCount ?? 0,
      xpPoints: overrides.xpPoints ?? state?.xpPoints ?? 0,
      lastCompletedAt: overrides.lastCompletedAt ?? state?.lastCompletedAt ?? null,
    };
    const updated = await saveStudyPlan(payload);
    applyState(updated);
    return updated;
  }, [state, user, applyState]);

  const dayTasks = useMemo(() => tasks
    .filter((task) => task.date === selectedDate)
    .sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99')), [tasks, selectedDate]);

  const kpis = useMemo(() => {
    const total = dayTasks.length;
    const done = dayTasks.filter((task) => task.status === 'done').length;
    const planned = dayTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    const actual = dayTasks.filter((task) => task.status === 'done')
      .reduce((sum, task) => sum + task.durationMinutes, 0);
    return { total, done, remaining: total - done, planned, actual };
  }, [dayTasks]);

  const weekStats = useMemo(() => {
    const now = new Date(`${selectedDate}T00:00:00`);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, index) => toIsoDate(new Date(monday.getTime() + index * 86400000)));
    const weekTasks = tasks.filter((task) => days.includes(task.date));
    const planned = weekTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    const completed = weekTasks.filter((task) => task.status === 'done')
      .reduce((sum, task) => sum + task.durationMinutes, 0);
    const percent = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    return { days, planned, completed, remaining: planned - completed, percent };
  }, [tasks, selectedDate]);

  const suggestions = useMemo(() => {
    const list = [];
    const today = toIsoDate(new Date());
    const myName = (user?.name || '').toLowerCase();
    homework
      .filter((item) => !(item.submissions || []).some(
        (sub) => String(sub.studentName || '').toLowerCase() === myName,
      ))
      .slice(0, 3)
      .forEach((item) => {
        list.push({
          key: `hw-${item.id}`,
          icon: ClipboardList,
          color: '#2563EB',
          title: `Ödev: ${item.title}`,
          detail: `${item.subject || 'Ders'} • Teslim: ${item.deadline || 'yakında'}`,
          task: {
            title: `Ödev: ${item.title}`, subject: item.subject || 'Genel',
            topic: 'Ödev tamamlama', durationMinutes: 45, source: 'assignment',
          },
        });
      });
    plannedExams.slice(0, 3).forEach((item) => {
      list.push({
        key: `exam-${item.id}`,
        icon: Target,
        color: '#8B5CF6',
        title: `Denemeye hazırlık: ${item.title}`,
        detail: `${item.subject || 'Genel'} • ${item.dateLabel || item.className || ''}`,
        task: {
          title: `Deneme hazırlığı: ${item.title}`, subject: item.subject || 'Genel',
          topic: 'Deneme tekrarı ve eksik analizi', durationMinutes: 60, source: 'exam',
        },
      });
    });
    // Kazanım analizi: son sınav sonuçlarında ortalaması düşük dersler.
    const scoresBySubject = examResults.slice(0, 12).reduce((acc, result) => {
      const subject = String(result.subject || '').trim();
      const score = Number(result.score);
      if (!subject || Number.isNaN(score)) return acc;
      (acc[subject] = acc[subject] || []).push(score);
      return acc;
    }, {});
    Object.entries(scoresBySubject)
      .map(([subject, scores]) => [subject, Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length), scores.length])
      .filter(([, average]) => average < 60)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .forEach(([subject, average, count]) => {
        list.push({
          key: `weak-${subject}`,
          icon: TrendingUp,
          color: '#EF4444',
          title: `Son ${count} sınavda ${subject} başarın düşük (ort. %${average})`,
          detail: 'Bu hafta bu derse ek süre ayırman önerilir.',
          task: {
            title: `${subject} Eksik Kazanım Çalışması`, subject,
            topic: 'Düşük başarılı konuların tekrarı', durationMinutes: 90, source: 'auto',
          },
        });
      });
    // Son 14 günde hiç çalışılmamış dersler.
    const recent = tasks.filter((task) => {
      const diff = (new Date(today) - new Date(task.date)) / 86400000;
      return diff >= 0 && diff <= 14;
    });
    const studied = new Set(recent.map((task) => task.subject));
    SUBJECTS.filter((subject) => subject !== 'Genel' && !studied.has(subject))
      .slice(0, 2)
      .forEach((subject) => {
        list.push({
          key: `gap-${subject}`,
          icon: Lightbulb,
          color: '#FF8A00',
          title: `${subject} son 14 günde çalışılmadı`,
          detail: 'Planına ekleyerek dengeyi koru.',
          task: {
            title: `${subject} Genel Tekrar`, subject,
            topic: 'Eksik kapatma', durationMinutes: 45, source: 'auto',
          },
        });
      });
    return list.slice(0, 6);
  }, [homework, plannedExams, examResults, tasks, user]);

  const calendarDayState = useCallback((iso) => {
    const list = tasks.filter((task) => task.date === iso);
    if (list.length === 0) return 'empty';
    return list.every((task) => task.status === 'done') ? 'full' : 'partial';
  }, [tasks]);

  const celebrate = useCallback((updatedState) => {
    const unlocked = collectNewBadges(updatedState?.xpPoints, user);
    if (unlocked.length) setNewBadges(unlocked);
  }, [user]);

  const addTask = useCallback(async (template, date = selectedDate) => {
    const duration = Math.max(10, Number(template.durationMinutes) || 45);
    const item = {
      type: 'task',
      title: template.title.trim(),
      subject: template.subject,
      topic: (template.topic || '').trim(),
      date,
      startTime: template.startTime || '',
      endTime: endTimeFor(template.startTime || '', duration),
      durationMinutes: duration,
      status: 'pending',
      source: template.source || 'manual',
      createdAt: new Date().toISOString(),
    };
    const updated = await addStudyPlanItem(item);
    applyState(updated);
  }, [selectedDate, applyState]);

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) {
      toast({ title: 'Görev adı zorunlu', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await addTask(taskForm);
      setTaskDialog(false);
      setTaskForm({ title: '', subject: 'Matematik', topic: '', startTime: '09:00', durationMinutes: 45 });
      toast({ title: 'Görev eklendi' });
    } catch (err) {
      toast({ title: 'Görev eklenemedi', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setTaskStatus = async (task, status) => {
    try {
      const nextTasks = tasks.map((item) => (item.id === task.id ? { ...item, status, done: status === 'done' } : item));
      if (status === 'done') {
        const streak = nextStreak(state);
        await persist(nextTasks, goals, { lastCompletedAt: new Date().toISOString(), streakCount: streak });
        const afterXp = await addStudyPlanXp(TASK_XP);
        setState(afterXp);
        toast({ title: `Görev tamamlandı! +${TASK_XP} XP 🎉` });
        celebrate(afterXp);
      } else {
        await persist(nextTasks, goals);
      }
    } catch (err) {
      toast({ title: 'Güncellenemedi', description: err.message, variant: 'destructive' });
    }
  };

  const removeTask = async (task) => {
    try {
      const updated = await deleteStudyPlanItem(task.id);
      applyState(updated);
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddGoal = async () => {
    if (!goalForm.title.trim()) {
      toast({ title: 'Hedef adı zorunlu', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const updated = await addStudyPlanItem({
        type: 'goal',
        title: goalForm.title.trim(),
        target: Math.max(1, Number(goalForm.target) || 1),
        current: Math.max(0, Number(goalForm.current) || 0),
        unit: goalForm.unit.trim(),
        createdAt: new Date().toISOString(),
      });
      applyState(updated);
      setGoalDialog(false);
      setGoalForm({ title: '', target: 10, current: 0, unit: '' });
      toast({ title: 'Hedef eklendi' });
    } catch (err) {
      toast({ title: 'Hedef eklenemedi', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const bumpGoal = async (goal, delta) => {
    const current = Math.min(goal.target, Math.max(0, goal.current + delta));
    if (current === goal.current) return;
    const nextGoals = goals.map((item) => (item.id === goal.id ? { ...item, current } : item));
    try {
      await persist(tasks, nextGoals);
      if (current >= goal.target && goal.current < goal.target) {
        const afterXp = await addStudyPlanXp(GOAL_XP);
        setState(afterXp);
        toast({ title: `Hedef tamamlandı! +${GOAL_XP} XP 🏆`, description: goal.title });
        celebrate(afterXp);
      }
    } catch (err) {
      toast({ title: 'Hedef güncellenemedi', description: err.message, variant: 'destructive' });
    }
  };

  const removeGoal = async (goal) => {
    try {
      const updated = await deleteStudyPlanItem(goal.id);
      applyState(updated);
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message, variant: 'destructive' });
    }
  };

  // Ödev, deneme ve eksik ders verilerinden bugünün planını otomatik üretir.
  const generatePlan = async () => {
    if (suggestions.length === 0) {
      toast({ title: 'Öneri bulunamadı', description: 'Ödev, deneme veya eksik ders verisi yok.' });
      return;
    }
    try {
      setGenerating(true);
      let start = 9 * 60;
      for (const suggestion of suggestions.slice(0, 4)) {
        const startTime = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
        // eslint-disable-next-line no-await-in-loop
        await addTask({ ...suggestion.task, startTime }, toIsoDate(new Date()));
        start += suggestion.task.durationMinutes + 15;
      }
      setSelectedDate(toIsoDate(new Date()));
      setTab('daily');
      toast({ title: 'Plan oluşturuldu', description: 'Ödev, deneme ve eksik derslerden bugünün planı üretildi.' });
    } catch (err) {
      toast({ title: 'Plan oluşturulamadı', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Çalışma planın hazırlanıyor...</p>
      </div>
    );
  }

  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const xp = Number(state?.xpPoints) || 0;
  const streak = Number(state?.streakCount) || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="student-study-plan-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Çalışma Planım</h1>
          <p className="text-sm text-muted-foreground mt-1">Hedeflerine ulaşmak için planını oluştur ve ilerlemeni takip et.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-orange-500/15 text-orange-500 border-0 font-bold gap-1"><Flame className="h-3.5 w-3.5" /> {streak} gün seri</Badge>
          <Badge className="bg-blue-500/15 text-blue-500 border-0 font-bold gap-1"><Zap className="h-3.5 w-3.5" /> {xp} XP</Badge>
          <Button variant="outline" className="rounded-xl" onClick={generatePlan} disabled={generating}>
            <Wand2 className="mr-2 h-4 w-4" /> {generating ? 'Oluşturuluyor...' : 'Plan Oluştur'}
          </Button>
          <Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={() => setGoalDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Yeni Hedef Ekle
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5 min-w-0">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Günlük Plan Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Toplam Görev', `${kpis.total} görev`, ClipboardList, 'text-blue-500 bg-blue-500/10'],
                  ['Tamamlanan', `${kpis.done} görev`, CheckCircle2, 'text-emerald-500 bg-emerald-500/10'],
                  ['Kalan', `${kpis.remaining} görev`, Clock3, 'text-orange-500 bg-orange-500/10'],
                  ['Tahmini Süre', formatMinutes(kpis.planned), Timer, 'text-purple-500 bg-purple-500/10'],
                  ['Gerçekleşen Süre', formatMinutes(kpis.actual), TrendingUp, 'text-cyan-500 bg-cyan-500/10'],
                ].map(([label, value, Icon, tone]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
                    </div>
                    <p className="text-xl font-black mt-1">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-0">
              <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 -mx-6 px-6">
                {[
                  ['daily', 'Günlük Plan'],
                  ['weekly', 'Haftalık Plan'],
                  ['monthly', 'Aylık Plan'],
                  ['goals', 'Hedeflerim'],
                  ['analytics', 'Analizler'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`px-3 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                      tab === key
                        ? 'border-orange-500 text-orange-500'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {tab === 'daily' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">{formatDateLong(selectedDate)}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedDate(toIsoDate(new Date(new Date(`${selectedDate}T00:00:00`).getTime() - 86400000)))}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedDate(toIsoDate(new Date(new Date(`${selectedDate}T00:00:00`).getTime() + 86400000)))}><ChevronRight className="h-4 w-4" /></Button>
                    <Button variant={selectedDate === toIsoDate(new Date()) ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setSelectedDate(toIsoDate(new Date()))}>Bugün</Button>
                  </div>

                  {dayTasks.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
                      <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="font-bold mt-2">Bu gün için görev yok</p>
                      <p className="text-sm text-muted-foreground mt-1">"Plan Oluştur" ile ödev ve denemelerinden otomatik plan üret, ya da görev ekle.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayTasks.map((task) => {
                        const meta = STATUS_META[task.status];
                        const subjectColor = SUBJECT_COLORS[task.subject] || '#64748B';
                        return (
                          <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3" style={{ borderLeft: `4px solid ${task.status === 'done' ? '#22C55E' : subjectColor}` }}>
                            <div className="w-24 shrink-0 text-sm font-bold tabular-nums">
                              {task.startTime ? `${task.startTime} – ${task.endTime || endTimeFor(task.startTime, task.durationMinutes)}` : 'Saatsiz'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{task.topic || 'Görev'}</p>
                            </div>
                            <span className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold w-28">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subjectColor }} /> {task.subject}
                            </span>
                            <span className="hidden sm:block w-16 text-sm font-semibold text-muted-foreground">{task.durationMinutes} dk</span>
                            <span className={`w-28 text-sm font-bold ${meta.className}`}>{meta.label}</span>
                            <div className="flex items-center gap-1">
                              {task.status === 'pending' && (
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" title="Başla" onClick={() => setTaskStatus(task, 'active')}><Play className="h-4 w-4" /></Button>
                              )}
                              {task.status !== 'done' && (
                                <Button size="icon" className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" title="Tamamla" onClick={() => setTaskStatus(task, 'done')}><CheckCircle2 className="h-4 w-4" /></Button>
                              )}
                              {task.status === 'done' && (
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" title="Geri al" onClick={() => setTaskStatus(task, 'pending')}><Pencil className="h-4 w-4" /></Button>
                              )}
                              <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg text-red-500" title="Sil" onClick={() => removeTask(task)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Button variant="outline" className="rounded-xl" onClick={() => setTaskDialog(true)}><Plus className="mr-2 h-4 w-4" /> Görev Ekle</Button>
                  </div>

                  {suggestions.length > 0 && (
                    <div className="rounded-2xl border border-orange-300/40 bg-orange-500/5 p-4">
                      <p className="font-bold flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-orange-500" /> Akıllı Öneriler</p>
                      <div className="mt-3 space-y-2">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.key} className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${suggestion.color}1F`, color: suggestion.color }}>
                              <suggestion.icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{suggestion.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{suggestion.detail}</p>
                            </div>
                            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => addTask(suggestion.task).then(() => toast({ title: 'Plana eklendi' })).catch((err) => toast({ title: 'Eklenemedi', description: err.message, variant: 'destructive' }))}>
                              Plana Ekle
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'weekly' && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weekStats.days.map((iso) => {
                    const list = tasks.filter((task) => task.date === iso)
                      .sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99'));
                    const done = list.filter((task) => task.status === 'done').length;
                    const isToday = iso === toIsoDate(new Date());
                    return (
                      <button key={iso} type="button" onClick={() => { setSelectedDate(iso); setTab('daily'); }} className={`text-left rounded-2xl border p-4 transition-colors hover:border-orange-400 ${isToday ? 'border-orange-400 bg-orange-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-black">{DAY_NAMES[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7]} <span className="text-muted-foreground font-semibold">{iso.slice(8)}</span></p>
                          <Badge variant="outline" className="font-bold">{done}/{list.length}</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          {list.slice(0, 3).map((task) => (
                            <p key={task.id} className={`text-xs truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.startTime ? `${task.startTime} • ` : ''}{task.title}
                            </p>
                          ))}
                          {list.length === 0 && <p className="text-xs text-muted-foreground">Görev yok</p>}
                          {list.length > 3 && <p className="text-xs text-muted-foreground">+{list.length - 3} görev daha</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {tab === 'monthly' && (() => {
                const monthPrefix = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}`;
                const monthTasks = tasks.filter((task) => task.date.startsWith(monthPrefix));
                const grouped = monthTasks.reduce((acc, task) => {
                  (acc[task.date] = acc[task.date] || []).push(task);
                  return acc;
                }, {});
                const dates = Object.keys(grouped).sort();
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCalendarMonth((prev) => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
                      <p className="font-black">{MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}</p>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCalendarMonth((prev) => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 })}><ChevronRight className="h-4 w-4" /></Button>
                      <Badge variant="outline" className="font-bold">{monthTasks.length} görev</Badge>
                    </div>
                    {dates.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">Bu ay için planlanmış görev yok.</p>
                    ) : dates.map((iso) => (
                      <div key={iso}>
                        <p className="text-sm font-black text-muted-foreground">{formatDateLong(iso)}</p>
                        <div className="mt-1 space-y-1">
                          {grouped[iso].map((task) => (
                            <button key={task.id} type="button" onClick={() => { setSelectedDate(iso); setTab('daily'); }} className="w-full text-left flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 hover:border-orange-400">
                              <span className={`h-2 w-2 rounded-full ${STATUS_META[task.status].dot}`} />
                              <span className={`text-sm font-semibold flex-1 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                              <span className="text-xs text-muted-foreground">{task.subject} • {task.durationMinutes} dk</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {tab === 'goals' && (
                <div className="space-y-3">
                  {goals.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
                      <Target className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="font-bold mt-2">Henüz hedefin yok</p>
                      <p className="text-sm text-muted-foreground mt-1">"Yeni Hedef Ekle" ile deneme, soru ya da net hedefi koy.</p>
                    </div>
                  )}
                  {goals.map((goal) => {
                    const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
                    return (
                      <div key={goal.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold">{goal.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black tabular-nums">{goal.current} / {goal.target} {goal.unit}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg" onClick={() => bumpGoal(goal, -1)}>-</Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg" onClick={() => bumpGoal(goal, 1)}>+</Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 rounded-lg text-red-500" onClick={() => removeGoal(goal)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={percent} className="h-2.5" />
                          <span className={`text-xs font-black ${percent >= 100 ? 'text-emerald-500' : 'text-orange-500'}`}>%{percent}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'analytics' && (() => {
                const last7 = Array.from({ length: 7 }, (_, index) => toIsoDate(new Date(Date.now() - (6 - index) * 86400000)));
                const perDay = last7.map((iso) => tasks
                  .filter((task) => task.date === iso && task.status === 'done')
                  .reduce((sum, task) => sum + task.durationMinutes, 0));
                const maxDay = Math.max(60, ...perDay);
                const doneTasks = tasks.filter((task) => task.status === 'done');
                const bySubject = doneTasks.reduce((acc, task) => {
                  acc[task.subject] = (acc[task.subject] || 0) + task.durationMinutes;
                  return acc;
                }, {});
                const subjectRows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
                const maxSubject = Math.max(1, ...subjectRows.map(([, minutes]) => minutes));
                return (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <p className="font-bold flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-blue-500" /> Son 7 Gün Çalışma Süresi</p>
                      <div className="mt-4 flex items-end justify-between gap-2 h-36">
                        {last7.map((iso, index) => (
                          <div key={iso} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] font-bold text-muted-foreground">{perDay[index] > 0 ? formatMinutes(perDay[index]) : ''}</span>
                            <div className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-400" style={{ height: `${Math.max(4, (perDay[index] / maxDay) * 110)}px` }} />
                            <span className="text-[10px] font-bold text-muted-foreground">{DAY_NAMES[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <p className="font-bold flex items-center gap-2 text-sm"><ListChecks className="h-4 w-4 text-purple-500" /> Ders Bazlı Dağılım</p>
                      <div className="mt-4 space-y-3">
                        {subjectRows.length === 0 && <p className="text-sm text-muted-foreground">Tamamlanan görev olunca dağılım burada görünür.</p>}
                        {subjectRows.map(([subject, minutes]) => (
                          <div key={subject}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold">{subject}</span>
                              <span className="font-black tabular-nums">{formatMinutes(minutes)}</span>
                            </div>
                            <div className="mt-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(minutes / maxSubject) * 100}%`, backgroundColor: SUBJECT_COLORS[subject] || '#64748B' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 lg:col-span-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {[
                          ['Toplam Görev', tasks.length],
                          ['Tamamlanan', doneTasks.length],
                          ['Toplam Süre', formatMinutes(doneTasks.reduce((sum, task) => sum + task.durationMinutes, 0))],
                          ['Tamamlama Oranı', tasks.length ? `%${Math.round((doneTasks.length / tasks.length) * 100)}` : '%0'],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-2xl font-black">{value}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base">Haftalık İlerleme</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="12" className="stroke-slate-200 dark:stroke-slate-800" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="12" strokeLinecap="round"
                      stroke="#22C55E" strokeDasharray={2 * Math.PI * 42}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - weekStats.percent / 100) }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black">%{weekStats.percent}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">ilerleme</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm flex-1">
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Tamamlanan <span className="font-black ml-auto">{formatMinutes(weekStats.completed)}</span></p>
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Kalan <span className="font-black ml-auto">{formatMinutes(Math.max(0, weekStats.remaining))}</span></p>
                  <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Planlanan <span className="font-black ml-auto">{formatMinutes(weekStats.planned)}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base">Hedeflerine Ulaşma Durumu</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {goals.length === 0 && <p className="text-sm text-muted-foreground">Henüz hedef eklemedin.</p>}
              {goals.slice(0, 4).map((goal) => {
                const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="font-semibold truncate">{goal.title}</span>
                      <span className="font-black tabular-nums shrink-0">{goal.current} / {goal.target}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={percent} className="h-2" />
                      <span className={`text-[11px] font-black ${percent >= 100 ? 'text-emerald-500' : percent >= 70 ? 'text-green-500' : 'text-orange-500'}`}>%{percent}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setCalendarMonth((prev) => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 })}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setCalendarMonth((prev) => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 })}><ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center">
                {DAY_NAMES.map((name) => <span key={name} className="text-[10px] font-bold text-muted-foreground py-1">{name}</span>)}
                {(() => {
                  const first = new Date(calendarMonth.year, calendarMonth.month, 1);
                  const offset = (first.getDay() + 6) % 7;
                  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
                  const cells = [];
                  for (let i = 0; i < offset; i += 1) cells.push(<span key={`empty-${i}`} />);
                  for (let day = 1; day <= daysInMonth; day += 1) {
                    const iso = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayState = calendarDayState(iso);
                    const isSelected = iso === selectedDate;
                    const tone = dayState === 'full'
                      ? 'bg-emerald-500/20 text-emerald-500 font-black'
                      : dayState === 'partial'
                        ? 'bg-orange-500/20 text-orange-500 font-black'
                        : 'text-muted-foreground';
                    cells.push(
                      <button
                        key={iso}
                        type="button"
                        onClick={() => { setSelectedDate(iso); setTab('daily'); }}
                        className={`h-8 w-8 mx-auto rounded-full text-xs flex items-center justify-center transition-colors hover:bg-orange-500/20 ${tone} ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
                      >
                        {day}
                      </button>,
                    );
                  }
                  return cells;
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Quote className="h-4 w-4 text-orange-500" /> Motivasyon</CardTitle></CardHeader>
            <CardContent>
              <p className="italic text-sm leading-relaxed">"{quote[0]}"</p>
              <p className="text-xs font-bold text-muted-foreground mt-2">— {quote[1]}</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Görev Ekle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Görev adı (örn: Türev Uygulamaları)" value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={taskForm.subject} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, subject: value }))}>
                <SelectTrigger><SelectValue placeholder="Ders" /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Konu (örn: Soru Çözümü)" value={taskForm.topic} onChange={(event) => setTaskForm((prev) => ({ ...prev, topic: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Başlangıç Saati</p>
                <Input type="time" value={taskForm.startTime} onChange={(event) => setTaskForm((prev) => ({ ...prev, startTime: event.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Süre (dk)</p>
                <Input type="number" min="10" step="5" value={taskForm.durationMinutes} onChange={(event) => setTaskForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Tarih: {formatDateLong(selectedDate)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog(false)}>Vazgeç</Button>
            <FeatureGate module="study-plan" action="create"><Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleAddTask} disabled={saving}>{saving ? 'Ekleniyor...' : 'Ekle'}</Button></FeatureGate>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Hedef</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Hedef adı (örn: TYT Matematik Net 40+)" value={goalForm.title} onChange={(event) => setGoalForm((prev) => ({ ...prev, title: event.target.value }))} />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Hedef</p>
                <Input type="number" min="1" value={goalForm.target} onChange={(event) => setGoalForm((prev) => ({ ...prev, target: event.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Mevcut</p>
                <Input type="number" min="0" value={goalForm.current} onChange={(event) => setGoalForm((prev) => ({ ...prev, current: event.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Birim</p>
                <Input placeholder="net, soru..." value={goalForm.unit} onChange={(event) => setGoalForm((prev) => ({ ...prev, unit: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialog(false)}>Vazgeç</Button>
            <FeatureGate module="study-plan" action="create"><Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleAddGoal} disabled={saving}>{saving ? 'Ekleniyor...' : 'Hedefi Kaydet'}</Button></FeatureGate>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {newBadges.length > 0 && (
        <BadgeUnlockModal badges={newBadges} onClose={() => setNewBadges([])} />
      )}
    </motion.div>
  );
}
