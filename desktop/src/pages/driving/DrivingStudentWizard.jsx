import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Camera, CheckCircle2, CreditCard,
  FileCheck2, IdCard, KeyRound, Loader2, Save, ShieldCheck, Upload, UserRound, X, XCircle,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  checkDrivingIdentity, checkDrivingPhone, convertDrivingLead, deleteDrivingRegistrationDraft, fetchDrivingInstructors, fetchDrivingPackages, verifyDrivingIdentity,
  fetchDrivingRegistrationDrafts, fetchDrivingVehicles, registerDrivingStudent, saveDrivingRegistrationDraft,
  uploadFile,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';
import { isValidTcKimlik, isValidTrPhone, maskTcKimlik, maskTrPhone } from '../../lib/inputMasks';
import { PROFESSIONS, OTHER_PROFESSION } from '../../lib/professions';
import { FileButton } from '../../components/ui/file-button';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const STEPS = [
  { id: 1, title: 'Kimlik', icon: IdCard },
  { id: 2, title: 'İletişim', icon: UserRound },
  { id: 3, title: 'Eğitim', icon: CalendarClock },
  { id: 4, title: 'Evraklar', icon: FileCheck2 },
  { id: 5, title: 'Finans', icon: CreditCard },
  { id: 6, title: 'Onay', icon: ShieldCheck },
];

const DOCUMENT_TYPES = [
  { value: 'Identity', label: 'Kimlik fotokopisi', required: true },
  { value: 'Diploma', label: 'Diploma / öğrenim belgesi', required: true },
  { value: 'HealthReport', label: 'Sağlık raporu', required: true },
  { value: 'BiometricPhoto', label: 'Biyometrik fotoğraf', required: true },
  { value: 'CriminalRecord', label: 'Adli sicil kaydı', required: true },
  // Kan grubu belgesi kaldırıldı (bilgi kimlik/sağlık raporunda zaten var).
  { value: 'Residence', label: 'İkametgâh', required: true },
  { value: 'ParentalConsent', label: 'Veli izin belgesi (18 yaş altı)' },
  { value: 'ExistingLicense', label: 'Mevcut ehliyet' },
  { value: 'Other', label: 'Diğer belge' },
];

