import { useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/status-badge';
import { useToast } from '../../hooks/use-toast';
import { bulkCollect } from '../../lib/api/modules';
import { formatMoney } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import type { BulkCollectionResultDto, BulkCollectionRow } from '../../types/api/generated';

const PLACEHOLDER = 'Ali Can; 2500; 2026-10-28; Havale; DEK-001\nAyşe Yılmaz; 1.250,50; 2026-10-29; Havale';

/** "1.250,50" / "1250.5" → sayı. */
function parseAmount(raw: string): number {
  const text = (raw || '').replace(/\s|TL|₺/gi, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** "28.10.2026" ya da "2026-10-28" → ISO tarih (öğle saati; gün kaymasın). */
function parseDate(raw: string): string | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const tr = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  const iso = tr ? `${tr[3]}-${(tr[2] ?? '').padStart(2, '0')}-${(tr[1] ?? '').padStart(2, '0')}` : text;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseRows(text: string): BulkCollectionRow[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [studentName, amount, date, method, reference] = line.split(/[;\t]/).map((cell) => cell.trim());
    return {
      line: index + 1,
      studentName: studentName || '',
      amount: parseAmount(amount || ''),
      method: method || null,
      paidAt: parseDate(date || ''),
      reference: reference || null,
      studentUserId: null,
    };
  });
}

type RowStatus = { label: string; tone: 'success' | 'danger' | 'neutral' | 'info' };
const ERROR_STATUS: RowStatus = { label: 'Hata', tone: 'danger' };
const STATUS: Partial<Record<string, RowStatus>> = {
  Ready: { label: 'Hazır', tone: 'info' },
  Recorded: { label: 'Kaydedildi', tone: 'success' },
  Duplicate: { label: 'Daha önce işlendi', tone: 'neutral' },
  Error: { label: 'Hata', tone: 'danger' },
};

/**
 * Toplu tahsilat (banka dökümü vb.): önce önizleme, sonra kayıt. Her satır ayrı
 * makbuzdur; aynı dosya tekrar yüklenirse sunucu aynı satırı ikinci kez almaz.
 */
export function BulkCollectionDialog({ open, onOpenChange, onRecorded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkCollectionResultDto | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => { setText(''); setResult(null); setPreviewed(false); };

  const run = async (dryRun: boolean) => {
    const rows = parseRows(text);
    if (rows.length === 0) {
      toast({ title: 'Satır yok', description: 'Biçim: öğrenci; tutar; tarih; yöntem; referans', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      const response = await bulkCollect({ rows, dryRun });
      setResult(response);
      setPreviewed(dryRun);
      if (!dryRun && response) {
        toast({ title: `${response.recorded} tahsilat kaydedildi`, description: `${formatMoney(response.recordedAmount)} • ${response.errors} hatalı, ${response.duplicates} tekrar` });
        onRecorded();
      }
    } catch (err) {
      toast({ title: 'Aktarım yapılamadı', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const fileChosen = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
    setResult(null);
    setPreviewed(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Toplu Tahsilat Aktarımı</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Her satır: <code>öğrenci; tutar; tarih; yöntem; referans</code>. Önce önizleyin; hatalı satırlar (bulunamayan ya da aynı adlı öğrenci, kapanmış gün) kaydedilmez.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-primary">
            <FileUp className="h-4 w-4" />CSV/metin dosyası seç
            <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => void fileChosen(e.target.files?.[0])} />
          </label>
          <textarea
            className="min-h-[160px] w-full rounded-xl border bg-background p-3 font-mono text-sm"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null); setPreviewed(false); }}
          />
          {result ? (
            <div className="space-y-1">
              {result.rows.map((row) => (
                <div key={row.line} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span>{row.line}. {row.studentName || '—'} • {formatMoney(row.amount)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{row.receiptNo || row.message}</span>
                    <StatusBadge tone={(STATUS[row.status] ?? ERROR_STATUS).tone}>{(STATUS[row.status] ?? ERROR_STATUS).label}</StatusBadge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
          <Button variant="outline" onClick={() => void run(true)} disabled={busy}>Önizle</Button>
          <Button onClick={() => void run(false)} disabled={busy || !previewed || !result || result.rows.every((row) => row.status !== 'Ready')}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Hazır Satırları Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
