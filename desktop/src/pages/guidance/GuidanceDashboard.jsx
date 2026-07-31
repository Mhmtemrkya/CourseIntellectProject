import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip,
} from 'recharts';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import RoleDashboardColumns from '../../components/dashboard/RoleDashboardColumns';
import { useToast } from '../../hooks/use-toast';
import {
  createGuidanceRiskReview,
  fetchGuidanceAppointments,
  fetchGuidanceFollowUps,
  fetchGuidanceOverview,
} from '../../lib/api/modules';

const RISK_META = {
  high: { label: 'Yüksek', badge: 'bg-red-500/15 text-red-500 border-red-500/30', color: '#ef4444' },
  medium: { label: 'Orta', badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30', color: '#f59e0b' },
  low: { label: 'Düşük', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', color: '#22c55e' },
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

export default function GuidanceDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [pendingAppointments, setPendingAppointments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, follows, appointments] = await Promise.all([
        fetchGuidanceOverview(),
        fetchGuidanceFollowUps().catch(() => []),
        fetchGuidanceAppointments().catch(() => []),
      ]);
      setStudents(overview);
      setFollowUps(follows);
      setPendingAppointments(appointments.filter((a) => a.status === 'Bekliyor').length);
    } catch (err) {
      setError(err?.message || 'Rehberlik verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const classes = useMemo(
    () => [...new Set(students.map((s) => s.className).filter(Boolean))].sort(),
    [students],
  );

  const filtered = useMemo(() => students.filter((s) => {
    if (classFilter !== 'all' && s.className !== classFilter) return false;
    if (riskFilter !== 'all' && s.riskLevel !== riskFilter) return false;
    if (search && !s.studentName.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))) return false;
    return true;
  }), [students, classFilter, riskFilter, search]);

  const attention = useMemo(() => students.filter((s) => s.needsAttention), [students]);

  const riskDistribution = useMemo(() => ['high', 'medium', 'low']
    .map((level) => ({
      name: RISK_META[level].label,
      value: students.filter((s) => s.riskLevel === level).length,
      color: RISK_META[level].color,
    }))
    .filter((item) => item.value > 0), [students]);

  const dashboardGroups = [
    {
      key: 'risk', title: 'Risk Takibi', description: 'Öncelikli incelenmesi gereken öğrenci durumu',
      cards: [
        { key: 'tracked', label: 'Takipteki Öğrenci', value: students.length, caption: 'Rehberlik kapsamındaki öğrenci', icon: Users, tone: 'blue' },
        { key: 'attention', label: 'İlgilenilecek', value: attention.length, caption: 'İnceleme bekleyen riskli kayıt', icon: ShieldAlert, tone: 'rose' },
      ],
    },
    {
      key: 'planning', title: 'Görüşme ve Takip', description: 'Yaklaşan görüşme ve randevu yükü',
      cards: [
        { key: 'followups', label: 'Yaklaşan Takip', value: followUps.length, caption: 'Takip tarihi yaklaşan görüşme', icon: CalendarClock, tone: 'amber' },
        { key: 'appointments', label: 'Bekleyen Randevu', value: pendingAppointments, caption: 'Karar bekleyen görüşme talebi', icon: BellRing, tone: 'violet', path: '/g/appointments' },
      ],
    },
    {
      key: 'distribution', title: 'Risk Dağılımı', description: 'Yüksek ve orta risk yoğunluğu',
      cards: [
        { key: 'highRisk', label: 'Yüksek Risk', value: students.filter((student) => student.riskLevel === 'high').length, caption: 'Öncelikli müdahale', icon: AlertTriangle, tone: 'rose' },
        { key: 'mediumRisk', label: 'Orta Risk', value: students.filter((student) => student.riskLevel === 'medium').length, caption: 'Yakın takip gereken', icon: ClipboardCheck, tone: 'amber' },
      ],
    },
  ];

  const markReviewed = async (student) => {
    try {
      await createGuidanceRiskReview({
        studentName: student.studentName,
        riskLevel: student.riskLevel,
        note: (student.riskReasons || []).join('; '),
      });
      toast({ title: 'İncelendi olarak işaretlendi', description: student.studentName });
      load();
    } catch (err) {
      toast({ title: 'İşaretlenemedi', description: err?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="guidance-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Vaka Merkezi</h1>
          <p className="text-sm text-muted-foreground">
            Devamsızlık, sınav ve ödev verilerinden hesaplanan canlı risk takibi.
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={load}>Yenile</Button>
      </div>

      {error ? <ErrorBanner title="Veriler alınamadı" message={error} onRetry={load} /> : null}

      <RoleDashboardColumns groups={dashboardGroups} navigate={navigate} testId="guidance-dashboard-columns" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Öğrenci listesi */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Öğrenci ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Sınıf" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Riskler</SelectItem>
                <SelectItem value="high">Yüksek</SelectItem>
                <SelectItem value="medium">Orta</SelectItem>
                <SelectItem value="low">Düşük</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Filtreye uyan öğrenci yok.</p>
            ) : filtered.map((student, index) => {
              const meta = RISK_META[student.riskLevel] || RISK_META.low;
              return (
                <motion.button
                  key={student.studentName}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.4) }}
                  onClick={() => navigate(`/g/student/${encodeURIComponent(student.studentName)}`)}
                  className="grid w-full gap-2 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.04] lg:grid-cols-[minmax(0,1fr)_130px_150px_120px] lg:items-center"
                  data-testid={`guidance-student-${index}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-black text-white">
                      {student.studentName?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{student.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.className}{student.schoolNumber ? ` • ${student.schoolNumber}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`w-fit rounded-lg ${meta.badge}`}>{meta.label} Risk</Badge>
                  <div className="text-xs text-muted-foreground">
                    {(student.riskReasons || []).slice(0, 2).map((reason) => (
                      <p key={reason} className="truncate">• {reason}</p>
                    ))}
                    {(student.riskReasons || []).length === 0 && <p>Sorun görünmüyor</p>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Son görüşme: {formatDate(student.lastSessionAtUtc)}</p>
                    {student.homeworkRate != null && <p>Ödev: %{student.homeworkRate}</p>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Sağ sütun */}
        <div className="space-y-5">
          {/* İlgilenilecekler */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black">
              <AlertTriangle className="h-4 w-4 text-red-500" /> İlgilenilecekler
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Riskli ve son 14 günde incelenmemiş öğrenciler.</p>
            <div className="mt-4 space-y-3">
              {attention.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Bekleyen inceleme yok.
                </p>
              ) : attention.slice(0, 6).map((student) => (
                <div key={student.studentName} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => navigate(`/g/student/${encodeURIComponent(student.studentName)}`)}
                  >
                    <p className="truncate text-sm font-bold">{student.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{(student.riskReasons || [])[0] || student.className}</p>
                  </button>
                  <Button size="sm" variant="outline" className="shrink-0 rounded-lg" onClick={() => markReviewed(student)}>
                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> İncelendi
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Risk dağılımı */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Risk Dağılımı</h2>
            {riskDistribution.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={4}>
                      {riskDistribution.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <ChartTooltip formatter={(value, name) => [`${value} öğrenci`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {riskDistribution.map((entry) => (
                <span key={entry.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}: {entry.value}
                </span>
              ))}
            </div>
          </div>

          {/* Yaklaşan takipler */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black">
              <CalendarClock className="h-4 w-4 text-amber-500" /> Yaklaşan Takipler
            </h2>
            <div className="mt-4 space-y-2">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Takip tarihi gelen görüşme yok.</p>
              ) : followUps.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/g/student/${encodeURIComponent(item.studentName)}`)}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-foreground/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.topic}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-amber-500">{formatDate(item.followUpAtUtc)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
