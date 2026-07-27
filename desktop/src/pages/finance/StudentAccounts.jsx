import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, MoreHorizontal, Eye, CreditCard, FileText,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useApp } from '../../context/AppContext';
import { resolveUserInstitutionType } from '../../lib/auth';
import DrivingCollectModal from '../../components/finance/DrivingCollectModal';
import { useToast } from '../../hooks/use-toast';
import { SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  createAccountingNotification,
  createCollection,
  fetchAccountingDashboard,
  fetchDrivingBranches,
  fetchDrivingCollectionList,
  fetchFinanceSummaries,
  fetchStudentFinanceAccount,
  fetchStudents,
  updateDrivingExamFees,
} from '../../lib/api/modules';
import PendingDownPayments from '../../components/finance/PendingDownPayments';
import {
  buildFinanceDocumentHtml,
  downloadFinanceHtml,
  formatCurrency,
  normalizeFinanceText,
  parseFinanceMoney,
  printFinanceHtml,
} from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};
const FALLBACK_CLASSES = [];

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function buildAccount(student, dashboard, summary) {
  const invoices = (dashboard?.invoices || []).filter((item) => String(item.title || '').toLowerCase().includes(String(student.fullName).toLowerCase()));
  const collections = (dashboard?.collections || []).filter((item) => String(item.name || '').toLowerCase() === String(student.fullName).toLowerCase());
  const installments = (dashboard?.installments || []).filter((item) => String(item.student || '').toLowerCase() === String(student.fullName).toLowerCase());
  const installmentTotal = installments.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const totalFee = Number(summary?.netTotal) || installmentTotal || invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const paid = summary ? Number(summary.paidTotal) || 0 : collections.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const remaining = summary ? Number(summary.totalPayable) || 0 : Math.max(0, totalFee - paid);
  const overdue = installments.some((item) => normalizeFinanceText(item.status).includes('gec'));
  const status = totalFee > 0 && paid >= totalFee ? 'paid' : overdue ? 'overdue' : 'current';
  return {
    id: student.id,
    userId: student.userId,
    name: student.fullName,
    username: student.username,
    className: student.className,
    branchName: student.branchName || student.branch || '',
    parent: student.parentName,
    totalFee,
    grossTotal: Number(summary?.grossTotal) || totalFee,
    discountTotal: Number(summary?.discountTotal) || 0,
    downPaymentTotal: Number(summary?.downPaymentTotal) || 0,
    downPaymentPaidTotal: Number(summary?.downPaymentPaidTotal) || 0,
    hasPendingDownPayment: Boolean(summary?.hasPendingDownPayment),
    paid,
    remaining,
    installmentCount: installments.length,
    status: summary?.status ? normalizeFinanceText(summary.status).includes('over') ? 'overdue' : normalizeFinanceText(summary.status).includes('paid') ? 'paid' : 'current' : status,
    drivingStudentProfileId: summary?.drivingStudentProfileId,
    drivingExamFee: Number(summary?.drivingExamFee) || 0,
    drivingExamFeePaid: Boolean(summary?.drivingExamFeePaid),
    drivingExamAttemptNo: Number(summary?.drivingExamAttemptNo) || 1,
    drivingExamDate: summary?.drivingExamDate,
    collections,
    invoices,
    installments,
  };
}

