import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Wallet, Receipt, CreditCard, CheckCircle2, Clock3, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingDots } from '../animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { formatDate } from '../../lib/format';
import {
  fetchStudentFinanceAccount,
  recordFinancePayment,
  createFinancePaymentIntent,
  confirmFinancePayment,
} from '../../lib/api/modules';

function tl(value, currency = 'TRY') {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })} ${currency === 'TRY' ? 'TL' : currency}`;
}

const STATUS_META = {
  Paid: ['Ödendi', 'text-emerald-600', CheckCircle2],
  Partial: ['Kısmi', 'text-amber-600', Clock3],
  Overdue: ['Gecikmiş', 'text-red-600', XCircle],
  Pending: ['Bekliyor', 'text-muted-foreground', Clock3],
};

// Öğrenci cari ekranı: sözleşme/taksit/ödeme listesi + ödeme kaydet, iade, online ödeme.
export default function StudentFinanceAccountDialog({ studentName, studentUserId, onClose }) {
  const { toast } = useToast();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Nakit');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchStudentFinanceAccount({
        studentName: studentName || '',
        studentUserId: studentUserId || undefined,
      });
      setAccount(data);
    } catch (err) {
      setError(err.message || 'Cari bilgisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [studentName, studentUserId]);

  useEffect(() => { load(); }, [load]);

  const recordPayment = async (online = false) => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Geçerli bir tutar girin.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      const contractId = account?.contracts?.[0]?.id || null;
      if (online) {
        const intent = await createFinancePaymentIntent({
          studentName: account.studentName,
          studentUserId: account.studentUserId,
          enrollmentContractId: contractId,
          amount,
        });
        const confirmed = await confirmFinancePayment({ intentId: intent.intentId, token: 'TEST-OK' });
        if (!confirmed?.success) {
          toast({ title: 'Online ödeme onaylanmadı', description: intent.configured ? 'Sağlayıcı reddetti.' : 'Sağlayıcı yapılandırılmadı (test modu).', variant: 'destructive' });
          return;
        }
      }
      await recordFinancePayment({
        studentName: account.studentName,
        studentUserId: account.studentUserId,
        enrollmentContractId: contractId,
        amount,
        method: online ? 'Online' : paymentMethod,
      });
      toast({ title: 'Ödeme kaydedildi', description: tl(amount) });
      setPaymentAmount('');
      await load();
    } catch (err) {
      toast({ title: 'Ödeme kaydedilemedi', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const currency = account?.currency || 'TRY';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,860px)] max-w-[860px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> {studentName || account?.studentName} — Cari Hesap
          </DialogTitle>
        </DialogHeader>

        {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <div className="py-12 text-center"><LoadingDots /></div>
        ) : !account || account.netTotal <= 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Bu öğrenci için kayıt/sözleşme finansalı bulunamadı.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Net', tl(account.netTotal, currency)],
                ['Brüt Tahsilat', tl(account.grossCollectedTotal, currency)],
                ['İade', tl(account.refundedTotal, currency)],
                ['Net Tahsilat', tl(account.paidTotal, currency)],
                ['Kalan', tl(account.balance, currency)],
                ['Geciken Taksit', account.overdueCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border p-4">
                <p className="mb-2 font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Ödeme Al</p>
                <Input type="number" min="0" placeholder="Tutar" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  {['Nakit', 'Kart', 'Havale'].map((m) => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${paymentMethod === m ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground'}`}>{m}</button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => recordPayment(false)} disabled={busy} className="flex-1">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />} Tahsil Et
                  </Button>
                  <Button onClick={() => recordPayment(true)} disabled={busy} variant="outline" className="flex-1">
                    <CreditCard className="mr-2 h-4 w-4" /> Online
                  </Button>
                </div>
              </div>

            </div>

            <div>
              <p className="mb-2 font-semibold">Taksitler</p>
              <div className="space-y-2">
                {(account.installments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Taksit yok.</p>
                ) : account.installments.map((item) => {
                  const [label, tone, Icon] = STATUS_META[item.status] || STATUS_META.Pending;
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                      <div>
                        <span className="font-semibold">{item.label || `${item.seqNo}. Taksit`}</span>
                        <span className="ml-2 text-muted-foreground">{formatDate(item.dueDateUtc)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>{tl(item.amount, currency)}</span>
                        <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}><Icon className="h-3.5 w-3.5" />{label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold">Ödemeler / Makbuzlar</p>
              <div className="space-y-2">
                {(account.payments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ödeme kaydı yok.</p>
                ) : account.payments.map((item) => {
                  const isRefund = item.entryType === 'Refund' || item.amount < 0;
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 text-sm ${isRefund ? 'border-red-300/50 bg-red-500/5' : 'bg-muted/20'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="font-semibold">{item.receiptNo || (isRefund ? 'İade Belgesi' : 'Makbuz')}</span>
                          <span className="ml-2 text-muted-foreground">{isRefund ? item.refundChannel || 'İade' : item.method} · {formatDate(item.paidAtUtc)}</span>
                          {item.isDownPayment ? <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">Peşinat</span> : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-bold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>{tl(item.amount, currency)}</p>
                            {!isRefund && item.refundedAmount > 0 ? <p className="text-[11px] text-red-600">İade edilen: {tl(item.refundedAmount, currency)}</p> : null}
                          </div>
                        </div>
                      </div>
                      {isRefund ? (
                        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.refundReason || item.note}</span>
                          {item.externalReference ? <span> · Referans: {item.externalReference}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
