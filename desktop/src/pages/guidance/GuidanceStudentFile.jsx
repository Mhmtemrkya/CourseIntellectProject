import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LineChart as LineChartIcon,
  NotebookPen,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
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
  assignGuidanceInventory,
  createGuidanceSession,
  deleteGuidanceSession,
  fetchGuidanceStudentFile,
  saveGuidanceGoal,
  updateGuidanceSession,
} from '../../lib/api/modules';

const TABS = [
  { id: 'summary', label: 'Özet', icon: ClipboardList },
  { id: 'academic', label: 'Akademik Seyir', icon: LineChartIcon },
  { id: 'attendance', label: 'Devam', icon: CalendarDays },
  { id: 'sessions', label: 'Görüşmeler', icon: NotebookPen },
  { id: 'goals', label: 'Program & Hedef', icon: Target },
  { id: 'inventories', label: 'Envanterler', icon: BookOpenCheck },
];

const TOPIC_LABELS = {
  motivasyon: 'Motivasyon',
  'sinav-kaygisi': 'Sınav Kaygısı',
  aile: 'Aile',
  arkadas: 'Arkadaş İlişkileri',
  akademik: 'Akademik',
  diger: 'Diğer',
};

const VISIBILITY_LABELS = {
  private: 'Sadece Ben',
  guidance: 'Rehberlik Servisi',
  admin: 'İdareyle Paylaşılabilir',
};

