import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Download, Printer, Search, Calendar,
  Eye, CheckCircle, XCircle, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockInvoices = [
  { id: 'FTR-2025-001', student: 'Ali Yılmaz', class: '10-A', amount: 4000, date: '2025-01-05', dueDate: '2025-01-31', status: 'unpaid' },
  { id: 'FTR-2025-002', student: 'Zeynep Kaya', class: '10-A', amount: 4000, date: '2025-01-05', dueDate: '2025-01-31', status: 'paid', paidDate: '2025-01-06' },
  { id: 'FTR-2024-128', student: 'Can Arslan', class: '11-A', amount: 4500, date: '2024-12-01', dueDate: '2024-12-31', status: 'paid', paidDate: '2024-12-15' },
  { id: 'FTR-2024-127', student: 'Elif Şahin', class: '11-B', amount: 4000, date: '2024-12-01', dueDate: '2024-12-31', status: 'overdue' },
];

const mockReceipts = [
  { id: 'MKB-2025-0106-001', student: 'Zeynep Kaya', class: '10-A', amount: 4000, date: '2025-01-06', type: 'Havale', collector: 'Sistem' },
  { id: 'MKB-2025-0105-001', student: 'Mehmet Demir', class: '10-B', amount: 2500, date: '2025-01-05', type: 'Nakit', collector: 'Ayşe H.' },
  { id: 'MKB-2025-0105-002', student: 'Burak Çelik', class: '11-B', amount: 3200, date: '2025-01-05', type: 'Kredi Kartı', collector: 'Ayşe H.' },
  { id: 'MKB-2024-1215-001', student: 'Can Arslan', class: '11-A', amount: 4500, date: '2024-12-15', type: 'Havale', collector: 'Sistem' },
];

export default function InvoicesReceipts() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredInvoices = mockInvoices.filter((inv) => {
    const matchesSearch = inv.student.toLowerCase().includes(search.toLowerCase()) ||
                         inv.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredReceipts = mockReceipts.filter((rec) => {
    return rec.student.toLowerCase().includes(search.toLowerCase()) ||
           rec.id.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-yellow-100 text-yellow-700',
      overdue: 'bg-red-100 text-red-700',
    };
    const labels = { paid: 'Ödendi', unpaid: 'Bekliyor', overdue: 'Gecikmiş' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const stats = {
    totalInvoices: mockInvoices.length,
    paidInvoices: mockInvoices.filter(i => i.status === 'paid').length,
    pendingAmount: mockInvoices.filter(i => i.status !== 'paid').reduce((a, i) => a + i.amount, 0),
    totalReceipts: mockReceipts.length,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="finance-invoices-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Fatura & Makbuz</h1>
          <p className="text-muted-foreground mt-1">Fatura ve makbuz yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Toplu Yazdır
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <FileText className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalInvoices}</p>
                <p className="text-sm text-muted-foreground">Toplam Fatura</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.paidInvoices}</p>
                <p className="text-sm text-muted-foreground">Ödenen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <XCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{stats.pendingAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Bekleyen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-accent/10">
                <FileText className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReceipts}</p>
                <p className="text-sm text-muted-foreground">Makbuz</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoices">Faturalar</TabsTrigger>
          <TabsTrigger value="receipts">Makbuzlar</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {activeTab === 'invoices' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="unpaid">Bekliyor</SelectItem>
                    <SelectItem value="overdue">Gecikmiş</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Son Ödeme</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                      <TableCell className="font-medium">{invoice.student}</TableCell>
                      <TableCell>{invoice.class}</TableCell>
                      <TableCell>₺{invoice.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(invoice.date).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Makbuz No</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Tahsildar</TableHead>
                    <TableHead className="w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-sm">{receipt.id}</TableCell>
                      <TableCell className="font-medium">{receipt.student}</TableCell>
                      <TableCell>{receipt.class}</TableCell>
                      <TableCell className="text-green-600">₺{receipt.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(receipt.date).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell><Badge variant="outline">{receipt.type}</Badge></TableCell>
                      <TableCell>{receipt.collector}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
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