function formatDateUtc(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function isInstallmentPaid(item) {
  const status = normalizeFinanceText(item.status);
  return status.includes('oden') || status.includes('paid') || status.includes('tamam') || (Number(item.remaining) <= 0 && Number(item.paidAmount) > 0);
}

function StudentAccountDrawer({
  account,
  onCreateCollection,
  onExportStatement,
  onPrintStatement,
  creatingCollection,
  onUpdated,
}) {
  // Sürücü kursunda "veli" kavramı yoktur; kursiyerin muhatabı kendisidir.
  const { user } = useApp();
  const isDrivingSchool = resolveUserInstitutionType(user) === 'DrivingSchool';
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [examFeeDraft, setExamFeeDraft] = useState(null);
  const [savingExamFee, setSavingExamFee] = useState(false);

  useEffect(() => {
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    fetchStudentFinanceAccount(account?.userId
      ? { studentUserId: account.userId }
      : { studentName: account?.name })
      .then((data) => { if (active) setDetail(data); })
      .catch((error) => {
        if (active) {
          setDetail(null);
          setDetailError(error.message || 'Cari hesap ayrıntıları alınamadı.');
        }
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [account?.name, account?.userId]);

  if (!account) return null;

  const now = Date.now();
  const installments = detail?.installments || [];
  const paidInstallments = installments
    .filter(isInstallmentPaid)
    .sort((a, b) => new Date(b.dueDateUtc) - new Date(a.dueDateUtc));
  const upcomingInstallments = installments
    .filter((item) => !isInstallmentPaid(item))
    .sort((a, b) => new Date(a.dueDateUtc) - new Date(b.dueDateUtc));
  const totalFee = detail ? Number(detail.netTotal) || 0 : account.totalFee;
  const paid = detail ? Number(detail.paidTotal) || 0 : account.paid;
  const remaining = detail ? Number(detail.totalPayable) || 0 : account.remaining;
  const courseRemaining = detail ? Number(detail.courseRemaining) || 0 : 0;
  const additionalChargeRemaining = detail ? Number(detail.additionalChargeRemaining) || 0 : 0;
  const standaloneExamFeeRemaining = detail ? Number(detail.standaloneExamFeeRemaining) || 0 : 0;
  const grossTotal = Number(detail?.grossTotal) || account.grossTotal;
  const discountTotal = Number(detail?.discountTotal) || account.discountTotal;
  const downPaymentTotal = Number(detail?.downPaymentTotal) || account.downPaymentTotal;
  const downPaymentPaidTotal = Number(detail?.downPaymentPaidTotal) || account.downPaymentPaidTotal;
  const drivingExamFee = Number(detail?.drivingExamFee) || 0;
  const drivingExamFeePaid = Boolean(detail?.drivingExamFeePaid);
  const drivingExamAttemptNo = Number(detail?.drivingExamAttemptNo) || 1;

  const saveExamFee = async () => {
    if (!detail?.drivingStudentProfileId || !examFeeDraft) return;
    const amount = Number(examFeeDraft.amount) || 0;
    if (amount < 0) return;
    try {
      setSavingExamFee(true);
      await updateDrivingExamFees(detail.drivingStudentProfileId, {
        theoryExamFee: 0,
        theoryExamFeePaid: false,
        drivingExamFee: amount,
        drivingExamFeePaid: amount > 0 && examFeeDraft.paid,
        drivingExamDate: examFeeDraft.date ? new Date(`${examFeeDraft.date}T12:00:00`).toISOString() : null,
      });
      const refreshed = await fetchStudentFinanceAccount(account?.userId
        ? { studentUserId: account.userId }
        : { studentName: account?.name });
      setDetail(refreshed);
      setExamFeeDraft(null);
      onUpdated?.();
    } finally {
      setSavingExamFee(false);
    }
  };

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğrenci Cari Hesabı</SheetTitle>
        <SheetDescription>Taksit planı, ödenen ve gelecek taksitler</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {account.name.split(' ').map((n) => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{account.name}</h3>
          <p className="text-sm text-muted-foreground">
            {isDrivingSchool ? account.className : `${account.className} • Veli: ${account.parent}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [grossTotal, 'Kurs Ücreti', 'text-foreground'],
          [discountTotal, 'İndirim', 'text-blue-600'],
          [Math.max(0, grossTotal - discountTotal), 'Net Kurs Ücreti', 'text-foreground'],
          [downPaymentPaidTotal, downPaymentTotal > 0 && downPaymentPaidTotal < downPaymentTotal ? `Peşinat • ₺${downPaymentTotal.toLocaleString('tr-TR')} bekleniyor` : 'Ödenen Peşinat', downPaymentTotal > 0 && downPaymentPaidTotal < downPaymentTotal ? 'text-amber-600' : 'text-green-600'],
          [paid, 'Toplam Tahsil Edilen', 'text-green-600'],
          [courseRemaining, 'Kurs Borcu', courseRemaining > 0 ? 'text-red-600' : 'text-green-600'],
          [additionalChargeRemaining, 'Ek Ücret Borcu', additionalChargeRemaining > 0 ? 'text-red-600' : 'text-green-600'],
          [remaining, 'Toplam Ödenecek', remaining > 0 ? 'text-red-600' : 'text-green-600'],
        ].map(([value, label, color, isCount]) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{isCount ? value : `₺${Number(value).toLocaleString('tr-TR')}`}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {detailError ? <ErrorBanner title="Cari hesap ayrıntıları alınamadı" message={detailError} /> : null}

      <Card className="border-brand-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Direksiyon sınav ücreti</p>
              <p className="text-sm text-muted-foreground">{drivingExamAttemptNo}. sınav girişi • Kurs ücretinden ayrı takip edilir</p>
            </div>
            {detail?.drivingStudentProfileId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExamFeeDraft({
                  amount: drivingExamFee,
                  paid: drivingExamFeePaid,
                  date: detail?.drivingExamDate?.slice?.(0, 10) || '',
                })}
              >
                Düzenle
              </Button>
            ) : null}
          </div>
          {examFeeDraft ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input type="number" min="0" value={examFeeDraft.amount} onChange={(event) => setExamFeeDraft({ ...examFeeDraft, amount: event.target.value })} placeholder="Ücret (₺)" />
              <Input type="date" value={examFeeDraft.date} onChange={(event) => setExamFeeDraft({ ...examFeeDraft, date: event.target.value })} />
              <div className="flex gap-2">
                <Button type="button" variant={examFeeDraft.paid ? 'default' : 'outline'} onClick={() => setExamFeeDraft({ ...examFeeDraft, paid: !examFeeDraft.paid })}>
                  {examFeeDraft.paid ? 'Ödendi' : 'Ödenmedi'}
                </Button>
                <Button type="button" onClick={saveExamFee} disabled={savingExamFee}>{savingExamFee ? 'Kaydediliyor…' : 'Kaydet'}</Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <b className="text-xl">₺{drivingExamFee.toLocaleString('tr-TR')}</b>
              <Badge className={drivingExamFee > 0 && drivingExamFeePaid ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>
                {drivingExamFee > 0 && drivingExamFeePaid ? 'Ödendi' : 'Ödenmedi'}
              </Badge>
              <span className="text-sm text-muted-foreground">{formatDateUtc(detail?.drivingExamDate)}</span>
              {standaloneExamFeeRemaining > 0 ? (
                <span className="text-sm font-semibold text-red-600">
                  Toplam borca ₺{standaloneExamFeeRemaining.toLocaleString('tr-TR')} dâhil
                </span>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {detailLoading ? (
        <div className="flex justify-center py-6"><LoadingDots /></div>
      ) : (
        <>
          <div className="space-y-3">
            <h4 className="font-medium text-green-700 dark:text-green-400">Ödenen Taksitler ({paidInstallments.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {paidInstallments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz ödenmiş taksit yok.</p>
              ) : paidInstallments.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border bg-green-50/50 dark:bg-green-900/10 p-3">
                  <div>
                    <p className="text-sm font-medium">{item.label || 'Taksit'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateUtc(item.dueDateUtc)}</p>
                  </div>
                  <span className="font-bold text-green-600">₺{Number(item.amount).toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-amber-700 dark:text-amber-400">Ödenmeyen / Gelecek Taksitler ({upcomingInstallments.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {upcomingInstallments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Bekleyen taksit yok.</p>
              ) : upcomingInstallments.map((item) => {
                const overdue = new Date(item.dueDateUtc).getTime() < now;
                return (
                  <div key={item.id} className={`flex items-center justify-between rounded-lg border p-3 ${overdue ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10' : 'bg-muted/40'}`}>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {item.label || 'Taksit'}
                        {overdue ? <Badge className="bg-red-100 text-red-700 text-[10px]">Gecikti</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateUtc(item.dueDateUtc)}</p>
                    </div>
                    <span className={`font-bold ${overdue ? 'text-red-600' : 'text-foreground'}`}>₺{Number(item.remaining ?? item.amount).toLocaleString('tr-TR')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 pt-4">
        <Button className="flex-1 bg-brand-primary hover:bg-brand-primary/90" onClick={() => onCreateCollection?.(account)} disabled={creatingCollection}>
          <CreditCard className="h-4 w-4 mr-2" />
          {creatingCollection ? 'İşleniyor...' : 'Tahsilat Gir'}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onExportStatement?.(account)}>
          <FileText className="h-4 w-4 mr-2" />
          Ekstre İndir
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onPrintStatement?.(account)}>
          <Eye className="h-4 w-4 mr-2" />
          Yazdır
        </Button>
      </div>
    </div>
  );
}

export default function StudentAccounts() {
  const { openDrawer, user } = useApp();
  // Sürücü kursunda "veli" kavramı yoktur; kursiyerin muhatabı kendisidir.
  const isDrivingSchool = resolveUserInstitutionType(user) === 'DrivingSchool';
  // Sürücü kursunda tahsilat, "Ödeme Al" ile AYNI pencereden alınır: taksit planı
  // görünür, taksit seçilir, ödenmiş taksitler pasiftir, makbuz + tarih-saat düşer.
  const [drivingRows, setDrivingRows] = useState([]);
  const [drivingBranches, setDrivingBranches] = useState([]);
  const [collectTarget, setCollectTarget] = useState(null);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [examFeeFilter, setExamFeeFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, accounting, financeSummaries] = await Promise.all([
        fetchStudents(),
        fetchAccountingDashboard(),
        fetchFinanceSummaries(),
      ]);
      setStudents(studentList);
      setDashboard(accounting);
      setSummaries(financeSummaries);
    } catch (err) {
      setError(err.message || 'Cari hesaplar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accounts = useMemo(() => students.map((student) => {
    const summary = summaries.find((item) =>
      item.studentUserId && item.studentUserId === student.userId)
      || summaries.find((item) =>
        !item.studentUserId
        && normalizeFinanceText(item.studentName) === normalizeFinanceText(student.fullName));
    return buildAccount(student, dashboard, summary);
  }), [students, dashboard, summaries]);
  const classes = useMemo(() => [...new Set([
    ...accounts.map((item) => item.className).filter(Boolean),
    ...FALLBACK_CLASSES,
  ])], [accounts]);
  const branches = useMemo(() => [...new Set(accounts.map((item) => item.branchName).filter(Boolean))], [accounts]);

  const buildStatementHtml = useCallback((account) => buildFinanceDocumentHtml({
    title: 'Öğrenci Cari Hesap Ekstresi',
    subtitle: `${account.name} için tahsilat, fatura ve bakiye özeti`,
    code: `EXT-${account.id}`,
    badge: isDrivingSchool
      ? (account.className || 'Sınıf yok')
      : `${account.className || 'Sınıf yok'} • ${account.parent || 'Veli bilgisi yok'}`,
    summary: [
      { label: 'Toplam Ücret', value: formatCurrency(account.totalFee) },
      { label: 'Ödenen', value: formatCurrency(account.paid) },
      { label: 'Toplam Ödenecek', value: formatCurrency(account.remaining) },
      { label: 'Durum', value: account.status === 'overdue' ? 'Gecikmiş' : account.status === 'paid' ? 'Ödendi' : 'Güncel' },
    ],
    sections: [
      {
        title: isDrivingSchool ? 'Kursiyer Bilgileri' : 'Öğrenci Bilgileri',
        rows: [
          { label: isDrivingSchool ? 'Kursiyer' : 'Öğrenci', value: account.name },
          { label: isDrivingSchool ? 'Ehliyet sınıfı' : 'Sınıf', value: account.className || 'Belirtilmedi' },
          ...(isDrivingSchool ? [] : [{ label: 'Veli', value: account.parent || 'Belirtilmedi' }]),
          { label: 'Hesap Durumu', value: account.status === 'overdue' ? 'Gecikmiş bakiye takibi' : account.status === 'paid' ? 'Hesap kapanmış' : 'Aktif hesap' },
        ],
      },
      {
        title: 'Hesap Hareketleri',
        description: 'Fatura ve tahsilat kayıtları aynı ekstre üstünde listelenir.',
        table: {
          headers: ['Tarih', 'Tür', 'Açıklama', 'Tutar'],
          rows: [
            ...account.invoices.map((item) => [
              item.subtitle || item.status || '-',
              'Borç',
              item.title,
              `-${formatCurrency(item.amount)}`,
            ]),
            ...account.collections.map((item) => [
              item.time || '-',
              'Tahsilat',
              item.note || item.method || 'Tahsilat',
              `+${formatCurrency(item.amount)}`,
            ]),
          ],
        },
      },
      {
        title: 'Tahsilat Tavsiyesi',
        rows: [
          { label: 'Önerilen Sonraki Aksiyon', value: account.remaining > 0 ? 'Tahsilat girişi yapılmalı' : 'Ek işlem gerekmiyor' },
          { label: 'Açık Tutar', value: formatCurrency(account.remaining) },
        ],
      },
    ],
  }), [isDrivingSchool]);

  const applyCollectionToDashboard = useCallback((account, collection) => {
    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        collections: [collection, ...(prev.collections || [])],
      };
    });
  }, []);

  // Sürücü kursunda kursiyer listesi bir kez çekilir; cari hesap satırını
  // kursiyer profiline (profileId) bağlamak için gerekir.
  useEffect(() => {
    if (!isDrivingSchool) return;
    let active = true;
    Promise.all([
      fetchDrivingCollectionList().catch(() => []),
      fetchDrivingBranches().catch(() => []),
    ]).then(([rows, branchList]) => {
      if (!active) return;
      setDrivingRows(rows || []);
      setDrivingBranches(branchList || []);
    });
    return () => { active = false; };
  }, [isDrivingSchool]);

  const normalizeName = (value) => (value || '').trim().toLocaleLowerCase('tr-TR');

  /// Cari hesap satırını sürücü kursiyerine bağlar: önce kullanıcı kimliği, yoksa ad.
  const resolveDrivingRow = useCallback((account) => drivingRows.find((row) =>
    (account.userId && row.studentUserId && row.studentUserId === account.userId)
    || normalizeName(row.fullName) === normalizeName(account.name)), [drivingRows]);

  const handleCreateCollection = useCallback(async (account) => {
    // Sürücü kursu: taksit seçimli ortak tahsilat penceresi açılır.
    if (isDrivingSchool) {
      const row = resolveDrivingRow(account);
      if (!row) {
        toast({
          title: 'Kursiyer bulunamadı',
          description: `${account.name} sürücü kursu kayıtlarıyla eşleşmedi. Listeyi yenileyip tekrar deneyin.`,
          variant: 'destructive',
        });
        return;
      }
      setCollectTarget(row);
      return;
    }

    const remaining = Math.max(0, account.remaining);
    if (remaining <= 0) {
      toast({
        title: 'Tahsilat gerekmiyor',
        description: `${account.name} için açık bakiye bulunmuyor.`,
      });
      return;
    }

    try {
      setActiveCollectionId(account.id);
      const payload = await createCollection({
        name: account.name,
        studentUserId: account.userId,
        className: account.className,
        amount: `₺${remaining.toLocaleString('tr-TR')}`,
        method: 'Kart',
        note: `${account.className} cari hesap tahsilatı`,
      });
      applyCollectionToDashboard(account, payload);
      toast({
        title: 'Tahsilat işlendi',
        description: `${account.name} için ₺${remaining.toLocaleString('tr-TR')} tahsil edildi.`,
      });
    } catch (err) {
      toast({
        title: 'Tahsilat girilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setActiveCollectionId(null);
    }
  }, [applyCollectionToDashboard, toast, isDrivingSchool, resolveDrivingRow]);

  const handleExportStatement = useCallback((account) => {
    const html = buildStatementHtml(account);
    downloadFinanceHtml(`ekstre-${account.name.replace(/\s+/g, '-').toLowerCase()}.html`, html);
    toast({
      title: 'Ekstre indirildi',
      description: `${account.name} için tasarımlı ekstre hazırlandı.`,
    });
  }, [buildStatementHtml, toast]);

  const handlePrintStatement = useCallback((account) => {
    printFinanceHtml(`ekstre-${account.id}`, buildStatementHtml(account));
    toast({
      title: 'Ekstre yazdırma görünümü açıldı',
      description: `${account.name} için yazdırılabilir belge hazırlandı.`,
    });
  }, [buildStatementHtml, toast]);

  const handleBulkCollection = async () => {
    const debtors = filteredAccounts.filter((account) => account.remaining > 0);
    if (debtors.length === 0) {
      toast({
        title: 'Toplu tahsilat gerekmiyor',
        description: 'Listede açık bakiyesi olan öğrenci bulunmuyor.',
      });
      return;
    }

    try {
      setBulkProcessing(true);
      for (const account of debtors) {
        const remaining = Math.max(0, account.remaining);
        const created = await createCollection({
          name: account.name,
          studentUserId: account.userId,
          className: account.className,
          amount: `₺${remaining.toLocaleString('tr-TR')}`,
          method: 'Toplu Tahsilat',
          note: `${account.className} toplu tahsilat`,
        });
        applyCollectionToDashboard(account, created);
        await createAccountingNotification({
          title: 'Toplu tahsilat işlendi',
          message: `${account.name} icin ₺${remaining.toLocaleString('tr-TR')} tutarli tahsilat kaydedildi.`,
          severity: 'Info',
        }).catch(() => null);
      }
      toast({
        title: 'Toplu tahsilat tamamlandı',
        description: `${debtors.length} hesap için tahsilat oluşturuldu.`,
      });
    } catch (err) {
      toast({
        title: 'Toplu tahsilat tamamlanamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const matchesSearch = `${account.name} ${account.parent}`.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || account.className === classFilter;
    const matchesBranch = branchFilter === 'all' || account.branchName === branchFilter;
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    const matchesExamFee = examFeeFilter === 'all'
      || (examFeeFilter === 'paid' && account.drivingExamFee > 0 && account.drivingExamFeePaid)
      || (examFeeFilter === 'unpaid' && (!account.drivingExamFeePaid || account.drivingExamFee <= 0));
    return matchesSearch && matchesClass && matchesBranch && matchesStatus && matchesExamFee;
  }), [accounts, search, classFilter, branchFilter, statusFilter, examFeeFilter]);

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      current: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = { paid: 'Ödendi', current: 'Güncel', overdue: 'Gecikmiş' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Cari hesaplar yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-accounts-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Cari Hesaplar</h1>
          <p className="text-muted-foreground mt-1">{accounts.length} öğrenci hesabı</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleBulkCollection} disabled={bulkProcessing}>
          <Plus className="h-4 w-4 mr-2" />
          {bulkProcessing ? 'İşleniyor...' : 'Toplu Tahsilat'}
        </Button>
      </div>

      {error ? <ErrorBanner title="Cari hesaplar alınamadı" message={error} onRetry={loadData} /> : null}

      <PendingDownPayments onCollected={loadData} />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öğrenci veya veli ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Sınıf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {branches.length > 0 ? (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-full md:w-32">
                  <SelectValue placeholder="Şube" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="current">Güncel</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
              </SelectContent>
            </Select>
            <Select value={examFeeFilter} onValueChange={setExamFeeFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Sınav ücreti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm sınav ücretleri</SelectItem>
                <SelectItem value="paid">Sınav ücreti ödendi</SelectItem>
                <SelectItem value="unpaid">Sınav ücreti ödenmedi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead>Kurs Ücreti</TableHead>
                <TableHead>İndirim</TableHead>
                <TableHead>Peşinat</TableHead>
                <TableHead>Kalan</TableHead>
                <TableHead>Direksiyon Sınavı</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <motion.tr
                  key={account.id}
                  variants={itemVariants}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => openDrawer(
                    <StudentAccountDrawer
                      account={account}
                      onCreateCollection={handleCreateCollection}
                      onExportStatement={handleExportStatement}
                      onPrintStatement={handlePrintStatement}
                      creatingCollection={activeCollectionId === account.id}
                      onUpdated={loadData}
                    />,
                    { size: 'wide' },
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {account.name.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{account.name}</p>
                        {!isDrivingSchool && (
                          <p className="text-sm text-muted-foreground">Veli: {account.parent}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.className}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">₺{account.grossTotal.toLocaleString('tr-TR')}</TableCell>
                  <TableCell className="text-blue-600">₺{account.discountTotal.toLocaleString('tr-TR')}</TableCell>
                  <TableCell>
                    {account.downPaymentTotal <= 0 ? (
                      <span className="text-sm text-muted-foreground">Peşinat yok</span>
                    ) : account.hasPendingDownPayment ? (
                      <div><b className="text-amber-600">Ödenmedi</b><p className="text-xs text-muted-foreground">₺{account.downPaymentTotal.toLocaleString('tr-TR')}</p></div>
                    ) : (
                      <div><b className="text-green-600">₺{account.downPaymentPaidTotal.toLocaleString('tr-TR')}</b><p className="text-xs text-muted-foreground">Ödendi</p></div>
                    )}
                  </TableCell>
                  <TableCell className={account.remaining > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                    ₺{account.remaining.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="text-sm font-medium">{account.drivingExamAttemptNo}. giriş • ₺{account.drivingExamFee.toLocaleString('tr-TR')}</span>
                      <Badge className={account.drivingExamFee > 0 && account.drivingExamFeePaid ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}>
                        {account.drivingExamFee > 0 && account.drivingExamFeePaid ? 'Ödendi' : 'Ödenmedi'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(account.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDrawer(
                          <StudentAccountDrawer
                            account={account}
                            onCreateCollection={handleCreateCollection}
                            onExportStatement={handleExportStatement}
                            onPrintStatement={handlePrintStatement}
                            creatingCollection={activeCollectionId === account.id}
                            onUpdated={loadData}
                          />,
                          { size: 'wide' },
                        )}
                        >
                          <Eye className="h-4 w-4 mr-2" /> Detay
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCreateCollection(account)}>
                          <CreditCard className="h-4 w-4 mr-2" /> Tahsilat Gir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportStatement(account)}>
                          <FileText className="h-4 w-4 mr-2" /> Ekstre
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintStatement(account)}>
                          <Eye className="h-4 w-4 mr-2" /> Yazdır
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sürücü kursu tahsilatı: "Ödeme Al" ile aynı pencere — taksit planı,
          taksit seçimi, ödenmiş taksitlerin pasifliği ve makbuz burada. */}
      {collectTarget && (
        <DrivingCollectModal
          row={collectTarget}
          branches={drivingBranches}
          onClose={() => setCollectTarget(null)}
          onDone={() => {
            setCollectTarget(null);
            loadData();
            toast({ title: 'Tahsilat kaydedildi', description: 'Cari hesap güncellendi.' });
          }}
        />
      )}
    </motion.div>
  );
}