const INVENTORY_TYPES = {
  'ogrenme-stili': 'Öğrenme Stili',
  'sinav-kaygisi': 'Sınav Kaygısı Ölçeği',
  'ilgi-envanteri': 'İlgi Envanteri',
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Devamsızlık ısı takvimi: son 12 haftayı hafta sütunları halinde çizer.
function AttendanceHeatmap({ entries }) {
  const cells = useMemo(() => {
    const byDay = new Map();
    entries.forEach((entry) => {
      const key = String(entry.lessonDate).slice(0, 10);
      const status = String(entry.status || '').toLocaleLowerCase('tr-TR');
      const absent = status.includes('absent') || status.includes('yok') || status.includes('gelmedi');
      const late = status.includes('late') || status.includes('geç');
      const current = byDay.get(key) || { total: 0, absent: 0, late: 0 };
      current.total += 1;
      if (absent) current.absent += 1;
      else if (late) current.late += 1;
      byDay.set(key, current);
    });

    const weeks = [];
    const today = new Date();
    for (let w = 11; w >= 0; w -= 1) {
      const week = [];
      for (let d = 0; d < 7; d += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() - w * 7 + d + 1);
        const key = date.toISOString().slice(0, 10);
        week.push({ key, info: byDay.get(key) });
      }
      weeks.push(week);
    }
    return weeks;
  }, [entries]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {cells.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              let color = 'bg-foreground/[0.06]';
              let title = `${day.key}: kayıt yok`;
              if (day.info) {
                if (day.info.absent > 0) { color = 'bg-red-500'; title = `${day.key}: ${day.info.absent} devamsızlık`; }
                else if (day.info.late > 0) { color = 'bg-amber-400'; title = `${day.key}: geç kalma`; }
                else { color = 'bg-emerald-500'; title = `${day.key}: tam katılım`; }
              }
              return <div key={day.key} title={title} className={`h-4 w-4 rounded-[4px] ${color}`} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" /> Katıldı</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400" /> Geç</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Devamsız</span>
      </div>
    </div>
  );
}

const EMPTY_SESSION = {
  sessionType: 'bireysel', topic: 'akademik', note: '', visibility: 'guidance', followUpAt: '',
};

export default function GuidanceStudentFile() {
  const { studentName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const decodedName = decodeURIComponent(studentName || '');

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('summary');
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION);
  const [savingSession, setSavingSession] = useState(false);
  const [goalForm, setGoalForm] = useState({ targetSchool: '', targetField: '', targetScore: '', progress: 0, note: '' });
  const [savingGoal, setSavingGoal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGuidanceStudentFile(decodedName);
      setFile(data);
      if (data?.goal) {
        setGoalForm({
          targetSchool: data.goal.targetSchool || '',
          targetField: data.goal.targetField || '',
          targetScore: data.goal.targetScore || '',
          progress: data.goal.progress || 0,
          note: data.goal.note || '',
        });
      }
    } catch (err) {
      setError(err?.message || 'Öğrenci dosyası alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [decodedName]);

  useEffect(() => { load(); }, [load]);

  const examTrend = useMemo(() => {
    if (!file?.exams) return [];
    const classAvg = new Map((file.classExamAverages || []).map((e) => [e.examTitle, e.average]));
    return file.exams.map((exam) => ({
      name: exam.examTitle?.length > 18 ? `${exam.examTitle.slice(0, 18)}…` : exam.examTitle,
      Puan: exam.score,
      'Sınıf Ort.': classAvg.get(exam.examTitle) ?? null,
    }));
  }, [file]);

  const subjectTrends = useMemo(() => {
    if (!file?.exams) return [];
    const bySubject = new Map();
    file.exams.forEach((exam) => {
      const list = bySubject.get(exam.subject) || [];
      list.push(exam.score);
      bySubject.set(exam.subject, list);
    });
    return [...bySubject.entries()].map(([subject, scores]) => {
      const recent = scores.slice(-2).reduce((a, b) => a + b, 0) / Math.max(scores.slice(-2).length, 1);
      const older = scores.slice(0, -2);
      const olderAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : null;
      return {
        subject,
        average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        trend: olderAvg == null ? 0 : Math.round(recent - olderAvg),
        count: scores.length,
      };
    }).sort((a, b) => a.trend - b.trend);
  }, [file]);

  const studyPlanStats = useMemo(() => {
    let items = [];
    try {
      items = JSON.parse(file?.studyPlan?.planItemsSerialized || '[]');
    } catch { items = []; }
    const tasks = items.filter((i) => i && (i.type === 'task' || i.type == null));
    const done = tasks.filter((i) => i.status === 'done' || i.done === true).length;
    return { total: tasks.length, done, rate: tasks.length ? Math.round((done / tasks.length) * 100) : null };
  }, [file]);

  const homeworkRate = file?.homework?.total
    ? Math.round((file.homework.submitted / file.homework.total) * 100)
    : null;

  const saveSession = async () => {
    setSavingSession(true);
    try {
      await createGuidanceSession({
        studentName: decodedName,
        className: file?.profile?.className || '',
        sessionType: sessionForm.sessionType,
        topic: sessionForm.topic,
        note: sessionForm.note,
        visibility: sessionForm.visibility,
        followUpAtUtc: sessionForm.followUpAt ? new Date(sessionForm.followUpAt).toISOString() : null,
      });
      toast({ title: 'Görüşme kaydedildi' });
      setSessionDialogOpen(false);
      setSessionForm(EMPTY_SESSION);
      load();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingSession(false);
    }
  };

  const removeSession = async (id) => {
    try {
      await deleteGuidanceSession(id);
      toast({ title: 'Görüşme silindi' });
      load();
    } catch (err) {
      toast({ title: 'Silinemedi', description: err?.message, variant: 'destructive' });
    }
  };

  const markFollowUpDone = async (session) => {
    try {
      await updateGuidanceSession(session.id, { ...session, followUpDone: true });
      load();
    } catch (err) {
      toast({ title: 'Güncellenemedi', description: err?.message, variant: 'destructive' });
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try {
      await saveGuidanceGoal(decodedName, {
        ...goalForm,
        progress: Number(goalForm.progress) || 0,
      });
      toast({ title: 'Hedef güncellendi' });
      load();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingGoal(false);
    }
  };

  const assignInventory = async (inventoryType) => {
    try {
      await assignGuidanceInventory({ studentName: decodedName, inventoryType });
      toast({ title: 'Envanter atandı', description: INVENTORY_TYPES[inventoryType] });
      load();
    } catch (err) {
      toast({ title: 'Atanamadı', description: err?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }
  if (error || !file) {
    return <ErrorBanner title="Dosya açılamadı" message={error || 'Öğrenci bulunamadı.'} onRetry={load} />;
  }

  const { profile } = file;

  return (
    <div className="space-y-6" data-testid="guidance-student-file">
      {/* Başlık */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => navigate('/g/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-lg font-black text-white">
          {profile.fullName?.slice(0, 2)?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl font-bold">{profile.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.className}{profile.schoolNumber ? ` • No: ${profile.schoolNumber}` : ''}
            {profile.parentName ? ` • Veli: ${profile.parentName}` : ''}
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => setSessionDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Görüşme Ekle
        </Button>
      </div>

      {/* Sekmeler */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? 'border-brand-accent/40 bg-brand-accent text-white shadow'
                : 'border-transparent bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]'
            }`}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {/* Özet */}
      {tab === 'summary' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Son Görüşme</p>
            <p className="mt-2 text-xl font-black">
              {file.sessions?.[0] ? formatDateTime(file.sessions[0].sessionAtUtc) : 'Hiç yok'}
            </p>
            <p className="text-xs text-muted-foreground">
              {file.sessions?.[0] ? TOPIC_LABELS[file.sessions[0].topic] || file.sessions[0].topic : 'İlk görüşmeyi planlayın'}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Çalışma Programı Uyumu</p>
            <p className="mt-2 text-xl font-black">{studyPlanStats.rate == null ? '—' : `%${studyPlanStats.rate}`}</p>
            <Progress className="mt-2 h-2" value={studyPlanStats.rate || 0} />
            <p className="mt-1 text-xs text-muted-foreground">{studyPlanStats.done}/{studyPlanStats.total} görev tamamlandı</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Ödev Teslimi</p>
            <p className="mt-2 text-xl font-black">{homeworkRate == null ? '—' : `%${homeworkRate}`}</p>
            <Progress className="mt-2 h-2" value={homeworkRate || 0} />
            <p className="mt-1 text-xs text-muted-foreground">{file.homework.submitted}/{file.homework.total} ödev teslim edildi</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Hedef</p>
            <p className="mt-2 flex items-center gap-2 text-xl font-black">
              <GraduationCap className="h-5 w-5 text-brand-accent" />
              {file.goal?.targetSchool || 'Tanımlanmadı'}
            </p>
            <Progress className="mt-2 h-2" value={file.goal?.progress || 0} />
            <p className="mt-1 text-xs text-muted-foreground">İlerleme %{file.goal?.progress || 0}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2 xl:col-span-4">
            <h2 className="font-black">Son Sınavlar</h2>
            {examTrend.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sınav kaydı yok.</p>
            ) : (
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={examTrend.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                    <ChartTooltip />
                    <Line type="monotone" dataKey="Puan" stroke="hsl(var(--brand-accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Akademik seyir */}
      {tab === 'academic' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Sınav Trendi (sınıf ortalamasıyla)</h2>
            {examTrend.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sınav kaydı yok.</p>
            ) : (
              <div className="mt-3 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={examTrend}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
                    <ChartTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Puan" stroke="hsl(var(--brand-accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Sınıf Ort." stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Branş Karşılaştırması</h2>
            <p className="mt-1 text-xs text-muted-foreground">Son 2 sınavın önceki ortalamaya göre değişimi.</p>
            <div className="mt-4 space-y-3">
              {subjectTrends.length === 0 ? (
                <p className="text-sm text-muted-foreground">Veri yok.</p>
              ) : subjectTrends.map((item) => (
                <div key={item.subject} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{item.subject}</p>
                    <Badge variant="outline" className={`rounded-lg ${
                      item.trend < -5 ? 'border-red-500/30 text-red-500'
                        : item.trend > 5 ? 'border-emerald-500/30 text-emerald-600'
                          : 'text-muted-foreground'
                    }`}
                    >
                      {item.trend > 0 ? `+${item.trend}` : item.trend}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Ortalama {item.average} • {item.count} sınav</p>
                  <Progress className="mt-2 h-1.5" value={item.average} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Devam */}
      {tab === 'attendance' && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Devamsızlık Isı Takvimi (son 12 hafta)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Her sütun bir hafta; kırmızı hücre devamsız gündür.</p>
          <div className="mt-5">
            <AttendanceHeatmap entries={file.attendance || []} />
          </div>
          <div className="mt-6 grid gap-2">
            {(file.attendance || []).filter((a) => {
              const status = String(a.status || '').toLocaleLowerCase('tr-TR');
              return status.includes('absent') || status.includes('yok') || status.includes('gelmedi');
            }).slice(-8).reverse().map((entry, index) => (
              <div key={index} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span className="font-semibold">{formatDateTime(entry.lessonDate)}</span>
                <span className="text-muted-foreground">{entry.lesson || 'Ders belirtilmemiş'}</span>
                <Badge variant="outline" className="rounded-lg border-red-500/30 text-red-500">Devamsız</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Görüşmeler */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {(file.sessions || []).length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              Henüz görüşme kaydı yok. "Görüşme Ekle" ile ilk kaydı oluşturun.
            </div>
          ) : file.sessions.map((session) => (
            <div key={session.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-lg bg-brand-accent text-white">{TOPIC_LABELS[session.topic] || session.topic}</Badge>
                <Badge variant="outline" className="rounded-lg capitalize">{session.sessionType}</Badge>
                <Badge variant="outline" className="rounded-lg">{VISIBILITY_LABELS[session.visibility] || session.visibility}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(session.sessionAtUtc)} • {session.counselorName}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{session.note || 'Not girilmedi.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {session.followUpAtUtc ? (
                  <Badge variant="outline" className={`rounded-lg ${session.followUpDone ? 'text-emerald-600 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'}`}>
                    Takip: {formatDateTime(session.followUpAtUtc)} {session.followUpDone ? '(yapıldı)' : ''}
                  </Badge>
                ) : null}
                {session.followUpAtUtc && !session.followUpDone ? (
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => markFollowUpDone(session)}>
                    Takibi Tamamla
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="ml-auto rounded-lg text-red-500 hover:text-red-600" onClick={() => removeSession(session.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Sil
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Program & Hedef */}
      {tab === 'goals' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Hedef Bilgileri</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Hedef Okul</Label>
                <Input className="mt-1 rounded-xl" value={goalForm.targetSchool} onChange={(e) => setGoalForm((p) => ({ ...p, targetSchool: e.target.value }))} placeholder="Örn. Fen Lisesi / Tıp Fakültesi" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Hedef Alan/Bölüm</Label>
                  <Input className="mt-1 rounded-xl" value={goalForm.targetField} onChange={(e) => setGoalForm((p) => ({ ...p, targetField: e.target.value }))} placeholder="Sayısal, TM..." />
                </div>
                <div>
                  <Label>Hedef Puan/Net</Label>
                  <Input className="mt-1 rounded-xl" value={goalForm.targetScore} onChange={(e) => setGoalForm((p) => ({ ...p, targetScore: e.target.value }))} placeholder="Örn. 480 puan" />
                </div>
              </div>
              <div>
                <Label>İlerleme (%{goalForm.progress})</Label>
                <input type="range" min="0" max="100" value={goalForm.progress} onChange={(e) => setGoalForm((p) => ({ ...p, progress: e.target.value }))} className="mt-2 w-full accent-[hsl(var(--brand-accent))]" />
              </div>
              <div>
                <Label>Not</Label>
                <Textarea className="mt-1 rounded-xl" rows={3} value={goalForm.note} onChange={(e) => setGoalForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
              <Button className="w-full rounded-xl" onClick={saveGoal} disabled={savingGoal}>
                {savingGoal ? 'Kaydediliyor...' : 'Hedefi Kaydet'}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-black">Çalışma Programı</h2>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/g/planner?student=${encodeURIComponent(decodedName)}`)}>
                Programı Düzenle
              </Button>
            </div>
            <div className="mt-4 rounded-xl border p-4">
              <p className="text-3xl font-black">{studyPlanStats.rate == null ? '—' : `%${studyPlanStats.rate}`}</p>
              <p className="text-xs text-muted-foreground">Program uyumu • {studyPlanStats.done}/{studyPlanStats.total} görev</p>
              <Progress className="mt-3 h-2.5" value={studyPlanStats.rate || 0} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Öğrenci görevleri tamamladıkça uyum yüzdesi otomatik güncellenir; veli panelinden de görünür.
            </p>
          </div>
        </div>
      )}

      {/* Envanterler */}
      {tab === 'inventories' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(INVENTORY_TYPES).map(([key, label]) => (
              <Button key={key} variant="outline" className="rounded-xl" onClick={() => assignInventory(key)}>
                <Plus className="mr-2 h-4 w-4" /> {label} Ata
              </Button>
            ))}
          </div>
          {(file.inventories || []).length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              Atanmış envanter yok.
            </div>
          ) : file.inventories.map((item) => {
            let answers = [];
            try { answers = JSON.parse(item.answersJson || '[]'); } catch { answers = []; }
            return (
              <div key={item.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{INVENTORY_TYPES[item.inventoryType] || item.inventoryType}</p>
                  <Badge variant="outline" className={`rounded-lg ${item.status === 'Tamamlandı' ? 'border-emerald-500/30 text-emerald-600' : 'border-amber-500/30 text-amber-500'}`}>
                    {item.status}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Atandı: {formatDateTime(item.assignedAtUtc)}
                    {item.completedAtUtc ? ` • Tamamlandı: ${formatDateTime(item.completedAtUtc)}` : ''}
                  </span>
                </div>
                {answers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {answers.map((answer, index) => (
                      <div key={index} className="rounded-xl bg-foreground/[0.04] p-3 text-sm">
                        <p className="font-semibold">{answer.q}</p>
                        <p className="text-muted-foreground">{answer.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Görüşme ekleme dialogu */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Görüşme Kaydı — {profile.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Görüşme Türü</Label>
                <Select value={sessionForm.sessionType} onValueChange={(v) => setSessionForm((p) => ({ ...p, sessionType: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bireysel">Bireysel</SelectItem>
                    <SelectItem value="veli">Veli</SelectItem>
                    <SelectItem value="grup">Grup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Konu</Label>
                <Select value={sessionForm.topic} onValueChange={(v) => setSessionForm((p) => ({ ...p, topic: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TOPIC_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Görüşme Notu</Label>
              <Textarea className="mt-1 rounded-xl" rows={4} value={sessionForm.note} onChange={(e) => setSessionForm((p) => ({ ...p, note: e.target.value }))} placeholder="Görüşme içeriği..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Gizlilik</Label>
                <Select value={sessionForm.visibility} onValueChange={(v) => setSessionForm((p) => ({ ...p, visibility: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIBILITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Takip Tarihi (opsiyonel)</Label>
                <Input type="date" className="mt-1 rounded-xl" value={sessionForm.followUpAt} onChange={(e) => setSessionForm((p) => ({ ...p, followUpAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setSessionDialogOpen(false)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={saveSession} disabled={savingSession || !sessionForm.note.trim()}>
              {savingSession ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
