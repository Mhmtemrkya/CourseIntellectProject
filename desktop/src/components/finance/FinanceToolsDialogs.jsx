import { useState } from 'react';
import { Loader2, Calculator, FileCheck2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/use-toast';
import { calculatePayroll, reconcileFinance } from '../../lib/api/modules';

function tl(value) {
  return `${Number(value || 0).toLocaleString('tr-TR')} ₺`;
}

// ---- Bordro hesaplayıcı (SGK/işsizlik/gelir vergisi/damga) ----
export function PayrollCalculatorDialog({ onClose }) {
  const { toast } = useToast();
  const [gross, setGross] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    const value = Number(gross);
    if (!value || value <= 0) {
      toast({ title: 'Geçerli bir brüt maaş girin.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      setResult(await calculatePayroll({ grossSalary: value }));
    } catch (err) {
      toast({ title: 'Hesaplanamadı', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,560px)] max-w-[560px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Bordro Hesaplama</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input type="number" min="0" placeholder="Brüt maaş (₺)" value={gross} onChange={(e) => setGross(e.target.value)} />
          <Button onClick={calc} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />} Hesapla
          </Button>
          {result ? (
            <div className="rounded-xl border p-4 text-sm space-y-1">
              {[
                ['Brüt', result.gross],
                ['SGK İşçi (%14)', -result.sgkEmployee],
                ['İşsizlik İşçi (%1)', -result.unemploymentEmployee],
                ['Gelir Vergisi', -result.incomeTax],
                ['Damga Vergisi', -result.stampTax],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={value < 0 ? 'text-red-600' : ''}>{tl(value)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Net Maaş</span><span className="text-emerald-600">{tl(result.net)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>İşveren maliyeti (SGK işveren dahil)</span><span>{tl(result.totalEmployerCost)}</span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">Yaklaşık hesap; resmi bordro için güncel dilim/kümülatif matrah gerekir.</p>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end"><Button variant="outline" onClick={onClose}>Kapat</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Banka/POS mutabakatı ----
export function ReconciliationDialog({ onClose }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const rows = text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [reference, amount, date, ...rest] = line.split(/[;,\t]/).map((c) => c.trim());
      return { reference: reference || '', amount: Number(amount) || 0, date: date || new Date().toISOString(), description: rest.join(' ') };
    }).filter((r) => r.amount > 0);
    if (rows.length === 0) {
      toast({ title: 'Satır bulunamadı', description: 'Biçim: referans, tutar, tarih (her satır bir hareket).', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      setResult(await reconcileFinance({ rows, dateToleranceDays: 3 }));
    } catch (err) {
      toast({ title: 'Mutabakat yapılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,640px)] max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" /> Banka/POS Mutabakatı</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Her satır: <code>referans, tutar, tarih(YYYY-AA-GG)</code></p>
          <textarea
            className="min-h-[140px] w-full rounded-xl border bg-background p-3 text-sm"
            placeholder={'HVL123, 5000, 2026-06-01\nPOS987, 2500, 2026-06-02'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />} Eşleştir
          </Button>
          {result ? (
            <div className="rounded-xl border p-4 text-sm space-y-2">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>Toplam: <b>{result.total}</b></span>
                <span className="text-emerald-600">Eşleşen: <b>{result.matched}</b> ({tl(result.matchedAmount)})</span>
                <span className="text-red-600">Eşleşmeyen: <b>{result.unmatched}</b> ({tl(result.unmatchedAmount)})</span>
              </div>
              <div className="space-y-1">
                {result.items.map((item, idx) => (
                  <div key={`${item.reference}-${idx}`} className="flex justify-between border-t pt-1">
                    <span>{item.reference} · {tl(item.amount)}</span>
                    <span className={item.matchStatus === 'Matched' ? 'text-emerald-600' : 'text-red-600'}>
                      {item.matchStatus === 'Matched' ? `Eşleşti (${item.receiptNo || '—'})` : 'Eşleşmedi'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end"><Button variant="outline" onClick={onClose}>Kapat</Button></div>
      </DialogContent>
    </Dialog>
  );
}

