import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, CreditCard, Download,
  FileCheck2, FileSignature, Gauge, History, Plus, Receipt, RefreshCw, StickyNote, TrendingUp, Upload, UserRoundCheck, Wrench, XCircle,
} from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  addDrivingExtraMinutes, adjustDrivingLedger, createDrivingAppointment, createDrivingCharge,
  downloadDrivingStudentForm, downloadDrivingStudentDocument, fetchDrivingBranches, fetchDrivingCharges, fetchDrivingLedger,
  fetchDrivingStudentDetail, fetchDrivingMebbisHistory, recordDrivingPayment, reviewDrivingStudentDocument,
  suggestDrivingInstructors, suggestDrivingVehicles, updateDrivingExamFees, updateDrivingStudentStatus,
  uploadDrivingStudentDocument, uploadFile,
} from '../../lib/api/modules';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';
import { maskTrPhone } from '../../lib/inputMasks';
import { createTypedDocumentUrl } from '../../lib/fileMime';
import { FileButton } from '../../components/ui/file-button';
import {
  DRIVING_EVALUATION_CATEGORIES, DRIVING_EVALUATION_CRITERIA, downloadDrivingEvaluationCsv,
  evaluationScores, lessonAverage,
} from '../../lib/drivingEvaluation';

const CHARGE_TYPES = [
  { value: 'ExtraLesson', label: 'Ek direksiyon dersi' },
  { value: 'ExamFee', label: 'Sınav ücreti' },
  { value: 'FileFee', label: 'Dosya masrafı' },
  { value: 'ExtraService', label: 'Ek hizmet' },
  { value: 'PackageDifference', label: 'Paket/vites farkı' },
  { value: 'Other', label: 'Diğer ücret' },
];

const LEDGER_LABELS = {
  PackageMinutes: 'Paket hakkı',
  PlannedMinutes: 'Randevu için ayrıldı',
  ReservationReleased: 'Rezervasyon çözüldü',
  LessonUsage: 'Yapılan ders',
  ExtraPurchasedMinutes: 'Ek satın alma',
  NoShowDeductedMinutes: 'Devamsızlık kesintisi',
  CancelledDeductedMinutes: 'Geç iptal cezası',
  RefundedMinutes: 'İade',
  ManualAdjustmentMinutes: 'Elle düzeltme',
};

const STATUS_LABELS = {
  PreRegistered: 'Ön kayıt', DocumentsPending: 'Evrak bekliyor', Active: 'Aktif',
  TheoryOngoing: 'Teorik eğitimde', PracticeOngoing: 'Direksiyonda', ExamPending: 'Sınav bekliyor',
  GraduationPending: 'Mezuniyet onayında', Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal',
};

const DOCUMENT_STATUS = {
  Missing: { label: 'Eksik', tone: 'bg-red-500' },
  PendingApproval: { label: 'Onay bekliyor', tone: 'bg-amber-500' },
  Approved: { label: 'Onaylı', tone: 'bg-emerald-500' },
  Rejected: { label: 'Reddedildi', tone: 'bg-red-500' },
  ReuploadRequested: { label: 'Yeniden yükleme istendi', tone: 'bg-orange-500' },
  Expired: { label: 'Süresi doldu', tone: 'bg-[hsl(var(--brand-accent))]' },
};

const MEBBIS_EVENT_LABELS = {
  Preparation: 'Hazırlık', DocumentReview: 'Evrak', CandidateEntry: 'Aday kaydı', Verification: 'Doğrulama',
  ExamResult: 'Sınav sonucu', CertificateNumber: 'Sertifika', Correction: 'Düzeltme', Import: 'Geri aktarım', StatusChange: 'Durum',
};

