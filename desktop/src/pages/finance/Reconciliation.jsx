import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRightLeft, CircleDollarSign, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { reconcileFinance } from '../../lib/api/modules';
import { formatCurrency } from '../../lib/financeDocuments';

const PLACEHOLDER = 'HVL123, 5000, 2026-06-01\nPOS987, 2500, 2026-06-02\nEFT456, 1800, 2026-06-03';

export default function Reconciliation() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [tolerance, setTolerance] = useState(3);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const rows = text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [reference, amount, date, ...rest] = line.split(/[;,\t]/).map((c) => c.trim());
      return { reference: reference || '', amount: Number(amount) || 0, date: date || new Date().toISOString(), description: rest.join(' ') };
    }).filter((r) => r.amount > 0);

    if (rows.length === 0) {
      toast({ title: 'Satır bulunamadı', description: 'Biçim: referans, tutar, tarih (YYYY-AA-GG).', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      setResult(await reconcileFinance({ rows, dateToleranceDays: Number(tolerance) || 0 }));
    } catch (err) {
      toast({ title: 'Mutabakat yapılamadı', description: err.message, variant: 'destructive' });
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
            <p>Bankadan veya POS cihazından gelen para hareketlerini (ekstre satırlarını) sistemdeki tahsilat kayıtlarıyla karşılaştırır. Böylece <b>"banka hesabıma giren para ile sistemdeki tahsilatlar tutuyor mu?"</b> sorusunu yanıtlar. Tutar ve tarih (±gün toleransı) eşleşen satırlar <b>Eşleşti</b>, sistemde karşılığı bulunamayanlar <b>Eşleşmedi</b> olarak işaretlenir; eşleşmeyenler kayıp/eksik tahsilat takibi için kullanılır.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-brand-primary" /> Ekstre Satırları</CardTitle>
          <CardDescription>Her satır: <code>referans, tutar, tarih(YYYY-AA-GG)</code></CardDescription>
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
            {[
              ['Toplam Satır', String(result.total), CircleDollarSign, 'text-foreground'],
              ['Eşleşen', `${result.matched} • ${formatCurrency(result.matchedAmount)}`, ShieldCheck, 'text-emerald-600'],
              ['Eşleşmeyen', `${result.unmatched} • ${formatCurrency(result.unmatchedAmount)}`, ArrowRightLeft, 'text-red-600'],
            ].map(([label, value, Icon, color]) => (
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
                    <p className="text-sm text-muted-foreground">{new Date(item.date).toLocaleDateString('tr-TR')} • {formatCurrency(item.amount)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.matchStatus === 'Matched' ? (
                      <span className="text-sm text-muted-foreground">Makbuz: {item.receiptNo || '—'}</span>
                    ) : null}
                    <Badge className={item.matchStatus === 'Matched' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {item.matchStatus === 'Matched' ? 'Eşleşti' : 'Eşleşmedi'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </motion.div>
  );
}
