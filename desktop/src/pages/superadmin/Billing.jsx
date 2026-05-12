import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, CreditCard, Calendar,
  CheckCircle, Clock, AlertCircle, TrendingUp, Building2, FileText, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchAccountingDashboard,
  fetchPlatformOverview,
  fetchPlatformSubscriptionInvoices,
  markPlatformInvoicePaid,
  cancelPlatformInvoice,
} from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Ödendi</Badge>;
  if (normalized === 'pending') return <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1"><Clock className="h-3 w-3" />Bekliyor</Badge>;
  if (normalized === 'cancelled') return <Badge className="bg-gray-100 text-gray-700 flex items-center gap-1"><XCircle className="h-3 w-3" />İptal</Badge>;
  return <Badge className="bg-red-100 text-red-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Gecikmiş</Badge>;
}

export default function Billing() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [platformInvoices, setPlatformInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);

  const loadBilling = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [overview, financeDashboard, subscriptionInvoices] = await Promise.all([
        fetchPlatformOverview(),
        fetchAccountingDashboard(),
        fetchPlatformSubscriptionInvoices().catch(() => []),
      ]);
      setPlatform(overview);
      setDashboard(financeDashboard);
      setPlatformInvoices(Array.isArray(subscriptionInvoices) ? subscriptionInvoices : []);
    } catch (err) {
      setError(err.message || 'Faturalama verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const filteredStudentInvoices = useMemo(() => {
    const invoices = dashboard?.invoices || [];
    return invoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      const matchesSearch = `${invoice.id} ${invoice.studentName || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dashboard, search, statusFilter]);

  const filteredPlatformInvoices = useMemo(() => {
    return platformInvoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      const haystack = `${invoice.invoiceNumber || ''} ${invoice.tenantName || ''} ${invoice.planName || ''}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [platformInvoices, search, statusFilter]);

  // Platform subscription stats
  const platformStats = useMemo(() => {
    const paidTotal = platformInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const pendingTotal = platformInvoices
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const overdueTotal = platformInvoices
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    return {
      totalRevenue: paidTotal,
      pending: pendingTotal,
      overdue: overdueTotal,
      count: platformInvoices.length,
    };
  }, [platformInvoices]);

  const stats = platform?.stats || {};

  const handleMarkPaid = async (invoiceId) => {
    try {
      setActingId(invoiceId);
      const updated = await markPlatformInvoicePaid(invoiceId);
      setPlatformInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated : i)));
      toast({ title: 'Fatura ödendi olarak işaretlendi', description: `${updated.invoiceNumber} güncellendi.` });
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (invoiceId) => {
    if (!window.confirm('Faturayı iptal etmek istediğinize emin misiniz?')) return;
    try {
      setActingId(invoiceId);
      const updated = await cancelPlatformInvoice(invoiceId);
      setPlatformInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated : i)));
      toast({ title: 'Fatura iptal edildi' });
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-billing-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Faturalama</h1>
        <p className="text-muted-foreground mt-1">Kurum abonelikleri ve öğrenci faturaları</p>
      </div>

      {error ? <ErrorBanner title="Faturalama alınamadı" message={error} onRetry={loadBilling} /> : null}

      <Tabs defaultValue="subscriptions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="subscriptions" className="gap-2">
            <Building2 className="h-4 w-4" />
            Kurum Abonelikleri
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <FileText className="h-4 w-4" />
            Öğrenci Faturaları
          </TabsTrigger>
        </TabsList>

        {/* === KURUM ABONELİK FATURALARI === */}
        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Tahsilat</p>
                    <p className="text-3xl font-bold mt-2">₺{platformStats.totalRevenue.toLocaleString('tr-TR')}</p>
                    <div className="flex items-center gap-1 mt-2 text-green-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Ödenmiş abonelikler</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-brand-accent">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bekleyen</p>
                    <p className="text-3xl font-bold mt-2">₺{platformStats.pending.toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-brand-accent/10">
                    <Calendar className="h-6 w-6 text-brand-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Geciken</p>
                    <p className="text-3xl font-bold mt-2">₺{platformStats.overdue.toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Fatura</p>
                    <p className="text-3xl font-bold mt-2">{platformStats.count}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Fatura no, kurum veya paket ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Durum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="pending">Bekliyor</SelectItem>
                    <SelectItem value="overdue">Gecikmiş</SelectItem>
                    <SelectItem value="cancelled">İptal</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => downloadText('platform-subscription-invoices.json', JSON.stringify(filteredPlatformInvoices, null, 2))}>
                  <Download className="h-4 w-4 mr-2" />
                  Dışa Aktar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kurum Abonelik Faturaları</CardTitle>
              <CardDescription>Kurumların CourseIntellect paket aboneliği için kestiğimiz faturalar</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Kurum</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Periyot</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Kesim</TableHead>
                    <TableHead>Vade</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-32">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlatformInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                        Henüz abonelik faturası yok. Kurumlar marketing sitesinden satın alma yaptığında burada görünür.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlatformInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="font-medium">
                          <div>{invoice.tenantName}</div>
                          <div className="text-xs text-muted-foreground">{invoice.tenantContactEmail}</div>
                        </TableCell>
                        <TableCell>{invoice.planName}</TableCell>
                        <TableCell>{invoice.billingPeriod}</TableCell>
                        <TableCell className="font-mono">₺{Number(invoice.amount || 0).toLocaleString('tr-TR')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invoice.issuedAtUtc).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invoice.dueAtUtc).toLocaleDateString('tr-TR')}
                        </TableCell>
                        <TableCell><StatusBadge status={invoice.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actingId === invoice.id}
                                onClick={() => handleMarkPaid(invoice.id)}
                                title="Ödendi olarak işaretle"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            {invoice.status !== 'cancelled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actingId === invoice.id}
                                onClick={() => handleCancel(invoice.id)}
                                title="İptal"
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ÖĞRENCİ FATURALARI (mevcut) === */}
        <TabsContent value="students" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Gelir</p>
                    <p className="text-3xl font-bold mt-2">₺{Number(stats.monthlyRevenue || 0).toLocaleString('tr-TR')}</p>
                    <div className="flex items-center gap-1 mt-2 text-green-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Tahsilat toplamı</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-brand-accent">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bekleyen</p>
                    <p className="text-3xl font-bold mt-2">₺{Number(stats.pendingPayments || 0).toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-brand-accent/10">
                    <Calendar className="h-6 w-6 text-brand-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Geciken</p>
                    <p className="text-3xl font-bold mt-2">₺{Number(stats.overduePayments || 0).toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Fatura Adedi</p>
                    <p className="text-3xl font-bold mt-2">{stats.invoiceCount || dashboard?.invoices?.length || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Fatura ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Durum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="pending">Bekliyor</SelectItem>
                    <SelectItem value="overdue">Gecikmiş</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => downloadText('student-invoices-export.json', JSON.stringify(filteredStudentInvoices, null, 2))}>
                  <Download className="h-4 w-4 mr-2" />
                  Dışa Aktar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Öğrenci Faturaları</CardTitle>
              <CardDescription>Kurumların öğrencilerine kestiği faturalar</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Son Ödeme</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-28">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudentInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                      <TableCell className="font-medium">{invoice.studentName || 'Öğrenci'}</TableCell>
                      <TableCell>₺{Number(invoice.amount || 0).toLocaleString('tr-TR')}</TableCell>
                      <TableCell>{new Date(invoice.createdAt || Date.now()).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('tr-TR') : '-'}</TableCell>
                      <TableCell><StatusBadge status={invoice.status} /></TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => navigate('/finance/invoices-receipts')}>Detay</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
