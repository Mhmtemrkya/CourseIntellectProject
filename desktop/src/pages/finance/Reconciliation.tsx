import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRightLeft, CircleDollarSign, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { fetchReconciliationEntries, reconcileFinance, updateReconciliationEntry } from '../../lib/api/modules';
import { formatCurrency } from '../../lib/financeDocuments';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/ui/status-badge';
import { errorMessage } from '../../lib/errors';
import type { BankReconciliationEntryDto, ReconciliationResultDto } from '../../types/api/generated';
import type { IconComponent } from '../../types/ui';

const PLACEHOLDER = 'HVL123; 5000; 2026-06-01\nPOS987; 2500; 2026-06-02\nMAAS11; -18000; 2026-06-03; Maaş ödemesi';

const MATCH_TYPE_LABEL: Record<string, string> = {
  Payment: 'Tahsilat', Expense: 'Gider', Salary: 'Maaş', Invoice: 'Fatura',
};

function statusLabel(status: string): string {
  if (status === 'Matched') return 'Eşleşti';
  if (status === 'Ignored') return 'Yok sayıldı';
  return 'Eşleşmedi';
}

type EntryFilter = 'Unmatched' | 'Matched' | 'Ignored' | '';

function toEntryFilter(value: string): EntryFilter {
  return value === 'Matched' || value === 'Ignored' || value === 'Unmatched' ? value : '';
}

