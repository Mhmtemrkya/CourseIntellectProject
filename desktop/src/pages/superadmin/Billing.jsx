import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, CreditCard, Calendar,
  CheckCircle, Clock, AlertCircle, TrendingUp,
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
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard, fetchPlatformOverview } from '../../lib/api/modules';

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

export default function Billing() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBilling = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [overview, financeDashboard] = await Promise.all([
        fetchPlatformOverview(),
        fetchAccountingDashboard(),
      ]);
      setPlatform(overview);
      setDashboard(financeDashboard);
    } catch (err) {
      setError(err.message || 'Faturalama verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const filteredInvoices = useMemo(() => {
    const invoices = dashboard?.invoices || [];
    return invoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      const matchesSearch = `${invoice.id} ${invoice.studentName || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [dashboard, search, statusFilter]);

  const stats = platform?.stats || {};

  const getStatusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'paid') return <Badge className="bg-green-100 text-green-700 flex items-center"><CheckCircle className="h-3 w-3 mr-1" />Ödendi</Badge>;
    if (normalized === 'pending') return <Badge className="bg-yellow-100 text-yellow-700 flex items-center"><Clock className="h-3 w-3 mr-1" />Bekliyor</Badge>;
    return <Badge className="bg-red-100 text-red-700 flex items-center"><AlertCircle className="h-3 w-3 mr-1" />Gecikmiş</Badge>;
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-billing-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Faturalama</h1>
        <p className="text-muted-foreground mt-1">Gerçek finans ve platform operasyon görünümü</p>
      </div>

      {error ? <ErrorBanner title="Faturalama alınamadı" message={error} onRetry={loadBilling} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Toplam Gelir</p><p className="text-3xl font-bold mt-2">₺{Number(stats.monthlyRevenue || 0).toLocaleString('tr-TR')}</p><div className="flex items-center gap-1 mt-2 text-green-500"><TrendingUp className="h-4 w-4" /><span className="text-sm">Tahsilat toplamı</span></div></div><div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30"><CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" /></div></div></CardContent></Card>
        <Card className="border-l-4 border-l-brand-accent"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Bekleyen</p><p className="text-3xl font-bold mt-2">₺{Number(stats.pendingPayments || 0).toLocaleString('tr-TR')}</p></div><div className="p-3 rounded-xl bg-brand-accent/10"><Calendar className="h-6 w-6 text-brand-accent" /></div></div></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-500"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Geciken</p><p className="text-3xl font-bold mt-2">₺{Number(stats.overduePayments || 0).toLocaleString('tr-TR')}</p></div><div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30"><Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" /></div></div></CardContent></Card>
        <Card className="border-l-4 border-l-blue-500"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Fatura Adedi</p><p className="text-3xl font-bold mt-2">{stats.invoiceCount || dashboard?.invoices?.length || 0}</p></div><div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30"><AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" /></div></div></CardContent></Card>
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
            <Button variant="outline" onClick={() => downloadText('platform-billing-export.txt', JSON.stringify(filteredInvoices, null, 2))}>
              <Download className="h-4 w-4 mr-2" />
              Dışa Aktar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturalar</CardTitle>
          <CardDescription>Gerçek finans backend listesinden beslenir</CardDescription>
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
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                  <TableCell className="font-medium">{invoice.studentName || 'Öğrenci'}</TableCell>
                  <TableCell>₺{Number(invoice.amount || 0).toLocaleString('tr-TR')}</TableCell>
                  <TableCell>{new Date(invoice.createdAt || Date.now()).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('tr-TR') : '-'}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate('/finance/invoices-receipts')}>Detay</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
