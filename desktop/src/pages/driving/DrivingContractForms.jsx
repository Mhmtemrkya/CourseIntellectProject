import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Building2, Download, FileSignature, FileText, Package, PenLine, Search, Settings2, ShieldAlert, UserRound,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { maskTrPhone } from '../../lib/inputMasks';
import {
  downloadDrivingContractForm, fetchDrivingContractFormSettings, fetchDrivingStudentDetail,
  fetchDrivingStudents, updateDrivingContractFormSettings, updateDrivingRegistrationIdentity,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, itemVariants } from './_shared';

// Basılabilecek matbu evraklar. `needsFinance` olanlar ücret/taksit tablosu
// taşıdığı için finans yetkisi olmayana gösterilmez (backend de reddeder).
const FORMS = [
  {
    key: 'muracaat',
    title: 'EK-1 Müracaat Formu',
    description: 'Nüfus bilgileri, öğrenim durumu ve mevcut ehliyet bloğu ile kursa müracaat dilekçesi.',
    icon: FileText,
    pages: 1,
    needsFinance: false,
  },
  {
    key: 'imza-sirkuleri',
    title: 'Kursiyerin İmza Sirküleri',
    description: 'MEBBİS modülüne taranarak yüklenen imza örneği sayfası.',
    icon: PenLine,
    pages: 1,
    needsFinance: false,
  },
  {
    key: 'sozlesme',
    title: 'Kayıt Sözleşmesi',
    description: 'Kursiyer ve kurum künyesi, mevzuat maddeleri ve ödeme planı tablosu (ön + arka yüz).',
    icon: FileSignature,
    pages: 2,
    needsFinance: true,
  },
  {
    key: 'tumu',
    title: 'Tüm Evrak Paketi',
    description: 'Üç belge tek PDF olarak — kayıt masasında tek seferde basmak için.',
    icon: Package,
    pages: 4,
    needsFinance: true,
  },
];

// Müracaat formunun boş kalmaması için kursiyerde bulunması gereken alanlar.
const REQUIRED_STUDENT_FIELDS = [
  { key: 'fatherName', label: 'Baba adı' },
  { key: 'motherName', label: 'Ana adı' },
  { key: 'birthPlace', label: 'Doğum yeri' },
  { key: 'registrationCity', label: 'Nüfus ili' },
  { key: 'registrationDistrict', label: 'Nüfus ilçesi' },
  { key: 'registrationNeighborhood', label: 'Köy-mahalle' },
  { key: 'registrationVolumeNo', label: 'Cilt no' },
  { key: 'registrationFamilyOrderNo', label: 'Aile sıra no' },
  { key: 'registrationOrderNo', label: 'Sıra no' },
];

// Sözleşmenin künye ve ücret satırlarının dolu olması için gereken kurum alanları.
const REQUIRED_SETTINGS_FIELDS = [
  { key: 'institutionName', label: 'Kurum adı' },
  { key: 'institutionCode', label: 'Kurum kodu' },
  { key: 'institutionCity', label: 'İl' },
  { key: 'institutionDistrict', label: 'İlçe' },
  { key: 'institutionAddress', label: 'Adres' },
  { key: 'institutionPhone', label: 'Telefon' },
  { key: 'directorName', label: 'Müdür/kurucu adı' },
  { key: 'theoryHourlyFee', label: 'Teorik saat ücreti' },
  { key: 'drivingHourlyFee', label: 'Direksiyon saat ücreti' },
];

