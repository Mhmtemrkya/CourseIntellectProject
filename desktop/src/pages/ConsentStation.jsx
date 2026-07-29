import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadConsentFormDocument, pollConsentStation, signConsentForm } from '../lib/api/modules';
import SignaturePad from '../components/consent/SignaturePad';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '@/lib/utils';

const STATION_STORAGE_KEY = 'ci-consent-station-name';
const POLL_INTERVAL_MS = 2500;
const THANKS_DURATION_MS = 6000;

const SIGNER_HINT = {
  Student: 'Öğrenci / kursiyer imzası',
  Parent: 'Veli veya yasal temsilci imzası',
  StudentOrParent: '18 yaş altındaysa veli, değilse öğrencinin kendisi imzalar',
};

/**
 * Tablet İmza İstasyonu.
 *
 * Tablet, sisteme giriş yapmış İKİNCİ BİR EKRANDIR; fiziksel eşleştirme (QR,
 * Bluetooth, kod) yoktur — eşleşme isimle olur ve tüm iletişim sunucu üzerinden
 * yürür. Ad cihazda kalıcı saklanır, personel bilgisayarda bu adı seçer.
 *
 * Soket yerine kısa yoklama kullanılır: salon içi birkaç tablet için kalıcı
 * soket altyapısı gereksiz karmaşıklıktır; kısa yoklama hem anında hissettirir
 * hem ağ kesintisinden kendiliğinden toparlar.
 *
 * Tabletin bu ekranda kalması için cihazın kiosk / rehberli erişim modu önerilir.
 */
