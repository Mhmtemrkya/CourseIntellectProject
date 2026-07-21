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
import { useToast } from '../../hooks/use-toast';
import { SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { createAccountingNotification, createCollection, fetchAccountingDashboard, fetchStudentFinanceAccount, fetchStudents } from '../../lib/api/modules';
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

function buildAccount(student, dashboard) {
  const invoices = (dashboard?.invoices || []).filter((item) => String(item.title || '').toLowerCase().includes(String(student.fullName).toLowerCase()));
  const collections = (dashboard?.collections || []).filter((item) => String(item.name || '').toLowerCase() === String(student.fullName).toLowerCase());
  const installments = (dashboard?.installments || []).filter((item) => String(item.student || '').toLowerCase() === String(student.fullName).toLowerCase());
  const installmentTotal = installments.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const totalFee = installmentTotal || invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const paid = collections.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const remaining = Math.max(0, totalFee - paid);
  const overdue = installments.some((item) => normalizeFinanceText(item.status).includes('gec'));
  const status = totalFee > 0 && paid >= totalFee ? 'paid' : overdue ? 'overdue' : 'current';
  return {
    id: student.id,
    name: student.fullName,
    username: student.username,
    className: student.className,
    branchName: student.branchName || student.branch || '',
    parent: student.parentName,
    totalFee,
    paid,
    remaining,
    installmentCount: installments.length,
    status,
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
}) {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setDetailLoading(true);
    fetchStudentFinanceAccount(account?.username ? { studentName: account.name } : { studentName: account?.name })
      .then((data) => { if (active) setDetail(data); })
      .catch(() => { if (active) setDetail(null); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [account?.name, account?.username]);

  if (!account) return null;

  const now = Date.now();
  const installments = detail?.installments || [];
  const paidInstallments = installments
    .filter(isInstallmentPaid)
    .sort((a, b) => new Date(b.dueDateUtc) - new Date(a.dueDateUtc));
  const upcomingInstallments = installments
    .filter((item) => !isInstallmentPaid(item))
    .sort((a, b) => new Date(a.dueDateUtc) - new Date(b.dueDateUtc));
  const totalFee = Number(detail?.netTotal) || account.totalFee;
  const paid = Number(detail?.paidTotal) || account.paid;
  const remaining = Math.max(0, totalFee - paid);

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
          <p className="text-sm text-muted-foreground">{account.className} • Veli: {account.parent}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [totalFee, 'Toplam Ücret', 'text-foreground'],
          [paid, 'Ödenen', 'text-green-600'],
          [remaining, 'Kalan Ücret', remaining > 0 ? 'text-red-600' : 'text-green-600'],
          [installments.length, 'Taksit Sayısı', 'text-foreground', true],
        ].map(([value, label, color, isCount]) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{isCount ? value : `₺${Number(value).toLocaleString('tr-TR')}`}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
  const { openDrawer } = useApp();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, accounting] = await Promise.all([
        fetchStudents(),
        fetchAccountingDashboard(),
      ]);
      setStudents(studentList);
      setDashboard(accounting);
    } catch (err) {
      setError(err.message || 'Cari hesaplar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accounts = useMemo(() => students.map((student) => buildAccount(student, dashboard)), [students, dashboard]);
  const classes = useMemo(() => [...new Set([
    ...accounts.map((item) => item.className).filter(Boolean),
    ...FALLBACK_CLASSES,
  ])], [accounts]);
  const branches = useMemo(() => [...new Set(accounts.map((item) => item.branchName).filter(Boolean))], [accounts]);

  const buildStatementHtml = useCallback((account) => buildFinanceDocumentHtml({
    title: 'Öğrenci Cari Hesap Ekstresi',
    subtitle: `${account.name} için tahsilat, fatura ve bakiye özeti`,
    code: `EXT-${account.id}`,
    badge: `${account.className || 'Sınıf yok'} • ${account.parent || 'Veli bilgisi yok'}`,
    summary: [
      { label: 'Toplam Ücret', value: formatCurrency(account.totalFee) },
      { label: 'Ödenen', value: formatCurrency(account.paid) },
      { label: account.balance < 0 ? 'Kalan Borç' : 'Pozitif Bakiye', value: formatCurrency(Math.abs(account.balance)) },
      { label: 'Durum', value: account.status === 'overdue' ? 'Gecikmiş' : account.status === 'paid' ? 'Ödendi' : 'Güncel' },
    ],
    sections: [
      {
        title: 'Öğrenci Bilgileri',
        rows: [
          { label: 'Öğrenci', value: account.name },
          { label: 'Sınıf', value: account.className || 'Belirtilmedi' },
          { label: 'Veli', value: account.parent || 'Belirtilmedi' },
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
          { label: 'Önerilen Sonraki Aksiyon', value: account.totalFee - account.paid > 0 ? 'Tahsilat girişi yapılmalı' : 'Ek işlem gerekmiyor' },
          { label: 'Açık Tutar', value: formatCurrency(Math.max(0, account.totalFee - account.paid)) },
        ],
      },
    ],
  }), []);

  const applyCollectionToDashboard = useCallback((account, collection) => {
    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        collections: [collection, ...(prev.collections || [])],
      };
    });
  }, []);

  const handleCreateCollection = useCallback(async (account) => {
    const remaining = Math.max(0, account.totalFee - account.paid);
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
  }, [applyCollectionToDashboard, toast]);

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
    const debtors = filteredAccounts.filter((account) => account.totalFee - account.paid > 0);
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
        const remaining = Math.max(0, account.totalFee - account.paid);
        const created = await createCollection({
          name: account.name,
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
    return matchesSearch && matchesClass && matchesBranch && matchesStatus;
  }), [accounts, search, classFilter, branchFilter, statusFilter]);

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
          <h1 className="text-3xl font-bold font-heading">Öğrenci Cari Hesapları</h1>
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
                <TableHead>Toplam Ücret</TableHead>
                <TableHead>Ödenen</TableHead>
                <TableHead>Kalan Ücret</TableHead>
                <TableHead>Taksit Sayısı</TableHead>
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
                    />,
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
                        <p className="text-sm text-muted-foreground">Veli: {account.parent}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.className}</Badge>
                  </TableCell>
                  <TableCell>₺{account.totalFee.toLocaleString('tr-TR')}</TableCell>
                  <TableCell className="text-green-600">₺{account.paid.toLocaleString('tr-TR')}</TableCell>
                  <TableCell className={account.remaining > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                    ₺{account.remaining.toLocaleString('tr-TR')}
                  </TableCell>
                  <TableCell className="text-center">{account.installmentCount}</TableCell>
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
                          />,
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
    </motion.div>
  );
}