const isBlank = (value) => value === null || value === undefined || `${value}`.trim() === '' || value === 0;

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/// Kurum künyesi: bir kere doldurulur, sonra her kursiyerin evrakında kullanılır.
function InstitutionSettingsModal({ initial, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateDrivingContractFormSettings({
        ...form,
        theoryHourlyFee: Number(form.theoryHourlyFee) || 0,
        drivingHourlyFee: Number(form.drivingHourlyFee) || 0,
        theoryExamFee: 0,
        drivingExamFee: Number(form.drivingExamFee) || 0,
        theoryHours: Number(form.theoryHours) || 34,
        drivingHours: Number(form.drivingHours) || 16,
      });
      toast({ title: 'Kurum künyesi kaydedildi' });
      onSaved(saved);
      onClose();
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Sözleşme ve form künyesi</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Bu bilgiler matbu evrakların kurum sütununa ve sözleşme metnindeki ücret satırlarına basılır.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Kurum künyesi</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kurum adı" value={form.institutionName} onChange={set('institutionName')} placeholder="Özel ... M.T.S.K." />
              <Field label="MEBBİS kurum kodu" value={form.institutionCode} onChange={set('institutionCode')} placeholder="Örn. 40052" />
              <Field label="Müdür / kurucu adı" value={form.directorName} onChange={set('directorName')} />
              <Field label="İl" value={form.institutionCity} onChange={set('institutionCity')} />
              <Field label="İlçe" value={form.institutionDistrict} onChange={set('institutionDistrict')} />
              <Field label="Telefon" value={maskTrPhone(form.institutionPhone)} onChange={(value) => set('institutionPhone')(maskTrPhone(value))} placeholder="+90 5XX XXX XX XX" />
              <Field label="Yetkili mahkeme ili" value={form.jurisdictionCity} onChange={set('jurisdictionCity')} placeholder="Boşsa kurum ili" />
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Adres</span>
                <Input value={form.institutionAddress ?? ''} onChange={(e) => set('institutionAddress')(e.target.value)} />
              </label>
              <Field label="Banka adı" value={form.bankName} onChange={set('bankName')} />
              <Field label="Hesap / IBAN no" value={form.bankAccountNo} onChange={set('bankAccountNo')} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Mevzuat ücretleri ve ders saatleri</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Teorik saat ücreti (TL)" type="number" value={form.theoryHourlyFee} onChange={set('theoryHourlyFee')} />
              <Field label="Direksiyon saat ücreti (TL)" type="number" value={form.drivingHourlyFee} onChange={set('drivingHourlyFee')} />
              <Field label="Direksiyon sınav ücreti (TL)" type="number" value={form.drivingExamFee} onChange={set('drivingExamFee')} />
              <Field label="Zorunlu teorik ders saati" type="number" value={form.theoryHours} onChange={set('theoryHours')} />
              <Field label="Zorunlu direksiyon ders saati" type="number" value={form.drivingHours} onChange={set('drivingHours')} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/// Kursiyerin nüfus kayıt bloğu — müracaat formunun kimlik tablosunu doldurur.
function RegistrationIdentityModal({ profileId, detail, onClose, onSaved }) {
  const { toast } = useToast();
  const student = detail?.overview ?? {};
  const [form, setForm] = useState({
    fatherName: student.fatherName ?? '', motherName: student.motherName ?? '', birthPlace: student.birthPlace ?? '',
    registrationCity: student.registrationCity ?? '', registrationDistrict: student.registrationDistrict ?? '',
    registrationNeighborhood: student.registrationNeighborhood ?? '', registrationStreet: student.registrationStreet ?? '',
    registrationVolumeNo: student.registrationVolumeNo ?? '', registrationFamilyOrderNo: student.registrationFamilyOrderNo ?? '',
    registrationOrderNo: student.registrationOrderNo ?? '',
    identityIssueDate: student.identityIssueDate ? student.identityIssueDate.slice(0, 10) : '',
    identityIssuePlace: student.identityIssuePlace ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDrivingRegistrationIdentity(profileId, {
        ...form,
        identityIssueDate: form.identityIssueDate ? new Date(form.identityIssueDate).toISOString() : null,
      });
      toast({ title: 'Nüfus bilgileri kaydedildi' });
      await onSaved();
      onClose();
    } catch (error) {
      toast({ title: 'Kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Nüfus kayıt bilgileri — {student.fullName}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Nüfus cüzdanından okunarak girilir. Boş bırakılan alanlar formda boş basılır, elde doldurulabilir.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Baba adı" value={form.fatherName} onChange={set('fatherName')} />
          <Field label="Ana adı" value={form.motherName} onChange={set('motherName')} />
          <Field label="Doğum yeri" value={form.birthPlace} onChange={set('birthPlace')} />
          <Field label="Nüfus ili" value={form.registrationCity} onChange={set('registrationCity')} />
          <Field label="Nüfus ilçesi" value={form.registrationDistrict} onChange={set('registrationDistrict')} />
          <Field label="Köy - mahalle" value={form.registrationNeighborhood} onChange={set('registrationNeighborhood')} />
          <Field label="Sokağı" value={form.registrationStreet} onChange={set('registrationStreet')} />
          <Field label="Cilt no" value={form.registrationVolumeNo} onChange={set('registrationVolumeNo')} />
          <Field label="Aile sıra no" value={form.registrationFamilyOrderNo} onChange={set('registrationFamilyOrderNo')} />
          <Field label="Sıra no" value={form.registrationOrderNo} onChange={set('registrationOrderNo')} />
          <Field label="Veriliş tarihi" type="date" value={form.identityIssueDate} onChange={set('identityIssueDate')} />
          <Field label="Verildiği yer" value={form.identityIssuePlace} onChange={set('identityIssuePlace')} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DrivingContractForms() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const canView = can(DRIVING.studentView);
  const canSeeFinance = can(DRIVING.financeView);
  const canManageSettings = can(DRIVING.settingsManage);
  const canUpdateStudent = can(DRIVING.studentUpdate);

  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [studentList, formSettings] = await Promise.all([
        fetchDrivingStudents(),
        fetchDrivingContractFormSettings().catch(() => null),
      ]);
      setStudents(studentList || []);
      setSettings(formSettings);
    } catch (error) {
      toast({ title: 'Kursiyerler alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { if (!permissionsLoading && canView) load(); }, [load, permissionsLoading, canView]);

  // Seçilen kursiyerin dosyası, eksik alan uyarısını gösterebilmek için çekilir.
  const loadDetail = useCallback(async (profileId) => {
    if (!profileId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      setDetail(await fetchDrivingStudentDetail(profileId));
    } catch (error) {
      setDetail(null);
      toast({ title: 'Kursiyer dosyası alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    if (!needle) return students;
    return students.filter((s) => `${s.fullName} ${s.studentNumber}`.toLocaleLowerCase('tr').includes(needle));
  }, [students, query]);

  const selected = useMemo(() => students.find((s) => s.id === selectedId) ?? null, [students, selectedId]);

  const missingStudentFields = useMemo(() => {
    if (!detail?.overview) return [];
    return REQUIRED_STUDENT_FIELDS.filter((f) => isBlank(detail.overview[f.key])).map((f) => f.label);
  }, [detail]);

  const missingSettingsFields = useMemo(() => {
    if (!settings) return [];
    return REQUIRED_SETTINGS_FIELDS.filter((f) => isBlank(settings[f.key])).map((f) => f.label);
  }, [settings]);

  const download = async (form) => {
    if (!selectedId) return;
    setDownloading(form.key);
    try {
      const blob = await downloadDrivingContractForm(selectedId, form.key);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${form.title} - ${selected?.fullName ?? selectedId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Belge indirilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  if (permissionsLoading || loading) return <DrivingLoading />;

  if (!canView) {
    return (
      <DrivingPage testId="driving-contract-forms">
        <DrivingNotice
          icon={ShieldAlert}
          title="Bu sayfayı görme yetkiniz yok"
          message="Sözleşme ve formlar sayfası kursiyer görüntüleme yetkisi gerektirir."
        />
      </DrivingPage>
    );
  }

  const visibleForms = FORMS.filter((f) => !f.needsFinance || canSeeFinance);

  return (
    <DrivingPage testId="driving-contract-forms">
      <DrivingPageHeader
        title="Sözleşme ve Formlar"
        description="Kursiyer seçin, matbu MEB evrakları bilgileriyle dolu olarak insin."
        icon={FileSignature}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={canManageSettings && settings ? (
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Kurum künyesi
          </Button>
        ) : null}
      />

      {missingSettingsFields.length > 0 ? (
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Kurum künyesi eksik</p>
              <p className="text-sm text-muted-foreground">
                Sözleşmede boş kalacak alanlar: {missingSettingsFields.join(', ')}.
              </p>
            </div>
          </div>
          {canManageSettings ? (
            <Button size="sm" onClick={() => setSettingsOpen(true)}>Şimdi doldur</Button>
          ) : null}
        </motion.div>
      ) : null}

      <motion.div variants={itemVariants} className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* ── Kursiyer seçimi ── */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Ad veya kursiyer no ara…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-3 max-h-[540px] space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Kursiyer bulunamadı.</p>
            ) : filtered.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedId(student.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                  student.id === selectedId
                    ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.08)]'
                    : 'border-transparent hover:bg-foreground/[0.04]'
                }`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-xs font-black">
                  {student.studentNumber}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{student.fullName}</p>
                  <p className="text-xs text-muted-foreground">{student.licenseClass} sınıfı</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Belgeler ── */}
        <div className="space-y-4">
          {!selected ? (
            <DrivingNotice
              icon={UserRound}
              title="Kursiyer seçin"
              message="Soldaki listeden bir kursiyer seçtiğinizde evrakları bilgileriyle dolu olarak indirebilirsiniz."
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold">{selected.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    Kursiyer no {selected.studentNumber} · {selected.licenseClass} sınıfı
                  </p>
                </div>
                {canUpdateStudent && !detailLoading ? (
                  <Button variant="outline" size="sm" onClick={() => setIdentityOpen(true)}>
                    <PenLine className="mr-2 h-4 w-4" /> Nüfus bilgileri
                  </Button>
                ) : null}
              </div>

              {missingStudentFields.length > 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Müracaat formunda boş kalacak alanlar</p>
                    <p className="text-sm text-muted-foreground">{missingStudentFields.join(', ')}.</p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleForms.map((form) => (
                  <div key={form.key} className="flex flex-col rounded-2xl border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]">
                        <form.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{form.title}</p>
                          <Badge variant="secondary" className="shrink-0">{form.pages} sayfa</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      variant={form.key === 'tumu' ? 'default' : 'outline'}
                      disabled={downloading !== null}
                      onClick={() => download(form)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {downloading === form.key ? 'Hazırlanıyor…' : 'PDF indir'}
                    </Button>
                  </div>
                ))}
              </div>

              {!canSeeFinance ? (
                <p className="text-xs text-muted-foreground">
                  Kayıt sözleşmesi ücret ve taksit bilgisi içerdiği için yalnızca finans yetkisi olan kullanıcılara gösterilir.
                </p>
              ) : null}
            </>
          )}
        </div>
      </motion.div>

      {settingsOpen && settings ? (
        <InstitutionSettingsModal
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={setSettings}
        />
      ) : null}

      {identityOpen && detail ? (
        <RegistrationIdentityModal
          profileId={selectedId}
          detail={detail}
          onClose={() => setIdentityOpen(false)}
          onSaved={() => loadDetail(selectedId)}
        />
      ) : null}
    </DrivingPage>
  );
}
