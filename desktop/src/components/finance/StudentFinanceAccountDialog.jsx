import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Wallet, Receipt, RotateCcw, CreditCard, CheckCircle2, Clock3, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingDots } from '../animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchStudentFinanceAccount,
  recordFinancePayment,
  refundFinancePayment,
  createFinancePaymentIntent,
  confirmFinancePayment,
} from '../../lib/api/modules';

function tl(value, currency = 'TRY') {
  return `${Number(value || 0).toLocaleString('tr-TR')} ${currency === 'TRY' ? '₺' : currency}`;
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
  const [refundAmount, setRefundAmount] = useState('');

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

  const doRefund = async () => {
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Geçerli bir iade tutarı girin.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await refundFinancePayment({
        studentName: account.studentName,
        studentUserId: account.studentUserId,
        enrollmentContractId: account?.contracts?.[0]?.id || null,
        amount,
        reason: 'Panel üzerinden iade',
      });
      toast({ title: 'İade işlendi', description: tl(amount) });
      setRefundAmount('');
      await load();
    } catch (err) {
      toast({ title: 'İade yapılamadı', description: err.message, variant: 'destructive' });
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Net', tl(account.netTotal, currency)],
                ['Ödenen', tl(account.paidTotal, currency)],
                ['Kalan', tl(account.balance, currency)],
                ['Geciken Taksit', account.overdueCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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

              <div className="rounded-xl border p-4">
                <p className="mb-2 font-semibold flex items-center gap-2"><RotateCcw className="h-4 w-4" /> İade</p>
                <Input type="number" min="0" placeholder="İade tutarı" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                <Button onClick={doRefund} disabled={busy} variant="outline" className="mt-3 w-full">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} İade Et
                </Button>
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
                        <span className="ml-2 text-muted-foreground">{new Date(item.dueDateUtc).toLocaleDateString('tr-TR')}</span>
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
                ) : account.payments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
                    <div>
                      <span className="font-semibold">{item.receiptNo || 'Makbuz'}</span>
                      <span className="ml-2 text-muted-foreground">{item.method} · {new Date(item.paidAtUtc).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <span className={`font-bold ${item.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{tl(item.amount, currency)}</span>
                  </div>
                ))}
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
