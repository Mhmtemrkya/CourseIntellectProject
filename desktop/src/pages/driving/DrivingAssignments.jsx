import { useCallback, useEffect, useState } from 'react';
import {
  CalendarOff, CarFront, Clock, Lock, Plus, RefreshCw, Settings2, Trash2, UserRoundCheck,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createDrivingAssignment, createDrivingLeave, deactivateDrivingAssignment, deleteDrivingLeave,
  fetchDrivingAssignments, fetchDrivingInstructors, fetchDrivingLeaves, fetchDrivingSettings,
  fetchDrivingVehicles, fetchDrivingWorkingHours, setDrivingWorkingHours, updateDrivingSettings, uploadFile,
  updateDrivingCertificateSettings, downloadDrivingCertificatePreview,
  fetchDrivingCertificateSettings, approveDrivingCertificateSettings,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const ASSIGNMENT_TYPES = [
  { value: 'Primary', label: 'Asıl araç' },
  { value: 'Secondary', label: 'İkinci araç' },
  { value: 'Temporary', label: 'Geçici (tarih aralıklı)' },
  { value: 'SpecificDays', label: 'Belirli günler' },
  { value: 'Backup', label: 'Yedek' },
];

const DAYS = [
  { value: 0, label: 'Paz' }, { value: 1, label: 'Pzt' }, { value: 2, label: 'Sal' },
  { value: 3, label: 'Çar' }, { value: 4, label: 'Per' }, { value: 5, label: 'Cum' }, { value: 6, label: 'Cmt' },
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyAssignment = { instructorProfileId: '', vehicleId: '', assignmentType: 'Primary', startsOnUtc: '', endsOnUtc: '', daysOfWeekMask: 0, priority: 10, note: '' };
const emptyLeave = { instructorProfileId: '', startsAtUtc: '', endsAtUtc: '', leaveType: 'Annual', reason: '' };

const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinutes = (time) => {
  const [hour, minute] = String(time || '').split(':').map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
};

function Field({ label, hint, children }) {
  return (
    <label className="space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      {children}
      {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ReadOnlyNotice({ message }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4 shrink-0" />{message}</div>;
}

export default function DrivingAssignments() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();

  const [data, setData] = useState({ instructors: [], vehicles: [], assignments: [], leaves: [] });
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [leaveForm, setLeaveForm] = useState(emptyLeave);
  const [hoursInstructor, setHoursInstructor] = useState('');
  const [hours, setHours] = useState([]);

  const canManageAssignments = can(DRIVING.instructorAssignmentManage);
  const canManageInstructors = can(DRIVING.instructorUpdate);
  const canManageSettings = can(DRIVING.settingsManage);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [instructors, vehicles, assignments, leaves, currentSettings, certificateSettings] = await Promise.all([
        fetchDrivingInstructors(),
        fetchDrivingVehicles(),
        fetchDrivingAssignments(),
        fetchDrivingLeaves(),
        fetchDrivingSettings().catch(() => null),
        canManageSettings ? fetchDrivingCertificateSettings().catch(() => null) : Promise.resolve(null),
      ]);
      setData({
        instructors: instructors || [],
        vehicles: vehicles || [],
        assignments: assignments || [],
        leaves: leaves || [],
      });
      setSettings(currentSettings ? {
        ...currentSettings,
        ...(certificateSettings ? {
          certificateDirectorName: certificateSettings.directorName,
          certificateDirectorTitle: certificateSettings.directorTitle,
          certificateLogoUrl: certificateSettings.logoUrl,
          certificateSignatureUrl: certificateSettings.signatureUrl,
          certificatePrimaryColor: certificateSettings.primaryColor,
          minimumTheoryAttendancePercent: certificateSettings.minimumTheoryAttendancePercent,
          excusedAbsencePolicy: certificateSettings.excusedAbsencePolicy,
          certificateSettingsApproved: certificateSettings.approved,
          certificateSettingsApprovedAtUtc: certificateSettings.certificateSettingsApprovedAtUtc,
        } : {}),
      } : null);
    } catch (error) {
      toast({ title: 'Atama verileri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, canManageSettings]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  // Çalışma saatleri öğretmen seçilince yüklenir; boş liste = "kısıt yok".
  useEffect(() => {
    if (!hoursInstructor) { setHours([]); return; }
    fetchDrivingWorkingHours(hoursInstructor)
      .then((rows) => setHours((rows || []).map((x) => ({
        dayOfWeek: x.dayOfWeek,
        start: toTime(x.startMinute),
        end: toTime(x.endMinute),
      }))))
      .catch(() => setHours([]));
  }, [hoursInstructor]);

  async function run(action, success) {
    setSaving(true);
    try {
      await action();
      toast({ title: success });
      await load();
      return true;
    } catch (error) {
      toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignment(event) {
    event.preventDefault();
    const payload = {
      ...assignmentForm,
      priority: Number(assignmentForm.priority),
      daysOfWeekMask: Number(assignmentForm.daysOfWeekMask),
      startsOnUtc: assignmentForm.startsOnUtc ? new Date(assignmentForm.startsOnUtc).toISOString() : null,
      endsOnUtc: assignmentForm.endsOnUtc ? new Date(assignmentForm.endsOnUtc).toISOString() : null,
    };
    if (await run(() => createDrivingAssignment(payload), 'Araç ataması yapıldı')) setAssignmentForm(emptyAssignment);
  }

  async function saveLeave(event) {
    event.preventDefault();
    const payload = {
      ...leaveForm,
      startsAtUtc: new Date(leaveForm.startsAtUtc).toISOString(),
      endsAtUtc: new Date(leaveForm.endsAtUtc).toISOString(),
      forceWithExistingAppointments: false,
    };
    setSaving(true);
    try {
      await createDrivingLeave(payload);
      toast({ title: 'İzin tanımlandı' });
      setLeaveForm(emptyLeave);
      await load();
    } catch (error) {
      // Açık randevusu varsa backend engeller; yöneticiye ne yapacağını söyleriz.
      const affected = error.body?.affectedAppointments?.length;
      toast({
        title: 'İzin tanımlanamadı',
        description: affected
          ? `${error.message} Randevuları "Öğrenci & Randevu" ekranından yeniden planlayın.`
          : error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveHours() {
    const windows = hours
      .map((x) => ({ dayOfWeek: x.dayOfWeek, startMinute: toMinutes(x.start), endMinute: toMinutes(x.end) }))
      .filter((x) => x.startMinute !== null && x.endMinute !== null && x.endMinute > x.startMinute);
    await run(() => setDrivingWorkingHours(hoursInstructor, { windows }), 'Çalışma saatleri kaydedildi');
  }

  async function saveSettings(event) {
    event.preventDefault();
    await run(async () => {
      await updateDrivingCertificateSettings({
        directorName: settings.certificateDirectorName,
        directorTitle: settings.certificateDirectorTitle,
        logoUrl: settings.certificateLogoUrl,
        signatureUrl: settings.certificateSignatureUrl,
        primaryColor: settings.certificatePrimaryColor,
        minimumTheoryAttendancePercent: Number(settings.minimumTheoryAttendancePercent),
        excusedAbsencePolicy: settings.excusedAbsencePolicy,
      });
      await updateDrivingSettings({
        ...settings,
        lateCancellationHours: Number(settings.lateCancellationHours),
        lateCancellationDeductPercent: Number(settings.lateCancellationDeductPercent),
        noShowDeductPercent: Number(settings.noShowDeductPercent),
        minRescheduleHours: Number(settings.minRescheduleHours),
        maxInstructorDailyMinutes: Number(settings.maxInstructorDailyMinutes),
        maxVehicleDailyMinutes: Number(settings.maxVehicleDailyMinutes),
        maxStudentDailyLessons: Number(settings.maxStudentDailyLessons),
        maxStudentDailyMinutes: Number(settings.maxStudentDailyMinutes),
        lessonEarliestHour: Number(settings.lessonEarliestHour),
        lessonLatestHour: Number(settings.lessonLatestHour),
        failedPracticeExtraLessonMinutes: Number(settings.failedPracticeExtraLessonMinutes),
        failedPracticeExtraLessonFee: Number(settings.failedPracticeExtraLessonFee),
        maxVehicleAgeYears: Number(settings.maxVehicleAgeYears),
        preparationMinutes: Number(settings.preparationMinutes),
        financialHoldThreshold: Number(settings.financialHoldThreshold),
        minimumTheoryAttendancePercent: Number(settings.minimumTheoryAttendancePercent),
      });
    }, 'Kurum, sertifika ve operasyon kuralları güncellendi');
  }

  async function previewCertificate() {
    try {
      const blob = await downloadDrivingCertificatePreview();
      const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { toast({ title: 'Önizleme oluşturulamadı', description: error.message, variant: 'destructive' }); }
  }

  async function approveCertificatePreview() {
    if (!window.confirm('PDF önizlemesini, kurum logosunu, müdür bilgilerini ve imzayı kontrol edip onaylıyor musunuz?')) return;
    await run(() => approveDrivingCertificateSettings({ confirmed: true, note: 'Kurum yöneticisi PDF önizlemesini kontrol etti.' }), 'Sertifika tasarımı onaylandı');
  }

  async function uploadCertificateAsset(field, file) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast({ title: 'Geçersiz görsel', description: 'PNG/JPEG/WebP ve en fazla 5 MB dosya seçin.', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const form = new FormData(); form.set('file', file);
      const uploaded = await uploadFile(form, 'driving-certificate-assets');
      setSettings((current) => ({ ...current, [field]: uploaded.fileUrl }));
      toast({ title: 'Görsel yüklendi', description: 'Kuralları Kaydet ile değişikliği kalıcılaştırın.' });
    } catch (error) { toast({ title: 'Görsel yüklenemedi', description: error.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  }

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;

  const selectedType = assignmentForm.assignmentType;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge className="mb-2 border-0 bg-blue-500/15 text-blue-600"><UserRoundCheck className="mr-1 h-3.5 w-3.5" />Uygunluk kuralları</Badge>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Atama, Çalışma Saatleri ve Kurallar</h1>
          <p className="text-muted-foreground">
            Bir öğretmene araç atandığı andan itibaren, atanmamış araçla randevu verilemez.
          </p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button>
      </div>

      <Tabs defaultValue={new URLSearchParams(window.location.search).get('tab') || 'assignments'}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="assignments">Öğretmen-araç ataması</TabsTrigger>
          <TabsTrigger value="hours">Çalışma saatleri</TabsTrigger>
          <TabsTrigger value="leaves">İzinler</TabsTrigger>
          {canManageSettings && <TabsTrigger value="rules">Kurum kuralları</TabsTrigger>}
        </TabsList>

        <TabsContent value="assignments" className="mt-5 space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><CarFront className="text-[hsl(var(--brand-accent))]" />Yeni atama</CardTitle></CardHeader>
            <CardContent>
              {canManageAssignments ? (
                <form onSubmit={saveAssignment} className="grid gap-3 md:grid-cols-3">
                  <Field label="Öğretmen">
                    <select required className={selectClass} value={assignmentForm.instructorProfileId} onChange={(e) => setAssignmentForm({ ...assignmentForm, instructorProfileId: e.target.value })}>
                      <option value="">Seçin</option>
                      {data.instructors.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
                    </select>
                  </Field>
                  <Field label="Araç" hint="Öğretmenin sınıf/vites yetkinliğine uymayan araç atanamaz.">
                    <select required className={selectClass} value={assignmentForm.vehicleId} onChange={(e) => setAssignmentForm({ ...assignmentForm, vehicleId: e.target.value })}>
                      <option value="">Seçin</option>
                      {data.vehicles.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.plateNumber} • {x.licenseClass} • {x.transmissionType === 1 ? 'Manuel' : 'Otomatik'}</option>)}
                    </select>
                  </Field>
                  <Field label="Atama türü">
                    <select className={selectClass} value={selectedType} onChange={(e) => setAssignmentForm({ ...assignmentForm, assignmentType: e.target.value })}>
                      {ASSIGNMENT_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </Field>

                  {selectedType === 'Temporary' && (
                    <>
                      <Field label="Başlangıç"><Input required type="date" value={assignmentForm.startsOnUtc} onChange={(e) => setAssignmentForm({ ...assignmentForm, startsOnUtc: e.target.value })} /></Field>
                      <Field label="Bitiş"><Input required type="date" value={assignmentForm.endsOnUtc} onChange={(e) => setAssignmentForm({ ...assignmentForm, endsOnUtc: e.target.value })} /></Field>
                    </>
                  )}

                  {selectedType === 'SpecificDays' && (
                    <div className="md:col-span-2">
                      <span className="text-sm font-semibold">Geçerli günler</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DAYS.map((day) => {
                          const bit = 1 << day.value;
                          const active = (assignmentForm.daysOfWeekMask & bit) !== 0;
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => setAssignmentForm({ ...assignmentForm, daysOfWeekMask: assignmentForm.daysOfWeekMask ^ bit })}
                              className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${active ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'text-muted-foreground'}`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Field label="Öncelik" hint="Küçük değer önce önerilir."><Input type="number" min="0" max="1000" value={assignmentForm.priority} onChange={(e) => setAssignmentForm({ ...assignmentForm, priority: e.target.value })} /></Field>
                  <Field label="Not"><Input maxLength={500} value={assignmentForm.note} onChange={(e) => setAssignmentForm({ ...assignmentForm, note: e.target.value })} /></Field>
                  <Button disabled={saving} className="md:col-span-3 bg-brand-primary text-white hover:bg-brand-primary/90"><Plus className="mr-2 h-4 w-4" />Atamayı Kaydet</Button>
                </form>
              ) : (
                <ReadOnlyNotice message="Araç ataması yapmak filo sorumlusunun veya yöneticinin yetkisindedir." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Aktif atamalar</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.assignments.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  Henüz atama yok — bu durumda öğretmenler uygun her aracı kullanabilir.
                </p>
              )}
              {data.assignments.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <b>{item.instructorName} → {item.vehiclePlate}</b>
                    <p className="text-xs text-muted-foreground">
                      {ASSIGNMENT_TYPES.find((x) => x.value === item.assignmentType)?.label || item.assignmentType}
                      {' • '}öncelik {item.priority}
                      {item.startsOnUtc && ` • ${new Date(item.startsOnUtc).toLocaleDateString('tr-TR')} – ${new Date(item.endsOnUtc).toLocaleDateString('tr-TR')}`}
                      {item.daysOfWeekMask > 0 && ` • ${DAYS.filter((d) => (item.daysOfWeekMask & (1 << d.value)) !== 0).map((d) => d.label).join(', ')}`}
                    </p>
                  </div>
                  {canManageAssignments && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => deactivateDrivingAssignment(item.id), 'Atama kaldırıldı')}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />Kaldır
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="mt-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><Clock className="text-violet-500" />Haftalık çalışma programı</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Öğretmen" hint="Saat tanımlanmayan öğretmene kısıt uygulanmaz.">
                <select className={selectClass} value={hoursInstructor} onChange={(e) => setHoursInstructor(e.target.value)}>
                  <option value="">Seçin</option>
                  {data.instructors.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
                </select>
              </Field>

              {hoursInstructor && (
                <>
                  <div className="space-y-2">
                    {DAY_NAMES.map((dayName, index) => {
                      const window = hours.find((x) => x.dayOfWeek === dayName);
                      return (
                        <div key={dayName} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                          <label className="flex w-28 items-center gap-2 text-sm font-bold">
                            <input
                              type="checkbox"
                              checked={Boolean(window)}
                              disabled={!canManageInstructors}
                              onChange={(e) => setHours((current) => (e.target.checked
                                ? [...current, { dayOfWeek: dayName, start: '09:00', end: '18:00' }]
                                : current.filter((x) => x.dayOfWeek !== dayName)))}
                            />
                            {DAYS[index].label}
                          </label>
                          {window && (
                            <>
                              <Input
                                type="time"
                                className="w-32"
                                value={window.start}
                                disabled={!canManageInstructors}
                                onChange={(e) => setHours((current) => current.map((x) => (x.dayOfWeek === dayName ? { ...x, start: e.target.value } : x)))}
                              />
                              <span className="text-muted-foreground">–</span>
                              <Input
                                type="time"
                                className="w-32"
                                value={window.end}
                                disabled={!canManageInstructors}
                                onChange={(e) => setHours((current) => current.map((x) => (x.dayOfWeek === dayName ? { ...x, end: e.target.value } : x)))}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {canManageInstructors && (
                    <Button disabled={saving} onClick={saveHours}>Çalışma Saatlerini Kaydet</Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="mt-5 space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><CalendarOff className="text-rose-500" />İzin tanımla</CardTitle></CardHeader>
            <CardContent>
              {canManageInstructors ? (
                <form onSubmit={saveLeave} className="grid gap-3 md:grid-cols-3">
                  <Field label="Öğretmen">
                    <select required className={selectClass} value={leaveForm.instructorProfileId} onChange={(e) => setLeaveForm({ ...leaveForm, instructorProfileId: e.target.value })}>
                      <option value="">Seçin</option>
                      {data.instructors.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
                    </select>
                  </Field>
                  <Field label="Başlangıç"><Input required type="datetime-local" value={leaveForm.startsAtUtc} onChange={(e) => setLeaveForm({ ...leaveForm, startsAtUtc: e.target.value })} /></Field>
                  <Field label="Bitiş"><Input required type="datetime-local" value={leaveForm.endsAtUtc} onChange={(e) => setLeaveForm({ ...leaveForm, endsAtUtc: e.target.value })} /></Field>
                  <Field label="İzin türü">
                    <select className={selectClass} value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
                      <option value="Annual">Yıllık izin</option>
                      <option value="Sick">Hastalık</option>
                      <option value="Unpaid">Ücretsiz</option>
                      <option value="Other">Diğer</option>
                    </select>
                  </Field>
                  <Field label="Açıklama"><Input maxLength={500} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></Field>
                  <Button disabled={saving} className="md:col-span-3"><Plus className="mr-2 h-4 w-4" />İzni Kaydet</Button>
                </form>
              ) : (
                <ReadOnlyNotice message="İzin tanımlamak için yetkiniz yok." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>İzinler</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.leaves.length === 0 && <p className="py-8 text-center text-muted-foreground">İzin kaydı yok.</p>}
              {data.leaves.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <b>{item.instructorName}</b>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.startsAtUtc).toLocaleString('tr-TR')} – {new Date(item.endsAtUtc).toLocaleString('tr-TR')} • {item.leaveType}
                      {item.reason && ` • ${item.reason}`}
                    </p>
                  </div>
                  {canManageInstructors && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => deleteDrivingLeave(item.id), 'İzin kaldırıldı')}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />Sil
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {canManageSettings && settings && (
          <TabsContent value="rules" className="mt-5">
            <Card>
              <CardHeader><CardTitle className="flex gap-2"><Settings2 className="text-emerald-500" />Randevu ve iptal kuralları</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2">
                  <Field label="Geç iptal penceresi (saat)" hint="Bu süreden yakın öğrenci iptali cezalıdır.">
                    <Input type="number" min="0" max="168" value={settings.lateCancellationHours} onChange={(e) => setSettings({ ...settings, lateCancellationHours: e.target.value })} />
                  </Field>
                  <Field label="Geç iptal kesintisi (%)">
                    <Input type="number" min="0" max="100" value={settings.lateCancellationDeductPercent} onChange={(e) => setSettings({ ...settings, lateCancellationDeductPercent: e.target.value })} />
                  </Field>
                  <Field label="Devamsızlık kesintisi (%)">
                    <Input type="number" min="0" max="100" value={settings.noShowDeductPercent} onChange={(e) => setSettings({ ...settings, noShowDeductPercent: e.target.value })} />
                  </Field>
                  <Field label="Yeniden planlama sınırı (saat)">
                    <Input type="number" min="0" max="168" value={settings.minRescheduleHours} onChange={(e) => setSettings({ ...settings, minRescheduleHours: e.target.value })} />
                  </Field>
                  <Field label="Öğretmen günlük limit (dk)" hint="0 = sınırsız">
                    <Input type="number" min="0" max="1440" value={settings.maxInstructorDailyMinutes} onChange={(e) => setSettings({ ...settings, maxInstructorDailyMinutes: e.target.value })} />
                  </Field>
                  <Field label="Araç günlük limit (dk)" hint="0 = sınırsız">
                    <Input type="number" min="0" max="1440" value={settings.maxVehicleDailyMinutes} onChange={(e) => setSettings({ ...settings, maxVehicleDailyMinutes: e.target.value })} />
                  </Field>
                  <Field label="Öğrenci günlük ders limiti" hint="0 = sınırsız">
                    <Input type="number" min="0" max="10" value={settings.maxStudentDailyLessons} onChange={(e) => setSettings({ ...settings, maxStudentDailyLessons: e.target.value })} />
                  </Field>
                  <Field label="Öğrenci günlük direksiyon limiti (dk)" hint="MTSK mevzuatı: günde en fazla 120 dk. 0 = sınırsız">
                    <Input type="number" min="0" max="1440" value={settings.maxStudentDailyMinutes} onChange={(e) => setSettings({ ...settings, maxStudentDailyMinutes: e.target.value })} />
                  </Field>
                  <Field label="Ders başlangıç alt sınırı (saat)" hint="Gece dersi yasağı — mevzuat gün ışığını esas alır.">
                    <Input type="number" min="0" max="24" value={settings.lessonEarliestHour} onChange={(e) => setSettings({ ...settings, lessonEarliestHour: e.target.value })} />
                  </Field>
                  <Field label="Ders bitiş üst sınırı (saat)" hint="Alt sınıra eşit/küçükse saat kısıtı uygulanmaz.">
                    <Input type="number" min="0" max="24" value={settings.lessonLatestHour} onChange={(e) => setSettings({ ...settings, lessonLatestHour: e.target.value })} />
                  </Field>
                  <Field label="Başarısız sınav sonrası zorunlu ek ders (dk)" hint="Direksiyon sınavında kalınca otomatik açılır. 0 = kapalı">
                    <Input type="number" min="0" max="1440" value={settings.failedPracticeExtraLessonMinutes} onChange={(e) => setSettings({ ...settings, failedPracticeExtraLessonMinutes: e.target.value })} />
                  </Field>
                  <Field label="Zorunlu ek ders ücreti (₺)" hint="0 = ücretsiz; yalnızca ders hakkı eklenir.">
                    <Input type="number" min="0" value={settings.failedPracticeExtraLessonFee} onChange={(e) => setSettings({ ...settings, failedPracticeExtraLessonFee: e.target.value })} />
                  </Field>
                  <Field label="MTSK araç yaş sınırı (yıl)" hint="İl müdürlüğü şartına göre girin. 0 = kapalı">
                    <Input type="number" min="0" max="60" value={settings.maxVehicleAgeYears} onChange={(e) => setSettings({ ...settings, maxVehicleAgeYears: e.target.value })} />
                  </Field>
                  <Field label="Dersler arası hazırlık (dk)">
                    <Input type="number" min="0" max="240" value={settings.preparationMinutes} onChange={(e) => setSettings({ ...settings, preparationMinutes: e.target.value })} />
                  </Field>

                  <label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={settings.financialHoldEnabled}
                      onChange={(e) => setSettings({ ...settings, financialHoldEnabled: e.target.checked })}
                    />
                    Borcu eşiği aşan öğrenciye randevu verilmesin
                  </label>
                  <Field label="Borç eşiği (₺)">
                    <Input
                      type="number"
                      min="0"
                      disabled={!settings.financialHoldEnabled}
                      value={settings.financialHoldThreshold}
                      onChange={(e) => setSettings({ ...settings, financialHoldThreshold: e.target.value })}
                    />
                  </Field>
                  <Field label="Mezuniyet için asgari teorik devam (%)">
                    <Input type="number" min="0" max="100" value={settings.minimumTheoryAttendancePercent} onChange={(e) => setSettings({ ...settings, minimumTheoryAttendancePercent: e.target.value })} />
                  </Field>
                  <Field label="Mazeretli devamsızlık hesabı">
                    <select className="h-10 w-full rounded-md border bg-background px-3" value={settings.excusedAbsencePolicy} onChange={(e) => setSettings({ ...settings, excusedAbsencePolicy: e.target.value })}>
                      <option value="ExcludeFromCalculation">Hesaplamadan çıkar</option><option value="CountsAsPresent">Katıldı say</option><option value="CountsAsAbsent">Devamsız say</option>
                    </select>
                  </Field>
                  <Field label="Kurum müdürü adı"><Input required minLength={2} maxLength={150} value={settings.certificateDirectorName || ''} onChange={(e) => setSettings({ ...settings, certificateDirectorName: e.target.value })} /></Field>
                  <Field label="Müdür unvanı"><Input required minLength={2} maxLength={100} value={settings.certificateDirectorTitle || ''} onChange={(e) => setSettings({ ...settings, certificateDirectorTitle: e.target.value })} /></Field>
                  <Field label="Kurum logosu" hint={settings.certificateLogoUrl || 'PNG/JPEG/WebP, en fazla 5 MB'}><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadCertificateAsset('certificateLogoUrl', e.target.files?.[0])} /></Field>
                  <Field label="Müdür imzası" hint={settings.certificateSignatureUrl || 'Şeffaf PNG önerilir, en fazla 5 MB'}><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadCertificateAsset('certificateSignatureUrl', e.target.files?.[0])} /></Field>
                  <Field label="Sertifika ana rengi"><Input type="color" value={settings.certificatePrimaryColor || '#173B57'} onChange={(e) => setSettings({ ...settings, certificatePrimaryColor: e.target.value })} /></Field>

                  <div className="flex flex-wrap items-center gap-2 md:col-span-2"><Button disabled={saving || !settings.certificateLogoUrl || !settings.certificateSignatureUrl}>Tüm Ayarları Kaydet</Button><Button type="button" variant="outline" disabled={saving || !settings.certificateLogoUrl || !settings.certificateSignatureUrl} onClick={previewCertificate}>Sertifika Önizlemesi</Button><Button type="button" variant="outline" disabled={saving || settings.certificateSettingsApproved || !settings.certificateLogoUrl || !settings.certificateSignatureUrl} onClick={approveCertificatePreview}>Önizlemeyi Onayla</Button><Badge className={settings.certificateSettingsApproved ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>{settings.certificateSettingsApproved ? 'Onaylandı' : 'Onay bekliyor'}</Badge></div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