const minutes = (value) => `${Math.round(Number(value || 0))} dk`;
const money = (value) => `₺${Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('tr-TR') : '—');
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '—');

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl border p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-2xl font-black ${tone || ''}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right">{value || '—'}</b>
    </div>
  );
}

const apptSelectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const DURATIONS = [30, 45, 60, 90, 120];

/**
 * Öğrenci sayfasından ayrılmadan bu kursiyere randevu/ders açar. Müsait öğretmen
 * ve araç backend'den önerilir; çakışma/uygunluk kuralları kayıtta yeniden
 * zorlanır (override yetkisi varsa gerekçeyle geçilebilir).
 */
function AppointmentModal({ profileId, studentName, canOverride, onClose, onCreated }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), time: '', duration: 60, instructorProfileId: '', vehicleId: '', meetingPoint: '', notes: '' });
  const [suggestions, setSuggestions] = useState(null);
  const [blockedOverrides, setBlockedOverrides] = useState([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch) => setForm((x) => ({ ...x, ...patch }));

  const startLocal = form.date && form.time ? new Date(`${form.date}T${form.time}`) : null;
  const endLocal = startLocal ? new Date(startLocal.getTime() + form.duration * 60000) : null;

  // Öğretmen/araç önerileri: saat seçilince backend'e "kim müsait" diye sorulur.
  useEffect(() => {
    if (!startLocal || !endLocal) { setSuggestions(null); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      const params = { studentDrivingProfileId: profileId, startsAtUtc: startLocal.toISOString(), endsAtUtc: endLocal.toISOString() };
      try {
        const instructors = await suggestDrivingInstructors(params);
        if (!active) return;
        const vehicles = form.instructorProfileId
          ? await suggestDrivingVehicles({ ...params, instructorProfileId: form.instructorProfileId })
          : [];
        if (active) setSuggestions({ instructors: instructors || [], vehicles: vehicles || [] });
      } catch {
        if (active) setSuggestions(null);
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, form.date, form.time, form.duration, form.instructorProfileId]);

  async function submit() {
    if (!startLocal || !endLocal) { toast({ title: 'Tarih ve saat seçin', variant: 'destructive' }); return; }
    if (!form.instructorProfileId || !form.vehicleId) { toast({ title: 'Öğretmen ve araç seçin', variant: 'destructive' }); return; }
    if (blockedOverrides.length && overrideReason.trim().length < 10) { toast({ title: 'Override gerekçesi en az 10 karakter olmalı', variant: 'destructive' }); return; }
    const payload = {
      studentDrivingProfileId: profileId,
      instructorProfileId: form.instructorProfileId,
      vehicleId: form.vehicleId,
      startsAtUtc: startLocal.toISOString(),
      endsAtUtc: endLocal.toISOString(),
      meetingPoint: form.meetingPoint.trim(),
      notes: form.notes.trim(),
      overrides: blockedOverrides.length ? blockedOverrides : null,
      overrideReason: blockedOverrides.length ? overrideReason.trim() : null,
    };
    setSaving(true);
    try {
      await createDrivingAppointment(payload);
      toast({ title: blockedOverrides.length ? 'Randevu gerekçeli override ile oluşturuldu' : 'Randevu oluşturuldu' });
      onCreated();
    } catch (e) {
      const code = e.body?.overridableWith;
      if (code && canOverride(code) && !blockedOverrides.includes(code)) {
        setBlockedOverrides((prev) => [...prev, code]);
        toast({ title: 'Kural ihlali', description: `${e.message} Yetkiniz var: gerekçe yazarak devam edin.` });
      } else {
        toast({ title: 'Randevu oluşturulamadı', description: e.message, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Randevu oluştur — {studentName}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-bold"><span>Tarih</span><Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></label>
          <label className="space-y-1 text-xs font-bold"><span>Saat</span><Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} /></label>
          <label className="space-y-1 text-xs font-bold">
            <span>Süre</span>
            <select className={apptSelectClass} value={form.duration} onChange={(e) => set({ duration: Number(e.target.value) })}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} dk</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>Öğretmen {suggestions && `(${suggestions.instructors.length} müsait)`}</span>
            <select className={apptSelectClass} value={form.instructorProfileId} onChange={(e) => set({ instructorProfileId: e.target.value, vehicleId: '' })} disabled={!suggestions}>
              <option value="">{suggestions ? 'Seçin' : 'Önce saat seçin'}</option>
              {suggestions?.instructors.map((i) => <option key={i.instructorProfileId} value={i.instructorProfileId}>{i.fullName}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>Araç {suggestions?.vehicles && form.instructorProfileId && `(${suggestions.vehicles.length} müsait)`}</span>
            <select className={apptSelectClass} value={form.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })} disabled={!form.instructorProfileId}>
              <option value="">{form.instructorProfileId ? 'Seçin' : 'Önce öğretmen seçin'}</option>
              {suggestions?.vehicles.map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.plateNumber}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold"><span>Buluşma noktası</span><Input value={form.meetingPoint} onChange={(e) => set({ meetingPoint: e.target.value })} /></label>
          <label className="space-y-1 text-xs font-bold sm:col-span-2"><span>Not</span><Input maxLength={1000} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          {startLocal && endLocal && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {startLocal.toLocaleString('tr-TR')} – {endLocal.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {blockedOverrides.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 sm:col-span-2">
              <b className="text-xs text-amber-700 dark:text-amber-400">Kural ihlal ediliyor — gerekçe zorunlu</b>
              <Input className="mt-2" maxLength={500} placeholder="En az 10 karakter" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Randevu Oluştur'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DrivingStudentDetail() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();

  const [data, setData] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [charges, setCharges] = useState([]);
  const [mebbisHistory, setMebbisHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  // Sekme durumu bileşen dışında tutulur; yeniden yüklemede sıfırlanmasın.
  const [activeTab, setActiveTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Nakit', financeInstallmentId: '', branchId: '' });
  const [branches, setBranches] = useState([]);
  const [chargeForm, setChargeForm] = useState({ chargeType: 'ExtraLesson', grossAmount: '', minutes: '', description: '' });
  const [examFeeDraft, setExamFeeDraft] = useState(null); // null = görüntüleme, obje = düzenleme
  const [savingFees, setSavingFees] = useState(false);
  const [docPreview, setDocPreview] = useState(null); // { item, url, kind, loading }
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleForm, setLifecycleForm] = useState({ status: 'Active', automaticStatusEnabled: true, allowIncompleteDocuments: false, reason: '' });

  const canReview = can(DRIVING.studentDocumentReview);
  const canUpload = can(DRIVING.studentDocumentUpload);
  const canUpdate = can(DRIVING.studentUpdate);
  const canDeactivate = can(DRIVING.studentDeactivate);
  const canOverrideDocuments = can(DRIVING.overrideStudentDocuments);
  const canAdjustBalance = can(DRIVING.lessonBalanceAdjust);
  const canCollect = can(DRIVING.financeCollect);
  const canCreateAppointment = can(DRIVING.appointmentCreate);
  const [apptOpen, setApptOpen] = useState(false);

  // İlk açılışta tam ekran yükleme gösterilir; sonraki yenilemelerde ekran
  // sökülmez. Aksi halde (ör. evrak yüklendikten sonra) sekme ağacı unmount olup
  // "Genel bakış"a dönüyor ve kullanıcı her belge için sekmeyi yeniden açıyordu.
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [detail, ledgerState, chargeList, mebbisTimeline] = await Promise.all([
        fetchDrivingStudentDetail(profileId),
        // Mutabakat ve ücret kalemleri yalnızca yetkisi olana gösterilir; hata sessiz geçilir.
        fetchDrivingLedger(profileId).catch(() => null),
        fetchDrivingCharges(profileId).catch(() => []),
        fetchDrivingMebbisHistory(profileId, { pageSize: 100 }).catch(() => ({ items: [] })),
      ]);
      setData(detail);
      setReconciliation(ledgerState?.reconciliation ?? null);
      setCharges(chargeList || []);
      setMebbisHistory(mebbisTimeline?.items || []);
    } catch (error) {
      toast({ title: 'Kursiyer dosyası açılamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [profileId, toast]);

  async function submitPayment(event) {
    event.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) return;
    if (await run(() => recordDrivingPayment(profileId, {
      amount,
      method: paymentForm.method,
      financeInstallmentId: paymentForm.financeInstallmentId || null,
      branchId: paymentForm.branchId || null,
    }), 'Tahsilat kaydedildi')) {
      setPaymentForm({ amount: '', method: paymentForm.method, financeInstallmentId: '', branchId: '' });
    }
  }

  async function submitCharge(event) {
    event.preventDefault();
    const grossAmount = Number(chargeForm.grossAmount);
    if (!grossAmount || grossAmount <= 0) return;
    const minutes = chargeForm.chargeType === 'ExtraLesson' ? Number(chargeForm.minutes) : 0;
    if (chargeForm.chargeType === 'ExtraLesson' && (!minutes || minutes < 1)) {
      toast({ title: 'Süre gerekli', description: 'Ek direksiyon dersinde eklenecek dakikayı yazın.', variant: 'destructive' });
      return;
    }
    const ok = await run(
      () => createDrivingCharge(profileId, {
        chargeType: chargeForm.chargeType,
        grossAmount,
        discountAmount: 0,
        minutes,
        description: chargeForm.description,
      }),
      minutes > 0 ? `Ek ders satıldı, ${minutes} dk eklendi` : 'Ücret kalemi eklendi',
    );
    if (ok) setChargeForm({ chargeType: chargeForm.chargeType, grossAmount: '', minutes: '', description: '' });
  }

  async function addExtraMinutes() {
    const raw = window.prompt('Eklenecek ek direksiyon süresi (dakika):');
    const minutes = Number(raw);
    if (!minutes || minutes < 1) return;
    await run(() => addDrivingExtraMinutes(profileId, { minutes, note: 'Detay ekranından eklendi' }), `${minutes} dk ek ders hakkı eklendi`);
  }

  async function adjustBalance() {
    const raw = window.prompt('Düzeltme (dakika, eksi için "-" kullanın):');
    const minutesDelta = Number(raw);
    if (!minutesDelta) return;
    const reason = window.prompt('Gerekçe (en az 10 karakter, audit kaydına yazılır):');
    if (!reason || reason.trim().length < 10) {
      toast({ title: 'Gerekçe zorunlu', description: 'Elle düzeltme en az 10 karakterlik gerekçe ister.', variant: 'destructive' });
      return;
    }
    await run(
      () => adjustDrivingLedger(profileId, { minutesDelta, reason: reason.trim(), isRefund: false }),
      'Ders hakkı düzeltildi',
    );
  }

  async function saveExamFees() {
    if (!examFeeDraft) return;
    setSavingFees(true);
    try {
      await updateDrivingExamFees(profileId, {
        theoryExamFee: 0,
        drivingExamFee: Number(examFeeDraft.drivingExamFee) || 0,
        theoryExamFeePaid: false,
        drivingExamFeePaid: !!examFeeDraft.drivingExamFeePaid,
        drivingExamDate: examFeeDraft.drivingExamDate ? new Date(examFeeDraft.drivingExamDate).toISOString() : null,
      });
      toast({ title: 'Sınav ücretleri güncellendi' });
      setExamFeeDraft(null);
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'Güncellenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSavingFees(false);
    }
  }

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);
  useEffect(() => { if (canCollect) fetchDrivingBranches().then((b) => setBranches(b || [])).catch(() => {}); }, [canCollect]);

  // Resmî formlar (PDF): kapak formu, direksiyon eğitim kartı, devam çizelgesi.
  async function downloadForm(formKey, label) {
    try {
      const blob = await downloadDrivingStudentForm(profileId, formKey);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${label}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Form indirilemedi', description: error.message, variant: 'destructive' });
    }
  }

  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function saveLifecycle() {
    const sensitive = ['Suspended', 'Cancelled'].includes(lifecycleForm.status)
      || (!overview.documentsComplete && lifecycleForm.allowIncompleteDocuments);
    if (sensitive && lifecycleForm.reason.trim().length < 10) {
      toast({ title: 'Gerekçe zorunlu', description: 'Bu işlem için en az 10 karakterlik gerekçe yazın.', variant: 'destructive' });
      return;
    }
    await run(() => updateDrivingStudentStatus(profileId, lifecycleForm), 'Kursiyer yaşam döngüsü güncellendi');
    setLifecycleOpen(false);
  }

  async function uploadDocument(documentType, file) {
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const upload = await uploadFile(formData, 'driving-student-documents');
      await uploadDrivingStudentDocument(profileId, {
        documentType,
        fileUrl: upload.fileUrl,
        fileName: file.name,
      });
      toast({ title: 'Belge yüklendi, onay bekliyor' });
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'Belge yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // Tauri webview'inde window.open(blob) çalışmıyor; belgeyi doğrudan ekrandaki modalda gösteriyoruz.
  async function openDocument(item) {
    setDocPreview({ item, url: null, kind: null, loading: true });
    try {
      const blob = await downloadDrivingStudentDocument(item.id);
      // MIME'i dosya adından zorla: Tauri blob'u türsüz gelirse iframe/img boş çıkar.
      const { url, kind } = await createTypedDocumentUrl(blob, item.fileName);
      setDocPreview({ item, url, kind, loading: false });
    } catch (error) {
      setDocPreview(null);
      toast({ title: 'Belge açılamadı', description: error.message, variant: 'destructive' });
    }
  }

  function closeDocPreview() {
    setDocPreview((current) => { if (current?.url) URL.revokeObjectURL(current.url); return null; });
  }

  function downloadDocPreview() {
    if (!docPreview?.url) return;
    const anchor = document.createElement('a');
    anchor.href = docPreview.url;
    anchor.download = docPreview.item.fileName || `${docPreview.item.label || 'belge'}.dat`;
    anchor.click();
  }

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;
  if (!data) return null;

  const { overview, training, appointments, lessons, ledger, documents, finance, history, mebbisMissing, examRights } = data;
  const trendData = [...lessons]
    .filter((lesson) => lesson.completedAtUtc && lessonAverage(lesson) != null)
    .sort((a, b) => new Date(a.startedAtUtc) - new Date(b.startedAtUtc))
    .map((lesson, index) => ({
      ...lesson,
      ders: index + 1,
      tarih: new Date(lesson.startedAtUtc).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      genel: Number(lessonAverage(lesson).toFixed(2)),
    }));
  const exportEvaluations = () => {
    downloadDrivingEvaluationCsv(
      `${overview.fullName}-surus-gelisim-raporu.csv`.toLocaleLowerCase('tr-TR').replaceAll(' ', '-'),
      lessons.map((lesson) => ({ ...lesson, studentName: overview.fullName })),
    );
    toast({ title: 'Öğrenci gelişim raporu indirildi', description: `${lessons.length} dersin ayrıntılı kriterleri CSV dosyasına eklendi.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/driving/students')}><ArrowLeft className="h-4 w-4" /></Button>
          {(overview.livePhotoUrl || overview.photoUrl)
            ? <img src={assetUrl(overview.livePhotoUrl || overview.photoUrl)} alt={overview.fullName} className="h-16 w-16 rounded-2xl object-cover" />
            : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-xl font-black">{overview.fullName?.[0]}</div>}
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold font-heading tracking-tight">
              {overview.fullName}
              {overview.studentNumber != null && <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-sm font-black text-brand-primary">No: {overview.studentNumber}</span>}
            </h1>
            <p className="text-muted-foreground">
              {overview.packageName} • {overview.licenseClass} • {overview.transmissionType === 'Manual' ? 'Manuel' : 'Otomatik'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="border-0 bg-violet-500/15 text-violet-600">{STATUS_LABELS[overview.status] || overview.status}</Badge>
              {documents.missingCount > 0 && (
                <Badge className="border-0 bg-red-500/15 text-red-600"><AlertTriangle className="mr-1 h-3 w-3" />{documents.missingCount} eksik evrak</Badge>
              )}
              {finance?.overdueCount > 0 && (
                <Badge className="border-0 bg-[hsl(var(--brand-accent)/0.15)] text-[hsl(var(--brand-accent))]"><CreditCard className="mr-1 h-3 w-3" />{finance.overdueCount} gecikmiş taksit</Badge>
              )}
              {mebbisMissing?.length > 0
                ? <Badge className="border-0 bg-amber-500/15 text-amber-600" title={mebbisMissing.join(', ')}><AlertTriangle className="mr-1 h-3 w-3" />MEBBİS eksik: {mebbisMissing.length}</Badge>
                : <Badge className="border-0 bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />MEBBİS hazır</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate && <Button variant="outline" onClick={() => {
            setLifecycleForm({ status: overview.status, automaticStatusEnabled: overview.automaticStatusEnabled !== false, allowIncompleteDocuments: false, reason: '' });
            setLifecycleOpen(true);
          }}><UserRoundCheck className="mr-2 h-4 w-4" />Durum ve uygunluk</Button>}
          <Button variant="outline" onClick={() => load({ silent: true })}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button>
          <Button variant="outline" disabled={!lessons.length} onClick={exportEvaluations}><Download className="mr-2 h-4 w-4" />Gelişim Raporu</Button>
        </div>
      </div>

      <Dialog open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kursiyer yaşam döngüsü</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-xl border p-3 text-sm ${overview.documentsComplete ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <b>{overview.documentsComplete ? 'Zorunlu evraklar tamam' : 'Evrak dosyası tamamlanmamış'}</b>
              {!overview.documentsComplete && <p className="mt-1 text-muted-foreground">{(overview.missingDocuments || []).join(', ')}</p>}
            </div>
            <label className="flex items-start gap-3 rounded-xl border p-3">
              <input type="checkbox" className="mt-1" checked={lifecycleForm.automaticStatusEnabled} onChange={(e) => setLifecycleForm({ ...lifecycleForm, automaticStatusEnabled: e.target.checked, allowIncompleteDocuments: false })} />
              <span><b>Otomatik yönetim</b><small className="block text-muted-foreground">Evraklar tamamlanınca aktif, yeniden eksilirse evrak bekliyor durumuna geçer.</small></span>
            </label>
            {!lifecycleForm.automaticStatusEnabled && <>
              <label className="space-y-1 text-sm font-semibold">Manuel durum
                <select className={apptSelectClass} value={lifecycleForm.status} onChange={(e) => setLifecycleForm({ ...lifecycleForm, status: e.target.value, allowIncompleteDocuments: false })}>
                  {Object.entries(STATUS_LABELS).filter(([value]) => value !== 'Graduated' && (canDeactivate || !['Suspended', 'Cancelled'].includes(value))).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {!overview.documentsComplete && ['Active', 'TheoryOngoing', 'PracticeOngoing', 'ExamPending'].includes(lifecycleForm.status) && (
                <label className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                  <input type="checkbox" className="mt-1" disabled={!canOverrideDocuments} checked={lifecycleForm.allowIncompleteDocuments} onChange={(e) => setLifecycleForm({ ...lifecycleForm, allowIncompleteDocuments: e.target.checked })} />
                  <span><b>Eksik evraka rağmen eğitime izin ver</b><small className="block text-muted-foreground">Yetkili istisna olarak kaydedilir; gerekçe ve kullanıcı denetim geçmişine yazılır.</small></span>
                </label>
              )}
              <label className="space-y-1 text-sm font-semibold">Gerekçe
                <Input maxLength={500} value={lifecycleForm.reason} onChange={(e) => setLifecycleForm({ ...lifecycleForm, reason: e.target.value })} placeholder="Pasife alma veya istisna nedeni" />
              </label>
            </>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLifecycleOpen(false)}>Vazgeç</Button><Button disabled={busy} onClick={saveLifecycle}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Genel bakış</TabsTrigger>
          <TabsTrigger value="training">Direksiyon</TabsTrigger>
          <TabsTrigger value="appointments">Randevular</TabsTrigger>
          <TabsTrigger value="documents">Evraklar</TabsTrigger>
          {finance && <TabsTrigger value="finance">Ödemeler</TabsTrigger>}
          <TabsTrigger value="notes">Notlar</TabsTrigger>
          <TabsTrigger value="mebbis-history">MEBBİS geçmişi</TabsTrigger>
          <TabsTrigger value="history">İşlem geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Öğrenci kimliği: biyometrik + anlık (web kamera) fotoğraf alt alta, kimlik kartı görünümü. */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-primary to-brand-primary/70 px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <b className="text-sm font-black tracking-widest">ÖĞRENCİ KİMLİĞİ</b>
                {overview.studentNumber != null && (
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-black">No: {overview.studentNumber}</span>
                )}
              </div>
              <p className="mt-2 text-xl font-black leading-tight">{overview.fullName}</p>
              <p className="text-xs text-white/80">
                {overview.packageName ? `${overview.packageName} • ` : ''}{overview.licenseClass} • {overview.transmissionType === 'Manual' ? 'Manuel' : 'Otomatik'}
              </p>
            </div>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 sm:gap-5">
                {[['Biyometrik fotoğraf', overview.photoUrl], ['Anlık fotoğraf (web kamera)', overview.livePhotoUrl]].map(([label, url]) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    {url
                      ? <img src={assetUrl(url)} alt={label} className="h-44 w-36 rounded-xl border object-cover shadow-sm" />
                      : (
                        <div className="flex h-44 w-36 items-center justify-center rounded-xl border border-dashed bg-muted/40 text-3xl font-black text-muted-foreground">
                          {overview.fullName?.[0] || '?'}
                        </div>
                      )}
                    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Kimlik ve iletişim</CardTitle></CardHeader>
            <CardContent>
              <Row label="Kimlik türü" value={overview.identityKind === 'TurkishId' ? 'T.C. Kimlik' : overview.identityKind === 'Passport' ? 'Pasaport' : 'Yabancı Kimlik'} />
              <Row label="Kimlik numarası" value={overview.identityNumber || overview.tcNo} />
              <Row label="Kimlik seri no" value={overview.identitySerialNo} />
              <Row label="Baba adı" value={overview.fatherName} />
              <Row label="Anne adı" value={overview.motherName} />
              <Row label="Doğum yeri" value={overview.birthPlace} />
              <Row label="Doğum tarihi" value={overview.birthDate} />
              <Row label="Cinsiyet" value={overview.gender} />
              <Row label="Kan grubu" value={overview.bloodType} />
              <Row label="Meslek" value={overview.occupation} />
              <Row label="Öğrenim" value={overview.educationLevel} />
              <Row label="İl / İlçe" value={[overview.city, overview.district].filter(Boolean).join(' / ')} />
              <Row label="İkametgâh" value={overview.residenceAddress} />
              <Row label="Telefon" value={maskTrPhone(overview.studentPhone || overview.phone)} />
              <Row label="E-posta" value={overview.email} />
              <Row label="Acil durum" value={[overview.emergencyContactName, overview.emergencyContactPhone].filter(Boolean).join(' • ')} />
              <Row label="Kayıt şubesi" value={overview.registrationBranchName} />
              <Row label="Kaydeden" value={overview.registrarName} />
            </CardContent>
          </Card>

          {mebbisMissing?.length > 0 && (
            <Card className="border-amber-500/40">
              <CardHeader><CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" />MEBBİS için eksik alanlar</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {mebbisMissing.map((item) => (
                    <span key={item} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{item}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Bu alanlar tamamlanmadan aday MEBBİS'e eksiksiz girilemez. Kimlik alanları kayıt bilgilerinden, belgeler Evraklar sekmesinden tamamlanır.
                </p>
              </CardContent>
            </Card>
          )}

          {overview.hasExistingLicense && (
            <Card>
              <CardHeader><CardTitle>Mevcut sürücü belgesi</CardTitle></CardHeader>
              <CardContent>
                <Row label="Geçmek istediği sınıf" value={overview.targetLicenseClass || overview.licenseClass} />
                <Row label="Önceki belge no" value={overview.existingLicenseNumber} />
                <Row label="Önceki sınıf(lar)" value={overview.existingLicenseClasses} />
                <Row label="Veren makam" value={overview.licenseIssuePlace} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Sınav ücretleri</CardTitle>
              {canCollect && examFeeDraft === null && (
                <Button variant="outline" size="sm" onClick={() => setExamFeeDraft({
                  drivingExamFee: overview.drivingExamFee || 0,
                  drivingExamFeePaid: !!overview.drivingExamFeePaid,
                  drivingExamDate: overview.drivingExamDate ? overview.drivingExamDate.slice(0, 10) : '',
                })}>Düzenle</Button>
              )}
            </CardHeader>
            <CardContent>
              {examFeeDraft === null ? (
                <>
                  <div className="flex items-center justify-between border-b py-2 text-sm">
                    <span className="text-muted-foreground">Direksiyon sınavı • {examRights?.practice?.used || 1}. giriş</span>
                    <span className="flex items-center gap-2">
                      <b>{money(overview.drivingExamFee)}</b>
                      <Badge className={`border-0 ${overview.drivingExamFee > 0 && overview.drivingExamFeePaid ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                        {overview.drivingExamFee > 0 && overview.drivingExamFeePaid ? 'Ödendi' : 'Ödenmedi'}
                      </Badge>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b py-2 text-sm">
                    <span className="text-muted-foreground">Direksiyon sınav tarihi</span>
                    <b>{dateOnly(overview.drivingExamDate)}</b>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Direksiyon sınav ücreti (₺) • {examRights?.practice?.used || 1}. giriş</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input type="number" min="0" value={examFeeDraft.drivingExamFee} onChange={(e) => setExamFeeDraft({ ...examFeeDraft, drivingExamFee: e.target.value })} />
                      <label className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <input type="checkbox" checked={examFeeDraft.drivingExamFeePaid} onChange={(e) => setExamFeeDraft({ ...examFeeDraft, drivingExamFeePaid: e.target.checked })} />Ödendi
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Direksiyon sınav tarihi</label>
                    <Input type="date" className="mt-1" value={examFeeDraft.drivingExamDate} onChange={(e) => setExamFeeDraft({ ...examFeeDraft, drivingExamDate: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setExamFeeDraft(null)} disabled={savingFees}>Vazgeç</Button>
                    <Button size="sm" onClick={saveExamFees} disabled={savingFees}>{savingFees ? 'Kaydediliyor…' : 'Kaydet'}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {examRights && (
            <Card>
              <CardHeader><CardTitle>Sınav hakları (en fazla 4)</CardTitle></CardHeader>
              <CardContent>
                {[['E-sınav', examRights.theory], ['Direksiyon sınavı', examRights.practice]].map(([label, right]) => (
                  <div key={label} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="flex items-center gap-2">
                      <b>{right.used}/{right.max} hak kullanıldı</b>
                      {right.outOfAttempts
                        ? <Badge className="border-0 bg-red-500/15 text-red-600">Dönem düştü — yeniden kayıt gerekir</Badge>
                        : <Badge className="border-0 bg-emerald-500/15 text-emerald-600">{right.remaining} hak kaldı</Badge>}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Resmî formlar (PDF)</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadForm('cover', `kapak-formu-${overview.studentNumber}`)}>
                <Download className="mr-2 h-4 w-4" />Aday Dosyası Kapak Formu
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadForm('lesson-card', `egitim-karti-${overview.studentNumber}`)}>
                <Download className="mr-2 h-4 w-4" />Direksiyon Eğitim Kartı
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadForm('attendance', `devam-cizelgesi-${overview.studentNumber}`)}>
                <Download className="mr-2 h-4 w-4" />Devam Çizelgesi
              </Button>
              {/* Matbu MEB evrakları (müracaat formu, imza sirküleri, sözleşme)
                  ayrı sayfada yönetilir; buradan o kursiyerle açılır. */}
              <Button variant="outline" size="sm" onClick={() => navigate('/driving/forms')}>
                <FileSignature className="mr-2 h-4 w-4" />Sözleşme ve Formlar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Kurs ve tercihler</CardTitle></CardHeader>
            <CardContent>
              <Row label="Kayıt tarihi" value={dateOnly(overview.registeredAtUtc)} />
              <Row label="Kurs başlangıcı" value={dateOnly(overview.courseStartsAtUtc)} />
              <Row label="Sürüş deneyimi" value={{ None: 'Hiç yok', Some: 'Biraz var', Experienced: 'Deneyimli' }[overview.drivingExperience]} />
              <Row
                label="Zaman uygunluğu"
                value={[
                  overview.availability?.availableWeekdays && 'Hafta içi',
                  overview.availability?.availableWeekend && 'Hafta sonu',
                ].filter(Boolean).join(', ')}
              />
              <Row
                label="Saat tercihi"
                value={[
                  overview.availability?.prefersMorning && 'Sabah',
                  overview.availability?.prefersMidday && 'Öğlen',
                  overview.availability?.prefersEvening && 'Akşam',
                ].filter(Boolean).join(', ')}
              />
              <Row label="Erişilebilirlik notu" value={overview.accessibilityNotes} />
              <Row label="KVKK onayı" value={overview.consents?.kvkkConsentAtUtc ? dateTime(overview.consents.kvkkConsentAtUtc) : 'Yok'} />
              <Row label="İletişim izni" value={overview.consents?.communicationConsent ? 'Var' : 'Yok'} />
              <Row
                label="Sözleşme"
                value={overview.consents?.contractSignedAtUtc
                  ? <a className="text-blue-600 hover:underline" href={overview.consents.signatureUrl} target="_blank" rel="noreferrer">İmzalı sözleşme</a>
                  : 'İmzalanmadı'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Toplam hak" value={minutes(training.totalMinutes)} />
            <Stat label="Tamamlanan" value={minutes(training.completedMinutes)} tone="text-emerald-600" />
            <Stat label="Planlanmış (rezerve)" value={minutes(training.plannedMinutes)} tone="text-amber-600" />
            <Stat label="Serbest kalan" value={minutes(training.unreservedMinutes)} tone="text-violet-600" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Tamamlanan ders" value={training.completedLessonCount} />
            <Stat label="İptal edilen randevu" value={training.cancelledAppointmentCount} />
            <Stat label="Ortalama puan" value={training.averageScore ? `${Number(training.averageScore).toFixed(1)} / 5` : '—'} />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex gap-2"><TrendingUp className="text-blue-500" />Öğrenci gelişim grafikleri</CardTitle></CardHeader>
            <CardContent>
              {trendData.length === 0 ? <p className="py-10 text-center text-muted-foreground">Grafik için değerlendirilmiş ders bulunmuyor.</p> : <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ left: 4, right: 16, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="tarih" tick={{ fontSize: 11 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                    <Tooltip formatter={(value, name) => [`${value} / 5`, name]} labelFormatter={(_, payload) => payload?.[0] ? `${payload[0].payload.ders}. ders • ${payload[0].payload.tarih}` : ''} />
                    <Legend />
                    <Line type="monotone" dataKey="genel" name="Genel" stroke="hsl(var(--foreground))" strokeWidth={3} />
                    {DRIVING_EVALUATION_CATEGORIES.map((category) => <Line key={category.key} type="monotone" dataKey={category.scoreKey} name={category.label} stroke={category.color} strokeWidth={2} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex gap-2"><Gauge className="text-emerald-500" />Ders değerlendirmeleri</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lessons.length === 0 && <p className="py-6 text-center text-muted-foreground">Henüz tamamlanmış ders yok.</p>}
              {lessons.map((lesson) => {
                const details = evaluationScores(lesson);
                return (
                <div key={lesson.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <b>{dateTime(lesson.startedAtUtc)}</b>
                    <span className="text-sm text-muted-foreground">{lesson.instructorName} • {lesson.vehiclePlate} • {minutes(lesson.chargedMinutes)}</span>
                  </div>
                  {lesson.safetyScore != null && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Trafik {lesson.trafficRulesScore}/5</Badge>
                      <Badge variant="outline">Araç hâkimiyeti {lesson.vehicleControlScore}/5</Badge>
                      <Badge variant="outline">Manevra {lesson.maneuversScore}/5</Badge>
                      <Badge variant="outline">Güvenlik {lesson.safetyScore}/5</Badge>
                    </div>
                  )}
                  {lesson.instructorNote && <p className="mt-2 text-sm text-muted-foreground">{lesson.instructorNote}</p>}
                  {Object.keys(details).length > 0 && (
                    <details className="mt-3 rounded-lg bg-muted/40 p-3">
                      <summary className="cursor-pointer text-sm font-bold">Ayrıntılı kriterler</summary>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {DRIVING_EVALUATION_CRITERIA.filter((criterion) => details[criterion.key] != null).map((criterion) => (
                          <div key={criterion.key} className="flex justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">{criterion.label}</span><b>{details[criterion.key]} / 5</b>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex gap-2"><ClipboardList className="text-violet-500" />Ders hakkı hareketleri</span>
                {canAdjustBalance && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={addExtraMinutes}>
                      <Plus className="mr-1 h-3.5 w-3.5" />Ek ders
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={adjustBalance}>
                      <Wrench className="mr-1 h-3.5 w-3.5" />Elle düzelt
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Defter ile gerçek randevular uyuşmuyorsa bunu saklamak yerine söyleriz. */}
              {reconciliation && !reconciliation.isBalanced && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span>
                    Defter tutarsız: rezervasyon {reconciliation.ledgerPlannedMinutes} dk, açık randevular {reconciliation.activeAppointmentMinutes} dk
                    (fark {reconciliation.differenceMinutes} dk).
                  </span>
                </div>
              )}
              {ledger.length === 0 && <p className="py-6 text-center text-muted-foreground">Hareket yok.</p>}
              {ledger.map((entry) => (
                <div key={entry.id} className="flex justify-between rounded-xl border p-3 text-sm">
                  <div>
                    <b>{LEDGER_LABELS[entry.entryType] || entry.entryType}</b>
                    <p className="text-xs text-muted-foreground">{entry.description} • {dateTime(entry.createdAtUtc)}</p>
                    {entry.reason && <p className="text-xs text-amber-600">Gerekçe: {entry.reason}</p>}
                  </div>
                  <b className={entry.minutesDelta < 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {entry.minutesDelta > 0 ? '+' : ''}{entry.minutesDelta} dk
                  </b>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex gap-2"><CalendarClock className="text-[hsl(var(--brand-accent))]" />Randevular</CardTitle>
              {canCreateAppointment && (
                <Button size="sm" onClick={() => setApptOpen(true)}><Plus className="mr-2 h-4 w-4" />Randevu Oluştur</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {appointments.length === 0 && <p className="py-6 text-center text-muted-foreground">Randevu yok.</p>}
              {appointments.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <b>{dateTime(item.startsAtUtc)}</b>
                    <p className="text-xs text-muted-foreground">{item.instructorName} • {item.vehiclePlate}</p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-5 space-y-5">
          <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${documents.complete ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
            {documents.complete
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Kurs dosyası tamam — tüm zorunlu evraklar onaylı.</span></>
              : <><AlertTriangle className="h-4 w-4 text-amber-600" /><span>{documents.missingCount} zorunlu evrak eksik, {documents.pendingCount} evrak onay bekliyor. Dosya tamamlanmadan kursiyer eğitime alınamaz.</span></>}
          </div>

          <Card>
            <CardHeader><CardTitle className="flex gap-2"><FileCheck2 className="text-blue-500" />Kurs dosyası</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {documents.items.map((item) => {
                const tone = DOCUMENT_STATUS[item.status] || { label: item.status, tone: 'bg-muted' };
                return (
                  <div key={item.documentType} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <b>{item.label}</b>
                        {item.required && <Badge className="ml-2 border-0 bg-red-500/15 text-red-600">Zorunlu</Badge>}
                        {item.fileUrl && (
                          <Badge className="ml-2 border-0 bg-emerald-500/15 text-emerald-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Belge yüklendi
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {item.uploadedAtUtc ? `Yüklendi: ${dateTime(item.uploadedAtUtc)}` : 'Henüz yüklenmedi'}
                          {item.fileName ? ` • ${item.fileName}` : ''}
                        </p>
                        {item.rejectionReason && <p className="mt-1 text-xs text-red-600">Ret nedeni: {item.rejectionReason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.fileUrl && <button type="button" className="text-xs font-bold text-blue-600 hover:underline" onClick={() => openDocument(item)}>Dosya</button>}
                        <Badge className={tone.tone}>{tone.label}</Badge>
                      </div>
                    </div>

                    {canReview && item.status === 'PendingApproval' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => run(() => reviewDrivingStudentDocument(item.id, { action: 'Approve', expectedVersion: item.reviewVersion }), 'Belge onaylandı')}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />Onaylıyorum
                        </Button>
                        <Input
                          className="w-64"
                          placeholder="Ret nedeni (en az 5 karakter)"
                          value={rejectReasons[item.id] || ''}
                          onChange={(e) => setRejectReasons((x) => ({ ...x, [item.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="destructive"
                          disabled={busy || (rejectReasons[item.id] || '').trim().length < 5}
                          onClick={() => run(
                            () => reviewDrivingStudentDocument(item.id, { action: 'Reject', rejectionReason: rejectReasons[item.id], expectedVersion: item.reviewVersion }),
                            'Belge reddedildi',
                          )}>
                          <XCircle className="mr-1 h-4 w-4" />Onaylamıyorum
                        </Button>
                      </div>
                    )}

                    {canUpload && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <FileButton
                          className="w-72"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={busy}
                          uploaded={Boolean(item.fileUrl)}
                          uploadedName={item.fileName}
                          onChange={(e) => uploadDocument(item.documentType, e.target.files?.[0])}
                        />
                        <span className="text-xs text-muted-foreground">
                          <Upload className="mr-1 inline h-3 w-3" />
                          {item.status === 'Missing' ? 'Belgeyi yükleyin' : 'Yeni sürüm yükleyin (eskisi geçmişe alınır)'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {documents.history?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Geçmiş belge sürümleri</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {documents.history.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-xl border p-3 text-sm">
                    <div>
                      <b>{item.label}</b>
                      <p className="text-xs text-muted-foreground">{dateTime(item.uploadedAtUtc)} • {item.status}</p>
                    </div>
                    <button type="button" className="text-xs font-bold text-blue-600 hover:underline" onClick={() => openDocument(item)}>Dosya</button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {finance && (
          <TabsContent value="finance" className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Net tutar" value={money(finance.netAmount)} />
              <Stat label="Tahsil edilen" value={money(finance.paidTotal)} tone="text-emerald-600" />
              <Stat label="Kalan borç" value={money(finance.remaining)} tone={finance.remaining > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <Stat label="Gecikmiş taksit" value={finance.overdueCount} tone={finance.overdueCount > 0 ? 'text-[hsl(var(--brand-accent))]' : undefined} />
            </div>

            {canCollect && (
              <Card>
                <CardHeader><CardTitle className="flex gap-2"><Receipt className="text-emerald-500" />Tahsilat ve ücret kalemi</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <form onSubmit={submitPayment} className="space-y-2 rounded-2xl border p-4">
                    <b className="text-sm">Tahsilat al</b>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={paymentForm.financeInstallmentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const chosen = finance.installments.find((x) => x.id === id);
                        setPaymentForm({ ...paymentForm, financeInstallmentId: id, amount: chosen ? String(chosen.amount - chosen.paidAmount) : paymentForm.amount });
                      }}
                    >
                      <option value="">Taksit: Otomatik (en eski vade)</option>
                      {finance.installments.filter((x) => x.amount - x.paidAmount > 0).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label || `${x.seqNo}. taksit`} • {dateOnly(x.dueDateUtc)} • {money(x.amount - x.paidAmount)}
                        </option>
                      ))}
                    </select>
                    <Input required type="number" min="1" placeholder="Tutar (₺)" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                      <option value="Nakit">Nakit</option><option value="Kart">Kart</option><option value="Havale">Havale</option>
                    </select>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paymentForm.branchId} onChange={(e) => setPaymentForm({ ...paymentForm, branchId: e.target.value })}>
                      <option value="">{branches.length ? 'Tahsilat şubesi: Varsayılan (kendi şubem)' : 'Tahsilat şubesi: Varsayılan'}</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <Button disabled={busy} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">Tahsilatı Kaydet</Button>
                  </form>

                  <form onSubmit={submitCharge} className="space-y-2 rounded-2xl border p-4">
                    <b className="text-sm">Ücret kalemi ekle</b>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={chargeForm.chargeType}
                      onChange={(e) => setChargeForm({ ...chargeForm, chargeType: e.target.value })}
                    >
                      {CHARGE_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                    <Input required type="number" min="1" placeholder="Tutar (₺)" value={chargeForm.grossAmount} onChange={(e) => setChargeForm({ ...chargeForm, grossAmount: e.target.value })} />
                    {chargeForm.chargeType === 'ExtraLesson' && (
                      <Input
                        required
                        type="number"
                        min="1"
                        placeholder="Eklenecek süre (dakika)"
                        value={chargeForm.minutes}
                        onChange={(e) => setChargeForm({ ...chargeForm, minutes: e.target.value })}
                      />
                    )}
                    <Input placeholder="Açıklama" value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} />
                    <Button disabled={busy} className="w-full">
                      <Plus className="mr-1 h-4 w-4" />
                      {chargeForm.chargeType === 'ExtraLesson' ? 'Ek Dersi Sat ve Süre Ekle' : 'Kalemi Ekle'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {charges.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Ücret kalemleri</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {charges.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                      <div>
                        <b>{CHARGE_TYPES.find((x) => x.value === item.chargeType)?.label || item.chargeType}</b>
                        <p className="text-xs text-muted-foreground">
                          {item.description} • {dateTime(item.createdAtUtc)}
                          {item.minutes > 0 && ` • ${item.minutes} dk ders hakkı`}
                        </p>
                        {item.refundedAtUtc && (
                          <p className="text-xs text-red-600">İade: {money(item.refundedAmount)} — {item.refundReason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <b>{money(item.netAmount)}</b>
                      </div>
                    </div>
                  ))}
                  {charges.some((item) => !item.refundedAtUtc) && can(DRIVING.financeRefund) && (
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/finance/refunds?student=${profileId}`)}>
                      İade işlemleri sayfasına git
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Taksit planı</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {finance.installments.map((item) => {
                  const overdue = item.paidAmount < item.amount && new Date(item.dueDateUtc) < new Date();
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                      <div>
                        <b>{item.seqNo}. taksit</b>
                        <p className="text-xs text-muted-foreground">Vade: {dateOnly(item.dueDateUtc)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{money(item.paidAmount)} / {money(item.amount)}</span>
                        <Badge className={overdue ? 'bg-red-500' : item.paidAmount >= item.amount ? 'bg-emerald-500' : 'bg-amber-500'}>
                          {overdue ? 'Gecikmiş' : item.paidAmount >= item.amount ? 'Ödendi' : 'Bekliyor'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Makbuzlar</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {finance.payments.length === 0 && <p className="py-6 text-center text-muted-foreground">Tahsilat yok.</p>}
                {finance.payments.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-xl border p-3 text-sm">
                    <div>
                      <b>Makbuz {item.receiptNo}</b>
                      <p className="text-xs text-muted-foreground">{item.method} • {dateTime(item.paidAtUtc)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.branchName ? `Şube: ${item.branchName}` : 'Şube: —'}
                        {item.collectedByName ? ` • Tahsil eden: ${item.collectedByName}` : ''}
                      </p>
                    </div>
                    <b className="text-emerald-600">{money(item.amount)}</b>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="notes" className="mt-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><StickyNote className="text-amber-500" />Notlar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border p-3">
                <b className="text-sm text-muted-foreground">Kurum içi not</b>
                <p className="mt-1">{data.notes?.institution || '—'}</p>
              </div>
              <div className="rounded-xl border p-3">
                <b className="text-sm text-muted-foreground">Erişilebilirlik / özel eğitim</b>
                <p className="mt-1">{data.notes?.accessibility || '—'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mebbis-history" className="mt-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><History className="text-sky-600" />MEBBİS zaman çizelgesi</CardTitle></CardHeader>
            <CardContent>
              {mebbisHistory.length === 0 ? <p className="py-8 text-center text-muted-foreground">Henüz MEBBİS işlem kaydı bulunmuyor.</p> : (
                <div className="relative space-y-0 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-border">
                  {mebbisHistory.map((item) => {
                    const tone = item.severity === 'Error' ? 'bg-red-500' : item.severity === 'Warning' ? 'bg-amber-500' : item.severity === 'Success' ? 'bg-emerald-500' : 'bg-sky-500';
                    return <div key={item.id} className="relative grid grid-cols-[16px_1fr] gap-4 pb-6 last:pb-0">
                      <span className={`z-10 mt-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background ${tone}`} />
                      <div className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2"><b>{item.title}</b><time className="text-xs text-muted-foreground">{dateTime(item.occurredAtUtc)}</time></div>
                        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{MEBBIS_EVENT_LABELS[item.eventType] || item.eventType}</Badge>{item.status && <Badge variant="outline">{item.status}</Badge>}<span>İşlemi yapan: {item.actorName || 'Sistem'}</span></div>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><History className="text-slate-500" />İşlem geçmişi</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 && <p className="py-6 text-center text-muted-foreground">Kayıt yok.</p>}
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <b>{item.action}</b>
                    <span className="text-xs text-muted-foreground">{dateTime(item.createdAtUtc)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                  <p className="text-xs text-muted-foreground">İşlemi yapan: {item.actorName}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {apptOpen && (
        <AppointmentModal
          profileId={profileId}
          studentName={overview.fullName}
          canOverride={can}
          onClose={() => setApptOpen(false)}
          onCreated={() => { setApptOpen(false); load({ silent: true }); }}
        />
      )}

      <Dialog open={Boolean(docPreview)} onOpenChange={(open) => { if (!open) closeDocPreview(); }}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-3">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
              <FileCheck2 className="h-4 w-4" />{docPreview?.item?.label || 'Belge'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[60vh] items-center justify-center overflow-auto bg-muted/40 p-3">
            {docPreview?.loading && <p className="text-sm text-muted-foreground">Belge güvenli şekilde açılıyor…</p>}
            {!docPreview?.loading && docPreview?.kind === 'image' && (
              <img src={docPreview.url} alt={docPreview.item?.label || 'Belge'} className="max-h-[78vh] max-w-full rounded-md object-contain" />
            )}
            {!docPreview?.loading && docPreview?.kind === 'pdf' && (
              <iframe src={docPreview.url} title={docPreview.item?.label || 'Belge'} className="h-[78vh] w-full rounded-md border-0 bg-white" />
            )}
            {!docPreview?.loading && docPreview?.kind === 'other' && (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">Bu belge türü ekranda önizlenemiyor. İndirerek açabilirsiniz.</p>
                <Button onClick={downloadDocPreview}><Download className="mr-2 h-4 w-4" />Belgeyi indir</Button>
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" onClick={downloadDocPreview} disabled={!docPreview?.url}><Download className="mr-2 h-4 w-4" />İndir</Button>
            <Button variant="outline" onClick={closeDocPreview}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
