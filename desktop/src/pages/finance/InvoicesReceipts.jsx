import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, Printer, Search,
  Eye, CheckCircle, XCircle, Plus,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '../../components/ui/tabs';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createCollection, createInvoice, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';
import {
  buildFinanceDocumentHtml,
  downloadCsvRows,
  downloadFinanceHtml,
  formatCurrency,
  parseFinanceMoney,
  printFinanceHtml,
} from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function statusFromInvoice(invoice) {
  const status = String(invoice.status || '').toLowerCase();
  if (status.includes('paid') || status.includes('oden')) return 'paid';
  if (status.includes('overdue') || status.includes('gec')) return 'overdue';
  return 'unpaid';
}

function InvoiceCreateDialog({
  open, onOpenChange, students, onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentKey: '',
    amount: '',
    category: 'Kurs Ucreti',
    date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  useEffect(() => {
    if (!open) {
      setForm({
        studentKey: '',
        amount: '',
        category: 'Kurs Ucreti',
        date: new Date().toISOString().slice(0, 10),
        reason: '',
      });
    }
  }, [open]);

  const selectedStudent = useMemo(
    () => students.find((student) => (student.username || student.fullName) === form.studentKey),
    [students, form.studentKey],
  );

  const handleSave = async () => {
    if (!selectedStudent || !form.amount) {
      toast({
        title: 'Eksik bilgi',
        description: 'Öğrenci ve tutar zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createInvoice({
        title: `${selectedStudent.fullName} - ${form.category}`,
        category: form.category,
        amount: form.amount,
        date: form.date,
        reason: form.reason || 'Masaüstü panelden oluşturuldu',
      });
      onCreated(created);
      toast({
        title: 'Fatura oluşturuldu',
        description: 'Fatura backend’e kaydedildi.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Fatura oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Fatura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select value={form.studentKey} onValueChange={(value) => setForm((prev) => ({ ...prev, studentKey: value }))}>
              <SelectTrigger><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.username || student.fullName} value={student.username || student.fullName}>
                    {student.fullName} ({student.className})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tutar</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Fatura Oluştur'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptCreateDialog({
  open, onOpenChange, students, onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentName: '',
    amount: '',
    method: 'Nakit',
    note: '',
  });

  useEffect(() => {
    if (!open) {
      setForm({ studentName: '', amount: '', method: 'Nakit', note: '' });
    }
  }, [open]);

  const selectedStudent = useMemo(() => students.find((student) => student.fullName === form.studentName), [students, form.studentName]);

  const handleSave = async () => {
    if (!selectedStudent || !form.amount) {
      toast({ title: 'Eksik bilgi', description: 'Öğrenci ve tutar zorunlu.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await createCollection({
        name: selectedStudent.fullName,
        className: selectedStudent.className || 'Belirtilmedi',
        amount: form.amount,
        method: form.method,
        note: form.note || 'Makbuz ekranindan olusturuldu',
      });
      onCreated(created);
      onOpenChange(false);
      toast({ title: 'Makbuz oluşturuldu', description: 'Tahsilat kaydı işlendi.' });
    } catch (err) {
      toast({ title: 'Makbuz oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni Makbuz</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select value={form.studentName} onValueChange={(value) => setForm((prev) => ({ ...prev, studentName: value }))}>
              <SelectTrigger><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.username || student.fullName} value={student.fullName}>
                    {student.fullName} ({student.className})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Tutar</Label><Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Ödeme Türü</Label><Select value={form.method} onValueChange={(value) => setForm((prev) => ({ ...prev, method: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Nakit">Nakit</SelectItem><SelectItem value="Kredi Karti">Kredi Kartı</SelectItem><SelectItem value="Havale/EFT">Havale/EFT</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Açıklama</Label><Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Makbuz Oluştur'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InvoicesReceipts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [accounting, studentList] = await Promise.all([
        fetchAccountingDashboard(),
        fetchStudents().catch(() => []),
      ]);
      setDashboard(accounting);
      setStudents(studentList);
    } catch (err) {
      setError(err.message || 'Fatura ve makbuz verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const invoices = useMemo(() => dashboard?.invoices || [], [dashboard]);
  const receipts = useMemo(() => dashboard?.collections || [], [dashboard]);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    const invoiceStatus = statusFromInvoice(inv);
    const matchesSearch = `${inv.title} ${inv.subtitle} ${inv.id}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoiceStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }), [invoices, search, statusFilter]);

  const filteredReceipts = useMemo(() => receipts.filter((rec) => `${rec.name} ${rec.id} ${rec.note}`.toLowerCase().includes(search.toLowerCase())), [receipts, search]);

  const getStatusBadge = (status) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-yellow-100 text-yellow-700',
      overdue: 'bg-red-100 text-red-700',
    };
    const labels = { paid: 'Ödendi', unpaid: 'Bekliyor', overdue: 'Gecikmiş' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const stats = useMemo(() => ({
    totalInvoices: invoices.length,
    paidInvoices: invoices.filter((i) => statusFromInvoice(i) === 'paid').length,
    pendingAmount: invoices.filter((i) => statusFromInvoice(i) !== 'paid').reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0),
    totalReceipts: receipts.length,
  }), [invoices, receipts]);

  const buildRecordHtml = useCallback((record, type) => buildFinanceDocumentHtml({
    title: type === 'invoice' ? 'Fatura Belgesi' : 'Tahsilat Makbuzu',
    subtitle: type === 'invoice' ? 'Finans ekibi tarafından üretilen fatura belgesi' : 'Tahsilat işlemi için düzenlenen makbuz',
    code: record.id,
    accent: type === 'invoice' ? '#0f4c81' : '#0b8f6f',
    badge: type === 'invoice' ? statusFromInvoice(record) : record.method,
    summary: type === 'invoice'
      ? [
        { label: 'Belge Türü', value: 'Fatura' },
        { label: 'Tutar', value: formatCurrency(record.amount) },
        { label: 'Durum', value: statusFromInvoice(record) },
        { label: 'Kategori', value: record.category || '-' },
      ]
      : [
        { label: 'Belge Türü', value: 'Makbuz' },
        { label: 'Tutar', value: formatCurrency(record.amount) },
        { label: 'Ödeme Tipi', value: record.method || '-' },
        { label: 'Kayıt Zamanı', value: record.time || '-' },
      ],
    sections: type === 'invoice'
      ? [{
        title: 'Fatura Bilgileri',
        rows: [
          { label: 'Başlık', value: record.title || '-' },
          { label: 'Kategori', value: record.category || '-' },
          { label: 'Durum', value: statusFromInvoice(record) },
          { label: 'Açıklama', value: record.subtitle || '-' },
        ],
      }]
      : [{
        title: 'Makbuz Bilgileri',
        rows: [
          { label: 'Öğrenci', value: record.name || '-' },
          { label: 'Sınıf', value: record.className || '-' },
          { label: 'Ödeme Türü', value: record.method || '-' },
          { label: 'Açıklama', value: record.note || '-' },
        ],
      }],
  }), []);

  const handleCreated = (created) => {
    setDashboard((prev) => ({
      ...prev,
      invoices: [created, ...(prev?.invoices || [])],
    }));
  };

  const handleReceiptCreated = (created) => {
    setDashboard((prev) => ({
      ...prev,
      collections: [created, ...(prev?.collections || [])],
    }));
  };

  const handleBulkPrint = () => {
    const html = buildFinanceDocumentHtml({
      title: activeTab === 'invoices' ? 'Toplu Fatura Dökümü' : 'Toplu Makbuz Dökümü',
      subtitle: 'Yazdırma için hazır toplu belge görünümü',
      code: `BATCH-${activeTab === 'invoices' ? 'INV' : 'REC'}-${new Date().toISOString().slice(0, 10)}`,
      accent: activeTab === 'invoices' ? '#0f4c81' : '#0b8f6f',
      summary: [
        { label: 'Belge Sayısı', value: String(activeTab === 'invoices' ? filteredInvoices.length : filteredReceipts.length) },
        { label: 'Toplam Tutar', value: formatCurrency((activeTab === 'invoices' ? filteredInvoices : filteredReceipts).reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0)) },
      ],
      sections: [{
        title: 'Belge Listesi',
        table: {
          headers: activeTab === 'invoices'
            ? ['No', 'Başlık', 'Kategori', 'Tutar', 'Durum']
            : ['No', 'Öğrenci', 'Sınıf', 'Tutar', 'Tür'],
          rows: activeTab === 'invoices'
            ? filteredInvoices.map((invoice) => [invoice.id, invoice.title, invoice.category, formatCurrency(invoice.amount), statusFromInvoice(invoice)])
            : filteredReceipts.map((receipt) => [receipt.id, receipt.name, receipt.className, formatCurrency(receipt.amount), receipt.method]),
        },
      }],
    });
    printFinanceHtml(activeTab === 'invoices' ? 'faturalar' : 'makbuzlar', html);
  };

  const handleExport = () => {
    if (activeTab === 'invoices') {
      downloadCsvRows('faturalar.csv', [
        ['Fatura No', 'Baslik', 'Kategori', 'Tutar', 'Durum'],
        ...filteredInvoices.map((invoice) => [
          invoice.id,
          invoice.title,
          invoice.category,
          parseFinanceMoney(invoice.amount),
          statusFromInvoice(invoice),
        ]),
      ]);
    } else {
      downloadCsvRows('makbuzlar.csv', [
        ['Makbuz No', 'Ogrenci', 'Sinif', 'Tutar', 'Tur', 'Zaman'],
        ...filteredReceipts.map((receipt) => [
          receipt.id,
          receipt.name,
          receipt.className,
          parseFinanceMoney(receipt.amount),
          receipt.method,
          receipt.time,
        ]),
      ]);
    }
    toast({
      title: 'Dışa aktarma hazır',
      description: `${activeTab === 'invoices' ? 'Fatura' : 'Makbuz'} listesi indirildi.`,
    });
  };

  const openRecordDetail = (record, type) => setSelectedRecord({ ...record, type });

  const handleDownloadRecord = (record, type) => {
    downloadFinanceHtml(`${type}-${record.id}.html`, buildRecordHtml(record, type));
  };

  const handlePrintRecord = (record, type) => {
    printFinanceHtml(`${type}-${record.id}`, buildRecordHtml(record, type));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Fatura ve makbuzlar yükleniyor...</p>
      </div>
    );
  }

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
          <p className="text-muted-foreground mt-1">Gerçek backend finans kayıtları</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBulkPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Toplu Yazdır
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => (activeTab === 'invoices' ? setDialogOpen(true) : setReceiptDialogOpen(true))}>
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'invoices' ? 'Yeni Fatura' : 'Yeni Makbuz'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Fatura ve makbuzlar alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.totalInvoices, 'Toplam Fatura', FileText, 'text-brand-primary'],
          [stats.paidInvoices, 'Ödenen', CheckCircle, 'text-green-600'],
          [`₺${stats.pendingAmount.toLocaleString('tr-TR')}`, 'Bekleyen', XCircle, 'text-yellow-600'],
          [stats.totalReceipts, 'Makbuz', FileText, 'text-brand-accent'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted/70">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {activeTab === 'invoices' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['Öğrenci Faturaları', 'Dershane Mekan Giderleri', 'Diğer Gider Faturaları', 'Maaş Faturaları'].map((category) => (
            <Card key={category}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{category}</p>
                <p className="mt-2 text-2xl font-bold">{invoices.filter((item) => item.category === category).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Nakit', 'Kredi Karti', 'Havale/EFT'].map((method) => (
            <Card key={method}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{method}</p>
                <p className="mt-2 text-2xl font-bold">{receipts.filter((item) => item.method === method).length}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="invoices" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoices">Faturalar</TabsTrigger>
          <TabsTrigger value="receipts">Makbuzlar</TabsTrigger>
        </TabsList>

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
              {activeTab === 'invoices' ? (
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
              ) : null}
            </div>
          </CardContent>
        </Card>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <p>{invoice.title}</p>
                          <p className="text-xs text-muted-foreground">{invoice.subtitle}</p>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.category}</TableCell>
                      <TableCell>₺{parseFinanceMoney(invoice.amount).toLocaleString('tr-TR')}</TableCell>
                      <TableCell>{getStatusBadge(statusFromInvoice(invoice))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openRecordDetail(invoice, 'invoice')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadRecord(invoice, 'invoice')}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintRecord(invoice, 'invoice')}>
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
                    <TableHead>Tür</TableHead>
                    <TableHead>Zaman</TableHead>
                    <TableHead className="w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-sm">{receipt.id}</TableCell>
                      <TableCell className="font-medium">{receipt.name}</TableCell>
                      <TableCell>{receipt.className}</TableCell>
                      <TableCell className="text-green-600">₺{parseFinanceMoney(receipt.amount).toLocaleString('tr-TR')}</TableCell>
                      <TableCell><Badge variant="outline">{receipt.method}</Badge></TableCell>
                      <TableCell>{receipt.time}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openRecordDetail(receipt, 'receipt')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadRecord(receipt, 'receipt')}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintRecord(receipt, 'receipt')}>
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

      <InvoiceCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        students={students}
        onCreated={handleCreated}
      />
      <ReceiptCreateDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        students={students}
        onCreated={handleReceiptCreated}
      />

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecord?.type === 'invoice' ? 'Fatura Detayı' : 'Makbuz Detayı'}</DialogTitle>
          </DialogHeader>
          {selectedRecord ? (
            <div className="space-y-5 py-2">
              <div className={`rounded-3xl p-6 text-white shadow-xl ${selectedRecord.type === 'invoice' ? 'bg-gradient-to-br from-sky-600 via-blue-700 to-slate-900' : 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700'}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/70">{selectedRecord.type === 'invoice' ? 'Fatura Belgesi' : 'Makbuz Belgesi'}</div>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedRecord.type === 'invoice' ? selectedRecord.title : selectedRecord.name}</h3>
                    <p className="mt-2 text-white/80">{selectedRecord.type === 'invoice' ? selectedRecord.category : selectedRecord.className}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-white/70">Belge Tutarı</div>
                    <div className="mt-2 text-3xl font-bold">{formatCurrency(selectedRecord.amount)}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Kayıt No</p>
                    <p className="mt-1 font-semibold">{selectedRecord.id}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{selectedRecord.type === 'invoice' ? 'Belge Durumu' : 'Ödeme Tipi'}</p>
                    <p className="mt-1 font-semibold">{selectedRecord.type === 'invoice' ? statusFromInvoice(selectedRecord) : selectedRecord.method}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedRecord.type === 'invoice' ? (
                  <>
                    <p><strong>Başlık:</strong> {selectedRecord.title}</p>
                    <p><strong>Kategori:</strong> {selectedRecord.category}</p>
                    <p><strong>Durum:</strong> {statusFromInvoice(selectedRecord)}</p>
                    <p><strong>Açıklama:</strong> {selectedRecord.subtitle || '-'}</p>
                  </>
                ) : (
                  <>
                    <p><strong>Öğrenci:</strong> {selectedRecord.name}</p>
                    <p><strong>Sınıf:</strong> {selectedRecord.className}</p>
                    <p><strong>Tür:</strong> {selectedRecord.method}</p>
                    <p><strong>Zaman:</strong> {selectedRecord.time}</p>
                    <p><strong>Not:</strong> {selectedRecord.note || '-'}</p>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {selectedRecord ? (
              <>
                <Button variant="outline" onClick={() => handleDownloadRecord(selectedRecord, selectedRecord.type)}>İndir</Button>
                <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => handlePrintRecord(selectedRecord, selectedRecord.type)}>Yazdır</Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
