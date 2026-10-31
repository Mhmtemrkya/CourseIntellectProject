import { useState } from 'react';
import { Database, ExternalLink, Upload } from 'lucide-react';
import { Page, PageHeader } from '../../components/layout/PageKit';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';
import { importLgsPreferenceData } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { PreferenceImportResultDto } from '../../types/api/generated';

const COLUMNS = 'Kurum Kodu;Okul;İl;İlçe;Okul Türü;Kontenjan;Taban Puan;Yüzdelik Dilim';

/**
 * Tercih robotu verisi. YKS tabloları (ÖSYM) uygulamaya gömülüdür; MEB toplu LGS dosyası
 * yayımlamadığı için LGS taban puanları buradan, kaynağı belirtilerek yüklenir.
 */
export default function PreferenceData() {
  const { toast } = useToast();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [source, setSource] = useState('MEB LGS Yerleştirme Sonuçları');
  const [sourceUrl, setSourceUrl] = useState('https://');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreferenceImportResultDto | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const response = await importLgsPreferenceData(Number(year), source.trim(), sourceUrl.trim(), file);
      setResult(response);
      toast({ title: 'LGS verisi yüklendi' });
    } catch (error) {
      toast({ title: 'Yüklenemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page testId="preference-data-page">
      <PageHeader title="Tercih Robotu Verisi" description="YKS verisi ÖSYM'nin resmî tablolarından uygulamaya gömülüdür. LGS okul taban puanlarını kaynağıyla birlikte buradan yükleyin." icon={Database} />
      <section className="max-w-2xl space-y-4 rounded-2xl border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div>
            <Label htmlFor="lgs-year">Yıl</Label>
            <Input id="lgs-year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="lgs-source">Kaynak adı</Label>
            <Input id="lgs-source" value={source} onChange={(event) => setSource(event.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="lgs-url">Kaynak adresi (https)</Label>
          <Input id="lgs-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="lgs-file">CSV dosyası (; ayraçlı, UTF-8)</Label>
          <Input id="lgs-file" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-muted-foreground">Sütunlar: <code>{COLUMNS}</code>. Aynı yılın eski LGS verisi tamamen değiştirilir.</p>
        </div>
        <Button onClick={() => void submit()} disabled={!file || busy}><Upload className="mr-2 h-4 w-4" />{busy ? 'Yükleniyor…' : 'Yükle'}</Button>
        {result ? (
          <div className="rounded-xl bg-foreground/[0.04] p-3 text-sm">
            <p className="font-semibold">{`${result.year}: ${result.imported} okul yüklendi, ${result.skipped} satır atlandı.`}</p>
            {result.errors.map((line) => <p key={line} className="text-xs text-amber-700 dark:text-amber-300">{line}</p>)}
          </div>
        ) : null}
        <a className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline" href="https://www.meb.gov.tr" target="_blank" rel="noopener noreferrer">meb.gov.tr<ExternalLink className="h-3 w-3" /></a>
      </section>
    </Page>
  );
}
