import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelConsentForm,
  createConsentForm,
  dispatchConsentFormToStation,
  downloadConsentFormDocument,
  downloadConsentFormPdf,
  fetchConsentForm,
  fetchConsentStations,
  fetchConsentStatus,
  revokeConsentFormSession,
  updateConsentForm,
} from '../../lib/api/modules';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { cn } from '@/lib/utils';

/** İmza bekleyen form varken bu aralıkta yoklanır — imza anında ekrana düşsün. */
const POLL_INTERVAL_MS = 2500;

const STATUS_LABEL = {
  Draft: 'Hazırlanıyor',
  AwaitingSignature: 'İmza bekleniyor',
  Signed: 'İmzalandı',
  Cancelled: 'İptal',
};

function StatusBadge({ status }) {
  if (!status) return <Badge variant="outline">Açılmadı</Badge>;
  if (status === 'Signed') {
    return <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600">İmzalandı</Badge>;
  }
  if (status === 'AwaitingSignature') {
    return <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600">İmza bekleniyor</Badge>;
  }
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

/**
 * Onam Merkezi — personelin form hazırlayıp tablete gönderdiği, imzayı canlı
 * izlediği ve imzalı belgeyi indirdiği ekran.
 *
 * Öğrenci kartından, randevudan, cari hesaptan ve adisyondan aynı bileşen açılır;
 * bağlam (contextKind/contextKey/contextRefId) dışarıdan verilir.
 */
export default function ConsentCenter({
  open,
  onOpenChange,
  studentProfileId,
  studentName,
  contextKind,
  contextKey,
  contextRefId,
  contextLabel,
  onStatusChange,
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [composer, setComposer] = useState(null);
  const [justSigned, setJustSigned] = useState(null);

  const previousStatusRef = useRef(new Map());

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!studentProfileId) return;
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (contextKind) params.contextKind = contextKind;
      if (contextKey) params.contextKey = contextKey;
      if (contextRefId) params.contextRefId = contextRefId;

      const [next, stationList] = await Promise.all([
        fetchConsentStatus(studentProfileId, params),
        fetchConsentStations().catch(() => []),
      ]);

      // İmza az önce mi geldi? Personel ekranında yeşil şerit bunun için çizilir.
      const previous = previousStatusRef.current;
      const freshlySigned = (next?.requirements || []).find(
        (row) => row.status === 'Signed' && previous.get(row.templateId) === 'AwaitingSignature',
      );
      previousStatusRef.current = new Map((next?.requirements || []).map((row) => [row.templateId, row.status]));
      if (freshlySigned) setJustSigned(freshlySigned.title);

      setStatus(next);
      setStations(stationList);
      onStatusChange?.(next);
    } catch (error) {
      if (!silent) toast({ title: 'Onam formları yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [studentProfileId, contextKind, contextKey, contextRefId, onStatusChange, toast]);

  useEffect(() => {
    if (!open) return undefined;
    load();
    return undefined;
  }, [open, load]);

  const awaiting = useMemo(
    () => (status?.requirements || []).some((row) => row.status === 'AwaitingSignature'),
    [status],
  );

  // Yalnız imza beklenirken yoklanır; boşta ağ trafiği üretilmez.
  useEffect(() => {
    if (!open || !awaiting) return undefined;
    const timer = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, awaiting, load]);

  useEffect(() => {
    if (!justSigned) return undefined;
    const timer = setTimeout(() => setJustSigned(null), 8000);
    return () => clearTimeout(timer);
  }, [justSigned]);

  const openComposer = async (requirement) => {
    setBusyId(requirement.templateId);
    try {
      // Var olan taslak açılırken KAYDIN kendi metni okunur, şablonunki değil:
      // yer tutucular kayıt üretilirken dolduruldu; şablonda hâlâ ham hâlde duruyor.
      if (requirement.formId && requirement.status !== 'Cancelled') {
        const existing = await fetchConsentForm(requirement.formId);
        setComposer({ ...existing, createdHere: false });
      } else {
        const created = await createConsentForm({
          templateId: requirement.templateId,
          studentProfileId,
          contextKind: contextKind || 'General',
          contextKey: contextKey || null,
          contextRefId: contextRefId || null,
          contextLabel: contextLabel || null,
          staffNotes: null,
        });
        setComposer({ ...created, createdHere: true });
      }
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'Form açılamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const dispatchForm = async (form, stationName) => {
    if (!stationName?.trim()) {
      toast({ title: 'Tablet adı gerekli', description: 'Formun gideceği tabletin adını yazın veya listeden seçin.', variant: 'destructive' });
      return;
    }
    setBusyId(form.id);
    try {
      if (form.staffNotes !== undefined) {
        await updateConsentForm(form.id, { staffNotes: form.staffNotes || '' });
      }
      await dispatchConsentFormToStation(form.id, stationName.trim());
      toast({ title: 'Form tablete gönderildi', description: `${stationName.trim()} ekranında imza bekleniyor.` });
      setComposer(null);
      await load({ silent: true });
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
      await load({ silent: true });
    } catch (error) {
      toast({ title: 'Gönderim geri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const download = async (formId, title) => {
    setBusyId(formId);
    try {
      const blob = await downloadConsentFormPdf(formId);
      saveBlob(blob, `${studentName || 'ogrenci'}-${title}.pdf`.replace(/\s+/g, '-'));
    } catch (error) {
      toast({ title: 'Belge indirilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const renew = async (requirement) => {
    // "Yeniden al": imzalı belge korunur, yerine yeni bir kayıt açılır.
    await openComposer({ ...requirement, formId: null });
  };

  const requirements = status?.requirements || [];
  const complete = status?.complete;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onam Formları</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} — ` : ''}
            {contextLabel || 'Kurumun tanımladığı onam ve izin formları'}
          </DialogDescription>
        </DialogHeader>

        {justSigned ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Form imzalandı: {justSigned}
          </div>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
        ) : requirements.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Bu akış için tanımlanmış onam formu yok.
            <br />
            Formları <strong>Ayarlar &rsaquo; Onam Formları</strong> ekranından tanımlayabilirsiniz.
          </div>
        ) : (
          <>
            <div
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium',
                complete
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
              )}
            >
              {status.signedCount}/{status.requiredCount} form imzalı
              {complete ? ' — tüm onamlar tamam.' : ' — eksik onam formu var.'}
            </div>

            <div className="space-y-2">
              {requirements.map((row) => (
                <div
                  key={row.templateId}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={row.status} />
                      {row.status === 'AwaitingSignature' && row.stationName ? <span>{row.stationName}</span> : null}
                      {row.signedAtUtc ? <span>{new Date(row.signedAtUtc).toLocaleString('tr-TR')}</span> : null}
                      {!row.requiresSignature ? <span>· imza istenmiyor</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {row.status === 'Signed' ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busyId === row.formId} onClick={() => download(row.formId, row.title)}>
                          PDF indir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => renew(row)}>
                          Yeniden al
                        </Button>
                      </>
                    ) : row.status === 'AwaitingSignature' ? (
                      <Button size="sm" variant="outline" disabled={busyId === row.formId} onClick={() => revoke(row.formId)}>
                        Geri al
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busyId === row.templateId} onClick={() => openComposer(row)}>
                        Formu doldur
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(status?.otherForms || []).length > 0 ? (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diğer imzalı formlar</p>
            {status.otherForms.map((form) => (
              <div key={form.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm">
                <span className="truncate">{form.title}</span>
                <Button size="sm" variant="ghost" disabled={busyId === form.id} onClick={() => download(form.id, form.title)}>
                  PDF
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {composer ? (
          <ConsentComposer
            form={composer}
            stations={stations}
            busy={busyId === composer.id}
            onCancel={async () => {
              // Yalnız BU açılışta üretilen taslak geri alınır; daha önce hazırlanmış
              // taslak vazgeçince silinmez (personelin yazdığı not kaybolmasın).
              if (composer.createdHere) {
                await cancelConsentForm(composer.id).catch(() => {});
                await load({ silent: true });
              }
              setComposer(null);
            }}
            onDispatch={dispatchForm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** "Formu doldur" bölmesi: metin önizlemesi, uygulama notu, hedef tablet. */
function ConsentComposer({ form, stations, busy, onCancel, onDispatch }) {
  const [notes, setNotes] = useState(form.staffNotes || '');
  const [station, setStation] = useState(() => localStorage.getItem('ci-consent-last-station') || '');

  const online = stations.filter((item) => item.online);

  const submit = () => {
    localStorage.setItem('ci-consent-last-station', station.trim());
    onDispatch({ ...form, staffNotes: notes }, station);
  };

  const openDocument = async () => {
    const blob = await downloadConsentFormDocument(form.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="font-semibold">{form.title}</p>
        {form.sourceKind === 'Pdf' ? (
          // Yüklenmiş belgede metin kutusu yerine belgenin kendisi açılır.
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border/50 bg-background p-3 text-sm">
            <span className="truncate">
              {form.documentFileName || 'Yüklenen belge'} · {form.documentPageCount} sayfa
            </span>
            <Button size="sm" variant="outline" onClick={openDocument}>Belgeyi aç</Button>
          </div>
        ) : (
          <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/50 bg-background p-3 text-sm leading-relaxed">
            {form.body}
          </div>
        )}
      </div>

      {(form.checkItems || []).length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tablette işaretlenecek maddeler
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {form.checkItems.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span>☐</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-sm font-medium">Uygulama notu (isteğe bağlı)</label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Özel durum, uyarı, ek bilgi..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Tablet adı</label>
        <Input
          value={station}
          onChange={(event) => setStation(event.target.value)}
          placeholder="Örn. Ofis 1"
          list="consent-stations"
        />
        <datalist id="consent-stations">
          {stations.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
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
        {station.trim() && online.length > 0 && !online.some((item) => item.name.trim().toLowerCase() === station.trim().toLowerCase()) ? (
          <p className="text-xs text-amber-600">
            &ldquo;{station.trim()}&rdquo; şu an çevrimdışı görünüyor; form gönderilir ama tablet açılana kadar ekrana düşmez.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Vazgeç
        </Button>
        <Button onClick={submit} disabled={busy}>
          Tablete Aktar
        </Button>
      </div>
    </div>
  );
}
