import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Eye, FileSignature, FileText, RefreshCw, Search, Upload, UserRound,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { useApp } from '../context/AppContext';
import { getUserRoles } from '../lib/permissions';
import {
  cancelConsentForm,
  createConsentForm,
  createConsentTemplate,
  dispatchConsentFormToStation,
  downloadConsentFormDocument,
  downloadConsentFormPdf,
  downloadConsentTemplatePreview,
  fetchConsentCatalog,
  fetchConsentStations,
  fetchConsentTemplates,
  fetchStudentConsentForms,
  fetchStudents,
  revokeConsentFormSession,
  updateConsentForm,
  uploadConsentDocument,
} from '../lib/api/modules';
import { cn } from '@/lib/utils';

/** İmza bekleyen form varken bu aralıkta yoklanır — imza anında ekrana düşsün. */
const POLL_INTERVAL_MS = 2500;

/** Yüklenen PDF için istemci tarafı sınır; sunucu da 12 MB'da keser. */
const MAX_PDF_BYTES = 12 * 1024 * 1024;

const SIGNER_ROLES = [
  { value: 'StudentOrParent', label: 'Öğrenci veya veli' },
  { value: 'Parent', label: 'Veli / yasal temsilci' },
  { value: 'Student', label: 'Öğrencinin kendisi' },
];

/** Bu ekran okul tarafıdır; sürücü kursuna özel akışlar burada listelenmez. */
const SCHOOL_MODULES = new Set(['all', 'school']);

const STATUS_LABEL = {
  Draft: 'Hazırlanıyor',
  AwaitingSignature: 'İmza bekleniyor',
  Signed: 'İmzalandı',
  Cancelled: 'İptal',
};

