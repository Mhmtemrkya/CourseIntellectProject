import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  LockKeyhole,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchParentChildrenFinance, parentPay } from '../../lib/api/modules';
import {
  DonutChart,
  EmptyPanel,
  IconTile,
  PageHeader,
  Panel,
  SmallButton,
  StatCard,
  StatusPill,
  decodeText,
  formatDate,
  formatMoney,
  initials,
  itemMotion,
  pageMotion,
  safeNumber,
} from './parentPremiumUi';

const STATUS = {
  Paid: ['Ödendi', 'green'],
  Partial: ['Kısmi', 'orange'],
  Overdue: ['Vadesi Geçti', 'red'],
  Pending: ['Bekliyor', 'orange'],
};

function downloadReceiptLike(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ParentPayments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [payFor, setPayFor] = useState(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchParentChildrenFinance();
      const list = Array.isArray(payload) ? payload : [];
      setAccounts(list);
      setSelectedStudent((prev) => prev || list[0]?.studentName || '');
    } catch (err) {
      setError(err.message || 'Ödeme verileri alınamadı.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedAccount = useMemo(() => {
    return accounts.find((account) => account.studentName === selectedStudent) || accounts[0] || null;
  }, [accounts, selectedStudent]);

  const summary = useMemo(() => {
    const currency = selectedAccount?.currency || accounts[0]?.currency || 'TRY';
    const netTotal = accounts.reduce((sum, account) => sum + safeNumber(account.netTotal), 0);
    const paidTotal = accounts.reduce((sum, account) => sum + safeNumber(account.paidTotal), 0);
    const balance = accounts.reduce((sum, account) => sum + safeNumber(account.balance), 0);
    const overdue = accounts.reduce((sum, account) => sum + (account.installments || []).filter((item) => item.status === 'Overdue').reduce((inner, item) => inner + safeNumber(item.remaining || item.amount), 0), 0);
    const nextDue = accounts
      .flatMap((account) => account.installments || [])
      .filter((item) => item.status !== 'Paid')
      .sort((a, b) => new Date(a.dueDateUtc || 0) - new Date(b.dueDateUtc || 0))[0]?.dueDateUtc;
    return { currency, netTotal, paidTotal, balance, overdue, nextDue };
  }, [accounts, selectedAccount?.currency]);

  const openPay = (account, installment = null) => {
    const value = installment ? safeNumber(installment.remaining || installment.amount) : safeNumber(account?.balance);
    setPayFor({ account, installment });
    setAmount(value > 0 ? String(value) : '');
  };

  const submitPay = async () => {
    const value = Number(amount);
    if (!payFor?.account || !value || value <= 0) {
      toast({ title: 'Geçerli bir ödeme tutarı girin.', variant: 'destructive' });
      return;
    }
    try {
      setPaying(true);
      const result = await parentPay({
        studentUserId: payFor.account.studentUserId,
        studentName: payFor.account.studentName,
        enrollmentContractId: payFor.installment?.enrollmentContractId || payFor.account.contracts?.[0]?.id,
        financeInstallmentId: payFor.installment?.id,
        amount: value,
        method: 'Online',
      });
      toast({ title: 'Ödeme alındı', description: `${formatMoney(value, payFor.account.currency)} • Makbuz: ${result?.receiptNo || '-'}` });
      setPayFor(null);
      setAmount('');
      await load();
    } catch (err) {
      toast({ title: 'Ödeme yapılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={pageMotion} initial="hidden" animate="visible" className="space-y-5 text-slate-100" data-testid="parent-payments-page">
      <PageHeader
        userName={user?.name}
        title="Ödemeler"
        description="Ödeme bilgilerinizi buradan görüntüleyebilir ve yönetebilirsiniz."
        icon={<IconTile icon={CreditCard} tone="purple" className="h-14 w-14" />}
        actions={(
          <>
            <Button className="h-11 rounded-[10px] bg-purple-600 px-8 font-black text-white hover:bg-purple-500" onClick={() => selectedAccount && openPay(selectedAccount)}>
              <CreditCard className="mr-2 h-4 w-4" />Ödeme Yap
            </Button>
            <SmallButton onClick={() => document.getElementById('parent-payment-plan')?.scrollIntoView({ behavior: 'smooth' })}>
              <CalendarDays className="mr-2 h-4 w-4" />Ödeme Planı
            </SmallButton>
          </>
        )}
      />

      {error ? <ErrorBanner title="Ödeme verileri alınamadı" message={error} onRetry={load} /> : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard icon={Wallet} tone="purple" label="Toplam Borç" value={formatMoney(summary.balance, summary.currency)} sub={`${accounts.reduce((sum, account) => sum + safeNumber(account.overdueCount), 0)} adet ödenmemiş taksit`} />
        <StatCard icon={CheckCircle2} tone="green" label="Ödenen Tutar" value={formatMoney(summary.paidTotal, summary.currency)} sub="Bu yıl toplam ödenen" />
        <StatCard icon={FileText} tone="blue" label="Bekleyen Tutar" value={formatMoney(Math.max(0, summary.balance - summary.overdue), summary.currency)} sub="Vadesi gelmemiş borç" />
        <StatCard icon={CalendarDays} tone="orange" label="Son Ödeme Tarihi" value={formatDate(summary.nextDue, '-')} sub="Sıradaki taksit için" />
      </div>

      {accounts.length === 0 ? (
        <EmptyPanel title="Tanımlı ödeme hesabı yok" description="Çocuğunuza ait kayıt ücreti veya taksit planı bulunamadı." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
          <div className="space-y-4">
            <Panel
              title="Ödeme Planı"
              action={(
                <div className="flex flex-wrap gap-3">
                  <select className="h-10 rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm font-semibold text-white outline-none" value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)}>
                    {accounts.map((account) => <option key={account.studentName} value={account.studentName}>{decodeText(account.studentName)}</option>)}
                  </select>
                  <SmallButton><CalendarDays className="mr-2 h-4 w-4" />2025 - 2026 Eğitim Yılı</SmallButton>
                </div>
              )}
              className="scroll-mt-6"
            >
              <div id="parent-payment-plan" className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr className="border-b border-foreground/[0.08]">
                      <th className="py-3 font-semibold">Taksit No</th>
                      <th className="py-3 font-semibold">Son Ödeme Tarihi</th>
                      <th className="py-3 font-semibold">Tutar</th>
                      <th className="py-3 font-semibold">Durum</th>
                      <th className="py-3 text-right font-semibold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAccount?.installments || []).map((item) => {
                      const [label, tone] = STATUS[item.status] || STATUS.Pending;
                      const isPaid = item.status === 'Paid';
                      return (
                        <tr key={item.id} className="border-b border-foreground/[0.06] text-slate-200">
                          <td className="py-4 font-semibold">{item.label || `${item.seqNo}. Taksit`}</td>
                          <td className="py-4">{formatDate(item.dueDateUtc)}</td>
                          <td className="py-4">{formatMoney(item.amount, item.currency || selectedAccount.currency)}</td>
                          <td className="py-4"><StatusPill tone={tone}>{label}</StatusPill></td>
                          <td className="py-4 text-right">
                            {isPaid ? (
                              <Button variant="ghost" size="icon" className="rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.04] text-slate-200" onClick={() => downloadReceiptLike(`taksit-${item.seqNo}.txt`, JSON.stringify(item, null, 2))}>
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button className="h-9 rounded-[10px] bg-purple-600 px-5 font-black text-white hover:bg-purple-500" onClick={() => openPay(selectedAccount, item)}>Öde</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(selectedAccount?.installments || []).length === 0 ? <EmptyPanel title="Taksit planı yok" description="Bu öğrenci için taksit kaydı bulunamadı." /> : null}
              </div>
            </Panel>

            <Panel title="Ödeme Yöntemleri">
              <p className="mb-4 text-sm text-slate-400">Güvenli ödeme seçeneklerimizle kolayca ödeme yapın.</p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Kredi / Banka Kartı', 'Kredi veya banka kartınız ile peşin veya taksitli ödeme yapın.', CreditCard, 'purple', 'Ödeme Yap', () => selectedAccount && openPay(selectedAccount)],
                  ['Banka Havalesi', 'Banka hesabımıza havale/EFT ile ödeme yapabilirsiniz.', Building2, 'blue', 'Havale Bilgileri', () => toast({ title: 'Havale bilgileri', description: 'Kurum banka bilgileri finans birimi tarafından paylaşılır.' })],
                  ['Kayıtlı Kartlarım', 'Kayıtlı kartlarınızla hızlı ve güvenli ödeme yapın.', Wallet, 'green', 'Kartlarımı Yönet', () => toast({ title: 'Kart yönetimi', description: 'Kart saklama sağlayıcısı yapılandırıldığında aktif olur.' })],
                ].map(([title, text, Icon, tone, button, action]) => (
                  <motion.div variants={itemMotion} key={title} className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.035] p-4">
                    <IconTile icon={Icon} tone={tone} />
                    <p className="mt-4 font-black text-white">{title}</p>
                    <p className="mt-2 min-h-[42px] text-sm text-slate-400">{text}</p>
                    <Button className="mt-4 h-10 w-full rounded-[10px] bg-foreground/[0.06] text-slate-100 hover:bg-purple-500/20" onClick={action}>{button}</Button>
                  </motion.div>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Ödeme Özeti" action={<SmallButton>Bu Yıl</SmallButton>}>
              <div className="grid gap-5 md:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
                <DonutChart
                  items={[
                    { label: 'Ödenen', value: summary.paidTotal, color: '#22c55e' },
                    { label: 'Bekleyen', value: summary.balance, color: '#8b5cf6' },
                    { label: 'Vadesi Geçen', value: summary.overdue, color: '#f97316' },
                  ]}
                  center={(
                    <div className="text-center">
                      <p className="text-xs text-slate-400">Toplam</p>
                      <p className="text-lg font-black text-white">{formatMoney(summary.netTotal, summary.currency)}</p>
                    </div>
                  )}
                />
                <div className="space-y-4">
                  {[
                    ['Ödenen Tutar', summary.paidTotal, '#22c55e'],
                    ['Bekleyen Tutar', summary.balance, '#8b5cf6'],
                    ['Vadesi Geçen Tutar', summary.overdue, '#f97316'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-slate-300"><span className="h-3 w-3 rounded-full" style={{ background: color }} />{label}</span>
                      <b className="text-white">{formatMoney(value, summary.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Kayıt Bilgileri">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--brand-accent))] text-lg font-black text-white">{initials(selectedAccount?.studentName)}</div>
                <div>
                  <p className="font-black text-white">{decodeText(selectedAccount?.studentName || '-')}</p>
                  <p className="text-sm text-slate-400">{decodeText(selectedAccount?.contracts?.[0]?.className || '-')}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-foreground/[0.08] pt-5 text-sm">
                <div><p className="text-slate-400">Kayıt Tarihi</p><p className="mt-1 font-bold text-white">{formatDate(selectedAccount?.contracts?.[0]?.createdAtUtc)}</p></div>
                <div><p className="text-slate-400">Akademik Yıl</p><p className="mt-1 font-bold text-white">{decodeText(selectedAccount?.contracts?.[0]?.academicYear || '-')}</p></div>
              </div>
            </Panel>

            <Panel title="Ödeme hakkında yardım mı gerekiyor?">
              <p className="text-sm text-slate-400">Ödeme yöntemleri, taksitlendirme ve diğer sorularınız için bizimle iletişime geçebilirsiniz.</p>
              <SmallButton className="mt-4" onClick={() => navigate('/support')}>Yardım Merkezine Git</SmallButton>
            </Panel>

            <motion.div variants={itemMotion} className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.035] p-4">
              <div className="flex items-center gap-4">
                <IconTile icon={ShieldCheck} tone="blue" />
                <div className="flex-1">
                  <p className="font-black text-white">Güvenli Ödeme</p>
                  <p className="text-sm text-slate-400">Tüm ödeme işlemleriniz güvenli bağlantı üzerinden yürütülür.</p>
                </div>
                <LockKeyhole className="h-6 w-6 text-slate-400" />
              </div>
            </motion.div>
          </aside>
        </div>
      )}

      <Dialog open={!!payFor} onOpenChange={(open) => { if (!open) setPayFor(null); }}>
        <DialogContent className="border-foreground/[0.08] bg-[#07162A] text-white">
          <DialogHeader>
            <DialogTitle>Online Ödeme — {decodeText(payFor?.account?.studentName || '')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.04] p-4">
              <p className="text-sm text-slate-400">Kalan borç</p>
              <p className="mt-1 text-2xl font-black">{formatMoney(payFor?.installment?.remaining || payFor?.account?.balance, payFor?.account?.currency)}</p>
            </div>
            <Input type="number" min="0" inputMode="decimal" placeholder="Tutar" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-12 rounded-[10px] border-foreground/[0.08] bg-foreground/[0.04] text-white" />
            <p className="text-xs text-slate-400">Ödeme seçili taksite, taksit seçilmediyse en eski açık bakiyeye işlenir; makbuz otomatik oluşur.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)} className="border-foreground/[0.08] bg-foreground/[0.04] text-white">Vazgeç</Button>
            <Button onClick={submitPay} disabled={paying} className="bg-purple-600 text-white hover:bg-purple-500">
              {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Öde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