export default function ConsentStation() {
  const [stationName, setStationName] = useState(() => localStorage.getItem(STATION_STORAGE_KEY) || '');
  const [renaming, setRenaming] = useState(() => !localStorage.getItem(STATION_STORAGE_KEY));
  const [draftName, setDraftName] = useState(stationName);
  const [form, setForm] = useState(null);
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState([]);
  const [signerName, setSignerName] = useState('');
  const [signerRelation, setSignerRelation] = useState('');
  const [hasInk, setHasInk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentError, setDocumentError] = useState('');

  const padRef = useRef(null);
  const formIdRef = useRef(null);
  const documentUrlRef = useRef('');

  /// Blob adresi ekrandan düşer düşmez serbest bırakılır: tablet günlerce açık
  /// kaldığında birikmiş PDF'ler belleği şişirmemeli.
  const releaseDocument = useCallback(() => {
    if (documentUrlRef.current) URL.revokeObjectURL(documentUrlRef.current);
    documentUrlRef.current = '';
    setDocumentUrl('');
    setDocumentError('');
  }, []);

  const resetForm = useCallback(() => {
    setChecked([]);
    setSignerName('');
    setSignerRelation('');
    setHasInk(false);
    setError('');
    padRef.current?.clear();
  }, []);

  /// Yüklenmiş PDF'li formda belge ekranda GÖSTERİLİR; indirilemezse imza
  /// düğmesi açılmaz — kimse görmediği belgeyi imzalamamalı.
  const loadDocument = useCallback(async (form) => {
    releaseDocument();
    if (form?.sourceKind !== 'Pdf') return;
    try {
      const blob = await downloadConsentFormDocument(form.id);
      const url = URL.createObjectURL(blob);
      documentUrlRef.current = url;
      setDocumentUrl(url);
    } catch (loadError) {
      setDocumentError(loadError.message || 'Belge alınamadı.');
    }
  }, [releaseDocument]);

  useEffect(() => () => releaseDocument(), [releaseDocument]);

  const poll = useCallback(async () => {
    if (!stationName.trim()) return;
    try {
      const next = await pollConsentStation(stationName.trim());
      setConnected(true);

      if (!next) {
        // Personel gönderimi geri aldıysa bekleme hâline dön.
        if (formIdRef.current) {
          formIdRef.current = null;
          setForm(null);
          resetForm();
          releaseDocument();
        }
        return;
      }

      // AYNI form tekrar yoklandığında ekran SIFIRLANMAZ — müşteri o sırada
      // imza atıyor olabilir; işaretlediği maddeler ve çizdiği imza durmalı.
      if (formIdRef.current === next.id) return;

      formIdRef.current = next.id;
      setForm(next);
      resetForm();
      setSignerName(next.studentName || '');
      await loadDocument(next);
    } catch {
      setConnected(false);
    }
  }, [stationName, resetForm, loadDocument, releaseDocument]);

  useEffect(() => {
    if (!stationName.trim() || renaming) return undefined;
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [stationName, renaming, poll]);

  useEffect(() => {
    if (!thanks) return undefined;
    const timer = setTimeout(() => setThanks(false), THANKS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [thanks]);

  const allChecked = useMemo(
    () => (form?.checkItems || []).every((_, index) => checked.includes(index)),
    [form, checked],
  );
  const signatureReady = !form?.requiresSignature || hasInk;
  // PDF'li formda belge ekrana gelmeden imza alınmaz.
  const documentReady = form?.sourceKind !== 'Pdf' || Boolean(documentUrl);
  const canSubmit = Boolean(form) && allChecked && signatureReady && documentReady && !submitting;

  const toggle = (index) => {
    setChecked((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await signConsentForm(form.sessionToken, {
        checkedItems: checked,
        signatureImage: padRef.current?.toDataUrl() || null,
        signerName: signerName.trim() || form.studentName,
        signerRelation: signerRelation.trim() || null,
      });
      formIdRef.current = null;
      setForm(null);
      resetForm();
      releaseDocument();
      setThanks(true);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const applyName = () => {
    const next = draftName.trim();
    if (!next) return;
    localStorage.setItem(STATION_STORAGE_KEY, next);
    setStationName(next);
    setRenaming(false);
    formIdRef.current = null;
    setForm(null);
    resetForm();
    releaseDocument();
  };

  const startRename = () => {
    // Ekranda imza bekleyen form varken onay sor — müşterinin yarım imzası gitmesin.
    if (form && !window.confirm('Ekranda imza bekleyen bir form var. Tablet adını değiştirirseniz bu form kapanır. Devam edilsin mi?')) {
      return;
    }
    setDraftName(stationName);
    setRenaming(true);
  };

  // ─── Ad verme ekranı ──────────────────────────────────────────────────────
  if (renaming) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-border/60 bg-card p-8 shadow-xl">
          <div>
            <h1 className="text-2xl font-bold">Bu tablete bir ad verin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Personel, formu gönderirken bu adı seçecek. Ad cihazda kalıcı saklanır; bir kez girilir.
            </p>
          </div>
          <Input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') applyName(); }}
            placeholder="Örn. Ofis 1"
            className="h-12 text-lg"
          />
          <div className="flex gap-2">
            {stationName ? (
              <Button variant="ghost" className="flex-1" onClick={() => setRenaming(false)}>
                Vazgeç
              </Button>
            ) : null}
            <Button className="flex-1 h-12" onClick={applyName} disabled={!draftName.trim()}>
              Kaydet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Teşekkür ekranı ──────────────────────────────────────────────────────
  if (thanks) {
    return (
      <div className="grid min-h-screen place-items-center bg-emerald-50 p-6 dark:bg-emerald-950/30">
        <div className="text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-500 text-5xl text-white">✓</div>
          <h1 className="mt-6 text-3xl font-bold text-emerald-700 dark:text-emerald-400">Formunuz imzalandı</h1>
          <p className="mt-2 text-emerald-700/80 dark:text-emerald-400/80">Teşekkür ederiz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('h-2.5 w-2.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-500')} />
          <span className="text-muted-foreground">{connected ? 'Bağlı' : 'Bekleniyor'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{stationName}</span>
          <Button size="sm" variant="ghost" onClick={startRename}>Değiştir</Button>
        </div>
      </header>

      {!form ? (
        // ─── Bekleme hâli ───────────────────────────────────────────────────
        <div className="grid flex-1 place-items-center p-6">
          <div className="text-center">
            <div className="relative mx-auto h-28 w-28">
              <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--brand-accent)/0.25)]" />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-[hsl(var(--brand-accent)/0.15)] text-4xl">
                ✍️
              </span>
            </div>
            <h1 className="mt-8 text-2xl font-bold">Form bekleniyor</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Personel bilgisayardan formu bu tablete gönderdiğinde ekranda görünecek.
            </p>

            <div className="mx-auto mt-8 w-full max-w-xs rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bu tabletin adı</p>
              <p className="mt-1 text-2xl font-bold">{stationName}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={startRename}>
                Değiştir
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // ─── Form ekranı ────────────────────────────────────────────────────
        <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-5">
          <div>
            <h1 className="text-2xl font-bold">{form.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {form.studentName ? <Chip>{form.studentName}</Chip> : null}
              {form.contextLabel ? <Chip>{form.contextLabel}</Chip> : null}
              {form.staffName ? <Chip>Uygulayan: {form.staffName}</Chip> : null}
            </div>
          </div>

          {form.sourceKind === 'Pdf' ? (
            <div className="space-y-2">
              {form.body ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-border/60 bg-card p-4 text-sm leading-relaxed">
                  {form.body}
                </div>
              ) : null}

              {documentUrl ? (
                <>
                  <iframe
                    title={form.documentFileName || 'Sözleşme'}
                    src={documentUrl}
                    className="h-[60vh] w-full rounded-2xl border border-border/60 bg-card"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    {form.documentFileName} · {form.documentPageCount} sayfa —
                    imzalamadan önce belgenin tamamını okuyun.
                  </p>
                </>
              ) : (
                <div className="grid h-40 place-items-center rounded-2xl border border-border/60 bg-card text-sm text-muted-foreground">
                  {documentError ? `Belge alınamadı: ${documentError}` : 'Belge yükleniyor…'}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-card p-4 text-sm leading-relaxed">
              {form.body}
            </div>
          )}

          {form.staffNotes ? (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uygulama notu</p>
              <p className="mt-1">{form.staffNotes}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {(form.checkItems || []).map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => toggle(index)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
                  checked.includes(index)
                    ? 'border-[hsl(var(--brand-accent)/0.5)] bg-[hsl(var(--brand-accent)/0.1)]'
                    : 'border-border/60 bg-card',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold',
                    checked.includes(index)
                      ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))] text-white'
                      : 'border-border',
                  )}
                >
                  {checked.includes(index) ? '✓' : ''}
                </span>
                <span className="text-base">{item}</span>
              </button>
            ))}
          </div>

          {form.requiresSignature ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{SIGNER_HINT[form.signerRole] || 'İmza'}</p>
              <SignaturePad ref={padRef} height={220} onChange={setHasInk} />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">İmzalayan ad soyad</label>
              <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} className="h-12" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Yakınlık (veli imzalıyorsa)</label>
              <Input
                value={signerRelation}
                onChange={(event) => setSignerRelation(event.target.value)}
                placeholder="Anne / Baba / Vasi"
                className="h-12"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="sticky bottom-0 space-y-2 bg-background/95 py-4 backdrop-blur">
            <Button className="h-14 w-full text-lg" disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Gönderiliyor...' : 'Onaylıyorum ve İmzalıyorum'}
            </Button>
            {!canSubmit && !submitting ? (
              <p className="text-center text-sm text-muted-foreground">
                {!documentReady
                  ? 'Belge ekrana gelmeden imza alınamaz.'
                  : !allChecked
                    ? 'Devam etmek için tüm onay maddelerini işaretleyin.'
                    : 'Devam etmek için imza alanına imzanızı atın.'}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
