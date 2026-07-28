import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CheckCircle2, GraduationCap, Lock, Plus, RefreshCw, ShieldAlert, UserRoundCheck, UserX, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  approveDrivingAppointment, cancelDrivingAppointment, createDrivingAppointment, createDrivingInstructor,
  createDrivingStudent, fetchDrivingAppointments, fetchDrivingBranches, fetchDrivingInstructors, fetchDrivingPackages,
  fetchDrivingStudents, fetchDrivingVehicles, fetchStaff, fetchStudents,
  markDrivingAppointmentNoShow, rescheduleDrivingAppointment,
  suggestDrivingInstructors, suggestDrivingVehicles,
  fetchDrivingAppointmentRequests, decideDrivingAppointmentRequest,
  updateDrivingInstructorLifecycle,
} from '../../lib/api/modules';
import { DRIVING, OVERRIDE_LABELS, useDrivingPermissions } from '../../lib/drivingPermissions';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const emptyAppointment = { studentDrivingProfileId: '', instructorProfileId: '', vehicleId: '', branchId: '', startsAtUtc: '', endsAtUtc: '', notes: '', meetingPoint: '' };
// Şube listesi yalnız "Şube"/"Kampüs" türü birimleri kapsar.
const BRANCH_UNIT_TYPES = ['şube', 'sube', 'kampüs', 'kampus'];

