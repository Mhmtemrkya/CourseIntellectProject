import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, CreditCard, CheckCircle2, Clock3, XCircle, Receipt, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchParentChildrenFinance, parentPay } from '../../lib/api/modules';

const STATUS_META = {
  Paid: ['Ödendi', 'text-emerald-600', CheckCircle2],
  Partial: ['Kısmi', 'text-amber-600', Clock3],
  Overdue: ['Gecikmiş', 'text-red-600', XCircle],
  Pending: ['Bekliyor', 'text-muted-foreground', Clock3],
};

function tl(value, currency = 'TRY') {
  return `${Number(value || 0).toLocaleString('tr-TR')} ${currency === 'TRY' ? '₺' : currency}`;
}

export default function ParentPayments() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payFor, setPayFor] = useState(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setAccounts(await fetchParentChildrenFinance());
    } catch (err) {
      setError(err.message || 'Ödeme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPay = (account) => {
    setPayFor(account);
    setAmount(account.balance > 0 ? String(account.balance) : '');
  };

  const submitPay = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { toast({ title: 'Geçerli bir tutar girin.', variant: 'destructive' }); return; }
    try {
      setPaying(true);
      const result = await parentPay({ studentName: payFor.studentName, amount: value, method: 'Online' });
      toast({ title: 'Ödeme alındı', description: `${tl(value)} • Makbuz: ${result?.receiptNo || '-'}` });
      setPayFor(null);
      setAmount('');
      await load();
    } catch (err) {
      toast({ title: 'Ödeme yapılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-payments-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><Wallet className="h-7 w-7 text-brand-primary" />Ödemeler</h1>
        <p className="text-muted-foreground mt-1">Çocuklarınızın kayıt ücreti, taksit planı ve kalan borcu; online ödeme ve makbuzlar.</p>
      </div>
      {error ? <ErrorBanner title="Ödeme verileri alınamadı" message={error} onRetry={load} /> : null}

      {accounts.length === 0 || accounts.every((a) => (a.netTotal || 0) <= 0) ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Tanımlı bir kayıt ücreti / taksit planı bulunamadı.</CardContent></Card>
      ) : accounts.map((account) => {
        if ((account.netTotal || 0) <= 0) return null;
        const currency = account.currency || 'TRY';
        return (
          <Card key={account.studentName}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{account.studentName}</CardTitle>
                <Button onClick={() => openPay(account)} disabled={account.balance <= 0}>
                  <CreditCard className="mr-2 h-4 w-4" />{account.balance > 0 ? 'Online Öde' : 'Borç Yok'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
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

              <div>
                <p className="mb-2 font-semibold">Taksitler</p>
                <div className="space-y-2">
                  {(account.installments || []).length === 0 ? <p className="text-sm text-muted-foreground">Taksit yok.</p>
                    : account.installments.map((item) => {
                      const [label, tone, Icon] = STATUS_META[item.status] || STATUS_META.Pending;
                      return (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                          <span>{item.label || `${item.seqNo}. Taksit`} <span className="text-muted-foreground">{new Date(item.dueDateUtc).toLocaleDateString('tr-TR')}</span></span>
                          <span className="flex items-center gap-3">
                            <span>{tl(item.amount, currency)}</span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}><Icon className="h-3.5 w-3.5" />{label}</span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {(account.payments || []).length > 0 ? (
                <div>
                  <p className="mb-2 font-semibold">Makbuzlar</p>
                  <div className="space-y-2">
                    {account.payments.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
                        <span className="inline-flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />{item.receiptNo || 'Makbuz'} · {item.method} · {new Date(item.paidAtUtc).toLocaleDateString('tr-TR')}</span>
                        <span className={`font-bold ${item.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{tl(item.amount, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!payFor} onOpenChange={(open) => { if (!open) setPayFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Online Ödeme — {payFor?.studentName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Kalan borç: <b>{tl(payFor?.balance, payFor?.currency)}</b></p>
            <Input type="number" min="0" placeholder="Tutar" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Ödeme en eski taksitten başlayarak mahsup edilir; makbuzunuz otomatik oluşur.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Vazgeç</Button>
            <Button onClick={submitPay} disabled={paying}>{paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Öde</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
