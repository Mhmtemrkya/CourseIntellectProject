import { useCallback, useEffect, useState } from 'react';
import { Lock, LockOpen, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  closeFinanceDay, fetchFinanceDayHistory, fetchFinanceDaySummary, reopenFinanceDay,
} from '../../lib/api/modules';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import type { FinanceDayClosingDto, FinanceDaySummaryDto } from '../../types/api/generated';

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Gün sonu kasa kapanışı. Beklenen nakit = nakit tahsilat − (nakit iade + nakit
 * gider/maaş/fatura ödemesi). Kapanan güne sunucu hiçbir para hareketi yazdırmaz;
 * düzeltme için yönetici günü gerekçeyle yeniden açar.
 */
export function DayClosePanel() {
  const { toast } = useToast();
  const { user } = useApp();
  const isAdmin = ['admin', 'branchmanager'].includes(String(user?.backendRole || user?.role || '').toLowerCase());
  const [day, setDay] = useState(localToday);
  const [summary, setSummary] = useState<FinanceDaySummaryDto | null>(null);
  const [history, setHistory] = useState<FinanceDayClosingDto[]>([]);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [daySummary, closings] = await Promise.all([
        fetchFinanceDaySummary(day),
        fetchFinanceDayHistory(),
      ]);
      setSummary(daySummary);
      setHistory(closings.slice(0, 10));
      setCounted(daySummary ? String(daySummary.expectedCash) : '');
    } catch (err) {
      toast({ title: 'Kasa özeti alınamadı', description: errorMessage(err), variant: 'destructive' });
    }
  }, [day, toast]);

  useEffect(() => { void load(); }, [load]);

  const close = async () => {
    const countedCash = Number(counted);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      toast({ title: 'Sayılan nakit tutarını girin.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`${formatDate(day)} günü kapatılsın mı? Kapanan güne tahsilat, iade veya gider girilemez.`)) return;
    try {
      setBusy(true);
      await closeFinanceDay({ day, countedCash, note: note.trim() || null });
      toast({ title: 'Gün kapatıldı.' });
      setNote('');
      await load();
    } catch (err) {
      toast({ title: 'Gün kapatılamadı', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (!reopenReason.trim()) {
      toast({ title: 'Yeniden açma gerekçesi yazın.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await reopenFinanceDay(day, reopenReason.trim());
      toast({ title: 'Gün yeniden açıldı.' });
      setReopenReason('');
      await load();
    } catch (err) {
      toast({ title: 'Gün açılamadı', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const difference = summary ? Number(counted || 0) - summary.expectedCash : 0;

  return (
    <Card data-testid="day-close-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />Gün Sonu Kasa Kapanışı
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" className="h-9 w-40" value={day} max={localToday()} onChange={(e) => setDay(e.target.value || localToday())} />
          <Button variant="ghost" size="icon" aria-label="Yenile" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nakit giriş</p><p className="font-bold text-emerald-600">{formatMoney(summary.cashIn)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nakit çıkış</p><p className="font-bold text-rose-600">{formatMoney(summary.cashOut)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Beklenen kasa</p><p className="font-bold">{formatMoney(summary.expectedCash)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Kart</p><p className="font-bold">{formatMoney(summary.cardIn)}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Havale/EFT</p><p className="font-bold">{formatMoney(summary.transferIn)}</p></div>
            </div>

            {summary.isClosed && summary.closing ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-600 text-white">Kapatıldı</Badge>
                  <span>{summary.closing.closedByName || '—'} • {formatDateTime(summary.closing.closedAtUtc)}</span>
                </div>
                <p>
                  Sayılan {formatMoney(summary.closing.countedCash)} • Fark{' '}
                  <b className={summary.closing.difference === 0 ? '' : summary.closing.difference > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {formatMoney(summary.closing.difference)}
                  </b>
                  {summary.closing.note ? ` • ${summary.closing.note}` : ''}
                </p>
                {isAdmin ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[240px] flex-1">
                      <Label htmlFor="day-reopen-reason">Yeniden açma gerekçesi</Label>
                      <Input id="day-reopen-reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ör. unutulan tahsilat girilecek" />
                    </div>
                    <Button variant="outline" onClick={() => void reopen()} disabled={busy}><LockOpen className="mr-2 h-4 w-4" />Günü Yeniden Aç</Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="day-counted-cash">Sayılan nakit (TL)</Label>
                  <Input id="day-counted-cash" type="number" min="0" step="0.01" className="w-44" value={counted} onChange={(e) => setCounted(e.target.value)} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="day-close-note">Not</Label>
                  <Input id="day-close-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fark açıklaması (opsiyonel)" />
                </div>
                <div className="pb-2 text-sm">
                  Fark: <b className={difference === 0 ? '' : difference > 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatMoney(difference)}</b>
                </div>
                <Button onClick={() => void close()} disabled={busy}><Lock className="mr-2 h-4 w-4" />Günü Kapat</Button>
              </div>
            )}
          </>
        ) : null}

        {history.length > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Son kapanışlar</p>
            {history.map((item) => (
              <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-0">
                <span>{formatDate(item.day)} • {item.closedByName || '—'}</span>
                <span>Beklenen {formatMoney(item.expectedCash)} • Sayılan {formatMoney(item.countedCash)} • Fark {formatMoney(item.difference)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
