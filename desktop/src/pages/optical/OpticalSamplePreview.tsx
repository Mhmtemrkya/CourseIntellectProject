import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  decodeSample, readSampleLine, ruler, sampleLines, segmentLine, type LayoutField, type SampleLine,
} from './templateLayout';

const tint = (color: string) => ({ backgroundColor: `hsl(${color} / 0.28)`, boxShadow: `inset 0 -2px 0 hsl(${color})` });

/**
 * İsteğe bağlı örnek dosya önizlemesi: ilk satırlar sabit aralıklı yazıyla, cetvel ve renkli
 * alanlarla gösterilir; konumlar değiştikçe yeniden okunur. Dosya tarayıcıda okunur, sunucuya
 * gönderilmez; öğrenci ya da sonuç oluşturmaz.
 */
export interface SampleFile { name: string; bytes: Uint8Array }

export const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

/** Dosyayı bayt olarak okur; arrayBuffer olmayan ortamlarda FileReader kullanılır. */
export function readSampleFile(selected: File): Promise<SampleFile> {
  if (typeof selected.arrayBuffer === 'function') {
    return selected.arrayBuffer().then((buffer) => ({ name: selected.name, bytes: new Uint8Array(buffer) }));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve({ name: selected.name, bytes: new Uint8Array(result) });
      else reject(new Error('Dosya okunamadı.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'));
    reader.readAsArrayBuffer(selected);
  });
}

/** Dosya durumu üst bileşende tutulur; otomatik öneri için seçilen dosya da burada önizlenir. */
export function OpticalSamplePreview({ fields, encoding, file, onFile }: {
  fields: LayoutField[]; encoding: string; file: SampleFile | null; onFile: (file: SampleFile | null) => void;
}) {
  const [error, setError] = useState('');

  const pick = async (selected: File | undefined) => {
    setError('');
    if (!selected) return;
    if (selected.size > MAX_SAMPLE_BYTES) {
      setError('Dosya 5 MB’tan büyük; önizleme için ilk birkaç satır yeterli, küçük bir örnek seçin.');
      return;
    }
    onFile(await readSampleFile(selected));
  };

  const [decoded, setDecoded] = useState<{ lines: SampleLine[]; encoding: string } | null>(null);
  useEffect(() => {
    if (!file) { setDecoded(null); return; }
    const result = decodeSample(file.bytes, encoding);
    setDecoded({ lines: sampleLines(result.text), encoding: result.encoding });
  }, [file, encoding]);

  const lines = decoded?.lines ?? [];
  const used = fields.filter((field) => field.length > 0 && field.start >= 1);
  const width = Math.max(10, ...lines.map((line) => line.text.length), ...used.map((field) => field.start + field.length - 1));
  const { tens, units } = ruler(width);

  return (
    <div className="min-w-0 space-y-2 rounded-xl border p-3" data-testid="optical-sample-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Örnek dosyayla dene (isteğe bağlı)</p>
          <p className="text-xs text-muted-foreground">Yalnız önizlemedir: dosya kaydedilmez, öğrenci ya da sınav sonucu oluşturulmaz.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <FileText className="h-3.5 w-3.5" />
            {file ? 'Başka dosya seç' : 'TXT/DAT dosyası seç'}
            <input type="file" accept=".txt,.dat,.TXT,.DAT,text/plain" className="sr-only" aria-label="Örnek optik dosyası"
              onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {file ? <Button size="icon" variant="ghost" aria-label="Önizlemeyi kapat" onClick={() => onFile(null)}><X className="h-4 w-4" /></Button> : null}
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {file && decoded ? (
        lines.length === 0 ? <p className="text-xs text-amber-700 dark:text-amber-300">Dosyada dolu satır bulunamadı.</p> : (
          <>
            <p className="text-xs text-muted-foreground">
              {`${file.name} · ilk ${lines.length} dolu satır · kodlama: ${decoded.encoding === 'utf-8' ? 'UTF-8' : 'Türkçe Windows (1254)'}`}
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Renk açıklaması">
              {used.map((field) => (
                <li key={field.id} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm" style={tint(field.color)} aria-hidden />
                  {field.label}
                </li>
              ))}
            </ul>
            <div className="max-w-full overflow-x-auto rounded-lg border bg-muted/30 p-2">
              <pre className="font-mono text-[12px] leading-5" aria-label="Karakter cetveli">
                <span className="block text-muted-foreground">{tens}</span>
                <span className="block text-muted-foreground">{units}</span>
              </pre>
              {lines.map((line) => (
                <pre key={line.line} className="font-mono text-[12px] leading-5" data-testid="optical-sample-line">
                  {segmentLine(line.text, used).map((segment, index) => (
                    <span key={index} style={segment.field ? tint(segment.field.color) : undefined}
                      title={segment.field ? segment.field.label : 'Okunmayan bölüm'}>{segment.text}</span>
                  ))}
                </pre>
              ))}
            </div>
            <div className="space-y-2">
              {lines.map((line) => {
                const readings = readSampleLine(line, used);
                const issues = readings.flatMap((reading) => (reading.missing ? [reading.missing] : []));
                return (
                  <div key={line.line} className="rounded-lg border px-3 py-2 text-xs" data-testid="optical-sample-reading">
                    <p className="mb-1 font-semibold">{`${line.line}. satırdan okunan`}</p>
                    <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                      {readings.map((reading) => (
                        <div key={reading.field.id} className="flex min-w-0 gap-1.5">
                          <dt className="shrink-0 text-muted-foreground">{`${reading.field.label}:`}</dt>
                          <dd className="min-w-0 break-all font-medium">
                            {reading.field.kind === 'subject'
                              ? <span className="font-mono">{reading.value.replace(/ /g, '·') || '—'}</span>
                              : reading.value || <span className="text-muted-foreground">(boş)</span>}
                            {reading.blankQuestions.length > 0
                              ? <span className="ml-1 font-normal text-muted-foreground">{`(${reading.blankQuestions.length} soru boş bırakılmış)`}</span>
                              : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {issues.map((issue) => (
                      <p key={issue} className="mt-1 flex gap-1.5 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{issue}
                      </p>
                    ))}
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground">Cevaplarda “·” işaretlenmemiş (boş bırakılmış) soruyu gösterir; bu normaldir. Satırın alana yetmemesi ise konumların yanlış olabileceğini gösterir.</p>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
