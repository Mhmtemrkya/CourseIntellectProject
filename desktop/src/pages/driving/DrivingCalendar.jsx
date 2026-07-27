import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight,
  Columns3, Loader2, MapPin, Plus, RefreshCw, X, XCircle,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createDrivingAppointment, fetchDrivingCalendar, fetchDrivingInstructors, fetchDrivingStudents, fetchDrivingVehicles,
  rescheduleDrivingAppointment,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';

// Takvim YEREL saatte çizilir; API UTC konuşur. Tarayıcının kendi saat dilimi
// Türkiye ise Date nesnesi doğal olarak doğru saati verir.
const HOUR_START = 7;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const SLOT_HEIGHT = 68; // 1 saat = 68px; ders kartları ve yarım saat alanları sıkışmasın.

const STATUS_TONE = {
  Draft: 'bg-slate-500', Requested: 'bg-sky-500', WaitingApproval: 'bg-amber-500',
  Planned: 'bg-blue-500', Approved: 'bg-emerald-500', CheckedIn: 'bg-violet-500',
  InProgress: 'bg-[hsl(var(--brand-accent))]', Completed: 'bg-emerald-700', NoShow: 'bg-rose-600',
  Rescheduled: 'bg-indigo-500', Suspended: 'bg-slate-500',
  Cancelled: 'bg-red-500', CancelledByStudent: 'bg-red-500',
  CancelledByInstructor: 'bg-red-500', CancelledByInstitution: 'bg-red-500',
};

const STATUS_LABEL = {
  Planned: 'Planlandı', Approved: 'Onaylandı', CheckedIn: 'Buluşuldu', InProgress: 'Ders sürüyor',
  Completed: 'Tamamlandı', NoShow: 'Gelmedi', Rescheduled: 'Ertelendi',
  Requested: 'Talep', WaitingApproval: 'Onay bekliyor', Draft: 'Taslak', Suspended: 'Askıda',
  Cancelled: 'İptal', CancelledByStudent: 'Öğrenci iptal', CancelledByInstructor: 'Öğretmen iptal',
  CancelledByInstitution: 'Kurum iptal',
};

// Sürüklenerek taşınabilecek durumlar: kapanmış veya başlamış ders taşınmaz.
const MOVABLE = ['Planned', 'Approved', 'Requested', 'WaitingApproval'];
// Takvimde yer tutan randevu durumları — backend DrivingAppointmentStatuses.Blocking.
const BLOCKING_STATUSES = ['Requested', 'WaitingApproval', 'Planned', 'Approved', 'CheckedIn', 'InProgress'];
// Ders planlanabilecek kursiyer durumları (mezun/askıda/iptal hariç).
const BOOKABLE_STATUSES = ['PreRegistered', 'DocumentsPending', 'Active', 'TheoryOngoing', 'PracticeOngoing', 'ExamPending'];

const startOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
const startOfWeek = (date) => {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - day);
  return d;
};
const addDays = (date, count) => { const d = new Date(date); d.setDate(d.getDate() + count); return d; };
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const hhmm = (date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function DrivingCalendar({ embedded = false }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = useDrivingPermissions();

  const [view, setView] = useState('week'); // day | week | month
  const [groupBy, setGroupBy] = useState('time'); // time | instructor | vehicle
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [filters, setFilters] = useState({ instructorProfileId: '', vehicleId: '', licenseClass: '', transmissionType: '', status: 'open' });

  const [appointments, setAppointments] = useState([]);
  const [reference, setReference] = useState({ instructors: [], vehicles: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState(null);
  // Takvim slotuna tıklayınca açılan yeni-randevu modalının başlangıç saati.
  const [createStart, setCreateStart] = useState(null);

  const canReschedule = can(DRIVING.appointmentReschedule);
  const canCreate = can(DRIVING.appointmentCreate);
  const dragged = useRef(null);

  const openCreate = useCallback((day, hour, minute = 0) => {
    const start = new Date(day);
    start.setHours(hour, minute, 0, 0);
    setCreateStart(start);
  }, []);

  // Görünüme göre çekilecek tarih aralığı.
  const range = useMemo(() => {
    if (view === 'day') return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
    if (view === 'week') return { start: startOfWeek(anchor), end: addDays(startOfWeek(anchor), 7) };
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return { start: gridStart, end: addDays(gridStart, 42) };
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, instructors, vehicles, students] = await Promise.all([
        fetchDrivingCalendar({
          from: range.start.toISOString(),
          to: range.end.toISOString(),
          instructorProfileId: filters.instructorProfileId || undefined,
          vehicleId: filters.vehicleId || undefined,
          licenseClass: filters.licenseClass || undefined,
          transmissionType: filters.transmissionType || undefined,
          status: filters.status || undefined,
        }),
        (can(DRIVING.instructorView) || can(DRIVING.appointmentCreate)) ? fetchDrivingInstructors() : Promise.resolve([]),
        (can(DRIVING.vehicleView) || can(DRIVING.appointmentCreate)) ? fetchDrivingVehicles() : Promise.resolve([]),
        can(DRIVING.appointmentCreate) ? fetchDrivingStudents().catch(() => []) : Promise.resolve([]),
      ]);
      setAppointments(rows || []);
      setReference({ instructors: instructors || [], vehicles: vehicles || [], students: students || [] });
    } catch (error) {
      toast({ title: 'Takvim yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, filters, can, toast]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  /**
   * Sürükle-bırak yeniden planlama. İstemci hiçbir kuralı kendi başına geçerli
   * saymaz: taşıma backend'e gider, öğretmen izni/çalışma saati/araç ataması/limit
   * kontrolünden geçmezse randevu eski yerinde kalır ve neden reddedildiği söylenir.
   */
  async function moveAppointment(appointment, newStart) {
    const duration = new Date(appointment.endsAtUtc) - new Date(appointment.startsAtUtc);
    const newEnd = new Date(newStart.getTime() + duration);

    setMoving(true);
    try {
      await rescheduleDrivingAppointment(appointment.id, {
        startsAtUtc: newStart.toISOString(),
        endsAtUtc: newEnd.toISOString(),
        reason: `Takvimden sürüklenerek ${newStart.toLocaleString('tr-TR')} saatine taşındı`,
      });
      toast({
        title: 'Randevu taşındı',
        description: `${appointment.studentName} — ${newStart.toLocaleString('tr-TR')}. Öğrenci ve öğretmen bilgilendirildi.`,
      });
      await load();
    } catch (error) {
      toast({ title: 'Randevu taşınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setMoving(false);
    }
  }

  function onDropSlot(day, hour, minute = 0) {
    const appointment = dragged.current;
    dragged.current = null;
    if (!appointment) return;

    const target = new Date(day);
    target.setHours(hour, minute, 0, 0);
    if (Math.abs(target - new Date(appointment.startsAtUtc)) < 60000) return; // aynı yer
    moveAppointment(appointment, target);
  }

  const days = useMemo(() => {
    if (view === 'day') return [startOfDay(anchor)];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
    return Array.from({ length: 42 }, (_, i) => addDays(range.start, i));
  }, [view, anchor, range.start]);

  const title = useMemo(() => {
    if (view === 'day') return anchor.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    if (view === 'week') {
      const end = addDays(range.start, 6);
      return `${range.start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return anchor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }, [view, anchor, range.start]);

  const step = (direction) => {
    if (view === 'day') setAnchor((x) => addDays(x, direction));
    else if (view === 'week') setAnchor((x) => addDays(x, direction * 7));
    else setAnchor((x) => new Date(x.getFullYear(), x.getMonth() + direction, 1));
  };

  // Kaynak görünümünde satırlar: her öğretmen/araç bir şerit.
  const resources = useMemo(() => {
    if (groupBy === 'instructor') {
      return reference.instructors.filter((x) => x.isActive).map((x) => ({ id: x.id, label: x.fullName, key: 'instructorProfileId' }));
    }
    if (groupBy === 'vehicle') {
      return reference.vehicles.filter((x) => x.isActive).map((x) => ({ id: x.id, label: x.plateNumber, key: 'vehicleId' }));
    }
    return [];
  }, [groupBy, reference]);

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">Randevu Takvimi</h1>
            <p className="text-muted-foreground">
              {canReschedule
                ? 'Randevuyu sürükleyip bırakarak taşıyın — tüm uygunluk kuralları backend’de yeniden denetlenir.'
                : 'Randevuları görüntüleyebilirsiniz; taşımak için yetkiniz yok.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {moving && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Taşınıyor…</span>}
            <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Gezinme + görünüm + gruplama */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setAnchor(startOfDay(new Date()))}>Bugün</Button>
        <Button variant="outline" size="icon" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
        <b className="ml-2 min-w-[220px] text-lg">{title}</b>

        <div className="ml-auto flex flex-wrap gap-1.5">
          {[
            { id: 'day', label: 'Gün', icon: CalendarDays },
            { id: 'week', label: 'Hafta', icon: CalendarRange },
            { id: 'month', label: 'Ay', icon: CalendarRange },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.id} size="sm" variant={view === item.id ? 'default' : 'outline'} onClick={() => setView(item.id)}>
                <Icon className="mr-1 h-3.5 w-3.5" />{item.label}
              </Button>
            );
          })}
          {view !== 'month' && (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm font-semibold"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="time">Saat çizelgesi</option>
              <option value="instructor">Öğretmene göre</option>
              <option value="vehicle">Araca göre</option>
            </select>
          )}
        </div>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 py-3">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={filters.instructorProfileId} onChange={(e) => setFilters({ ...filters, instructorProfileId: e.target.value })}>
            <option value="">Tüm öğretmenler</option>
            {reference.instructors.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={filters.vehicleId} onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}>
            <option value="">Tüm araçlar</option>
            {reference.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={filters.licenseClass} onChange={(e) => setFilters({ ...filters, licenseClass: e.target.value })}>
            <option value="">Tüm sınıflar</option>
            {['A', 'A1', 'A2', 'B', 'BE', 'C', 'D'].map((x) => <option key={x} value={x}>{x} sınıfı</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={filters.transmissionType} onChange={(e) => setFilters({ ...filters, transmissionType: e.target.value })}>
            <option value="">Tüm vitesler</option>
            <option value="Manual">Manuel</option>
            <option value="Automatic">Otomatik</option>
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="open">Açık randevular</option>
            <option value="">Tümü (iptaller dahil)</option>
            <option value="Completed">Tamamlanan</option>
            <option value="NoShow">Gelmeyen</option>
          </select>
          <Badge variant="outline" className="ml-auto self-center">{appointments.length} randevu</Badge>
        </CardContent>
      </Card>

      {view === 'month' ? (
        <MonthGrid days={days} anchor={anchor} appointments={appointments} onSelect={setSelected} />
      ) : groupBy === 'time' ? (
        <TimeGrid
          days={days}
          appointments={appointments}
          canReschedule={canReschedule}
          dragged={dragged}
          onDropSlot={onDropSlot}
          onSelect={setSelected}
          onSlotClick={canCreate ? openCreate : null}
        />
      ) : (
        <ResourceGrid
          days={days}
          resources={resources}
          appointments={appointments}
          canReschedule={canReschedule}
          dragged={dragged}
          onDropSlot={onDropSlot}
          onSelect={setSelected}
        />
      )}

      {selected && (
        <AppointmentDialog
          appointment={selected}
          onClose={() => setSelected(null)}
          onOpenStudent={() => navigate(`/driving/students/${selected.studentDrivingProfileId}`)}
        />
      )}

      {createStart && (
        <CreateAppointmentDialog
          start={createStart}
          students={reference.students}
          instructors={reference.instructors}
          vehicles={reference.vehicles}
          appointments={appointments}
          onClose={() => setCreateStart(null)}
          onCreated={() => { setCreateStart(null); load(); }}
        />
      )}
    </div>
  );
}

// Vites türü iki uçtan İKİ FARKLI biçimde gelir: /students onu string olarak
// ("Manual"/"Automatic") döndürür, /vehicles ham entity döndürdüğü için int'tir
// (Manual = 1). Doğrudan karşılaştırma daima false olur ve araç listesi boş
// kalırdı; bu yüzden ikisini de tek biçime indiriyoruz.
function transmissionKey(value) {
  if (value === 1 || value === '1') return 'Manual';
  if (value === 2 || value === '2') return 'Automatic';
  return String(value ?? '').trim() || null;
}

// Randevu bir zaman aralığında öğretmenle çakışıyor mu? Yalnızca takvimde YER
// TUTAN durumlar sayılır — backend'deki DrivingAppointmentStatuses.Blocking ile
// aynı küme (iptal, devamsızlık, tamamlanan ve ertelenen yer bırakır).
function overlaps(appointment, start, end) {
  if (!BLOCKING_STATUSES.includes(String(appointment.status))) return false;
  const s = new Date(appointment.startsAtUtc).getTime();
  const e = new Date(appointment.endsAtUtc).getTime();
  return s < end.getTime() && e > start.getTime();
}

/**
 * Takvim slotuna tıklayınca açılan "yeni randevu" modalı. Tarih/saat otomatik gelir;
 * o saatte DERSİ OLAN öğretmen listede seçilemez (çakışma önleyici). Backend kuralları
 * (çalışma saati, araç ataması, limit) ayrıca zorunlu uygular.
 */
function CreateAppointmentDialog({ start, students, instructors, vehicles, appointments, onClose, onCreated }) {
  const { toast } = useToast();
  const [duration, setDuration] = useState(60);
  const [studentDrivingProfileId, setStudent] = useState('');
  const [groupFilter, setGroupFilter] = useState('all'); // 'all' | 'ungrouped' | <groupId>
  const [instructorProfileId, setInstructor] = useState('');
  const [vehicleId, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const end = useMemo(() => new Date(start.getTime() + duration * 60000), [start, duration]);

  // O saatte dersi olan öğretmenlerin id'leri (çakışma önleme).
  const busyInstructorIds = useMemo(() => {
    const set = new Set();
    for (const a of appointments) {
      if (a.instructorProfileId && overlaps(a, start, end)) set.add(a.instructorProfileId);
    }
    return set;
  }, [appointments, start, end]);

  // Mezun / askıya alınmış / iptal edilmiş kursiyere ders planlanmaz; listeyi
  // eğitimi süren adaylarla sınırlıyoruz.
  const bookableStudents = useMemo(
    () => students.filter((s) => BOOKABLE_STATUSES.includes(String(s.status))),
    [students],
  );

  // Kursiyer grupları (dönemler) — seçilebilir öğrencilerden türetilir.
  const groups = useMemo(() => {
    const map = new Map();
    bookableStudents.forEach((s) => { if (s.groupId) map.set(s.groupId, s.groupName || 'Grup'); });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [bookableStudents]);
  const hasUngrouped = useMemo(() => bookableStudents.some((s) => !s.groupId), [bookableStudents]);

  // Gruba göre daralt: öğrenci seçerken kalabalık listede grubu bul.
  const visibleStudents = useMemo(() => {
    if (groupFilter === 'all') return bookableStudents;
    if (groupFilter === 'ungrouped') return bookableStudents.filter((s) => !s.groupId);
    return bookableStudents.filter((s) => s.groupId === groupFilter);
  }, [bookableStudents, groupFilter]);

  // Grup değişince seçili öğrenci filtre dışında kaldıysa seçimi düşür.
  useEffect(() => {
    if (studentDrivingProfileId && !visibleStudents.some((s) => s.id === studentDrivingProfileId)) setStudent('');
  }, [visibleStudents, studentDrivingProfileId]);

  const student = useMemo(
    () => bookableStudents.find((s) => s.id === studentDrivingProfileId) || null,
    [bookableStudents, studentDrivingProfileId],
  );

  const availableInstructors = useMemo(
    () => instructors.filter((i) => i.isActive !== false && !busyInstructorIds.has(i.id)),
    [instructors, busyInstructorIds],
  );
  const busyInstructors = useMemo(
    () => instructors.filter((i) => busyInstructorIds.has(i.id)),
    [instructors, busyInstructorIds],
  );

  // Araçları seçili kursiyerin ehliyet sınıfı + vites türüne göre süz (uyumsuz
  // seçim backend'de 400 döndürürdü); ayrıca bakımdakiler gizlenir.
  const availableVehicles = useMemo(
    () => vehicles.filter((v) => !v.isInMaintenance && (!student
      || (String(v.licenseClass).toUpperCase() === String(student.licenseClass).toUpperCase()
        && transmissionKey(v.transmissionType) === transmissionKey(student.transmissionType)))),
    [vehicles, student],
  );

  // Seçili öğretmen bu saatte doluysa (ör. süre değişince) seçimi düşür.
  useEffect(() => {
    if (instructorProfileId && busyInstructorIds.has(instructorProfileId)) setInstructor('');
  }, [busyInstructorIds, instructorProfileId]);
  // Kursiyer değişince uyumsuz kalan aracı düşür.
  useEffect(() => {
    if (vehicleId && !availableVehicles.some((v) => v.id === vehicleId)) setVehicle('');
  }, [availableVehicles, vehicleId]);

  const submit = async () => {
    if (!studentDrivingProfileId) { toast({ title: 'Kursiyer seçin', variant: 'destructive' }); return; }
    if (!instructorProfileId) { toast({ title: 'Öğretmen seçin', variant: 'destructive' }); return; }
    if (!vehicleId) { toast({ title: 'Araç seçin', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await createDrivingAppointment({
        studentDrivingProfileId,
        instructorProfileId,
        vehicleId,
        startsAtUtc: start.toISOString(),
        endsAtUtc: end.toISOString(),
        notes: notes.trim(),
      });
      toast({ title: 'Randevu oluşturuldu', description: `${start.toLocaleString('tr-TR')} — öğrenci ve öğretmen bilgilendirildi.` });
      onCreated();
    } catch (e) {
      toast({ title: 'Randevu oluşturulamadı', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-brand-primary" />Yeni Randevu</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <b>{start.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            {' • '}{hhmm(start)}–{hhmm(end)}
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Süre</label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} dk</option>)}
            </select>
          </div>
          {groups.length > 0 && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Grup / Dönem filtresi</label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="all">Tüm gruplar</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                {hasUngrouped && <option value="ungrouped">Gruba atanmamış</option>}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-muted-foreground">Kursiyer * <span className="font-normal text-muted-foreground/70">({visibleStudents.length} kursiyer)</span></label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={studentDrivingProfileId} onChange={(e) => setStudent(e.target.value)}>
              <option value="">Seçin…</option>
              {visibleStudents.map((s) => <option key={s.id} value={s.id}>{s.studentNumber != null ? `#${s.studentNumber} ` : ''}{s.fullName}{s.groupName ? ` — ${s.groupName}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Öğretmen * <span className="font-normal text-muted-foreground/70">(o saatte müsait olanlar)</span></label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={instructorProfileId} onChange={(e) => setInstructor(e.target.value)}>
              <option value="">Seçin…</option>
              {availableInstructors.map((i) => <option key={i.id} value={i.id}>{i.fullName}</option>)}
            </select>
            {busyInstructors.length > 0 && (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                <span>Bu saatte dersi olduğu için seçilemez: {busyInstructors.map((i) => i.fullName).join(', ')}</span>
              </p>
            )}
            {availableInstructors.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 className="h-3 w-3" />{availableInstructors.length} öğretmen müsait</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Araç *{student ? <span className="font-normal text-muted-foreground/70"> ({student.licenseClass} • {transmissionKey(student.transmissionType) === 'Manual' ? 'Manuel' : 'Otomatik'})</span> : ''}</label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={vehicleId} onChange={(e) => setVehicle(e.target.value)}>
              <option value="">Seçin…</option>
              {availableVehicles.map((v) => <option key={v.id} value={v.id}>{v.plateNumber} • {v.brand} {v.model}</option>)}
            </select>
            {student && availableVehicles.length === 0 && (
              <p className="mt-1 text-[11px] text-red-500">Kursiyerin sınıf/vitesine uygun, müsait araç yok.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Not</label>
            <Input maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Buluşma noktası vb." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Oluşturuluyor…</> : <><Plus className="mr-2 h-4 w-4" />Randevu Oluştur</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Randevu kartı — sürüklenebilirliği duruma ve yetkiye bağlı. */
function AppointmentCard({ appointment, canReschedule, dragged, onSelect, compact }) {
  const movable = canReschedule && MOVABLE.includes(appointment.status);
  const start = new Date(appointment.startsAtUtc);
  const end = new Date(appointment.endsAtUtc);
  const tone = STATUS_TONE[appointment.status] || 'bg-muted';

  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={() => { dragged.current = appointment; }}
      onDragEnd={() => { dragged.current = null; }}
      onClick={() => onSelect(appointment)}
      className={`w-full overflow-hidden rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs transition hover:brightness-110 ${
        movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${tone.replace('bg-', 'border-l-')} bg-card shadow-sm`}
      title={`${appointment.studentName} • ${appointment.instructorName} • ${appointment.vehiclePlate}`}
    >
      <div className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />
        <b className="truncate">{hhmm(start)} {appointment.studentName}</b>
      </div>
      {!compact && (
        <p className="truncate text-[11px] text-muted-foreground">
          {appointment.vehiclePlate} • {appointment.instructorName} • {appointment.lessonNumber}. ders
        </p>
      )}
      {!compact && appointment.meetingPoint && (
        <p className="truncate text-[11px] text-muted-foreground">
          <MapPin className="mr-0.5 inline h-2.5 w-2.5" />{appointment.meetingPoint}
        </p>
      )}
      <span className="sr-only">{hhmm(start)}–{hhmm(end)}</span>
    </button>
  );
}

/** Saat çizelgesi: dikey eksen saat, yatay eksen gün. */
function TimeGrid({ days, appointments, canReschedule, dragged, onDropSlot, onSelect, onSlotClick }) {
  const now = new Date();

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <div style={{ minWidth: days.length === 1 ? 760 : 1120 }}>
          {/* Gün başlıkları */}
          <div className="flex border-b" style={{ paddingLeft: 68 }}>
            {days.map((day) => (
              <div key={day.toISOString()} className={`flex-1 border-l py-3 text-center text-sm font-bold ${sameDay(day, now) ? 'bg-violet-500/5 text-violet-600' : ''}`}>
                {day.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Saat sütunu */}
            <div className="w-[68px] shrink-0">
              {HOURS.map((hour) => (
                <div key={hour} className="border-b pr-2 pt-2 text-right text-xs font-medium text-muted-foreground" style={{ height: SLOT_HEIGHT }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayAppointments = appointments.filter((x) => sameDay(new Date(x.startsAtUtc), day));
              return (
                <div key={day.toISOString()} className={`relative flex-1 border-l ${sameDay(day, now) ? 'bg-violet-500/[0.03]' : ''}`}>
                  {HOURS.map((hour) => (
                    // Yarım saatlik iki bırakma hedefi: 09:00 ve 09:30'a ayrı ayrı bırakılabilir.
                    <div key={hour} className="border-b" style={{ height: SLOT_HEIGHT }}>
                      {[0, 30].map((minute) => (
                        <div
                          key={minute}
                          role={onSlotClick ? 'button' : undefined}
                          title={onSlotClick ? 'Randevu oluşturmak için tıklayın' : undefined}
                          className={`h-1/2 transition hover:bg-violet-500/10 ${onSlotClick ? 'cursor-pointer' : ''}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropSlot(day, hour, minute)}
                          onClick={onSlotClick ? () => onSlotClick(day, hour, minute) : undefined}
                        />
                      ))}
                    </div>
                  ))}

                  {dayAppointments.map((appointment) => {
                    const start = new Date(appointment.startsAtUtc);
                    const end = new Date(appointment.endsAtUtc);
                    const top = ((start.getHours() + start.getMinutes() / 60) - HOUR_START) * SLOT_HEIGHT;
                    const height = Math.max(30, ((end - start) / 3600000) * SLOT_HEIGHT - 3);
                    if (top < 0 || top > (HOUR_END - HOUR_START) * SLOT_HEIGHT) return null;

                    return (
                      <div key={appointment.id} className="absolute inset-x-1 z-10" style={{ top, height }}>
                        <AppointmentCard
                          appointment={appointment}
                          canReschedule={canReschedule}
                          dragged={dragged}
                          onSelect={onSelect}
                          compact={height < 52}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Kaynak görünümü: her öğretmen/araç bir satır, gün gün doluluk. */
function ResourceGrid({ days, resources, appointments, canReschedule, dragged, onDropSlot, onSelect }) {
  if (resources.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Bu görünüm için tanımlı kayıt yok.
      </CardContent></Card>
    );
  }

  const key = resources[0].key;

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <div style={{ minWidth: days.length === 1 ? 760 : 1120 }}>
          <div className="flex border-b">
            <div className="w-48 shrink-0 py-3 pl-4 text-sm font-bold">
              <Columns3 className="mr-1 inline h-3.5 w-3.5" />Kaynak
            </div>
            {days.map((day) => (
              <div key={day.toISOString()} className="flex-1 border-l py-3 text-center text-sm font-bold">
                {day.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })}
              </div>
            ))}
          </div>

          {resources.map((resource) => (
            <div key={resource.id} className="flex border-b">
              <div className="w-48 shrink-0 self-center py-3 pl-4 text-sm font-semibold">{resource.label}</div>
              {days.map((day) => {
                const cell = appointments.filter(
                  (x) => x[key] === resource.id && sameDay(new Date(x.startsAtUtc), day),
                );
                return (
                  <div
                    key={day.toISOString()}
                    className="min-h-[84px] flex-1 space-y-1.5 border-l p-2 transition hover:bg-violet-500/5"
                    onDragOver={(e) => e.preventDefault()}
                    // Kaynak görünümünde saat bilgisi yok; bırakılan randevu aynı
                    // saatinde kalır, yalnızca günü değişir.
                    onDrop={() => {
                      const appointment = dragged.current;
                      if (!appointment) return;
                      const original = new Date(appointment.startsAtUtc);
                      onDropSlot(day, original.getHours(), original.getMinutes());
                    }}
                  >
                    {cell.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        canReschedule={canReschedule}
                        dragged={dragged}
                        onSelect={onSelect}
                        compact
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Aylık genel bakış — yoğunluk görmek için; sürükleme yapılmaz. */
function MonthGrid({ days, anchor, appointments, onSelect }) {
  const now = new Date();

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-7 border-b">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((label) => (
              <div key={label} className="py-3 text-center text-sm font-bold">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayAppointments = appointments.filter((x) => sameDay(new Date(x.startsAtUtc), day));
              const outside = day.getMonth() !== anchor.getMonth();
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[140px] space-y-1.5 border-b border-l p-2 ${outside ? 'bg-muted/30 opacity-60' : ''} ${sameDay(day, now) ? 'bg-violet-500/5' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${sameDay(day, now) ? 'text-violet-600' : ''}`}>{day.getDate()}</span>
                    {dayAppointments.length > 0 && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{dayAppointments.length}</Badge>}
                  </div>
                  {dayAppointments.slice(0, 3).map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onSelect(appointment)}
                      className="flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] hover:bg-muted"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_TONE[appointment.status] || 'bg-muted'}`} />
                      <span className="truncate">{hhmm(new Date(appointment.startsAtUtc))} {appointment.studentName}</span>
                    </button>
                  ))}
                  {dayAppointments.length > 3 && (
                    <p className="pl-1 text-[11px] text-muted-foreground">+{dayAppointments.length - 3} daha</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentDialog({ appointment, onClose, onOpenStudent }) {
  const start = new Date(appointment.startsAtUtc);
  const end = new Date(appointment.endsAtUtc);
  const cancelled = appointment.status.startsWith('Cancelled');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {appointment.studentPhotoUrl
                ? <img src={assetUrl(appointment.studentPhotoUrl)} alt={appointment.studentName} className="h-12 w-12 rounded-xl object-cover" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted font-black">{appointment.studentName?.[0]}</div>}
              <div>
                <b className="text-lg">{appointment.studentName}</b>
                <p className="text-sm text-muted-foreground">{appointment.lessonNumber}. direksiyon dersi</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>

          <Badge className={STATUS_TONE[appointment.status] || 'bg-muted'}>
            {STATUS_LABEL[appointment.status] || appointment.status}
          </Badge>

          <div className="space-y-1.5 text-sm">
            <p><b>Zaman:</b> {start.toLocaleDateString('tr-TR')} {hhmm(start)} – {hhmm(end)}</p>
            <p><b>Öğretmen:</b> {appointment.instructorName}</p>
            <p><b>Araç:</b> {appointment.vehiclePlate}</p>
            <p><b>Sınıf/vites:</b> {appointment.licenseClass} • {appointment.transmissionType === 'Manual' ? 'Manuel' : 'Otomatik'}</p>
            {appointment.meetingPoint && <p><b>Buluşma:</b> {appointment.meetingPoint}</p>}
            {appointment.notes && <p><b>Not:</b> {appointment.notes}</p>}
          </div>

          {cancelled && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600" />Bu randevu iptal edilmiş.
            </div>
          )}

          <Button className="w-full" onClick={onOpenStudent}>Kursiyer dosyasını aç</Button>
        </CardContent>
      </Card>
    </div>
  );
}
