import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Wallet, Receipt, RotateCcw, CreditCard, CheckCircle2, Clock3, XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingDots } from '../animations/AnimatedIcon';
import { FeatureGate } from '../FeatureGate';
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
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType] = useState('PaymentReversal');
  const [refundReason, setRefundReason] = useState('');
  const [refundChannel, setRefundChannel] = useState('Nakit');
  const [refundReference, setRefundReference] = useState('');

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
    if (!refundPayment || amount > Number(refundPayment.refundableAmount || 0)) {
      toast({ title: 'İade tutarı makbuzun iade edilebilir tutarını aşamaz.', variant: 'destructive' });
      return;
    }
    if (!refundReason.trim()) {
      toast({ title: 'İade gerekçesi zorunludur.', variant: 'destructive' });
      return;
    }
    if (refundChannel !== 'Nakit' && !refundReference.trim()) {
      toast({ title: 'Kart ve banka iadelerinde işlem referansı zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await refundFinancePayment({
        paymentId: refundPayment.id,
        amount,
        refundType,
        reason: refundReason.trim(),
        refundChannel,
        externalReference: refundReference.trim() || null,
      });
      toast({ title: 'İade işlendi', description: tl(amount) });
      setRefundAmount('');
      setRefundReason('');
      setRefundReference('');
      setRefundPayment(null);
      await load();
    } catch (err) {
      toast({ title: 'İade yapılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const startRefund = (payment) => {
    const normalizedMethod = String(payment.method || '').toLocaleLowerCase('tr-TR');
    setRefundPayment(payment);
    setRefundAmount(String(payment.refundableAmount || ''));
    setRefundType('PaymentReversal');
    setRefundReason('');
    setRefundChannel(
      normalizedMethod.includes('kart') || normalizedMethod.includes('online')
        ? 'Karta İade'
        : normalizedMethod.includes('havale') || normalizedMethod.includes('eft')
          ? 'Havale/EFT'
          : 'Nakit',
    );
    setRefundReference('');
  };

  const currency = account?.currency || 'TRY';
  const refundTypeMax = refundPayment
    ? refundType === 'AdvanceReturn'
      ? Number(refundPayment.unallocatedRefundableAmount || 0)
      : refundType === 'ContractReduction' && Number(refundPayment.allocatedRefundableAmount || 0) > 0
        ? Number(refundPayment.allocatedRefundableAmount)
        : Number(refundPayment.refundableAmount || 0)
    : 0;

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
                ) : account.payments.map((item) => {
                  const isRefund = item.entryType === 'Refund' || item.amount < 0;
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 text-sm ${isRefund ? 'border-red-300/50 bg-red-500/5' : 'bg-muted/20'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="font-semibold">{item.receiptNo || (isRefund ? 'İade Belgesi' : 'Makbuz')}</span>
                          <span className="ml-2 text-muted-foreground">{isRefund ? item.refundChannel || 'İade' : item.method} · {new Date(item.paidAtUtc).toLocaleDateString('tr-TR')}</span>
                          {item.isDownPayment ? <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">Peşinat</span> : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-bold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>{tl(item.amount, currency)}</p>
                            {!isRefund && item.refundedAmount > 0 ? <p className="text-[11px] text-red-600">İade edilen: {tl(item.refundedAmount, currency)}</p> : null}
                          </div>
                          {!isRefund && item.refundableAmount > 0 ? (
                            <FeatureGate module="collections" action="refund">
                              <Button size="sm" variant="outline" onClick={() => startRefund(item)} disabled={busy}>
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> İade Et
                              </Button>
                            </FeatureGate>
                          ) : null}
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

            {refundPayment ? (
              <div className="rounded-xl border border-amber-300/60 bg-amber-500/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4" /> Makbuzdan İade</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {refundPayment.receiptNo} · Tahsilat {tl(refundPayment.amount, currency)} · İade edilebilir {tl(refundPayment.refundableAmount, currency)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setRefundPayment(null)} disabled={busy}>Vazgeç</Button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">İade türü
                    <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={refundType} onChange={(e) => setRefundType(e.target.value)}>
                      <option value="PaymentReversal">Tahsilat iptali / düzeltmesi</option>
                      {!refundPayment.isDownPayment ? <option value="AdvanceReturn">Fazla ödeme / avans iadesi</option> : null}
                      {!refundPayment.isDownPayment ? <option value="ContractReduction">Ücret indirimi kaynaklı iade</option> : null}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">İade tutarı
                    <Input className="mt-1" type="number" min="0.01" step="0.01" max={refundTypeMax} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
                    <span className="mt-1 block font-normal text-muted-foreground">Bu tür için en fazla {tl(refundTypeMax, currency)}</span>
                  </label>
                  <label className="text-xs font-semibold">İade kanalı
                    <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={refundChannel} onChange={(e) => setRefundChannel(e.target.value)}>
                      {['Nakit', 'Karta İade', 'Havale/EFT'].map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Banka / POS referansı
                    <Input className="mt-1" placeholder={refundChannel === 'Nakit' ? 'İsteğe bağlı' : 'Zorunlu'} value={refundReference} onChange={(e) => setRefundReference(e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold sm:col-span-2">İade gerekçesi
                    <Input className="mt-1" placeholder="Zorunlu açıklama" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} maxLength={500} />
                  </label>
                </div>

                <div className="mt-4 rounded-lg border bg-background/70 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> İşlem sonrası önizleme</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-3">
                    <span>Mevcut borç: <b>{tl(account.balance, currency)}</b></span>
                    <span>İade: <b className="text-red-600">{tl(Number(refundAmount || 0), currency)}</b></span>
                    <span>Öngörülen borç: <b>{tl(refundType === 'ContractReduction' ? account.balance : account.balance + Number(refundAmount || 0), currency)}</b></span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {refundType === 'PaymentReversal' && 'İade edilen tahsilatın gerçek taksit mahsupları geri açılır.'}
                    {refundType === 'AdvanceReturn' && 'Yalnızca taksitlere mahsup edilmemiş fazla ödeme iade edilir; taksitler açılmaz.'}
                    {refundType === 'ContractReduction' && 'Tahsilat ve sözleşme bedeli birlikte azaltılır; öğrencinin mevcut borcu değişmez.'}
                  </p>
                </div>

                <Button onClick={doRefund} disabled={busy || !refundReason.trim() || (refundChannel !== 'Nakit' && !refundReference.trim()) || Number(refundAmount) <= 0 || Number(refundAmount) > refundTypeMax} variant="outline" className="mt-4 w-full border-red-300 text-red-600 hover:bg-red-500/10">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} İadeyi Onayla
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
