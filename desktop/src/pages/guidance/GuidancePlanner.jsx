import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarRange, CheckCircle2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchGuidanceStudyPlan,
  fetchGuidanceOverview,
  updateGuidanceStudyPlan,
} from '../../lib/api/modules';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih', 'Coğrafya', 'İngilizce', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Genel'];

// Hazır program şablonları: gün indeksi (0=Pazartesi) + saat + ders + başlık.
const TEMPLATES = {
  'tyt-sprint': {
    label: 'TYT Sprint (yoğun hafta)',
    items: [
      { day: 0, startTime: '17:00', durationMinutes: 60, subject: 'Matematik', title: 'TYT problem çözümü' },
      { day: 0, startTime: '19:00', durationMinutes: 45, subject: 'Türkçe', title: 'Paragraf denemesi' },
      { day: 1, startTime: '17:00', durationMinutes: 60, subject: 'Fizik', title: 'Konu tekrarı + 20 soru' },
      { day: 2, startTime: '17:00', durationMinutes: 60, subject: 'Matematik', title: 'Eksik konu çalışması' },
      { day: 3, startTime: '17:00', durationMinutes: 45, subject: 'Kimya', title: 'Soru bankası' },
      { day: 4, startTime: '17:00', durationMinutes: 45, subject: 'Türkçe', title: 'Dil bilgisi tekrarı' },
      { day: 5, startTime: '10:00', durationMinutes: 120, subject: 'Genel', title: 'TYT deneme sınavı' },
      { day: 5, startTime: '14:00', durationMinutes: 60, subject: 'Genel', title: 'Deneme analizi' },
      { day: 6, startTime: '11:00', durationMinutes: 60, subject: 'Genel', title: 'Haftalık genel tekrar' },
    ],
  },
  'lgs-duzen': {
    label: 'LGS Düzenli Çalışma',
    items: [
      { day: 0, startTime: '17:30', durationMinutes: 45, subject: 'Matematik', title: 'Günün konusu + 15 soru' },
      { day: 1, startTime: '17:30', durationMinutes: 45, subject: 'Fen Bilimleri', title: 'Konu tekrarı' },
      { day: 2, startTime: '17:30', durationMinutes: 45, subject: 'Türkçe', title: 'Paragraf + sözcük' },
      { day: 3, startTime: '17:30', durationMinutes: 45, subject: 'Matematik', title: 'Yeni nesil sorular' },
      { day: 4, startTime: '17:30', durationMinutes: 45, subject: 'Sosyal Bilgiler', title: 'Tekrar + test' },
      { day: 5, startTime: '10:00', durationMinutes: 90, subject: 'Genel', title: 'LGS deneme' },
      { day: 6, startTime: '15:00', durationMinutes: 45, subject: 'Genel', title: 'Hata defteri incelemesi' },
    ],
  },
  aliskanlik: {
    label: 'Alışkanlık Kazanma (hafif)',
    items: [
      { day: 0, startTime: '18:00', durationMinutes: 30, subject: 'Genel', title: 'Günlük ders tekrarı' },
      { day: 2, startTime: '18:00', durationMinutes: 30, subject: 'Genel', title: 'Günlük ders tekrarı' },
      { day: 4, startTime: '18:00', durationMinutes: 30, subject: 'Genel', title: 'Haftalık özet çıkarma' },
      { day: 5, startTime: '11:00', durationMinutes: 45, subject: 'Genel', title: 'Serbest okuma' },
    ],
  },
};

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Pazartesi=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseItems(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const EMPTY_TASK = { title: '', subject: 'Matematik', startTime: '17:00', durationMinutes: 45 };

export default function GuidancePlanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(searchParams.get('student') || '');
  const [planItems, setPlanItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialog, setDialog] = useState(null); // { dayIndex }
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchGuidanceOverview()
      .then((list) => setStudents(list))
      .catch((err) => setError(err?.message || 'Öğrenciler alınamadı.'));
  }, []);

  const loadPlan = useCallback(async (name) => {
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      const plan = await fetchGuidanceStudyPlan(name);
      setPlanItems(parseItems(plan?.planItemsSerialized));
      setDirty(false);
    } catch (err) {
      setError(err?.message || 'Program alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlan(student); }, [student, loadPlan]);

  const weekDates = useMemo(
    () => DAYS.map((_, index) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + index);
      return d;
    }),
    [weekStart],
  );

  const weekTasks = useMemo(() => {
    const keys = new Set(weekDates.map(toIso));
    return planItems.filter((item) => item && item.type !== 'goal' && keys.has(String(item.date || '').slice(0, 10)));
  }, [planItems, weekDates]);

  const tasksByDay = useMemo(() => weekDates.map((date) => {
    const key = toIso(date);
    return weekTasks
      .filter((item) => String(item.date || '').slice(0, 10) === key)
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }), [weekTasks, weekDates]);

  const persist = async (nextItems) => {
    setSaving(true);
    try {
      await updateGuidanceStudyPlan({
        studentName: student,
        planItemsSerialized: JSON.stringify(nextItems),
      });
      setPlanItems(nextItems);
      setDirty(false);
      toast({ title: 'Program kaydedildi', description: student });
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    const date = weekDates[dialog.dayIndex];
    const item = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'task',
      title: taskForm.title.trim() || 'Çalışma bloğu',
      subject: taskForm.subject,
      topic: '',
      date: toIso(date),
      startTime: taskForm.startTime,
      endTime: '',
      durationMinutes: Number(taskForm.durationMinutes) || 45,
      status: 'pending',
      source: 'counselor',
      createdAt: new Date().toISOString(),
    };
    setPlanItems((prev) => [...prev, item]);
    setDirty(true);
    setDialog(null);
    setTaskForm(EMPTY_TASK);
  };

  const removeTask = (id) => {
    setPlanItems((prev) => prev.filter((item) => item.id !== id));
    setDirty(true);
  };

  const applyTemplate = (key) => {
    const template = TEMPLATES[key];
    if (!template) return;
    const additions = template.items.map((item, index) => ({
      id: `g-${Date.now()}-${index}`,
      type: 'task',
      title: item.title,
      subject: item.subject,
      topic: '',
      date: toIso(weekDates[item.day]),
      startTime: item.startTime,
      endTime: '',
      durationMinutes: item.durationMinutes,
      status: 'pending',
      source: 'counselor',
      createdAt: new Date().toISOString(),
    }));
    setPlanItems((prev) => [...prev, ...additions]);
    setDirty(true);
    toast({ title: 'Şablon uygulandı', description: `${template.label} — kaydetmeyi unutmayın.` });
  };

  const shiftWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  const doneCount = weekTasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-6" data-testid="guidance-planner">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Çalışma Programı</h1>
          <p className="text-sm text-muted-foreground">
            Öğrenciye haftalık program hazırlayın; öğrenci tamamladıkça uyum otomatik izlenir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={student || undefined}
            onValueChange={(value) => {
              setStudent(value);
              setSearchParams({ student: value });
            }}
          >
            <SelectTrigger className="w-56 rounded-xl"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.studentName} value={s.studentName}>{s.studentName} ({s.className})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={applyTemplate} disabled={!student}>
            <SelectTrigger className="w-56 rounded-xl">
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-accent" /> Şablon Uygula</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <SelectItem key={key} value={key}>{template.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={() => loadPlan(student)} /> : null}

      {!student ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Program hazırlamak için yukarıdan bir öğrenci seçin.
        </div>
      ) : loading ? (
        <div className="flex h-72 items-center justify-center"><LoadingDots /></div>
      ) : (
        <>
          {/* Hafta gezinme + kaydet */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <Button variant="outline" className="rounded-xl" onClick={() => shiftWeek(-1)}>← Önceki</Button>
            <span className="flex items-center gap-2 font-bold">
              <CalendarRange className="h-4 w-4 text-brand-accent" />
              {weekDates[0].toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} – {weekDates[6].toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <Button variant="outline" className="rounded-xl" onClick={() => shiftWeek(1)}>Sonraki →</Button>
            <Badge variant="outline" className="rounded-lg">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-500" />
              {doneCount}/{weekTasks.length} tamamlandı
            </Badge>
            <Button
              className="ml-auto rounded-xl"
              onClick={() => persist(planItems)}
              disabled={saving || !dirty}
              data-testid="planner-save"
            >
              <Save className="mr-2 h-4 w-4" /> {saving ? 'Kaydediliyor...' : dirty ? 'Programı Kaydet' : 'Kaydedildi'}
            </Button>
          </div>

          {/* Haftalık grid */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {DAYS.map((day, index) => (
              <div key={day} className="flex min-h-[220px] flex-col rounded-2xl border bg-card shadow-sm">
                <div className="border-b p-3">
                  <p className="text-sm font-black">{day}</p>
                  <p className="text-xs text-muted-foreground">{weekDates[index].toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</p>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {tasksByDay[index].map((task) => (
                    <div
                      key={task.id}
                      className={`group rounded-xl border p-2.5 text-xs ${task.status === 'done' ? 'border-emerald-500/30 bg-emerald-500/10' : 'bg-foreground/[0.03]'}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold leading-tight">{task.title}</p>
                        <button type="button" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => removeTask(task.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                      <p className="mt-1 text-muted-foreground">{task.subject} • {task.startTime || '—'} • {task.durationMinutes} dk</p>
                      {task.status === 'done' && <p className="mt-1 font-semibold text-emerald-600">✓ Tamamlandı</p>}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setDialog({ dayIndex: index }); setTaskForm(EMPTY_TASK); }}
                  className="flex items-center justify-center gap-1 border-t p-2 text-xs font-semibold text-brand-accent hover:bg-foreground/[0.04]"
                >
                  <Plus className="h-3.5 w-3.5" /> Blok Ekle
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Blok ekleme dialogu */}
      <Dialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog != null ? `${DAYS[dialog.dayIndex]} — Çalışma Bloğu` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Başlık</Label>
              <Input className="mt-1 rounded-xl" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} placeholder="Örn. Paragraf denemesi" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Ders</Label>
                <Select value={taskForm.subject} onValueChange={(v) => setTaskForm((p) => ({ ...p, subject: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Saat</Label>
                <Input type="time" className="mt-1 rounded-xl" value={taskForm.startTime} onChange={(e) => setTaskForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>Süre (dk)</Label>
                <Input type="number" min="15" step="15" className="mt-1 rounded-xl" value={taskForm.durationMinutes} onChange={(e) => setTaskForm((p) => ({ ...p, durationMinutes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialog(null)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={addTask}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
