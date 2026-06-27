import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileArchive,
  FolderOpen,
  Info,
  Mail,
  ReceiptText,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchParentChildrenFinance } from '../../lib/api/modules';
import {
  BarChart,
  DonutChart,
  EmptyPanel,
  IconTile,
  PageHeader,
  Panel,
  SmallButton,
  StatCard,
  decodeText,
  formatDate,
  formatMoney,
  normalizeText,
  pageMotion,
  safeNumber,
} from './parentPremiumUi';

function downloadText(name, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function paymentMethodIcon(method = '') {
  return normalizeText(method).includes('havale') ? Building2 : CreditCard;
}

function buildReceiptText(receipt) {
  return [
    'CourseIntellect Makbuz',
    `Makbuz No: ${receipt.receiptNo || receipt.id}`,
    `Öğrenci: ${receipt.studentName}`,
    `Sınıf: ${receipt.className || '-'}`,
    `Ödeme Türü: ${receipt.paymentType}`,
    `Tutar: ${formatMoney(receipt.amount, receipt.currency)}`,
    `Ödeme Yöntemi: ${receipt.method || '-'}`,
    `Tarih: ${formatDate(receipt.paidAtUtc)}`,
    `Not: ${receipt.note || '-'}`,
  ].join('\n');
}

export default function ParentReceipts() {
  const { user } = useApp();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [childFilter, setChildFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchParentChildrenFinance();
      setAccounts(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setError(err.message || 'Makbuz arşivi alınamadı.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const receipts = useMemo(() => {
    return accounts.flatMap((account) => {
      const contract = account.contracts?.[0] || {};
      return (account.payments || []).map((payment, index) => {
        const installment = (account.installments || []).find((item) => item.id === payment.financeInstallmentId);
        const paidAt = payment.paidAtUtc || payment.date || payment.createdAt;
        const calendarYear = paidAt ? String(new Date(paidAt).getFullYear()) : '';
        return {
          ...payment,
          key: payment.id || `${account.studentName}-${index}`,
          studentName: account.studentName,
          className: contract.className || installment?.className || '',
          academicYear: contract.academicYear || '',
          currency: payment.currency || account.currency || 'TRY',
          paidAtUtc: paidAt,
          year: calendarYear || contract.academicYear || '',
          // Dönem = akademik yıl (varsa), yoksa takvim yılı. Sayfanın genel filtresi.
          period: contract.academicYear || calendarYear || '',
          paymentType: installment?.label || (payment.amount < 0 ? 'İade' : 'Taksit Ödemesi'),
        };
      });
    }).sort((a, b) => new Date(b.paidAtUtc || 0) - new Date(a.paidAtUtc || 0));
  }, [accounts]);

  // Dönem (akademik yıl/takvim yılı) listesi — sayfanın genel kapsam filtresi.
  const periods = useMemo(() => Array.from(new Set(receipts.map((item) => item.period).filter(Boolean))).sort().reverse(), [receipts]);

  // Seçili döneme göre kapsanan makbuzlar; tüm özet/grafik/tablo bunun üzerinden hesaplanır.
  const scopedReceipts = useMemo(() => (
    periodFilter === 'all' ? receipts : receipts.filter((item) => item.period === periodFilter)
  ), [periodFilter, receipts]);

  const years = useMemo(() => Array.from(new Set(scopedReceipts.map((item) => item.year).filter(Boolean))).sort().reverse(), [scopedReceipts]);
  const children = useMemo(() => Array.from(new Set(accounts.map((account) => account.studentName).filter(Boolean))), [accounts]);
  const methods = useMemo(() => Array.from(new Set(scopedReceipts.map((item) => item.method || 'Diğer').filter(Boolean))), [scopedReceipts]);

  const filteredReceipts = useMemo(() => {
    const now = Date.now();
    const rangeDays = { '30': 30, '90': 90, '180': 180, '365': 365 }[rangeFilter];
    const rangeFromMs = rangeDays ? now - rangeDays * 24 * 60 * 60 * 1000 : null;
    return scopedReceipts.filter((item) => {
      const yearOk = yearFilter === 'all' || item.year === yearFilter || item.academicYear === yearFilter;
      const childOk = childFilter === 'all' || item.studentName === childFilter;
      const methodOk = methodFilter === 'all' || (item.method || 'Diğer') === methodFilter;
      const paidMs = item.paidAtUtc ? new Date(item.paidAtUtc).getTime() : null;
      const rangeOk = rangeFromMs == null || (paidMs != null && paidMs >= rangeFromMs);
      return yearOk && childOk && methodOk && rangeOk;
    });
  }, [childFilter, methodFilter, rangeFilter, scopedReceipts, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / 7));
  const pageItems = filteredReceipts.slice((page - 1) * 7, page * 7);

  const summary = useMemo(() => {
    const currency = accounts[0]?.currency || scopedReceipts[0]?.currency || 'TRY';
    const total = scopedReceipts.reduce((sum, item) => sum + Math.max(0, safeNumber(item.amount)), 0);
    const latest = scopedReceipts[0]?.paidAtUtc;
    const byYear = years.slice().reverse().map((year) => ({
      label: year,
      value: scopedReceipts.filter((item) => item.year === year).reduce((sum, item) => sum + Math.max(0, safeNumber(item.amount)), 0),
      display: formatMoney(scopedReceipts.filter((item) => item.year === year).reduce((sum, item) => sum + Math.max(0, safeNumber(item.amount)), 0), currency).replace(',00', ''),
    }));
    return { currency, total, latest, byYear };
  }, [accounts, scopedReceipts, years]);

  const exportFiltered = () => {
    const rows = [
      ['Makbuz No', 'Tarih', 'Çocuk', 'Sınıf', 'Ödeme Türü', 'Tutar', 'Para Birimi', 'Yöntem'],
      ...filteredReceipts.map((item) => [
        item.receiptNo || item.id,
        formatDate(item.paidAtUtc),
        decodeText(item.studentName),
        decodeText(item.className),
        decodeText(item.paymentType),
        safeNumber(item.amount),
        item.currency,
        decodeText(item.method || '-'),
      ]),
    ];
    downloadText('veli-makbuz-arsivi.csv', rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={pageMotion} initial="hidden" animate="visible" className="space-y-5 text-slate-100" data-testid="parent-receipts-page">
      <PageHeader
        userName={user?.name}
        title="Makbuz Arşivi"
        description="Tüm ödeme makbuzlarınızı görüntüleyebilir ve indirebilirsiniz."
        icon={<IconTile icon={FolderOpen} tone="purple" className="h-14 w-14" />}
      />

      {error ? <ErrorBanner title="Makbuz arşivi alınamadı" message={error} onRetry={loadReceipts} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr_1.1fr_0.85fr_1.45fr]">
        <StatCard icon={FileArchive} tone="purple" label="Toplam Makbuz" value={scopedReceipts.length} sub={periodFilter === 'all' ? 'Tüm dönemler' : `${periodFilter} dönemi`} />
        <StatCard icon={ReceiptText} tone="green" label="Toplam Ödenen Tutar" value={formatMoney(summary.total, summary.currency)} sub={periodFilter === 'all' ? 'Tüm dönemler' : `${periodFilter} dönemi`} />
        <div className="flex flex-col justify-center gap-2 rounded-[14px] border border-foreground/[0.08] bg-[linear-gradient(180deg,rgba(7,31,57,0.84),rgba(5,23,43,0.78))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <IconTile icon={CalendarDays} tone="blue" className="h-8 w-8" />
            Dönem
          </div>
          <select
            className="h-11 w-full rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm font-bold text-white outline-none"
            value={periodFilter}
            onChange={(event) => { setPeriodFilter(event.target.value); setYearFilter('all'); setPage(1); }}
          >
            <option value="all">Tüm Dönemler</option>
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </div>
        <StatCard icon={CalendarDays} tone="orange" label="Son Makbuz" value={formatDate(summary.latest, '-')} sub="En son ödeme" />
        <Panel title="Ödeme Özeti" className="row-span-2">
          <div className="grid gap-5 md:grid-cols-[170px_1fr] xl:grid-cols-1 2xl:grid-cols-[170px_1fr]">
            <DonutChart
              items={[
                { label: 'Taksit Ödemeleri', value: scopedReceipts.filter((item) => normalizeText(item.paymentType).includes('taksit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), color: '#8b5cf6' },
                { label: 'Kayıt Ücreti', value: scopedReceipts.filter((item) => normalizeText(item.paymentType).includes('kayit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), color: '#22c55e' },
                { label: 'Diğer', value: scopedReceipts.filter((item) => !normalizeText(item.paymentType).includes('taksit') && !normalizeText(item.paymentType).includes('kayit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), color: '#f97316' },
              ]}
              center={(
                <div className="text-center">
                  <p className="text-xs text-slate-400">Toplam</p>
                  <p className="text-lg font-black text-white">{formatMoney(summary.total, summary.currency)}</p>
                </div>
              )}
            />
            <div className="space-y-4 text-sm">
              {[
                ['Taksit Ödemeleri', scopedReceipts.filter((item) => normalizeText(item.paymentType).includes('taksit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), '#8b5cf6'],
                ['Kayıt Ücreti', scopedReceipts.filter((item) => normalizeText(item.paymentType).includes('kayit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), '#22c55e'],
                ['Diğer', scopedReceipts.filter((item) => !normalizeText(item.paymentType).includes('taksit') && !normalizeText(item.paymentType).includes('kayit')).reduce((sum, item) => sum + safeNumber(item.amount), 0), '#f97316'],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-300"><span className="h-3 w-3 rounded-full" style={{ background: color }} />{label}</span>
                  <b className="text-white">{formatMoney(value, summary.currency)}</b>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.85fr_0.7fr]">
        <div className="space-y-4">
          <Panel>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.9fr_1fr_1fr_1.4fr_auto_auto]">
              <label className="space-y-2 text-xs font-semibold text-slate-400">Yıl
                <select className="h-11 w-full rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm text-white outline-none" value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setPage(1); }}>
                  <option value="all">Tümü</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-slate-400">Çocuk
                <select className="h-11 w-full rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm text-white outline-none" value={childFilter} onChange={(event) => { setChildFilter(event.target.value); setPage(1); }}>
                  <option value="all">Tümü</option>
                  {children.map((child) => <option key={child} value={child}>{decodeText(child)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-slate-400">Ödeme Türü
                <select className="h-11 w-full rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm text-white outline-none" value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); }}>
                  <option value="all">Tümü</option>
                  {methods.map((method) => <option key={method} value={method}>{decodeText(method)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-slate-400">Tarih Aralığı
                <select className="h-11 w-full rounded-[10px] border border-foreground/[0.08] bg-[#06162B] px-4 text-sm text-white outline-none" value={rangeFilter} onChange={(event) => { setRangeFilter(event.target.value); setPage(1); }}>
                  <option value="all">Tüm Tarihler</option>
                  <option value="30">Son 30 Gün</option>
                  <option value="90">Son 3 Ay</option>
                  <option value="180">Son 6 Ay</option>
                  <option value="365">Son 1 Yıl</option>
                </select>
              </label>
              <SmallButton className="mt-6" onClick={() => { setYearFilter('all'); setChildFilter('all'); setMethodFilter('all'); setRangeFilter('all'); setPage(1); }}>
                <Search className="mr-2 h-4 w-4" />Filtreleri Temizle
              </SmallButton>
              <Button className="mt-6 h-11 rounded-[10px] bg-purple-600 px-7 font-black text-white hover:bg-purple-500" onClick={exportFiltered}>
                <Download className="mr-2 h-4 w-4" />Dışa Aktar
              </Button>
            </div>
          </Panel>

          <Panel>
            {pageItems.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="text-xs text-slate-400">
                      <tr className="border-b border-foreground/[0.08]">
                        <th className="py-3 font-semibold">Makbuz No</th>
                        <th className="py-3 font-semibold">Tarih</th>
                        <th className="py-3 font-semibold">Çocuk</th>
                        <th className="py-3 font-semibold">Ödeme Türü</th>
                        <th className="py-3 font-semibold">Tutar</th>
                        <th className="py-3 font-semibold">Ödeme Yöntemi</th>
                        <th className="py-3 text-right font-semibold">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item) => {
                        const MethodIcon = paymentMethodIcon(item.method);
                        return (
                          <tr key={item.key} className="border-b border-foreground/[0.06] text-slate-200">
                            <td className="py-4 font-semibold">{item.receiptNo || item.id}</td>
                            <td className="py-4">{formatDate(item.paidAtUtc)}</td>
                            <td className="py-4"><b className="text-white">{decodeText(item.studentName)}</b><p className="text-xs text-slate-400">{decodeText(item.className)}</p></td>
                            <td className="py-4">{decodeText(item.paymentType)}</td>
                            <td className="py-4 font-black text-white">{formatMoney(item.amount, item.currency)}</td>
                            <td className="py-4">
                              <span className="inline-flex items-center gap-2">
                                <IconTile icon={MethodIcon} tone={MethodIcon === Building2 ? 'blue' : 'purple'} className="h-8 w-8" />
                                {decodeText(item.method || '-')}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <div className="inline-flex gap-2">
                                <Button variant="ghost" size="icon" className="rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.04] text-slate-200" onClick={() => downloadText(`makbuz-${item.receiptNo || item.id}.txt`, buildReceiptText(item))}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-[10px] border border-foreground/[0.08] bg-foreground/[0.04] text-slate-200" onClick={() => setSelectedReceipt(item)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">{filteredReceipts.length ? `${(page - 1) * 7 + 1} - ${Math.min(page * 7, filteredReceipts.length)} / ${filteredReceipts.length} makbuz` : '0 makbuz'}</p>
                  <div className="flex items-center gap-2">
                    <SmallButton disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}><ChevronLeft className="h-4 w-4" /></SmallButton>
                    {Array.from({ length: totalPages }).slice(0, 4).map((_, index) => (
                      <button key={index + 1} type="button" onClick={() => setPage(index + 1)} className={`h-10 w-10 rounded-[10px] border border-foreground/[0.08] font-black ${page === index + 1 ? 'bg-purple-600 text-white' : 'bg-foreground/[0.035] text-slate-300'}`}>{index + 1}</button>
                    ))}
                    <SmallButton disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}><ChevronRight className="h-4 w-4" /></SmallButton>
                  </div>
                </div>
              </>
            ) : <EmptyPanel title="Makbuz bulunamadı" description="Seçili filtrelere uygun ödeme kaydı yok." />}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Yıllara Göre Ödemeler">
            {summary.byYear.length ? <BarChart items={summary.byYear} /> : <EmptyPanel title="Grafik için veri yok" />}
          </Panel>

          <Panel title="Hızlı İşlemler">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Makbuz Ara', Search, 'blue', () => toast({ title: 'Makbuz arama', description: 'Filtre alanları ile makbuz listesi canlı süzülür.' })],
                ['E-posta Gönder', Mail, 'purple', () => selectedReceipt ? toast({ title: 'E-posta hazır', description: `${selectedReceipt.receiptNo || 'Makbuz'} seçili.` }) : toast({ title: 'Önce bir makbuz seçin.' })],
                ['Toplu İndir', Download, 'green', exportFiltered],
              ].map(([label, Icon, tone, action]) => (
                <button key={label} type="button" onClick={action} className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.035] p-4 text-center transition hover:bg-foreground/[0.07]">
                  <IconTile icon={Icon} tone={tone} className="mx-auto" />
                  <span className="mt-3 block text-xs font-black text-white">{label}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Bilgilendirme">
            <div className="flex gap-4">
              <IconTile icon={Info} tone="blue" />
              <p className="text-sm leading-6 text-slate-400">Makbuzlarınızı yasal yükümlülükleriniz için saklamanız önerilir. Tüm makbuzlar canlı ödeme kayıtlarından üretilir.</p>
            </div>
          </Panel>
        </aside>
      </div>

      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="border-foreground/[0.08] bg-[#07162A] text-white">
          <DialogHeader>
            <DialogTitle>Makbuz Detayı</DialogTitle>
          </DialogHeader>
          {selectedReceipt ? (
            <div className="space-y-4">
              <div className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] p-5">
                <p className="text-sm text-slate-400">Makbuz No</p>
                <p className="mt-1 text-xl font-black">{selectedReceipt.receiptNo || selectedReceipt.id}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Öğrenci', decodeText(selectedReceipt.studentName)],
                  ['Tutar', formatMoney(selectedReceipt.amount, selectedReceipt.currency)],
                  ['Tarih', formatDate(selectedReceipt.paidAtUtc)],
                  ['Ödeme Yöntemi', decodeText(selectedReceipt.method || '-')],
                  ['Ödeme Türü', decodeText(selectedReceipt.paymentType)],
                  ['Not', decodeText(selectedReceipt.note || '-')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.035] p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-1 font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full rounded-[10px] bg-purple-600 font-black text-white hover:bg-purple-500" onClick={() => downloadText(`makbuz-${selectedReceipt.receiptNo || selectedReceipt.id}.txt`, buildReceiptText(selectedReceipt))}>
                <Download className="mr-2 h-4 w-4" />Makbuzu İndir
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
