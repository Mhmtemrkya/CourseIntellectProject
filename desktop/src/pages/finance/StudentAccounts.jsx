import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, MoreHorizontal, Eye, CreditCard,
  FileText, TrendingUp, TrendingDown,
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
import { createAccountingNotification, createCollection, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';
import {
  buildFinanceDocumentHtml,
  downloadFinanceHtml,
  formatCurrency,
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
const FALLBACK_CLASSES = ['9-A', '10-A', '10-B', '11-Sayisal', '12-Dil'];

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function buildAccount(student, dashboard) {
  const invoices = (dashboard?.invoices || []).filter((item) => String(item.title || '').toLowerCase().includes(String(student.fullName).toLowerCase()));
  const collections = (dashboard?.collections || []).filter((item) => String(item.name || '').toLowerCase() === String(student.fullName).toLowerCase());
  const installments = (dashboard?.installments || []).filter((item) => String(item.student || '').toLowerCase() === String(student.fullName).toLowerCase());
  const totalFee = invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0) || installments.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const paid = collections.reduce((sum, item) => sum + parseMoney(item.amount), 0);
  const balance = paid - totalFee;
  const overdue = installments.some((item) => String(item.status || '').toLowerCase().includes('gec'));
  const status = totalFee > 0 && paid >= totalFee ? 'paid' : overdue ? 'overdue' : 'current';
  return {
    id: student.id,
    name: student.fullName,
    className: student.className,
    parent: student.parentName,
    totalFee,
    paid,
    balance,
    status,
    collections,
    invoices,
    installments,
  };
}

function StudentAccountDrawer({
  account,
  onCreateCollection,
  onExportStatement,
  onPrintStatement,
  creatingCollection,
}) {
  if (!account) return null;

  const transactions = [
    ...account.invoices.map((item) => ({
      id: `invoice-${item.id}`,
      date: item.subtitle || item.status,
      type: 'fee',
      description: item.title,
      amount: -parseMoney(item.amount),
    })),
    ...account.collections.map((item) => ({
      id: `collection-${item.id}`,
      date: item.time,
      type: 'payment',
      description: item.note || item.method,
      amount: parseMoney(item.amount),
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğrenci Cari Hesabı</SheetTitle>
        <SheetDescription>Hesap hareketleri ve bakiye durumu</SheetDescription>
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

      <div className="grid grid-cols-3 gap-4">
        {[
          [account.totalFee, 'Toplam Ücret', 'text-foreground'],
          [account.paid, 'Ödenen', 'text-green-600'],
          [Math.abs(account.balance), account.balance < 0 ? 'Borç' : 'Bakiye', account.balance < 0 ? 'text-red-600' : 'text-green-600'],
        ].map(([value, label, color]) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>₺{Number(value).toLocaleString('tr-TR')}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Hesap Hareketleri</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tx.type === 'payment' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {tx.type === 'payment' ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
              </div>
              <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.amount > 0 ? '+' : ''}₺{Math.abs(tx.amount).toLocaleString('tr-TR')}
              </span>
            </div>
          ))}
        </div>
      </div>

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

  const buildStatementHtml = useCallback((account) => buildFinanceDocumentHtml({
    title: 'Öğrenci Cari Hesap Ekstresi',
    subtitle: `${account.name} için tahsilat, fatura ve bakiye özeti`,
    code: `EXT-${account.id}`,
    accent: '#0f4c81',
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
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  }), [accounts, search, classFilter, statusFilter]);

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
                <TableHead>Bakiye</TableHead>
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
                  <TableCell className={account.balance < 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                    {account.balance < 0 ? '-' : ''}₺{Math.abs(account.balance).toLocaleString('tr-TR')}
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