function StatusBadge({ status }) {
  if (status === 'Signed') {
    return <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600">İmzalandı</Badge>;
  }
  if (status === 'AwaitingSignature') {
    return <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600">İmza bekleniyor</Badge>;
  }
  if (!status) return <Badge variant="outline">Gönderilmedi</Badge>;
  return <Badge variant="secondary">{STATUS_LABEL[status] || status}</Badge>;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Sekme açılana kadar adres yaşamalı; 30 sn sonra serbest bırakılır.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Okul tarafı Sözleşmeler & Formlar ekranı.
 *
 * Sürücü kursundaki eş ekran matbu MEB evraklarını basar; buradaki iş farklıdır:
 * kurumun KENDİ sözleşme/form PDF'i yüklenir ya da sistemde metin olarak yazılır,
 * sonra öğrenci seçilip belge imza tabletine gönderilir. İmzalanan belge aynı
 * ekrandan PDF olarak indirilir.
 */
export default function SchoolContractForms() {
  const { toast } = useToast();
  const { user } = useApp();
  // getUserRoles KÜÇÜK HARFLİ menü anahtarları döner ('admin', 'administrative');
  // backend rol adlarıyla ('Admin') karşılaştırmak sessizce yetkisiz gösterir.
  const roles = useMemo(() => new Set(getUserRoles(user)), [user]);
  // Şablon/PDF yazma yetkisi yönetimdedir (sunucu da aynı rolleri arar).
  const canManageTemplates = roles.has('admin') || roles.has('administrative') || roles.has('superadmin');

  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contextKinds, setContextKinds] = useState([]);
  const [stations, setStations] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [composer, setComposer] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [justSigned, setJustSigned] = useState(null);

  const previousStatusRef = useRef(new Map());

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [studentList, templateList, catalog, stationList] = await Promise.all([
        fetchStudents(),
        fetchConsentTemplates(false),
        fetchConsentCatalog().catch(() => ({ contextKinds: [] })),
        fetchConsentStations().catch(() => []),
      ]);
      setStudents(Array.isArray(studentList) ? studentList : studentList?.items || []);
      setTemplates(templateList);
      setContextKinds((catalog?.contextKinds || []).filter((kind) => SCHOOL_MODULES.has(kind.module)));
      setStations(stationList);
    } catch (error) {
      toast({ title: 'Ekran yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadForms = useCallback(async ({ silent = false } = {}) => {
    if (!selectedId) { setForms([]); return; }
    try {
      const [list, stationList] = await Promise.all([
        fetchStudentConsentForms(selectedId),
        fetchConsentStations().catch(() => []),
      ]);

      // İmza az önce mi geldi? Personel ekranında yeşil şerit bunun için çizilir.
      const previous = previousStatusRef.current;
      const fresh = list.find((form) => form.status === 'Signed' && previous.get(form.id) === 'AwaitingSignature');
      previousStatusRef.current = new Map(list.map((form) => [form.id, form.status]));
      if (fresh) setJustSigned(fresh.title);

      setForms(list);
      setStations(stationList);
    } catch (error) {
      if (!silent) toast({ title: 'Öğrencinin formları alınamadı', description: error.message, variant: 'destructive' });
    }
  }, [selectedId, toast]);

  useEffect(() => {
    previousStatusRef.current = new Map();
    loadForms();
  }, [loadForms]);

  const awaiting = useMemo(() => forms.some((form) => form.status === 'AwaitingSignature'), [forms]);

  // Yalnız imza beklenirken yoklanır; boşta ağ trafiği üretilmez.
  useEffect(() => {
    if (!awaiting) return undefined;
    const timer = setInterval(() => loadForms({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [awaiting, loadForms]);

  useEffect(() => {
    if (!justSigned) return undefined;
    const timer = setTimeout(() => setJustSigned(null), 8000);
    return () => clearTimeout(timer);
  }, [justSigned]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    if (!needle) return students;
    return students.filter((student) => `${student.fullName} ${student.schoolNumber || ''} ${student.className || ''}`
      .toLocaleLowerCase('tr').includes(needle));
  }, [students, query]);

  const selected = useMemo(
    () => students.find((student) => student.id === selectedId) ?? null,
    [students, selectedId],
  );

  /// Şablonun bu öğrencideki EN GÜNCEL kaydı: imzalı varsa o, yoksa en yenisi.
  const formOf = useCallback((templateId) => {
    const candidates = forms.filter((form) => form.templateId === templateId);
    if (candidates.length === 0) return null;
    return candidates.slice().sort((a, b) => {
      if ((a.status === 'Signed') !== (b.status === 'Signed')) return a.status === 'Signed' ? -1 : 1;
      return new Date(b.signedAtUtc || b.createdAtUtc) - new Date(a.signedAtUtc || a.createdAtUtc);
    })[0];
  }, [forms]);

  const openComposer = async (template, existing) => {
    setBusyId(template.id);
    try {
      // Var olan taslak açılırken KAYDIN metni okunur, şablonunki değil: yer
      // tutucular kayıt üretilirken dolduruldu, şablonda ham hâlde duruyor.
      if (existing && existing.status === 'Draft') {
        setComposer({ ...existing, createdHere: false });
      } else {
        const created = await createConsentForm({
          templateId: template.id,
          studentProfileId: selectedId,
          contextKind: template.bindings?.[0]?.contextKind || 'SchoolEnrollment',
          contextKey: template.bindings?.[0]?.contextKey || null,
          contextRefId: null,
          contextLabel: selected?.className || null,
          staffNotes: null,
        });
        setComposer({ ...created, createdHere: true });
      }
      await loadForms({ silent: true });
    } catch (error) {
      toast({ title: 'Form açılamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const dispatchForm = async (form, stationName) => {
    if (!stationName?.trim()) {
      toast({
        title: 'Tablet adı gerekli',
        description: 'Formun gideceği tabletin adını yazın veya listeden seçin.',
        variant: 'destructive',
      });
      return;
    }
    setBusyId(form.id);
    try {
      // Personelin yazdığı not önce kayda işlenir; imzalı belgeye o hâliyle basılır.
      await updateConsentForm(form.id, { staffNotes: form.staffNotes || '' });
      await dispatchConsentFormToStation(form.id, stationName.trim());
      toast({ title: 'Form tablete gönderildi', description: `${stationName.trim()} ekranında imza bekleniyor.` });
      setComposer(null);
      await loadForms({ silent: true });
    } catch (error) {
      toast({ title: 'Form gönderilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (formId) => {
    setBusyId(formId);
    try {
      await revokeConsentFormSession(formId);
      await loadForms({ silent: true });
    } catch (error) {
      toast({ title: 'Gönderim geri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const downloadSigned = async (form) => {
    setBusyId(form.id);
    try {
      const blob = await downloadConsentFormPdf(form.id);
      saveBlob(blob, `${selected?.fullName || 'ogrenci'}-${form.title}.pdf`.replace(/\s+/g, '-'));
    } catch (error) {
      toast({ title: 'Belge indirilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const previewTemplate = async (template) => {
    try {
      openBlob(await downloadConsentTemplatePreview(template.id));
    } catch (error) {
      toast({ title: 'Önizleme açılamadı', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="school-contract-forms">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))] text-white">
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Sözleşmeler &amp; Formlar</h1>
            <p className="text-sm text-muted-foreground">
              Kurumun sözleşme ve izin belgelerini yükleyin, öğrenci seçip tablette imzalatın.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} /> Yenile
          </Button>
          {canManageTemplates ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> PDF yükle
            </Button>
          ) : null}
        </div>
      </div>

      {justSigned ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Form imzalandı: {justSigned}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* ── Öğrenci seçimi ── */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Ad, okul no veya sınıf ara…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-3 max-h-[560px] space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Öğrenci bulunamadı.</p>
            ) : filtered.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedId(student.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition',
                  student.id === selectedId
                    ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.08)]'
                    : 'border-transparent hover:bg-foreground/[0.04]',
                )}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-xs font-black">
                  {student.schoolNumber || student.fullName?.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{student.fullName}</p>
                  <p className="text-xs text-muted-foreground">{student.className || 'Sınıf yok'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Belgeler ── */}
        <div className="space-y-4">
          {!selected ? (
            <div className="grid place-items-center rounded-2xl border bg-card p-10 text-center">
              <UserRound className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-bold">Öğrenci seçin</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Soldaki listeden bir öğrenci seçtiğinizde kurumun tanımlı sözleşme ve formlarını
                imza tabletine gönderebilirsiniz.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-lg font-bold">{selected.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.schoolNumber ? `Okul no ${selected.schoolNumber} · ` : ''}
                  {selected.className || 'Sınıf yok'}
                </p>
              </div>

              {templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Henüz tanımlı belge yok.
                  {canManageTemplates
                    ? ' Yukarıdaki “PDF yükle” ile kurumun sözleşmesini ekleyin.'
                    : ' Yönetici Ayarlar › Onam Formları ekranından tanımlayabilir.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => {
                    const form = formOf(template.id);
                    const isPdf = template.sourceKind === 'Pdf';
                    return (
                      <div
                        key={template.id}
                        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]">
                            {isPdf ? <FileText className="h-5 w-5" /> : <FileSignature className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-bold">{template.title}</p>
                              {isPdf ? (
                                <Badge variant="secondary">PDF · {template.documentPageCount} sayfa</Badge>
                              ) : (
                                <Badge variant="outline">Sistem metni</Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <StatusBadge status={form?.status} />
                              {form?.status === 'AwaitingSignature' && form.stationName ? (
                                <span>{form.stationName}</span>
                              ) : null}
                              {form?.signedAtUtc ? (
                                <span>{new Date(form.signedAtUtc).toLocaleString('tr-TR')}</span>
                              ) : null}
                              {isPdf && template.documentFileName ? <span>· {template.documentFileName}</span> : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onClick={() => previewTemplate(template)}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> Belgeyi gör
                          </Button>

                          {form?.status === 'Signed' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === form.id}
                                onClick={() => downloadSigned(form)}
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" /> İmzalı PDF
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openComposer(template, null)}>
                                Yeniden al
                              </Button>
                            </>
                          ) : form?.status === 'AwaitingSignature' ? (
                            <Button size="sm" variant="outline" disabled={busyId === form.id} onClick={() => revoke(form.id)}>
                              Geri al
                            </Button>
                          ) : (
                            <Button size="sm" disabled={busyId === template.id} onClick={() => openComposer(template, form)}>
                              İmzaya gönder
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {composer ? (
        <ConsentDispatchDialog
          form={composer}
          stations={stations}
          busy={busyId === composer.id}
          onCancel={async () => {
            // Yalnız BU açılışta üretilen taslak geri alınır; daha önce hazırlanmış
            // taslak vazgeçince silinmez (personelin yazdığı not kaybolmasın).
            if (composer.createdHere) {
              await cancelConsentForm(composer.id).catch(() => {});
              await loadForms({ silent: true });
            }
            setComposer(null);
          }}
          onDispatch={dispatchForm}
        />
      ) : null}

      {uploadOpen ? (
        <UploadDocumentDialog
          contextKinds={contextKinds}
          onClose={() => setUploadOpen(false)}
          onSaved={async () => {
            setUploadOpen(false);
            await load(true);
          }}
        />
      ) : null}
    </motion.div>
  );
}

/** Formu tablete gönderme bölmesi: belge önizlemesi, uygulama notu, hedef tablet. */
function ConsentDispatchDialog({ form, stations, busy, onCancel, onDispatch }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(form.staffNotes || '');
  const [station, setStation] = useState(() => localStorage.getItem('ci-consent-last-station') || '');
  const isPdf = form.sourceKind === 'Pdf';

  const openDocument = async () => {
    try {
      openBlob(await downloadConsentFormDocument(form.id));
    } catch (error) {
      toast({ title: 'Belge açılamadı', description: error.message, variant: 'destructive' });
    }
  };

  const submit = () => {
    localStorage.setItem('ci-consent-last-station', station.trim());
    onDispatch({ ...form, staffNotes: notes }, station);
  };

  const online = stations.filter((item) => item.online);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title}</DialogTitle>
          <DialogDescription>
            {form.studentName} — belge imza tabletine gönderilecek.
          </DialogDescription>
        </DialogHeader>

        {isPdf ? (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{form.documentFileName || 'Yüklenen belge'}</p>
              <p className="text-xs text-muted-foreground">{form.documentPageCount} sayfa · imzalanacak PDF</p>
            </div>
            <Button size="sm" variant="outline" onClick={openDocument}>
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Aç
            </Button>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/50 bg-background p-3 text-sm leading-relaxed">
            {form.body}
          </div>
        )}

        {(form.checkItems || []).length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tablette işaretlenecek maddeler
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {form.checkItems.map((item, index) => (
                <li key={index} className="flex gap-2"><span>☐</span><span>{item}</span></li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label>Uygulama notu (isteğe bağlı)</Label>
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <div className="space-y-1">
          <Label>Tablet adı</Label>
          <Input
            value={station}
            onChange={(event) => setStation(event.target.value)}
            placeholder="Örn. Sekreterlik"
            list="school-consent-stations"
          />
          <datalist id="school-consent-stations">
            {stations.map((item) => <option key={item.id} value={item.name} />)}
          </datalist>
          {stations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStation(item.name)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition',
                    item.online
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-border/60 text-muted-foreground',
                  )}
                >
                  {item.name} {item.online ? '· çevrimiçi' : '· çevrimdışı'}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Henüz kayıtlı tablet yok. Tablette <strong>İmza İstasyonu</strong> ekranını açıp bir ad verin.
            </p>
          )}
          {station.trim() && online.length > 0
            && !online.some((item) => item.name.trim().toLowerCase() === station.trim().toLowerCase()) ? (
              <p className="text-xs text-amber-600">
                &ldquo;{station.trim()}&rdquo; şu an çevrimdışı; form gönderilir ama tablet açılana kadar ekrana düşmez.
              </p>
            ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Vazgeç</Button>
          <Button onClick={submit} disabled={busy}>Tablete Aktar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * PDF yükleme bölmesi: dosya + başlık + imzalayan + onay maddeleri.
 * Yükleme ile şablon kaydı TEK akışta yapılır; kullanıcı ayrıca Ayarlar
 * ekranına gitmek zorunda kalmaz.
 */
function UploadDocumentDialog({ contextKinds, onClose, onSaved }) {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [signerRole, setSignerRole] = useState('Parent');
  const [items, setItems] = useState(['Belgenin tamamını okudum.', 'Şartları kabul ediyorum.']);
  const [bindings, setBindings] = useState([]);
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [saving, setSaving] = useState(false);

  const pickFile = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (next.size > MAX_PDF_BYTES) {
      toast({ title: 'Dosya çok büyük', description: 'PDF en fazla 12 MB olabilir.', variant: 'destructive' });
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.pdf$/i, ''));
  };

  const toggleBinding = (kind) => {
    setBindings((current) => (current.some((item) => item.contextKind === kind)
      ? current.filter((item) => item.contextKind !== kind)
      : [...current, { contextKind: kind, contextKey: '' }]));
  };

  const save = async () => {
    if (!file) {
      toast({ title: 'PDF seçilmedi', variant: 'destructive' });
      return;
    }
    if (!title.trim()) {
      toast({ title: 'Başlık zorunlu', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Önce belge yüklenir (sunucu içeriği doğrular), sonra şablona bağlanır.
      const document = await uploadConsentDocument(file);
      await createConsentTemplate({
        title: title.trim(),
        body: note.trim(),
        checkItems: items.map((item) => item.trim()).filter(Boolean),
        requiresSignature,
        signerRole,
        isActive: true,
        sortOrder: 0,
        bindings,
        sourceKind: 'Pdf',
        documentId: document.id,
      });
      toast({ title: 'Belge yüklendi', description: `${document.fileName} · ${document.pageCount} sayfa` });
      await onSaved();
    } catch (error) {
      toast({ title: 'Belge yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sözleşme / form PDF&apos;i yükle</DialogTitle>
          <DialogDescription>
            Yüklenen belge olduğu gibi korunur; imza bilgileri belgenin sonuna eklenen
            ayrı bir imza tutanağı sayfasına basılır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>PDF dosyası</Label>
            <Input type="file" accept="application/pdf,.pdf" onChange={pickFile} />
            {file ? (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Belge başlığı</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Örn. Okul Kayıt Sözleşmesi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>İmzalayan</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={signerRole}
                onChange={(event) => setSignerRole(event.target.value)}
              >
                {SIGNER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <Switch checked={requiresSignature} onCheckedChange={setRequiresSignature} />
              İmza zorunlu
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Tablette gösterilecek kısa açıklama (isteğe bağlı)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sayın {{veli}}, {{ogrenci}} adına düzenlenen sözleşmeyi okuyup imzalayınız."
            />
            <p className="text-xs text-muted-foreground">
              Yer tutucular ({'{{ogrenci}}'}, {'{{veli}}'}, {'{{kurum}}'}) sunucuda doldurulur.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Onay maddeleri</Label>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(event) => {
                    const next = [...items];
                    next[index] = event.target.value;
                    setItems(next);
                  }}
                />
                <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                  Sil
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, ''])}>Madde ekle</Button>
            <p className="text-xs text-muted-foreground">
              İmzalayan, maddelerin TAMAMINI işaretlemeden imza atamaz.
            </p>
          </div>

          {contextKinds.length > 0 ? (
            <div className="space-y-2">
              <Label>Hangi akışlarda zorunlu olsun? (isteğe bağlı)</Label>
              <div className="flex flex-wrap gap-1.5">
                {contextKinds.map((kind) => {
                  const active = bindings.some((item) => item.contextKind === kind.kind);
                  return (
                    <button
                      key={kind.kind}
                      type="button"
                      title={kind.description}
                      onClick={() => toggleBinding(kind.kind)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition',
                        active
                          ? 'border-[hsl(var(--brand-accent)/0.5)] bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]'
                          : 'border-border/60 text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {kind.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Seçilen akışlarda bu belge &ldquo;eksik onam&rdquo; uyarısı olarak da görünür.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={save} disabled={saving || !file}>
            {saving ? 'Yükleniyor…' : 'Yükle ve kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
