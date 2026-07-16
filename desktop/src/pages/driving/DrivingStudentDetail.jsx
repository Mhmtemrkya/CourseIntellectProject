import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, CreditCard, Download,
  FileCheck2, Gauge, History, Plus, Receipt, RefreshCw, StickyNote, TrendingUp, Undo2, Upload, Wrench, XCircle,
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
  addDrivingExtraMinutes, adjustDrivingLedger, createDrivingCharge, fetchDrivingCharges, fetchDrivingLedger,
  fetchDrivingStudentDetail, recordDrivingPayment, refundDrivingCharge, reviewDrivingStudentDocument,
  updateDrivingStudentStatus, uploadDrivingStudentDocument, uploadFile,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
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
  Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal',
};

const DOCUMENT_STATUS = {
  Missing: { label: 'Eksik', tone: 'bg-red-500' },
  PendingApproval: { label: 'Onay bekliyor', tone: 'bg-amber-500' },
  Approved: { label: 'Onaylı', tone: 'bg-emerald-500' },
  Rejected: { label: 'Reddedildi', tone: 'bg-red-500' },
  Expired: { label: 'Süresi doldu', tone: 'bg-[hsl(var(--brand-accent))]' },
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

export default function DrivingStudentDetail() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();

  const [data, setData] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectReasons, setRejectReasons] = useState({});
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Nakit' });
  const [chargeForm, setChargeForm] = useState({ chargeType: 'ExtraLesson', grossAmount: '', minutes: '', description: '' });

  const canReview = can(DRIVING.studentDocumentReview);
  const canUpload = can(DRIVING.studentDocumentUpload);
  const canUpdate = can(DRIVING.studentUpdate);
  const canAdjustBalance = can(DRIVING.lessonBalanceAdjust);
  const canCollect = can(DRIVING.financeCollect);
  const canRefund = can(DRIVING.financeRefund);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, ledgerState, chargeList] = await Promise.all([
        fetchDrivingStudentDetail(profileId),
        // Mutabakat ve ücret kalemleri yalnızca yetkisi olana gösterilir; hata sessiz geçilir.
        fetchDrivingLedger(profileId).catch(() => null),
        fetchDrivingCharges(profileId).catch(() => []),
      ]);
      setData(detail);
      setReconciliation(ledgerState?.reconciliation ?? null);
      setCharges(chargeList || []);
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
    if (await run(() => recordDrivingPayment(profileId, { amount, method: paymentForm.method }), 'Tahsilat kaydedildi')) {
      setPaymentForm({ amount: '', method: paymentForm.method });
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

  async function refundCharge(charge) {
    const reason = window.prompt('İade nedeni (en az 5 karakter):');
    if (!reason || reason.trim().length < 5) return;
    await run(
      () => refundDrivingCharge(charge.id, { reason: reason.trim() }),
      'İade işlendi',
    );
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

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
      await load();
    } catch (error) {
      toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(documentType, file, expiresAtUtc) {
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
        expiresAtUtc: expiresAtUtc || null,
      });
      toast({ title: 'Belge yüklendi, onay bekliyor' });
      await load();
    } catch (error) {
      toast({ title: 'Belge yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;
  if (!data) return null;

  const { overview, training, appointments, lessons, ledger, documents, finance, history } = data;
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
          <Button variant="outline" size="icon" onClick={() => navigate('/driving/scheduling')}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex gap-2">
            {overview.photoUrl
              ? <img src={overview.photoUrl} alt={`${overview.fullName} biyografik`} title="Biyografik fotoğraf" className="h-16 w-16 rounded-2xl object-cover" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-xl font-black">{overview.fullName?.[0]}</div>}
            {overview.livePhotoUrl && (
              <img src={overview.livePhotoUrl} alt={`${overview.fullName} anlık`} title="Anlık fotoğraf (web kamera)" className="h-16 w-16 rounded-2xl object-cover" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">{overview.fullName}</h1>
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
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate && (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              value={overview.status}
              disabled={busy}
              onChange={(e) => run(
                () => updateDrivingStudentStatus(profileId, { status: e.target.value, reason: 'Detay ekranından değiştirildi' }),
                'Kursiyer durumu güncellendi',
              )}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button>
          <Button variant="outline" disabled={!lessons.length} onClick={exportEvaluations}><Download className="mr-2 h-4 w-4" />Gelişim Raporu</Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Genel bakış</TabsTrigger>
          <TabsTrigger value="training">Direksiyon</TabsTrigger>
          <TabsTrigger value="appointments">Randevular</TabsTrigger>
          <TabsTrigger value="documents">Evraklar</TabsTrigger>
          {finance && <TabsTrigger value="finance">Ödemeler</TabsTrigger>}
          <TabsTrigger value="notes">Notlar</TabsTrigger>
          <TabsTrigger value="history">İşlem geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Kimlik ve iletişim</CardTitle></CardHeader>
            <CardContent>
              <Row label="Kimlik türü" value={overview.identityKind === 'TurkishId' ? 'T.C. Kimlik' : overview.identityKind === 'Passport' ? 'Pasaport' : 'Yabancı Kimlik'} />
              <Row label="Kimlik numarası" value={overview.identityNumber || overview.tcNo} />
              <Row label="Doğum tarihi" value={overview.birthDate} />
              <Row label="Cinsiyet" value={overview.gender} />
              <Row label="Kan grubu" value={overview.bloodType} />
              <Row label="Meslek" value={overview.occupation} />
              <Row label="Öğrenim" value={overview.educationLevel} />
              <Row label="İl / İlçe" value={[overview.city, overview.district].filter(Boolean).join(' / ')} />
              <Row label="İkametgâh" value={overview.residenceAddress} />
              <Row label="Telefon" value={overview.phone} />
              <Row label="WhatsApp" value={overview.whatsAppPhone} />
              <Row label="E-posta" value={overview.email} />
              <Row label="Acil durum" value={[overview.emergencyContactName, overview.emergencyContactPhone].filter(Boolean).join(' • ')} />
            </CardContent>
          </Card>

          {overview.hasExistingLicense && (
            <Card>
              <CardHeader><CardTitle>Mevcut sürücü belgesi</CardTitle></CardHeader>
              <CardContent>
                <Row label="Belge no" value={overview.existingLicenseNumber} />
                <Row label="Sınıf(lar)" value={overview.existingLicenseClasses} />
                <Row label="Veriliş" value={dateOnly(overview.licenseIssueDate)} />
                <Row label="Son geçerlilik" value={dateOnly(overview.licenseExpiryDate)} />
                <Row label="Veren makam" value={overview.licenseIssuePlace} />
              </CardContent>
            </Card>
          )}

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
            <CardHeader><CardTitle className="flex gap-2"><CalendarClock className="text-[hsl(var(--brand-accent))]" />Randevular</CardTitle></CardHeader>
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
                        <p className="text-xs text-muted-foreground">
                          {item.uploadedAtUtc ? `Yüklendi: ${dateTime(item.uploadedAtUtc)}` : 'Henüz yüklenmedi'}
                          {item.expiresAtUtc ? ` • Geçerlilik: ${dateOnly(item.expiresAtUtc)}` : ''}
                        </p>
                        {item.rejectionReason && <p className="mt-1 text-xs text-red-600">Ret nedeni: {item.rejectionReason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.fileUrl && <a className="text-xs font-bold text-blue-600 hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">Dosya</a>}
                        <Badge className={tone.tone}>{tone.label}</Badge>
                      </div>
                    </div>

                    {canReview && item.status === 'PendingApproval' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => run(() => reviewDrivingStudentDocument(item.id, { approved: true }), 'Belge onaylandı')}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />Onayla
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
                            () => reviewDrivingStudentDocument(item.id, { approved: false, rejectionReason: rejectReasons[item.id] }),
                            'Belge reddedildi',
                          )}>
                          <XCircle className="mr-1 h-4 w-4" />Reddet
                        </Button>
                      </div>
                    )}

                    {canUpload && item.status !== 'Approved' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Input
                          type="file"
                          className="w-64"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={busy}
                          onChange={(e) => uploadDocument(item.documentType, e.target.files?.[0], item.expiresAtUtc)}
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
                    <a className="text-xs font-bold text-blue-600 hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">Dosya</a>
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
                    <Input required type="number" min="1" placeholder="Tutar (₺)" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                      <option value="Nakit">Nakit</option><option value="Kart">Kart</option><option value="Havale">Havale</option>
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
                        {canRefund && !item.refundedAtUtc && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => refundCharge(item)}>
                            <Undo2 className="mr-1 h-3.5 w-3.5" />İade
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}