// hint birkaç alanda zaten geçiliyordu ama basılmıyordu; ipucu satırı burada gösterilir.
function Field({ label, hint, children }) {
  return (
    <label className="space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
function Transmission({ value, setValue }) { return <select className={selectClass} value={value} onChange={(e) => setValue(Number(e.target.value))}><option value={1}>Manuel</option><option value={2}>Otomatik</option></select>; }
function ReadOnlyNotice({ message }) { return <div className="flex items-center gap-2 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4 shrink-0" />{message}</div>; }

/**
 * Backend bir iş kuralına takıldığında hangi override koduyla aşılabileceğini
 * söyler. O kodu taşıyan yönetici burada kuralı bilerek ezebilir — ama gerekçe
 * yazmadan gönderemez, ve işlem audit'e "kural ezildi" olarak düşer.
 */
function OverridePanel({ blocked, reason, setReason, onCancel, onConfirm, saving }) {
  const canSubmit = reason.trim().length >= 10;
  return (
    <div className="sm:col-span-3 space-y-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <b className="text-amber-700 dark:text-amber-400">Bu randevu bir kuralı ihlal ediyor</b>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {blocked.map((code) => <li key={code}>{OVERRIDE_LABELS[code] || code}</li>)}
          </ul>
        </div>
      </div>
      <Field label="Kuralı ezme gerekçesi (zorunlu, en az 10 karakter)">
        <Input value={reason} maxLength={500} placeholder="Ör. Öğrencinin sınavı yarın, muayene randevusu alındı." onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving || !canSubmit} className="bg-amber-600 text-white hover:bg-amber-700" onClick={onConfirm}>
          Gerekçeyle onayla ve kaydet
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Vazgeç</Button>
      </div>
    </div>
  );
}

export default function DrivingScheduling({ embedded = false }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [data, setData] = useState({ students: [], staff: [], profiles: [], instructors: [], packages: [], vehicles: [], appointments: [], requests: [], branches: [] });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [studentForm, setStudentForm] = useState({ studentId: '', packageId: '', licenseClass: 'B', transmissionType: 1 });
  const [instructorForm, setInstructorForm] = useState({ staffId: '', licenseClasses: 'B', canTeachManual: true, canTeachAutomatic: false, workingPermitNo: '', workingPermitExpiresAtUtc: '' });
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [blockedOverrides, setBlockedOverrides] = useState([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [instructorLifecycle, setInstructorLifecycle] = useState(null);

  const canViewStudents = can(DRIVING.studentView);
  const canCreateStudent = can(DRIVING.studentCreate);
  const canViewInstructors = can(DRIVING.instructorView);
  const canCreateInstructor = can(DRIVING.instructorCreate);
  const canUpdateInstructor = can(DRIVING.instructorUpdate);
  const canDeactivateInstructor = can(DRIVING.instructorDeactivate);
  const canOverridePermit = can(DRIVING.overrideDocumentExpiry);
  const canViewAppointments = can(DRIVING.appointmentView);
  const canCreateAppointment = can(DRIVING.appointmentCreate);

  async function saveInstructorLifecycle() {
    if (!instructorLifecycle) return;
    const sensitive = !instructorLifecycle.isActive || (instructorLifecycle.isActive && !instructorLifecycle.complianceReady);
    if (sensitive && instructorLifecycle.reason.trim().length < 10) {
      toast({ title: 'Gerekçe zorunlu', description: 'Bu işlem için en az 10 karakterlik gerekçe yazın.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateDrivingInstructorLifecycle(instructorLifecycle.id, {
        isActive: instructorLifecycle.isActive,
        automaticStatusEnabled: instructorLifecycle.automaticStatusEnabled,
        allowComplianceOverride: instructorLifecycle.isActive && !instructorLifecycle.complianceReady,
        reason: instructorLifecycle.reason,
      });
      toast({ title: 'Öğretmen durumu güncellendi' });
      setInstructorLifecycle(null);
      await load();
    } catch (error) {
      toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [students, staff, profiles, instructors, packages, vehicles, appointments, requests, branches] = await Promise.all([
        canCreateStudent ? fetchStudents() : Promise.resolve([]),
        canCreateInstructor ? fetchStaff('Teacher') : Promise.resolve([]),
        canViewStudents ? fetchDrivingStudents() : Promise.resolve([]),
        canViewInstructors ? fetchDrivingInstructors() : Promise.resolve([]),
        can(DRIVING.packageView) ? fetchDrivingPackages() : Promise.resolve([]),
        can(DRIVING.vehicleView) ? fetchDrivingVehicles() : Promise.resolve([]),
        canViewAppointments ? fetchDrivingAppointments() : Promise.resolve([]),
        canViewAppointments ? fetchDrivingAppointmentRequests() : Promise.resolve([]),
        fetchDrivingBranches().catch(() => []),
      ]);
      setData({
        students: students || [], staff: staff || [], profiles: profiles || [], instructors: instructors || [],
        packages: packages || [], vehicles: vehicles || [], appointments: appointments || [], requests: requests || [],
        branches: (branches || []).filter((x) => BRANCH_UNIT_TYPES.includes(String(x.unitType || '').toLowerCase())),
      });
    } catch (e) { toast({ title: 'Planlama verileri alınamadı', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast, can, canCreateStudent, canCreateInstructor, canViewStudents, canViewInstructors, canViewAppointments]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  const unregisteredStudents = useMemo(() => data.students.filter((s) => !data.profiles.some((p) => p.studentId === s.id)), [data]);
  const unregisteredStaff = useMemo(() => data.staff.filter((s) => !data.instructors.some((p) => p.staffId === s.id)), [data]);
  const selectedPackage = data.packages.find((p) => p.id === studentForm.packageId);
  useEffect(() => { if (selectedPackage) setStudentForm((f) => ({ ...f, licenseClass: selectedPackage.licenseClass, transmissionType: selectedPackage.transmissionType })); }, [selectedPackage]);

  async function run(action, success) { setSaving(true); try { await action(); toast({ title: success }); await load(); return true; } catch (e) { toast({ title: 'İşlem tamamlanamadı', description: e.message, variant: 'destructive' }); return false; } finally { setSaving(false); } }
  const saveStudent = async (e) => { e.preventDefault(); if (await run(() => createDrivingStudent(studentForm), 'Öğrenci sürücü profili oluşturuldu')) setStudentForm({ studentId: '', packageId: '', licenseClass: 'B', transmissionType: 1 }); };
  const saveInstructor = async (e) => {
    e.preventDefault();
    const payload = {
      ...instructorForm,
      licenseClasses: instructorForm.licenseClasses.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean),
      workingPermitNo: instructorForm.workingPermitNo.trim() || null,
      workingPermitExpiresAtUtc: instructorForm.workingPermitExpiresAtUtc ? new Date(`${instructorForm.workingPermitExpiresAtUtc}T23:59:59`).toISOString() : null,
    };
    if (await run(() => createDrivingInstructor(payload), 'Öğretmen yetkinliği kaydedildi')) setInstructorForm({ staffId: '', licenseClasses: 'B', canTeachManual: true, canTeachAutomatic: false, workingPermitNo: '', workingPermitExpiresAtUtc: '' });
  };

  const resetAppointment = () => { setAppointmentForm(emptyAppointment); setBlockedOverrides([]); setOverrideReason(''); setSuggestions(null); };

  // Öğrenci ve saat seçilir seçilmez backend'e "kim gerçekten müsait" diye sorarız:
  // izinli, çalışma saati dışında veya günlük limiti dolmuş öğretmen listeye girmez.
  useEffect(() => {
    const { studentDrivingProfileId, startsAtUtc, endsAtUtc } = appointmentForm;
    if (!canCreateAppointment || !studentDrivingProfileId || !startsAtUtc || !endsAtUtc) {
      setSuggestions(null);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      const params = {
        studentDrivingProfileId,
        startsAtUtc: new Date(startsAtUtc).toISOString(),
        endsAtUtc: new Date(endsAtUtc).toISOString(),
      };
      try {
        const instructors = await suggestDrivingInstructors(params);
        if (!active) return;
        const vehicles = appointmentForm.instructorProfileId
          ? await suggestDrivingVehicles({ ...params, instructorProfileId: appointmentForm.instructorProfileId })
          : [];
        if (!active) return;
        setSuggestions({ instructors: instructors || [], vehicles: vehicles || [] });
      } catch {
        // Öneri alınamazsa formu kilitlemeyiz; backend kaydederken kuralı zaten uygular.
        if (active) setSuggestions(null);
      }
    }, 400);

    return () => { active = false; clearTimeout(timer); };
  }, [
    canCreateAppointment,
    appointmentForm.studentDrivingProfileId,
    appointmentForm.startsAtUtc,
    appointmentForm.endsAtUtc,
    appointmentForm.instructorProfileId,
  ]);

  // İptal ve devamsızlık ders hakkını etkiler (geç iptalde ceza, devamsızlıkta
  // dakika yanar), o yüzden ikisi de gerekçe ister ve sonucu kullanıcıya söyleriz.
  async function runAppointmentAction(action, id) {
    if (action === 'approve') {
      await run(() => approveDrivingAppointment(id), 'Randevu onaylandı');
      return;
    }

    if (action === 'cancel') {
      const reason = window.prompt('İptal nedeni (en az 5 karakter):');
      if (!reason || reason.trim().length < 5) return;
      setSaving(true);
      try {
        const result = await cancelDrivingAppointment(id, reason.trim());
        toast({
          title: 'Randevu iptal edildi',
          description: result.penaltyMinutes > 0
            ? `Geç iptal: ${result.penaltyMinutes} dk ders hakkından düşüldü. Kalan: ${result.remainingMinutes} dk.`
            : `Ders hakkı iade edildi. Kalan: ${result.remainingMinutes} dk.`,
        });
        await load();
      } catch (e) {
        toast({ title: 'İptal edilemedi', description: e.message, variant: 'destructive' });
      } finally { setSaving(false); }
      return;
    }

    if (action === 'no-show') {
      const note = window.prompt('Devamsızlık notu (isteğe bağlı):') ?? '';
      setSaving(true);
      try {
        const result = await markDrivingAppointmentNoShow(id, note);
        toast({
          title: 'Devamsızlık yazıldı',
          description: `${result.penaltyMinutes} dk ders hakkından düşüldü. Kalan: ${result.remainingMinutes} dk.`,
        });
        await load();
      } catch (e) {
        toast({ title: 'Devamsızlık yazılamadı', description: e.message, variant: 'destructive' });
      } finally { setSaving(false); }
    }
  }

  async function submitAppointment(overrides, reason) {
    const payload = {
      ...appointmentForm,
      // Şube seçilmediyse backend kursiyerin kayıtlı olduğu şubeye düşürür.
      branchId: appointmentForm.branchId || null,
      startsAtUtc: new Date(appointmentForm.startsAtUtc).toISOString(),
      endsAtUtc: new Date(appointmentForm.endsAtUtc).toISOString(),
      overrides: overrides.length ? overrides : null,
      overrideReason: overrides.length ? reason : null,
    };
    setSaving(true);
    try {
      await createDrivingAppointment(payload);
      toast({ title: overrides.length ? 'Randevu gerekçeli override ile oluşturuldu' : 'Randevu güvenle oluşturuldu' });
      resetAppointment();
      await load();
    } catch (e) {
      // Kural ihlali override edilebiliyorsa ve kullanıcının o yetkisi varsa
      // hata yerine gerekçe panelini açarız.
      const code = e.body?.overridableWith;
      if (code && can(code) && !blockedOverrides.includes(code)) {
        setBlockedOverrides((prev) => [...prev, code]);
        toast({ title: 'Kural ihlali', description: `${e.message} Yetkiniz var: gerekçe yazarak devam edebilirsiniz.` });
      } else {
        toast({ title: 'Randevu oluşturulamadı', description: e.message, variant: 'destructive' });
      }
    } finally { setSaving(false); }
  }

  const saveAppointment = async (e) => { e.preventDefault(); await submitAppointment([], ''); };

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;

  return <div className="space-y-6">
    {!embedded && <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold font-heading tracking-tight">Öğrenci, Öğretmen ve Randevu</h1><p className="text-muted-foreground">Uyumluluk ve çakışma kontrolleri backend tarafından zorunlu uygulanır.</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button></div>}

    <div className="grid gap-5 xl:grid-cols-2">
      {canViewStudents && <Card><CardHeader><CardTitle className="flex gap-2"><GraduationCap className="text-violet-500" />Öğrenci Sürücü Profili</CardTitle></CardHeader><CardContent>
        {canCreateStudent
          ? <form onSubmit={saveStudent} className="grid gap-3 sm:grid-cols-2"><Field label="Öğrenci"><select required className={selectClass} value={studentForm.studentId} onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}><option value="">Seçin</option>{unregisteredStudents.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></Field><Field label="Paket"><select required className={selectClass} value={studentForm.packageId} onChange={(e) => setStudentForm({ ...studentForm, packageId: e.target.value })}><option value="">Seçin</option>{data.packages.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name} • {p.licenseClass}</option>)}</select></Field><Field label="Ehliyet sınıfı"><Input readOnly value={studentForm.licenseClass} /></Field><Field label="Vites"><Transmission value={studentForm.transmissionType} setValue={(v) => setStudentForm({ ...studentForm, transmissionType: v })} /></Field><Button disabled={saving || !unregisteredStudents.length} className="sm:col-span-2"><Plus className="mr-2 h-4 w-4" />Profil Oluştur</Button></form>
          : <ReadOnlyNotice message="Öğrenci kaydı oluşturmak için yetkiniz yok; listeyi görüntüleyebilirsiniz." />}
        <div className="mt-5 space-y-2">{data.profiles.map((p) => <button type="button" key={p.id} onClick={() => navigate(`/driving/students/${p.id}`)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left transition hover:border-violet-500/50 hover:bg-muted/40"><div><b>{p.fullName}</b><p className="text-xs text-muted-foreground">{p.licenseClass} • {p.transmissionType === 'Manual' ? 'Manuel' : 'Otomatik'} • {p.status}</p></div><Badge variant="outline">{p.remainingDrivingMinutes} dk kaldı</Badge></button>)}</div>
      </CardContent></Card>}

      {canViewInstructors && <Card><CardHeader><CardTitle className="flex gap-2"><UserRoundCheck className="text-emerald-500" />Öğretmen Yetkinliği</CardTitle></CardHeader><CardContent>
        {canCreateInstructor
          ? <form onSubmit={saveInstructor} className="grid gap-3 sm:grid-cols-2"><Field label="Öğretmen"><select required className={selectClass} value={instructorForm.staffId} onChange={(e) => setInstructorForm({ ...instructorForm, staffId: e.target.value })}><option value="">Seçin</option>{unregisteredStaff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></Field><Field label="Ehliyet sınıfları"><Input required placeholder="B, BE" value={instructorForm.licenseClasses} onChange={(e) => setInstructorForm({ ...instructorForm, licenseClasses: e.target.value })} /></Field><Field label="MEB çalışma izni no" hint="Takip edilecekse izin no ve bitiş tarihini birlikte girin."><Input maxLength={60} placeholder="Henüz takip edilmiyorsa boş bırakın" value={instructorForm.workingPermitNo} onChange={(e) => setInstructorForm({ ...instructorForm, workingPermitNo: e.target.value })} /></Field><Field label="Çalışma izni bitiş tarihi" hint="Süresi dolunca öğretmen randevu listesinden otomatik çıkar."><Input type="date" value={instructorForm.workingPermitExpiresAtUtc} onChange={(e) => setInstructorForm({ ...instructorForm, workingPermitExpiresAtUtc: e.target.value })} /></Field><label className="flex items-center gap-2"><input type="checkbox" checked={instructorForm.canTeachManual} onChange={(e) => setInstructorForm({ ...instructorForm, canTeachManual: e.target.checked })} />Manuel</label><label className="flex items-center gap-2"><input type="checkbox" checked={instructorForm.canTeachAutomatic} onChange={(e) => setInstructorForm({ ...instructorForm, canTeachAutomatic: e.target.checked })} />Otomatik</label><Button disabled={saving || !unregisteredStaff.length} className="sm:col-span-2"><Plus className="mr-2 h-4 w-4" />Yetkinlik Ekle</Button></form>
          : <ReadOnlyNotice message="Öğretmen yetkinliği tanımlamak için yetkiniz yok." />}
        <div className="mt-5 space-y-2">{data.instructors.map((p) => <div key={p.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><b>{p.fullName}</b><Badge className={p.isActive ? 'border-0 bg-emerald-500/15 text-emerald-600' : 'border-0 bg-slate-500/15 text-slate-600'}>{p.isActive ? 'Aktif' : 'Pasif'}</Badge>{p.complianceOverrideActive && <Badge className="border-0 bg-amber-500/15 text-amber-700">Yetkili istisna</Badge>}{p.workingPermitExpired && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-600">Çalışma izni doldu</span>}</div><p className="text-xs text-muted-foreground">{p.licenseClasses} • {[p.canTeachManual && 'Manuel', p.canTeachAutomatic && 'Otomatik'].filter(Boolean).join(' / ')}{p.workingPermitExpiresAtUtc ? ` • İzin bitişi: ${new Date(p.workingPermitExpiresAtUtc).toLocaleDateString('tr-TR')}` : ' • Çalışma izni tarihi girilmemiş'} • {p.automaticStatusEnabled ? 'Otomatik yönetim' : 'Manuel yönetim'}</p></div>{canUpdateInstructor && <Button type="button" size="sm" variant="outline" onClick={() => setInstructorLifecycle({ ...p, automaticStatusEnabled: p.automaticStatusEnabled !== false, reason: '' })}>Durumu yönet</Button>}</div></div>)}</div>
      </CardContent></Card>}
    </div>

    <Dialog open={!!instructorLifecycle} onOpenChange={(open) => !open && setInstructorLifecycle(null)}><DialogContent><DialogHeader><DialogTitle>Öğretmen yaşam döngüsü</DialogTitle></DialogHeader>{instructorLifecycle && <div className="space-y-4"><div className={`rounded-xl border p-3 text-sm ${instructorLifecycle.complianceReady ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><b>{instructorLifecycle.complianceReady ? (instructorLifecycle.workingPermitExpiresAtUtc ? 'Çalışma izni geçerli' : 'Çalışma izni takibi henüz başlatılmamış') : 'Çalışma izni bilgisi eksik veya süresi geçmiş'}</b></div><label className="flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" className="mt-1" checked={instructorLifecycle.automaticStatusEnabled} onChange={(e) => setInstructorLifecycle({ ...instructorLifecycle, automaticStatusEnabled: e.target.checked })} /><span><b>Otomatik yönetim</b><small className="block text-muted-foreground">İzin takibi açıldıysa geçerli belgeyle aktif, eksik/süresi geçmiş belgeyle pasif tutulur.</small></span></label>{!instructorLifecycle.automaticStatusEnabled && <><label className="flex items-center gap-2"><input type="checkbox" checked={instructorLifecycle.isActive} disabled={!instructorLifecycle.isActive && !canDeactivateInstructor && instructorLifecycle.isActive} onChange={(e) => setInstructorLifecycle({ ...instructorLifecycle, isActive: e.target.checked })} />Direksiyon öğretmeni aktif</label>{instructorLifecycle.isActive && !instructorLifecycle.complianceReady && <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><b>Yetkili istisna gerekir</b><p className="text-muted-foreground">{canOverridePermit ? 'Gerekçe ile aktif edilebilir.' : 'Bu işlem için çalışma izni istisna yetkiniz yok.'}</p></div>}<Field label="Gerekçe"><Input maxLength={500} value={instructorLifecycle.reason} onChange={(e) => setInstructorLifecycle({ ...instructorLifecycle, reason: e.target.value })} /></Field></>}</div>}<DialogFooter><Button variant="outline" onClick={() => setInstructorLifecycle(null)}>Vazgeç</Button><Button disabled={saving || (!instructorLifecycle?.automaticStatusEnabled && instructorLifecycle?.isActive && !instructorLifecycle?.complianceReady && !canOverridePermit)} onClick={saveInstructorLifecycle}>Kaydet</Button></DialogFooter></DialogContent></Dialog>

    {canViewAppointments && <Card><CardHeader><CardTitle className="flex gap-2"><CalendarClock className="text-[hsl(var(--brand-accent))]" />Direksiyon Randevusu</CardTitle></CardHeader><CardContent>
      {canCreateAppointment
        ? <form onSubmit={saveAppointment} className="grid gap-3 md:grid-cols-3">
            <Field label="Öğrenci"><select required className={selectClass} value={appointmentForm.studentDrivingProfileId} onChange={(e) => setAppointmentForm({ ...appointmentForm, studentDrivingProfileId: e.target.value })}><option value="">Seçin</option>{data.profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName} • {p.licenseClass}</option>)}</select></Field>
            <Field label="Başlangıç"><Input required type="datetime-local" value={appointmentForm.startsAtUtc} onChange={(e) => setAppointmentForm({ ...appointmentForm, startsAtUtc: e.target.value, instructorProfileId: '', vehicleId: '' })} /></Field>
            <Field label="Bitiş"><Input required type="datetime-local" value={appointmentForm.endsAtUtc} onChange={(e) => setAppointmentForm({ ...appointmentForm, endsAtUtc: e.target.value, instructorProfileId: '', vehicleId: '' })} /></Field>

            {/* Filo tüm şubelerde ortaktır; şube yalnız dersin hangi şubeye yazılacağını belirler. */}
            {data.branches.length > 0 && (
              <Field label="Dersi veren şube" hint="Boş bırakılırsa kursiyerin şubesine yazılır">
                <select className={selectClass} value={appointmentForm.branchId} onChange={(e) => setAppointmentForm({ ...appointmentForm, branchId: e.target.value })}>
                  <option value="">Kursiyerin şubesi</option>
                  {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}

            {/* Saat seçilince listeler daralır: burada görünen herkes o saatte gerçekten müsait. */}
            <Field
              label="Öğretmen"
              hint={suggestions ? `${suggestions.instructors.length} öğretmen bu saatte uygun` : 'Önce öğrenci ve saat seçin'}
            >
              <select
                required
                className={selectClass}
                value={appointmentForm.instructorProfileId}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, instructorProfileId: e.target.value, vehicleId: '' })}
              >
                <option value="">Seçin</option>
                {(suggestions ? suggestions.instructors.map((x) => ({ id: x.instructorProfileId, fullName: x.fullName })) : data.instructors.filter((x) => x.isActive !== false))
                  .map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </Field>

            <Field
              label="Araç"
              hint={suggestions && appointmentForm.instructorProfileId
                ? `${suggestions.vehicles.length} araç uygun ve öğretmene atanmış`
                : 'Öğretmen seçince uygun araçlar listelenir'}
            >
              <select
                required
                className={selectClass}
                value={appointmentForm.vehicleId}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, vehicleId: e.target.value })}
              >
                <option value="">Seçin</option>
                {(suggestions && appointmentForm.instructorProfileId
                  ? suggestions.vehicles.map((x) => ({ id: x.vehicleId, plateNumber: x.plateNumber, licenseClass: x.assignmentType }))
                  : data.vehicles.filter((v) => v.isActive && !v.isInMaintenance))
                  .map((v) => <option key={v.id} value={v.id}>{v.plateNumber} • {v.licenseClass}</option>)}
              </select>
            </Field>
            <Field label="Not"><Input value={appointmentForm.notes} maxLength={1000} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} /></Field>
            <Field label="Buluşma noktası"><Input value={appointmentForm.meetingPoint} maxLength={200} placeholder="Ör. Kurs önü" onChange={(e) => setAppointmentForm({ ...appointmentForm, meetingPoint: e.target.value })} /></Field>
            {blockedOverrides.length > 0 && (
              <OverridePanel
                blocked={blockedOverrides}
                reason={overrideReason}
                setReason={setOverrideReason}
                saving={saving}
                onCancel={() => { setBlockedOverrides([]); setOverrideReason(''); }}
                onConfirm={() => submitAppointment(blockedOverrides, overrideReason)}
              />
            )}
            <Button disabled={saving} className="md:col-span-3 bg-brand-primary text-white hover:bg-brand-primary/90"><Plus className="mr-2 h-4 w-4" />Randevu Oluştur</Button>
          </form>
        : <ReadOnlyNotice message="Randevuları görüntüleyebilirsiniz; randevu oluşturmak için yetkiniz yok." />}
      {data.requests.some((x) => x.status === 'Pending') && <div className="mt-6 space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="font-black">Bekleyen mobil randevu talepleri</h3>
        {data.requests.filter((x) => x.status === 'Pending').map((request) => <div key={request.id} className="flex flex-col justify-between gap-3 rounded-xl bg-background p-3 sm:flex-row sm:items-center">
          <div><b>{request.fullName}</b><p className="text-sm">{request.requestType === 'Reschedule' ? 'Yeniden planlama' : 'Yeni randevu'} • {new Date(request.requestedStartsAtUtc).toLocaleString('tr-TR')}</p><p className="text-xs text-muted-foreground">{request.studentNote || 'Not yok'}</p></div>
          {can(DRIVING.appointmentApprove) && <div className="flex gap-2"><Button size="sm" disabled={saving} onClick={() => run(() => decideDrivingAppointmentRequest(request.id, { approved: true, instructorProfileId: null, vehicleId: null, note: 'Uygun öğretmen ve araç otomatik atandı.' }), 'Randevu talebi onaylandı')}>Onayla</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => { const note = window.prompt('Ret nedeni (en az 5 karakter):'); if (note?.trim().length >= 5) run(() => decideDrivingAppointmentRequest(request.id, { approved: false, note }), 'Randevu talebi reddedildi'); }}>Reddet</Button></div>}
        </div>)}
      </div>}
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.appointments.map((a) => (
          <AppointmentCard
            key={a.id}
            appointment={a}
            saving={saving}
            can={can}
            onAction={runAppointmentAction}
            onReschedule={(id) => setRescheduleTarget(id)}
          />
        ))}
      </div>
    </CardContent></Card>}

    {rescheduleTarget && (
      <RescheduleDialog
        saving={saving}
        onClose={() => setRescheduleTarget(null)}
        onSubmit={async (payload) => {
          const ok = await run(() => rescheduleDrivingAppointment(rescheduleTarget, payload), 'Randevu yeniden planlandı');
          if (ok) setRescheduleTarget(null);
        }}
      />
    )}
  </div>;
}

const APPOINTMENT_STATUS = {
  Draft: { label: 'Taslak', tone: 'bg-slate-500' },
  Requested: { label: 'Talep edildi', tone: 'bg-sky-500' },
  WaitingApproval: { label: 'Onay bekliyor', tone: 'bg-amber-500' },
  Planned: { label: 'Planlandı', tone: 'bg-blue-500' },
  Approved: { label: 'Onaylandı', tone: 'bg-emerald-500' },
  CheckedIn: { label: 'Buluşuldu', tone: 'bg-violet-500' },
  InProgress: { label: 'Ders sürüyor', tone: 'bg-[hsl(var(--brand-accent))]' },
  Completed: { label: 'Tamamlandı', tone: 'bg-emerald-600' },
  Cancelled: { label: 'İptal', tone: 'bg-red-500' },
  CancelledByStudent: { label: 'Öğrenci iptal etti', tone: 'bg-red-500' },
  CancelledByInstructor: { label: 'Öğretmen iptal etti', tone: 'bg-red-500' },
  CancelledByInstitution: { label: 'Kurum iptal etti', tone: 'bg-red-500' },
  NoShow: { label: 'Gelmedi', tone: 'bg-rose-600' },
  Rescheduled: { label: 'Yeniden planlandı', tone: 'bg-indigo-500' },
  Suspended: { label: 'Askıda', tone: 'bg-slate-500' },
};

// Yalnızca takvimde yer tutan randevulara müdahale edilebilir; başlamış ders
// iptal edilmez (tamamlanır veya devamsızlık yazılır).
const OPEN_STATUSES = ['Requested', 'WaitingApproval', 'Planned', 'Approved', 'CheckedIn'];

function AppointmentCard({ appointment, saving, can, onAction, onReschedule }) {
  const status = APPOINTMENT_STATUS[appointment.status] || { label: appointment.status, tone: 'bg-muted' };
  const isOpen = OPEN_STATUSES.includes(appointment.status);
  const started = new Date(appointment.startsAtUtc) <= new Date();

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex justify-between gap-2">
        <b>{appointment.studentName}</b>
        <Badge className={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-1 text-sm">{appointment.instructorName} • {appointment.vehiclePlate}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {new Date(appointment.startsAtUtc).toLocaleString('tr-TR')} – {new Date(appointment.endsAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </p>

      {isOpen && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {appointment.status !== 'Approved' && can(DRIVING.appointmentApprove) && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => onAction('approve', appointment.id)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Onayla
            </Button>
          )}
          {can(DRIVING.appointmentReschedule) && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => onReschedule(appointment.id)}>
              <CalendarClock className="mr-1 h-3.5 w-3.5" />Ertele
            </Button>
          )}
          {can(DRIVING.appointmentCancel) && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => onAction('cancel', appointment.id)}>
              <XCircle className="mr-1 h-3.5 w-3.5" />İptal
            </Button>
          )}
          {started && can(DRIVING.lessonMarkNoShow) && (
            <Button size="sm" variant="outline" disabled={saving} className="text-rose-600" onClick={() => onAction('no-show', appointment.id)}>
              <UserX className="mr-1 h-3.5 w-3.5" />Gelmedi
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RescheduleDialog({ saving, onClose, onSubmit }) {
  const [form, setForm] = useState({ startsAtUtc: '', endsAtUtc: '', reason: '' });
  const valid = form.startsAtUtc && form.endsAtUtc && form.reason.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle className="flex gap-2"><CalendarClock className="text-indigo-500" />Randevuyu Yeniden Planla</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Eski randevu "yeniden planlandı" olarak kapanır, ders hakkı yeni randevuya devreder — hak yanmaz.
          </p>
          <Field label="Yeni başlangıç"><Input type="datetime-local" value={form.startsAtUtc} onChange={(e) => setForm({ ...form, startsAtUtc: e.target.value })} /></Field>
          <Field label="Yeni bitiş"><Input type="datetime-local" value={form.endsAtUtc} onChange={(e) => setForm({ ...form, endsAtUtc: e.target.value })} /></Field>
          <Field label="Gerekçe (en az 5 karakter)"><Input maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button
              disabled={saving || !valid}
              onClick={() => onSubmit({
                startsAtUtc: new Date(form.startsAtUtc).toISOString(),
                endsAtUtc: new Date(form.endsAtUtc).toISOString(),
                reason: form.reason,
              })}
            >
              Yeniden Planla
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
