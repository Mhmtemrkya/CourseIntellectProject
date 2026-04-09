import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Download, CreditCard, Calendar, 
  CheckCircle, Clock, AlertCircle, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockBillingStats = {
  totalRevenue: 156000,
  pendingPayments: 12500,
  overduePayments: 4800,
  thisMonthRevenue: 48000,
};

const mockInvoices = [
  { id: 'INV-2025-001', tenant: 'Özel Yıldız Koleji', amount: 4500, status: 'paid', date: '2025-01-01', dueDate: '2025-01-15', paidDate: '2025-01-10' },
  { id: 'INV-2025-002', tenant: 'ABC Eğitim Kurumları', amount: 2800, status: 'paid', date: '2025-01-01', dueDate: '2025-01-15', paidDate: '2025-01-12' },
  { id: 'INV-2025-003', tenant: 'Modern Akademi', amount: 850, status: 'pending', date: '2025-01-01', dueDate: '2025-01-15', paidDate: null },
  { id: 'INV-2025-004', tenant: 'Gelecek Nesil Okulu', amount: 3200, status: 'overdue', date: '2024-12-01', dueDate: '2024-12-15', paidDate: null },
  { id: 'INV-2025-005', tenant: 'Parlak Zihinler', amount: 5200, status: 'paid', date: '2025-01-01', dueDate: '2025-01-15', paidDate: '2025-01-08' },
];

export default function Billing() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredInvoices = mockInvoices.filter((invoice) => {
    const matchesSearch = invoice.tenant.toLowerCase().includes(search.toLowerCase()) ||
      invoice.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = { paid: 'Ödendi', pending: 'Bekliyor', overdue: 'Gecikmiş' };
    const icons = {
      paid: <CheckCircle className="h-3 w-3 mr-1" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      overdue: <AlertCircle className="h-3 w-3 mr-1" />,
    };
    return (
      <Badge className={`${styles[status]} flex items-center`}>
        {icons[status]}
        {labels[status]}
      </Badge>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-billing-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Faturalama</h1>
        <p className="text-muted-foreground mt-1">Platform gelir ve fatura yönetimi</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Gelir</p>
                  <p className="text-3xl font-bold mt-2">₺{mockBillingStats.totalRevenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">+12% bu yıl</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-accent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bu Ay</p>
                  <p className="text-3xl font-bold mt-2">₺{mockBillingStats.thisMonthRevenue.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <Calendar className="h-6 w-6 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen</p>
                  <p className="text-3xl font-bold mt-2">₺{mockBillingStats.pendingPayments.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gecikmiş</p>
                  <p className="text-3xl font-bold mt-2">₺{mockBillingStats.overduePayments.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Fatura ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="pending">Bekliyor</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Excel İndir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Faturalar</CardTitle>
          <CardDescription>Platform fatura listesi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fatura No</TableHead>
                <TableHead>Kurum</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Son Ödeme</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <motion.tr
                  key={invoice.id}
                  variants={itemVariants}
                  className="hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                  <TableCell className="font-medium">{invoice.tenant}</TableCell>
                  <TableCell>₺{invoice.amount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(invoice.date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>{new Date(invoice.dueDate).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
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
