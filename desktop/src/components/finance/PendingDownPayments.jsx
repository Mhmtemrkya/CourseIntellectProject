import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { collectDownPayment, fetchPendingDownPayments } from '../../lib/api/modules';

const money = (value, currency = 'TRY') =>
  `${Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency === 'TRY' ? 'TL' : currency}`;

/**
 * Peşinatı beklenen (henüz tahsil edilmemiş) sözleşmeleri listeler ve tek tıkla
 * makbuzlu tahsilata çevirir. Hem okul (finans/Collections) hem sürücü kursu
 * (DrivingCollection) tahsilat ekranında kullanılır.
 *
 * onCollected() — bir peşinat tahsil edilince üst ekran kendi verisini tazelesin.
 */
export default function PendingDownPayments({ onCollected }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState({}); // contractId -> seçilen yöntem
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPendingDownPayments();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const collect = async (row) => {
    setBusyId(row.contractId);
    try {
      await collectDownPayment(row.contractId, methods[row.contractId] || 'Nakit');
      setRows((prev) => prev.filter((item) => item.contractId !== row.contractId));
      toast({ title: 'Peşinat tahsil edildi', description: `${row.studentName} • ${money(row.downPayment, row.currency)} • makbuz kesildi.` });
      onCollected?.();
    } catch (error) {
      toast({ title: 'Peşinat tahsil edilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Peşinat bekleyenler yükleniyor…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Bekleyen peşinat yok — tüm kayıt peşinatları tahsil edilmiş.
      </div>
    );
  }

  const total = rows.reduce((sum, item) => sum + Number(item.downPayment || 0), 0);

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          <b className="text-sm">Peşinat Bekleyenler</b>
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-600">{rows.length}</span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Toplam beklenen: {money(total)}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.contractId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <b className="truncate">{row.studentName}</b>
                {row.className ? <span className="rounded bg-foreground/10 px-1.5 text-[11px] font-semibold text-muted-foreground">{row.className}</span> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Beklenen peşinat: <b className="text-red-600">{money(row.downPayment, row.currency)}</b>
                {row.createdAtUtc ? ` • Kayıt: ${new Date(row.createdAtUtc).toLocaleDateString('tr-TR')}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                className="h-9 rounded-lg border border-foreground/15 bg-background px-2 text-sm"
                value={methods[row.contractId] || 'Nakit'}
                onChange={(e) => setMethods((prev) => ({ ...prev, [row.contractId]: e.target.value }))}
                disabled={busyId === row.contractId}
              >
                <option value="Nakit">Nakit</option>
                <option value="Kart">Kart / POS</option>
                <option value="Havale">Havale / EFT</option>
              </select>
              <Button type="button" size="sm" onClick={() => collect(row)} disabled={busyId === row.contractId}>
                {busyId === row.contractId
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Tahsil ediliyor…</>
                  : <><CheckCircle2 className="mr-1.5 h-4 w-4" />Peşinatı Tahsil Et</>}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