const emptyForm = {
  fullName: '', identityKind: 1, identityNumber: '', identitySerialNo: '', nationality: 'T.C.', birthDate: '',
  fatherName: '', motherName: '', birthPlace: '',
  gender: '', bloodType: '', occupation: '', educationLevel: '',
  city: '', district: '', address: '', residenceAddress: '', phone: '', email: '',
  // Nüfus kayıt bloğu — matbu EK-1 müracaat formunun kimlik tablosunu doldurur.
  registrationCity: '', registrationDistrict: '', registrationNeighborhood: '', registrationStreet: '',
  registrationVolumeNo: '', registrationFamilyOrderNo: '', registrationOrderNo: '',
  identityIssueDate: '', identityIssuePlace: '',
  emergencyContactName: '', emergencyContactPhone: '', photoUrl: '', livePhotoUrl: '',
  hasExistingLicense: false, existingLicenseNumber: '', existingLicenseClasses: '',
  licenseIssuePlace: '',
  packageId: '', courseStartsAtUtc: '', preferredInstructorProfileId: '', preferredVehicleId: '',
  drivingExperience: 1, availableWeekdays: true, availableWeekend: false,
  prefersMorning: false, prefersMidday: false, prefersEvening: false, accessibilityNotes: '',
  kvkkConsent: false, communicationConsent: false, signatureUrl: '', note: '',
  theoryExamFee: 0, drivingExamFee: 0, theoryExamFeePaid: false, drivingExamFeePaid: false,
  finance: { grossAmount: 0, discountAmount: 0, discountReason: '', downPayment: 0, downPaymentPaid: true, installmentCount: 0, firstInstallmentDate: '', downPaymentMethod: 'Nakit' },
  documents: [],
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

// Meslek seçimi: sıralı liste (Öğrenci dahil) + "Diğer" seçilince serbest metin.
function ProfessionField({ value, onChange }) {
  const known = PROFESSIONS.includes(value) && value !== OTHER_PROFESSION;
  const [manualOther, setManualOther] = useState(false);
  const other = manualOther || (Boolean(value) && !known);
  return (
    <>
      <select
        className={selectClass}
        value={other ? OTHER_PROFESSION : (known ? value : '')}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER_PROFESSION) { setManualOther(true); onChange(''); }
          else { setManualOther(false); onChange(next); }
        }}
      >
        <option value="">Seçin</option>
        {PROFESSIONS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      {other && (
        <Input className="mt-2" placeholder="Mesleğinizi yazın" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </>
  );
}

function Check({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border p-2.5 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

// Web kameradan anlık fotoğraf çeker ve /uploads'a yükler. Çekilen görüntü
// dosya olarak değil, doğrudan görüntü (livePhotoUrl) olarak saklanır.
function WebcamCapture({ value, onCaptured, onClear, folder = 'driving-student-photos' }) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  // Bileşen kapanınca kamerayı serbest bırak (kamera ışığı açık kalmasın).
  useEffect(() => () => stop(), [stop]);

  // active true olunca <video> DOM'da; akışı o an bağla.
  useEffect(() => {
    if (active && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [active]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      toast({ title: 'Kamera açılamadı', description: 'Uygulamaya kamera izni verildiğinden emin olun.', variant: 'destructive' });
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setBusy(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Görüntü alınamadı.');
      const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const data = new FormData(); data.set('file', file);
      const upload = await uploadFile(data, folder);
      onCaptured(upload.fileUrl);
      stop();
      toast({ title: 'Fotoğraf çekildi' });
    } catch (error) {
      toast({ title: 'Fotoğraf yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img src={assetUrl(value)} alt="Anlık fotoğraf" className="h-24 w-24 rounded-xl border object-cover" />
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={start}><Camera className="mr-2 h-4 w-4" />Yeniden çek</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}><X className="mr-2 h-4 w-4" />Kaldır</Button>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full max-w-xs rounded-xl border bg-black" playsInline muted />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={capture} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Yükleniyor…</> : <><Camera className="mr-2 h-4 w-4" />Çek</>}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={stop}>İptal</Button>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={start}>
      <Camera className="mr-2 h-4 w-4" />Web kameradan çek
    </Button>
  );
}

export default function DrivingStudentWizard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { can, loading: permissionsLoading } = useDrivingPermissions();

  // Lead'den geliş: aday adayı bilgileri ön dolu açılır; kayıt bitince lead
  // otomatik "kayda dönüştü" olarak dosyaya bağlanır.
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    fullName: searchParams.get('name') || emptyForm.fullName,
    phone: maskTrPhone(searchParams.get('phone') || emptyForm.phone),
  }));
  const [reference, setReference] = useState({ packages: [], instructors: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [identityState, setIdentityState] = useState({ checking: false, available: null, existingStudentName: null });
  const [phoneState, setPhoneState] = useState({ checking: false, available: null, existingStudentName: null });
  // NVİ doğrulaması: { checking, verified: true|false|null, message }
  const [nviState, setNviState] = useState({ checking: false, verified: undefined, message: null });
  const [draftId, setDraftId] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [result, setResult] = useState(null);
  // Son kayıt denemesinin hatası: sunucudan gelen adım/alan ayrıntılarıyla birlikte
  // ekranda kalıcı gösterilir (bkz. submit).
  const [submitError, setSubmitError] = useState(null);

  const canCreate = can(DRIVING.studentCreate);
  const canSeeFinance = can(DRIVING.financeView);
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (permissionsLoading) return;
    let active = true;
    (async () => {
      try {
        const [packages, instructors, vehicles, drafts] = await Promise.all([
          fetchDrivingPackages(),
          can(DRIVING.instructorView) ? fetchDrivingInstructors() : Promise.resolve([]),
          can(DRIVING.vehicleView) ? fetchDrivingVehicles() : Promise.resolve([]),
          fetchDrivingRegistrationDrafts().catch(() => []),
        ]);
        if (!active) return;
        setReference({ packages: packages || [], instructors: instructors || [], vehicles: vehicles || [] });

        // Yarım kalmış kayıt varsa kaldığı yerden devam ettir.
        const draft = (drafts || [])[0];
        if (draft?.payloadJson) {
          try {
            setForm({ ...emptyForm, ...JSON.parse(draft.payloadJson) });
            setStep(draft.step || 1);
            setDraftId(draft.id);
            toast({ title: 'Yarım kalan kayıt geri yüklendi', description: draft.displayName });
          } catch {
            // Bozuk taslak sessizce yok sayılır; boş formla devam.
          }
        }
      } catch (error) {
        toast({ title: 'Kayıt verileri alınamadı', description: error.message, variant: 'destructive' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [permissionsLoading, can, toast]);

  // Otomatik taslak kaydı: form her değiştiğinde 1.5 sn sonra sunucuya yazılır,
  // böylece sekme kapansa da veri kaybolmaz.
  const formRef = useRef(form);
  formRef.current = form;
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (loading || result || !form.fullName.trim()) return undefined;
    const timer = setTimeout(async () => {
      try {
        const saved = await saveDrivingRegistrationDraft({
          id: draftId,
          displayName: formRef.current.fullName,
          step: stepRef.current,
          payloadJson: JSON.stringify(formRef.current),
        });
        setDraftId(saved.id);
        setDraftSavedAt(new Date());
      } catch {
        // Taslak kaydı sessiz kalır: kullanıcıyı formun ortasında uyarmanın anlamı yok.
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [form, step, draftId, loading, result]);

  const selectedPackage = useMemo(
    () => reference.packages.find((x) => x.id === form.packageId),
    [reference.packages, form.packageId],
  );

  // Paket seçilince fiyat finans adımına düşer — personel elle yazmak zorunda kalmasın.
  useEffect(() => {
    if (selectedPackage) {
      setForm((current) => ({ ...current, finance: { ...current.finance, grossAmount: Number(selectedPackage.price) || 0 } }));
    }
  }, [selectedPackage]);

  const compatibleInstructors = useMemo(() => {
    if (!selectedPackage) return reference.instructors;
    return reference.instructors.filter((x) => {
      const classes = String(x.licenseClasses || '').split(',').map((c) => c.trim().toUpperCase());
      const transmissionOk = selectedPackage.transmissionType === 1 ? x.canTeachManual : x.canTeachAutomatic;
      return transmissionOk && classes.includes(String(selectedPackage.licenseClass).toUpperCase());
    });
  }, [reference.instructors, selectedPackage]);

  const compatibleVehicles = useMemo(() => {
    if (!selectedPackage) return reference.vehicles;
    return reference.vehicles.filter((x) => x.isActive
      && x.transmissionType === selectedPackage.transmissionType
      && String(x.licenseClass).toUpperCase() === String(selectedPackage.licenseClass).toUpperCase());
  }, [reference.vehicles, selectedPackage]);

  const netAmount = Math.max(0, Number(form.finance.grossAmount || 0) - Number(form.finance.discountAmount || 0));

  // MEBBİS aday girişinde eksik kalacak alanlar (sunucudaki kuralın ekran kopyası).
  const mebbisMissing = useMemo(() => {
    const has = (value) => Boolean((value || '').trim());
    const doc = (type) => form.documents.find((x) => x.documentType === type);
    const health = doc('HealthReport');
    const missing = [];
    if (!has(form.identityNumber)) missing.push('Kimlik numarası');
    if (!form.birthDate) missing.push('Doğum tarihi');
    if (!has(form.fatherName)) missing.push('Baba adı');
    if (!has(form.motherName)) missing.push('Anne adı');
    if (!has(form.birthPlace)) missing.push('Doğum yeri');
    if (!has(form.educationLevel)) missing.push('Öğrenim durumu');
    if (!has(form.identitySerialNo)) missing.push('Kimlik seri no');
    if (!has(form.phone)) missing.push('Telefon');
    if (!has(form.photoUrl) && !doc('BiometricPhoto')) missing.push('Biyometrik fotoğraf');
    if (!health) missing.push('Sağlık raporu');
    if (!doc('Diploma')) missing.push('Öğrenim belgesi');
    if (!doc('CriminalRecord')) missing.push('Adli sicil kaydı');
    return missing;
  }, [form]);

  const examFeesTotal = (Number(form.theoryExamFee) || 0) + (Number(form.drivingExamFee) || 0);
  const grandTotal = netAmount + examFeesTotal;
  const remainingAfterDownPayment = Math.max(0, netAmount - Number(form.finance.downPayment || 0));
  const perInstallment = form.finance.installmentCount > 0
    ? remainingAfterDownPayment / Number(form.finance.installmentCount)
    : 0;

  const isMinor = useMemo(() => {
    if (!form.birthDate) return false;
    const birth = new Date(form.birthDate);
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    return birth > eighteen;
  }, [form.birthDate]);

  const requiredDocuments = useMemo(
    () => DOCUMENT_TYPES.filter((x) => x.required || (isMinor && x.value === 'ParentalConsent')),
    [isMinor],
  );
  const missingDocuments = requiredDocuments.filter(
    (x) => !form.documents.some((d) => d.documentType === x.value),
  );

  async function checkIdentity() {
    const value = form.identityNumber.trim();
    if (value.length < 5) return;
    setIdentityState({ checking: true, available: null, existingStudentName: null });
    try {
      const response = await checkDrivingIdentity(value);
      setIdentityState({ checking: false, available: response.available, existingStudentName: response.existingStudentName });
    } catch {
      setIdentityState({ checking: false, available: null, existingStudentName: null });
    }
  }

  async function verifyWithNvi() {
    setNviState({ checking: true, verified: undefined, message: null });
    try {
      const response = await verifyDrivingIdentity({
        identityNumber: form.identityNumber.trim(),
        fullName: form.fullName.trim(),
        birthDate: form.birthDate,
      });
      setNviState({ checking: false, verified: response.verified, message: response.message });
    } catch (error) {
      setNviState({ checking: false, verified: null, message: error.message });
    }
  }

  async function checkPhone() {
    const digits = (form.phone || '').replace(/\D/g, '');
    if (digits.length < 10) { setPhoneState({ checking: false, available: null, existingStudentName: null }); return; }
    setPhoneState({ checking: true, available: null, existingStudentName: null });
    try {
      const response = await checkDrivingPhone(form.phone);
      setPhoneState({ checking: false, available: response.available, existingStudentName: response.existingStudentName });
    } catch {
      setPhoneState({ checking: false, available: null, existingStudentName: null });
    }
  }

  async function attachDocument(documentType, file) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const upload = await uploadFile(formData, 'driving-student-documents');
      setForm((current) => ({
        ...current,
        documents: [
          ...current.documents.filter((x) => x.documentType !== documentType),
          {
            documentType,
            fileUrl: upload.fileUrl,
            fileName: file.name,
          },
        ],
      }));
      toast({ title: 'Belge eklendi', description: file.name });
    } catch (error) {
      toast({ title: 'Belge yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function validateStep(current) {
    if (current === 1) {
      if (form.fullName.trim().length < 3) return 'Ad soyad en az 3 karakter olmalıdır.';
      if (form.identityKind === 1 && !isValidTcKimlik(form.identityNumber)) return 'Geçerli, 11 haneli bir T.C. kimlik numarası girin.';
      if (form.identityKind !== 1 && form.identityNumber.trim().length < 5) return 'Kimlik numarası zorunludur.';
      if (identityState.available === false) return 'Bu kimlik numarasıyla kayıtlı bir kursiyer zaten var.';
      if (!form.birthDate) return 'Doğum tarihi zorunludur.';
    }
    if (current === 2) {
      if (!isValidTrPhone(form.phone)) return 'Telefonu +90 5XX XXX XX XX biçiminde eksiksiz girin.';
      if (form.emergencyContactPhone && !isValidTrPhone(form.emergencyContactPhone)) return 'Acil durum telefonunu +90 5XX XXX XX XX biçiminde girin.';
      if (phoneState.available === false) return 'Bu telefon numarasıyla kayıtlı bir kursiyer zaten var.';
    }
    if (current === 3) {
      if (!form.packageId) return 'Paket seçimi zorunludur.';
      if (!form.availableWeekdays && !form.availableWeekend) return 'En az bir zaman uygunluğu seçilmelidir.';
    }
    if (current === 6 && !form.kvkkConsent) return 'KVKK onayı olmadan kayıt tamamlanamaz.';
    return null;
  }

  function next() {
    const error = validateStep(step);
    if (error) { toast({ title: 'Eksik bilgi', description: error, variant: 'destructive' }); return; }
    setStep((x) => Math.min(6, x + 1));
  }

  async function submit() {
    for (let current = 1; current <= 6; current += 1) {
      const error = validateStep(current);
      if (error) { setStep(current); toast({ title: 'Eksik bilgi', description: error, variant: 'destructive' }); return; }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        identityKind: Number(form.identityKind),
        drivingExperience: Number(form.drivingExperience),
        courseStartsAtUtc: form.courseStartsAtUtc ? new Date(form.courseStartsAtUtc).toISOString() : null,
        licenseIssueDate: null,
        licenseExpiryDate: null,
        identityIssueDate: form.identityIssueDate ? new Date(form.identityIssueDate).toISOString() : null,
        theoryExamFee: Number(form.theoryExamFee) || 0,
        drivingExamFee: Number(form.drivingExamFee) || 0,
        preferredInstructorProfileId: form.preferredInstructorProfileId || null,
        preferredVehicleId: form.preferredVehicleId || null,
        finance: Number(form.finance.grossAmount) > 0
          ? {
              grossAmount: Number(form.finance.grossAmount),
              discountAmount: Number(form.finance.discountAmount) || 0,
              discountReason: form.finance.discountReason,
              downPayment: Number(form.finance.downPayment) || 0,
              installmentCount: Number(form.finance.installmentCount) || 0,
              firstInstallmentDate: form.finance.firstInstallmentDate ? new Date(form.finance.firstInstallmentDate).toISOString() : null,
              downPaymentMethod: form.finance.downPaymentMethod,
              // Peşinat girildiyse ödendi/ödenmedi durumu; peşinat yoksa anlamsız (true).
              downPaymentPaid: Number(form.finance.downPayment) > 0 ? !!form.finance.downPaymentPaid : true,
            }
          : null,
      };
      const response = await registerDrivingStudent(payload);
      if (draftId) await deleteDrivingRegistrationDraft(draftId).catch(() => {});
      // Lead'den gelindiyse aday adayını kursiyer dosyasına bağla (başarısızsa kayıt bozulmaz).
      if (leadId) await convertDrivingLead(leadId, { studentDrivingProfileId: response.studentDrivingProfileId }).catch(() => {});
      setResult(response);
      setSubmitError(null);
      toast({ title: 'Kayıt tamamlandı', description: `${form.fullName} kursiyer olarak kaydedildi.` });
    } catch (error) {
      // Sunucu hangi adımda ne eksik olduğunu döner (problems). Panelde kalıcı
      // gösteririz; kaybolan bir toast'ta "kayıt tamamlanamadı" tek başına
      // personele hiçbir şey söylemiyordu.
      setSubmitError({
        message: error.message,
        problems: Array.isArray(error.body?.problems) ? error.body.problems : [],
        status: error.status,
      });
      toast({ title: 'Kayıt tamamlanamadı', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;

  if (!canCreate) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-2 py-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <b className="block text-lg">Kursiyer kaydı için yetkiniz yok</b>
          <p className="text-sm text-muted-foreground">Bu ekran kayıt sorumlusu ve yöneticiler içindir.</p>
        </CardContent>
      </Card>
    );
  }

  // Kayıt bitti: personel adaya kullanıcı adı/şifreyi teslim eder ve eksik evrakları görür.
  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="border-emerald-500/40">
          <CardContent className="space-y-5 py-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight">Kayıt tamamlandı</h1>
              <p className="text-muted-foreground">{form.fullName} kursiyer dosyası açıldı.</p>
              {result.studentNumber != null && (
                <p className="mt-2 inline-block rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-black text-brand-primary">
                  Kursiyer No: {result.studentNumber}
                </p>
              )}
            </div>

            <div className="rounded-2xl border bg-muted/40 p-4 text-left">
              <b className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Kursiyer giriş bilgileri</b>
              <p className="mt-2 text-sm">Kullanıcı adı: <b>{result.credentials?.username}</b></p>
              <p className="text-sm">Geçici şifre: <b>{result.credentials?.password}</b></p>
              <p className="mt-2 text-xs text-muted-foreground">
                Bu bilgiler yalnızca şimdi gösterilir. Aday mobil uygulamadan giriş yapıp eksik evraklarını yükleyebilir.
              </p>
            </div>

            {result.missingDocuments?.length > 0 && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-left">
                <b className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />Eksik zorunlu evraklar
                </b>
                <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                  {result.missingDocuments.map((x) => <li key={x.documentType}>{x.label}</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dosya tamamlanmadan kursiyer eğitime alınamaz; durumu "Evrak bekliyor" olarak açıldı.
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate(`/driving/students/${result.studentDrivingProfileId}`)}>
                Kursiyer dosyasını aç
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setForm(emptyForm); setStep(1); setDraftId(null); }}>
                Yeni kayıt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge className="mb-2 border-0 bg-violet-500/15 text-violet-600"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Kayıt sihirbazı</Badge>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Yeni Kursiyer Kaydı</h1>
          <p className="text-muted-foreground">Adım adım kimlik, evrak, finans ve onay — taslak otomatik kaydedilir.</p>
        </div>
        {draftSavedAt && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className="h-3.5 w-3.5" />Taslak kaydedildi {draftSavedAt.toLocaleTimeString('tr-TR')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = item.id === step;
          const done = item.id < step;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                active ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                  : done ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600'
                  : 'text-muted-foreground'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {item.id}. {item.title}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ad soyad"><Input required value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} /></Field>
              <Field label="Kimlik türü">
                <select className={selectClass} value={form.identityKind} onChange={(e) => set({ identityKind: Number(e.target.value) })}>
                  <option value={1}>T.C. Kimlik</option>
                  <option value={2}>Yabancı Kimlik</option>
                  <option value={3}>Pasaport</option>
                </select>
              </Field>
              <Field
                label="Kimlik numarası"
                hint={identityState.checking ? 'Kontrol ediliyor…'
                  : identityState.available === false ? `Bu numara kayıtlı: ${identityState.existingStudentName}`
                  : identityState.available === true ? 'Uygun — kurumda kayıtlı değil.' : 'Kurum içinde mükerrer kayıt engellenir.'}
              >
                <Input
                  required
                  value={form.identityNumber}
                  inputMode={form.identityKind === 1 ? 'numeric' : 'text'}
                  pattern={form.identityKind === 1 ? '[0-9]{11}' : undefined}
                  maxLength={form.identityKind === 1 ? 11 : 30}
                  placeholder={form.identityKind === 1 ? '11 haneli T.C. kimlik no' : 'Kimlik / pasaport numarası'}
                  onChange={(e) => {
                    set({ identityNumber: form.identityKind === 1 ? maskTcKimlik(e.target.value) : e.target.value.replace(/\s/g, '').slice(0, 30) });
                    setIdentityState({ checking: false, available: null, existingStudentName: null });
                  }}
                  onBlur={checkIdentity}
                  className={identityState.available === false ? 'border-red-500' : identityState.available === true ? 'border-emerald-500' : undefined}
                />
              </Field>
              <Field label="Kimlik seri no" hint="Kimlik kartının üzerindeki seri numarası (ör. A12 345678)">
                <Input maxLength={20} value={form.identitySerialNo} onChange={(e) => set({ identitySerialNo: e.target.value })} />
              </Field>
              {/* NVİ resmî doğrulaması: MEBBİS'te "kimlik uyuşmuyor" reti yaşanmasın. */}
              {form.identityKind === 1 && (
                <div className={`sm:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                  nviState.verified === true ? 'border-emerald-500/40 bg-emerald-500/5'
                    : nviState.verified === false ? 'border-red-500/40 bg-red-500/5'
                    : 'border-foreground/10'
                }`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={nviState.checking || form.identityNumber.trim().length !== 11 || !form.fullName.trim() || !form.birthDate}
                    onClick={verifyWithNvi}
                  >
                    {nviState.checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    NVİ ile Doğrula
                  </Button>
                  <span className={`text-sm ${
                    nviState.verified === true ? 'font-bold text-emerald-600'
                      : nviState.verified === false ? 'font-bold text-red-600'
                      : 'text-muted-foreground'
                  }`}>
                    {nviState.message || 'TC + ad soyad + doğum tarihi resmî NVİ kaydıyla karşılaştırılır (MEBBİS reti önlenir).'}
                  </span>
                </div>
              )}
              <Field label="Baba adı" hint="MEBBİS aday kaydında zorunludur.">
                <Input maxLength={100} value={form.fatherName} onChange={(e) => set({ fatherName: e.target.value })} />
              </Field>
              <Field label="Anne adı" hint="MEBBİS aday kaydında zorunludur.">
                <Input maxLength={100} value={form.motherName} onChange={(e) => set({ motherName: e.target.value })} />
              </Field>
              <Field label="Doğum yeri" hint="MEBBİS aday kaydında zorunludur.">
                <Input maxLength={100} value={form.birthPlace} onChange={(e) => set({ birthPlace: e.target.value })} />
              </Field>
              <Field label="Uyruk"><Input value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} /></Field>
              <Field label="Doğum tarihi" hint={isMinor ? '18 yaş altı: veli izin belgesi zorunlu olacak.' : undefined}>
                <Input required type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
              </Field>
              <Field label="Cinsiyet">
                <select className={selectClass} value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">Seçin</option><option value="Kadın">Kadın</option><option value="Erkek">Erkek</option><option value="Belirtmek istemiyorum">Belirtmek istemiyorum</option>
                </select>
              </Field>
              <Field label="Kan grubu">
                <select className={selectClass} value={form.bloodType} onChange={(e) => set({ bloodType: e.target.value })}>
                  <option value="">Seçin</option>
                  {['A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-', '0 Rh+', '0 Rh-'].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Öğrenim durumu">
                <select className={selectClass} value={form.educationLevel} onChange={(e) => set({ educationLevel: e.target.value })}>
                  <option value="">Seçin</option>
                  {['İlkokul', 'Ortaokul', 'Lise', 'Ön lisans', 'Lisans', 'Lisansüstü'].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Meslek"><ProfessionField value={form.occupation} onChange={(v) => set({ occupation: v })} /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Telefon"
                hint={phoneState.checking ? 'Kontrol ediliyor…'
                  : phoneState.available === false ? `Bu numara kayıtlı: ${phoneState.existingStudentName}`
                  : phoneState.available === true ? 'Uygun — kurumda kayıtlı değil.' : 'Aynı numarayla mükerrer kayıt engellenir.'}
              >
                <Input
                  required
                  value={form.phone}
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={17}
                  placeholder="+90 5XX XXX XX XX"
                  onChange={(e) => { set({ phone: maskTrPhone(e.target.value) }); setPhoneState({ checking: false, available: null, existingStudentName: null }); }}
                  onBlur={checkPhone}
                  className={phoneState.available === false ? 'border-red-500' : phoneState.available === true ? 'border-emerald-500' : undefined}
                />
              </Field>
              <Field label="E-posta"><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="İl"><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="İlçe"><Input value={form.district} onChange={(e) => set({ district: e.target.value })} /></Field>
              <Field label="Adres"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="İkametgâh adresi" hint="Nüfusa kayıtlı yerleşim yeri (MEB dosyası için)">
                <Input maxLength={500} value={form.residenceAddress} onChange={(e) => set({ residenceAddress: e.target.value })} />
              </Field>
              {/* Nüfus cüzdanından okunan kayıt bilgileri. Yalnız EK-1 müracaat
                  formunda kullanılır; boş bırakılırsa form elde doldurulabilir. */}
              <Field label="Nüfus ili" hint="Nüfusa kayıtlı olduğu il (müracaat formu)">
                <Input maxLength={60} value={form.registrationCity} onChange={(e) => set({ registrationCity: e.target.value })} />
              </Field>
              <Field label="Nüfus ilçesi">
                <Input maxLength={60} value={form.registrationDistrict} onChange={(e) => set({ registrationDistrict: e.target.value })} />
              </Field>
              <Field label="Köy - mahalle">
                <Input maxLength={120} value={form.registrationNeighborhood} onChange={(e) => set({ registrationNeighborhood: e.target.value })} />
              </Field>
              <Field label="Sokağı">
                <Input maxLength={120} value={form.registrationStreet} onChange={(e) => set({ registrationStreet: e.target.value })} />
              </Field>
              <Field label="Cilt no">
                <Input maxLength={30} value={form.registrationVolumeNo} onChange={(e) => set({ registrationVolumeNo: e.target.value })} />
              </Field>
              <Field label="Aile sıra no">
                <Input maxLength={30} value={form.registrationFamilyOrderNo} onChange={(e) => set({ registrationFamilyOrderNo: e.target.value })} />
              </Field>
              <Field label="Sıra no">
                <Input maxLength={30} value={form.registrationOrderNo} onChange={(e) => set({ registrationOrderNo: e.target.value })} />
              </Field>
              <Field label="Cüzdan veriliş tarihi">
                <Input type="date" value={form.identityIssueDate} onChange={(e) => set({ identityIssueDate: e.target.value })} />
              </Field>
              <Field label="Cüzdanın verildiği yer">
                <Input maxLength={120} value={form.identityIssuePlace} onChange={(e) => set({ identityIssuePlace: e.target.value })} />
              </Field>
              <Field label="Acil durum kişisi"><Input value={form.emergencyContactName} onChange={(e) => set({ emergencyContactName: e.target.value })} /></Field>
              <Field label="Acil durum telefonu"><Input value={form.emergencyContactPhone} inputMode="tel" autoComplete="tel" maxLength={17} placeholder="+90 5XX XXX XX XX" onChange={(e) => set({ emergencyContactPhone: maskTrPhone(e.target.value) })} /></Field>
              <Field label="Biyografik fotoğraf" hint="Dosyadan yüklenen vesikalık.">
                <div className="flex items-center gap-3">
                  {form.photoUrl && <img src={assetUrl(form.photoUrl)} alt="Biyografik" className="h-24 w-24 rounded-xl border object-cover" />}
                  <Input type="file" accept=".jpg,.jpeg,.png" disabled={uploading} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const data = new FormData(); data.set('file', file);
                      const upload = await uploadFile(data, 'driving-student-photos');
                      set({ photoUrl: upload.fileUrl });
                    } catch (error) {
                      toast({ title: 'Fotoğraf yüklenemedi', description: error.message, variant: 'destructive' });
                    } finally { setUploading(false); }
                  }} />
                </div>
              </Field>
              <Field label="Anlık fotoğraf (web kamera)" hint="Kayıt masasında çekilir; öğrenci detayında biyografik foto ile birlikte görünür.">
                <WebcamCapture
                  value={form.livePhotoUrl}
                  onCaptured={(url) => set({ livePhotoUrl: url })}
                  onClear={() => set({ livePhotoUrl: '' })}
                />
              </Field>
              <Field label="Kurum içi not"><Input maxLength={500} value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Paket" hint={selectedPackage ? `${selectedPackage.licenseClass} • ${selectedPackage.transmissionType === 1 ? 'Manuel' : 'Otomatik'} • ${selectedPackage.drivingLessonMinutes} dk direksiyon` : undefined}>
                  <select required className={selectClass} value={form.packageId} onChange={(e) => set({ packageId: e.target.value })}>
                    <option value="">Seçin</option>
                    {reference.packages.filter((x) => x.isActive).map((x) => (
                      <option key={x.id} value={x.id}>{x.name} • {x.licenseClass} • ₺{Number(x.price).toLocaleString('tr-TR')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Kurs başlangıç tarihi"><Input type="date" value={form.courseStartsAtUtc} onChange={(e) => set({ courseStartsAtUtc: e.target.value })} /></Field>
                <Field label="Tercih edilen öğretmen" hint="Yalnızca paketle uyumlu öğretmenler listelenir.">
                  <select className={selectClass} value={form.preferredInstructorProfileId} onChange={(e) => set({ preferredInstructorProfileId: e.target.value })}>
                    <option value="">Farketmez</option>
                    {compatibleInstructors.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
                  </select>
                </Field>
                <Field label="Tercih edilen araç" hint="Yalnızca paketin vites ve sınıfına uyan araçlar listelenir.">
                  <select className={selectClass} value={form.preferredVehicleId} onChange={(e) => set({ preferredVehicleId: e.target.value })}>
                    <option value="">Farketmez</option>
                    {compatibleVehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber} • {x.brand} {x.model}</option>)}
                  </select>
                </Field>
                <Field label="Sürüş deneyimi">
                  <select className={selectClass} value={form.drivingExperience} onChange={(e) => set({ drivingExperience: Number(e.target.value) })}>
                    <option value={1}>Hiç yok</option><option value={2}>Biraz var</option><option value={3}>Deneyimli</option>
                  </select>
                </Field>
                <Field label="Özel eğitim / erişilebilirlik notu">
                  <Input maxLength={1000} value={form.accessibilityNotes} onChange={(e) => set({ accessibilityNotes: e.target.value })} />
                </Field>
              </div>

              <div>
                <b className="text-sm">Zaman uygunluğu</b>
                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  <Check checked={form.availableWeekdays} onChange={(v) => set({ availableWeekdays: v })}>Hafta içi</Check>
                  <Check checked={form.availableWeekend} onChange={(v) => set({ availableWeekend: v })}>Hafta sonu</Check>
                  <Check checked={form.prefersMorning} onChange={(v) => set({ prefersMorning: v })}>Sabah</Check>
                  <Check checked={form.prefersMidday} onChange={(v) => set({ prefersMidday: v })}>Öğlen</Check>
                  <Check checked={form.prefersEvening} onChange={(v) => set({ prefersEvening: v })}>Akşam</Check>
                </div>
              </div>

              {/* Sınıf yükselten / hâlihazırda ehliyeti olan aday için, kartın üzerindeki bilgiler. */}
              <div>
                <Check checked={form.hasExistingLicense} onChange={(v) => set({ hasExistingLicense: v })}>
                  Adayın mevcut sürücü belgesi var (sınıf yükseltme)
                </Check>
                {form.hasExistingLicense && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Sürücü belgesi no"><Input maxLength={40} value={form.existingLicenseNumber} onChange={(e) => set({ existingLicenseNumber: e.target.value })} /></Field>
                    <Field label="Mevcut sınıf(lar)" hint="Örn. B veya B, A2"><Input maxLength={60} value={form.existingLicenseClasses} onChange={(e) => set({ existingLicenseClasses: e.target.value })} /></Field>
                    <Field label="Veren makam / yer (4c)"><Input maxLength={120} value={form.licenseIssuePlace} onChange={(e) => set({ licenseIssuePlace: e.target.value })} /></Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${missingDocuments.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
                {missingDocuments.length
                  ? <><AlertTriangle className="h-4 w-4 text-amber-600" /><span>{missingDocuments.length} zorunlu evrak eksik. Şimdi yüklemezseniz kursiyer "Evrak bekliyor" durumunda açılır.</span></>
                  : <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Zorunlu evrakların tamamı eklendi.</span></>}
              </div>

              {DOCUMENT_TYPES.filter((x) => x.value !== 'ParentalConsent' || isMinor).map((type) => {
                const attached = form.documents.find((x) => x.documentType === type.value);
                const required = type.required || (isMinor && type.value === 'ParentalConsent');
                return (
                  <div key={type.value} className={`space-y-2 rounded-xl border p-3 ${attached ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[220px] flex-1">
                        <b className="text-sm">{type.label}</b>
                        {required && !attached && <Badge className="ml-2 border-0 bg-red-500/15 text-red-600">Zorunlu</Badge>}
                        {attached && (
                          <Badge className="ml-2 border-0 bg-emerald-500/15 text-emerald-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Belge yüklendi
                          </Badge>
                        )}
                        {attached && <p className="text-xs text-muted-foreground">{attached.fileName}</p>}
                      </div>
                      <FileButton
                        className="w-72"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploading}
                        uploaded={Boolean(attached)}
                        onChange={(e) => attachDocument(type.value, e.target.files?.[0], null)}
                      />
                    </div>
                  </div>
                );
              })}
              {uploading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Belge yükleniyor…</p>}
            </div>
          )}

          {step === 5 && (
            canSeeFinance ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brüt tutar (₺)" hint={selectedPackage ? `Paket fiyatı: ₺${Number(selectedPackage.price).toLocaleString('tr-TR')}` : undefined}>
                  <Input type="number" min="0" value={form.finance.grossAmount} onChange={(e) => set({ finance: { ...form.finance, grossAmount: e.target.value } })} />
                </Field>
                <Field label="İndirim (₺)"><Input type="number" min="0" value={form.finance.discountAmount} onChange={(e) => set({ finance: { ...form.finance, discountAmount: e.target.value } })} /></Field>
                <Field label="İndirim nedeni"><Input value={form.finance.discountReason} onChange={(e) => set({ finance: { ...form.finance, discountReason: e.target.value } })} /></Field>
                <Field label="Peşinat (₺)"><Input type="number" min="0" value={form.finance.downPayment} onChange={(e) => set({ finance: { ...form.finance, downPayment: e.target.value } })} /></Field>
                {Number(form.finance.downPayment) > 0 ? (
                  <Field label="Peşinat durumu" hint={form.finance.downPaymentPaid ? 'Kayıtta tahsil edildi; makbuz kesilir.' : 'Tahsil edilmedi; “Peşinat Bekleyenler”de görünür.'}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => set({ finance: { ...form.finance, downPaymentPaid: true } })}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${form.finance.downPaymentPaid ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-foreground/15 text-muted-foreground hover:bg-foreground/5'}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />Ödendi
                      </button>
                      <button
                        type="button"
                        onClick={() => set({ finance: { ...form.finance, downPaymentPaid: false } })}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${!form.finance.downPaymentPaid ? 'border-red-500 bg-red-500/10 text-red-600' : 'border-foreground/15 text-muted-foreground hover:bg-foreground/5'}`}
                      >
                        <XCircle className="h-4 w-4" />Ödenmedi
                      </button>
                    </div>
                  </Field>
                ) : <div className="hidden sm:block" />}
                {Number(form.finance.downPayment) > 0 && form.finance.downPaymentPaid ? (
                  <Field label="Peşinat yöntemi">
                    <select className={selectClass} value={form.finance.downPaymentMethod} onChange={(e) => set({ finance: { ...form.finance, downPaymentMethod: e.target.value } })}>
                      <option value="Nakit">Nakit</option><option value="Kart">Kart</option><option value="Havale">Havale</option>
                    </select>
                  </Field>
                ) : null}
                <Field label="Taksit sayısı"><Input type="number" min="0" max="36" value={form.finance.installmentCount} onChange={(e) => set({ finance: { ...form.finance, installmentCount: e.target.value } })} /></Field>
                <Field label="İlk taksit tarihi"><Input type="date" value={form.finance.firstInstallmentDate} onChange={(e) => set({ finance: { ...form.finance, firstInstallmentDate: e.target.value } })} /></Field>

                {/* Sınav ücretleri: pakete dâhil değil; genel toplama eklenir, ödeme durumu ayrı takip edilir. */}
                <div className="rounded-2xl border p-4 sm:col-span-2">
                  <b className="text-sm">Sınav ücretleri (paket dışı)</b>
                  <p className="mb-3 text-xs text-muted-foreground">İlgili sınavı işaretleyip ücreti girin. Genel toplama eklenir; ödeme durumu sonradan da güncellenebilir.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <Check checked={Number(form.theoryExamFee) > 0} onChange={(v) => set({ theoryExamFee: v ? (Number(form.theoryExamFee) || 0) : 0, theoryExamFeePaid: v ? form.theoryExamFeePaid : false })}>
                        Teorik (e-sınav) ücreti
                      </Check>
                      <div className="mt-2 flex items-center gap-2">
                        <Input type="number" min="0" placeholder="₺" value={form.theoryExamFee || ''} onChange={(e) => set({ theoryExamFee: e.target.value })} />
                        <label className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                          <input type="checkbox" checked={form.theoryExamFeePaid} onChange={(e) => set({ theoryExamFeePaid: e.target.checked })} />Ödendi
                        </label>
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <Check checked={Number(form.drivingExamFee) > 0} onChange={(v) => set({ drivingExamFee: v ? (Number(form.drivingExamFee) || 0) : 0, drivingExamFeePaid: v ? form.drivingExamFeePaid : false })}>
                        Direksiyon sınav ücreti
                      </Check>
                      <div className="mt-2 flex items-center gap-2">
                        <Input type="number" min="0" placeholder="₺" value={form.drivingExamFee || ''} onChange={(e) => set({ drivingExamFee: e.target.value })} />
                        <label className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                          <input type="checkbox" checked={form.drivingExamFeePaid} onChange={(e) => set({ drivingExamFeePaid: e.target.checked })} />Ödendi
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/40 p-4 sm:col-span-2">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div><span className="text-xs text-muted-foreground">Net tutar</span><p className="text-xl font-black">₺{netAmount.toLocaleString('tr-TR')}</p></div>
                    <div><span className="text-xs text-muted-foreground">Sınav ücretleri</span><p className="text-xl font-black">₺{examFeesTotal.toLocaleString('tr-TR')}</p></div>
                    <div><span className="text-xs text-muted-foreground">Genel toplam</span><p className="text-xl font-black text-brand-primary">₺{grandTotal.toLocaleString('tr-TR')}</p></div>
                    <div><span className="text-xs text-muted-foreground">Taksit tutarı</span><p className="text-xl font-black">{perInstallment > 0 ? `₺${perInstallment.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : '—'}</p></div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Taksitlendirme yalnızca kurs ücreti (net tutar) üzerinden yapılır; sınav ücretleri ayrı takip edilir.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Finans bilgisi girmek için yetkiniz yok. Kayıt finans adımı olmadan tamamlanır; sözleşmeyi muhasebe oluşturur.
              </div>
            )
          )}

          {step === 6 && (
            <div className="space-y-5">
              {submitError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
                  <b className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />Kayıt tamamlanamadı
                  </b>
                  <p className="mt-1 text-sm text-muted-foreground">{submitError.message}</p>
                  {submitError.problems.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {submitError.problems.map((problem, index) => (
                        <li key={`${problem.field}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className="shrink-0">{problem.step}. adım · {problem.section}</Badge>
                          <b>{problem.field}:</b>
                          <span className="text-muted-foreground">{problem.message}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setStep(problem.step)}
                          >
                            Git
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {submitError.status >= 500
                        ? 'Sunucu tarafında beklenmeyen bir hata oluştu. Bilgiler kaydedilmedi; tekrar deneyin, sürerse bu mesajı yöneticinize iletin.'
                        : 'Ayrıntı sunucudan gelmedi. Alanları kontrol edip tekrar deneyin.'}
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <b className="text-sm text-muted-foreground">Kursiyer</b>
                  <p className="text-lg font-black">{form.fullName || '—'}</p>
                  <p className="text-sm text-muted-foreground">{form.identityNumber} • {form.birthDate}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <b className="text-sm text-muted-foreground">Paket</b>
                  <p className="text-lg font-black">{selectedPackage?.name || '—'}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPackage ? `${selectedPackage.licenseClass} • ${selectedPackage.transmissionType === 1 ? 'Manuel' : 'Otomatik'}` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <b className="text-sm text-muted-foreground">Evraklar</b>
                  <p className="text-lg font-black">{form.documents.length} yüklendi</p>
                  <p className={`text-sm ${missingDocuments.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {missingDocuments.length ? `${missingDocuments.length} zorunlu evrak eksik` : 'Dosya tamam'}
                  </p>
                </div>
                {canSeeFinance && (
                  <div className="rounded-2xl border p-4">
                    <b className="text-sm text-muted-foreground">Finans</b>
                    <p className="text-lg font-black">₺{netAmount.toLocaleString('tr-TR')}</p>
                    <p className="text-sm text-muted-foreground">
                      Peşinat ₺{Number(form.finance.downPayment || 0).toLocaleString('tr-TR')} • {form.finance.installmentCount || 0} taksit
                    </p>
                  </div>
                )}
              </div>

              {/* MEBBİS hazırlık kontrolü: kayıt engellenmez, sekreter neyin eksik kalacağını görür. */}
              <div className={`rounded-2xl border p-4 ${mebbisMissing.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
                <b className={`flex items-center gap-2 text-sm ${mebbisMissing.length ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {mebbisMissing.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {mebbisMissing.length ? `MEBBİS için eksik: ${mebbisMissing.length} alan` : 'MEBBİS aday girişi için tüm alanlar hazır.'}
                </b>
                {mebbisMissing.length > 0 && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mebbisMissing.map((item) => (
                        <span key={item} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{item}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Kayıt yine tamamlanabilir; eksikler kursiyer dosyasından sonradan girilebilir.</p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Check checked={form.kvkkConsent} onChange={(v) => set({ kvkkConsent: v })}>
                  KVKK aydınlatma metni okundu ve kişisel verilerin işlenmesine onay verildi (zorunlu).
                </Check>
                <Check checked={form.communicationConsent} onChange={(v) => set({ communicationConsent: v })}>
                  Ticari elektronik ileti (SMS/e-posta) gönderimine onay verildi.
                </Check>
              </div>

              <Field label="Kursiyer imzası (sözleşme)" hint={form.signatureUrl ? 'İmzalı sözleşme yüklendi.' : 'İmzalı sözleşmeyi tarayıp yükleyin; sonra da eklenebilir.'}>
                <FileButton label="Sözleşme Yükle" accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const data = new FormData(); data.set('file', file);
                    const upload = await uploadFile(data, 'driving-student-contracts');
                    set({ signatureUrl: upload.fileUrl });
                  } catch (error) {
                    toast({ title: 'Sözleşme yüklenemedi', description: error.message, variant: 'destructive' });
                  } finally { setUploading(false); }
                }} />
              </Field>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((x) => Math.max(1, x - 1))}>
              <ArrowLeft className="mr-2 h-4 w-4" />Geri
            </Button>
            {step < 6 ? (
              <Button onClick={next}>İleri<ArrowRight className="ml-2 h-4 w-4" /></Button>
            ) : (
              <Button disabled={saving || uploading} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={submit}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Kaydı Tamamla
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