/** Türkçe tutarı (1.250,50 / -1250.5) sayıya çevirir. */
function parseBankAmount(raw: string): number {
  const text = raw.replace(/\s|TL|₺/gi, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export default function Reconciliation() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [tolerance, setTolerance] = useState<number | string>(3);
  const [result, setResult] = useState<ReconciliationResultDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<BankReconciliationEntryDto[]>([]);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('Unmatched');

  const loadEntries = useCallback(async () => {
    try {
      setEntries(await fetchReconciliationEntries(entryFilter || null));
    } catch (err) {
      toast({ title: 'Kayıtlı hareketler alınamadı', description: errorMessage(err), variant: 'destructive' });
    }
  }, [entryFilter, toast]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const act = async (entry: BankReconciliationEntryDto, action: 'ignore' | 'unmatch') => {
    try {
      await updateReconciliationEntry(entry.id, action);
      await loadEntries();
    } catch (err) {
      toast({ title: 'İşlem yapılamadı', description: errorMessage(err), variant: 'destructive' });
    }
  };

  const run = async () => {
    const rows = text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      // Ayraç ";" ya da sekme; tutardaki ondalık virgülü bozulmasın diye virgül ayraç değildir.
      const [reference, amount, date, ...rest] = line.split(/[;\t]/).map((c) => c.trim());
      return { reference: reference || '', amount: parseBankAmount(amount || ''), date: date || new Date().toISOString(), description: rest.join(' ') };
    }).filter((r) => r.amount !== 0);

    if (rows.length === 0) {
      toast({ title: 'Satır bulunamadı', description: 'Biçim: referans, tutar, tarih (YYYY-AA-GG).', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      setResult(await reconcileFinance({ rows, dateToleranceDays: Number(tolerance) || 0 }));
      await loadEntries();
    } catch (err) {
      toast({ title: 'Mutabakat yapılamadı', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-reconciliation-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Mutabakat Merkezi</h1>
        <p className="text-muted-foreground mt-1">Banka/POS ekstresini sisteme girilmiş tahsilatlarla otomatik eşleştirin</p>
      </div>

      <Card className="border-sky-200 bg-sky-50/50 dark:bg-sky-900/10">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div className="space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground">Mutabakat nedir, ne işe yarar?</p>
            <p>Bankadan veya POS cihazından gelen para hareketlerini sistemdeki kayıtlarla karşılaştırır: hesaba giren tutarlar (pozitif) nakit dışı tahsilatlarla, hesaptan çıkan tutarlar (eksi) onaylı giderler, ödenmiş maaşlar ve faturalarla eşleşir. Sonuçlar kaydedilir; aynı ekstre tekrar yüklenirse satırlar çoğalmaz. Böylece <b>"banka hesabıma giren para ile sistemdeki tahsilatlar tutuyor mu?"</b> sorusunu yanıtlar. Tutar ve tarih (±gün toleransı) eşleşen satırlar <b>Eşleşti</b>, sistemde karşılığı bulunamayanlar <b>Eşleşmedi</b> olarak işaretlenir; eşleşmeyenler kayıp/eksik tahsilat takibi için kullanılır.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-brand-primary" /> Ekstre Satırları</CardTitle>
          <CardDescription>Her satır: <code>referans; tutar; tarih(YYYY-AA-GG); açıklama</code> — çıkan para eksi tutarla yazılır.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-[160px] w-full rounded-xl border bg-background p-3 text-sm font-mono"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Tarih toleransı (gün)
              <input
                type="number"
                min="0"
                max="15"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="h-9 w-20 rounded-lg border bg-background px-3 text-sm"
              />
            </label>
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Eşleştir
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {([
              ['Toplam Satır', String(result.total), CircleDollarSign, 'text-foreground'],
              ['Eşleşen', `${result.matched} • ${formatCurrency(result.matchedAmount)}`, ShieldCheck, 'text-emerald-600'],
              ['Eşleşmeyen', `${result.unmatched} • ${formatCurrency(result.unmatchedAmount)}`, ArrowRightLeft, 'text-red-600'],
            ] satisfies ReadonlyArray<readonly [string, string, IconComponent, string]>).map(([label, value, Icon, color]) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-xl bg-muted p-2"><Icon className={`h-5 w-5 ${color}`} /></div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Eşleşme Sonucu</CardTitle>
              <CardDescription>Her ekstre satırının sistemdeki tahsilatla eşleşme durumu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.items.map((item, idx) => (
                <div key={`${item.reference}-${idx}`} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{item.reference || 'Referans yok'}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(item.date)} • {formatCurrency(item.amount)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.matchStatus === 'Matched' ? (
                      <span className="text-sm text-muted-foreground">
                        {MATCH_TYPE_LABEL[item.matchedType || ''] || 'Kayıt'}: {item.matchedLabel || item.receiptNo || '—'}
                      </span>
                    ) : null}
                    <StatusBadge tone={item.matchStatus === 'Matched' ? 'success' : item.matchStatus === 'Ignored' ? 'neutral' : 'danger'}>
                      {statusLabel(item.matchStatus)}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Kayıtlı Banka Hareketleri</CardTitle>
            <CardDescription>Eşleşmeyenleri takip edin; banka masrafı gibi karşılığı olmayan satırları yok sayın.</CardDescription>
          </div>
          <select className="h-9 rounded-lg border bg-background px-3 text-sm" value={entryFilter} onChange={(e) => setEntryFilter(toEntryFilter(e.target.value))}>
            <option value="Unmatched">Eşleşmeyenler</option>
            <option value="Matched">Eşleşenler</option>
            <option value="Ignored">Yok sayılanlar</option>
            <option value="">Tümü</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{entry.reference}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(entry.bankDate)} • <span className={entry.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(entry.amount)}</span>
                  {entry.description ? ` • ${entry.description}` : ''}
                </p>
                {entry.status === 'Matched' ? (
                  <p className="text-xs text-muted-foreground">{MATCH_TYPE_LABEL[entry.matchedType] || 'Kayıt'}: {entry.matchedLabel}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={entry.status === 'Matched' ? 'success' : entry.status === 'Ignored' ? 'neutral' : 'danger'}>{statusLabel(entry.status)}</StatusBadge>
                {entry.status === 'Unmatched' ? (
                  <Button size="sm" variant="outline" onClick={() => void act(entry, 'ignore')}>Yok say</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void act(entry, 'unmatch')}>{entry.status === 'Matched' ? 'Eşleşmeyi kaldır' : 'Geri al'}</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
