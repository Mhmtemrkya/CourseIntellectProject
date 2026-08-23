import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, Printer, Search,
  Eye, CheckCircle, XCircle, Plus, CircleDollarSign,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
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
import {
  createCollection, createInvoice, fetchAccountingDashboard, fetchStudents, markInvoicePaid,
} from '../../lib/api/modules';
import {
  buildFinanceDocumentHtml,
  downloadCsvRows,
  downloadFinanceHtml,
  formatCurrency,
  getBrandAccentHex,
  normalizeFinanceText,
  parseFinanceMoney,
  printFinanceHtml,
} from '../../lib/financeDocuments';
import { filterByPeriod, periodLabel as buildPeriodLabel, shiftAnchor } from '../../lib/financePeriod';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/ui/status-badge';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Öğrenci seçicilerinde kullanılan TEKİL anahtar. Ad tekil değildir: aynı isimli
 * iki öğrenci varsa ada göre eşleştirme yanlış kişiyi bulur ve makbuz/tahsilat
 * başkasına yazılabilir. Kullanıcı kimliği varsa o, yoksa kullanıcı adı kullanılır;
 * ad yalnız son çare.
 */
function studentKeyOf(student) {
  return String(student?.userId || student?.username || student?.fullName || '');
}

function statusFromInvoice(invoice) {
  const status = normalizeFinanceText(invoice.status);
  if (status === 'paid' || status.includes('odendi') || status.includes('onay')) return 'paid';
  if (invoice.dueDateUtc && new Date(invoice.dueDateUtc) < new Date()) return 'overdue';
  if (status.includes('overdue') || status.includes('gec')) return 'overdue';
  if (status.includes('unpaid') || status.includes('odenmedi') || status.includes('bekli')) return 'unpaid';
  return 'unpaid';
}

function InvoiceCreateDialog({
  open, onOpenChange, students, onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentKey: '',
    counterparty: '',
    title: '',
    invoiceNumber: '',
    amount: '',
    category: 'Öğrenci Faturaları',
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    reason: '',
    paymentStatus: 'unpaid',
    paymentMethod: 'Nakit',
  });

  useEffect(() => {
    if (!open) {
      setForm({
        studentKey: '',
        counterparty: '',
        title: '',
        invoiceNumber: '',
        amount: '',
        category: 'Öğrenci Faturaları',
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        reason: '',
        paymentStatus: 'unpaid',
        paymentMethod: 'Nakit',
      });
    }
  }, [open]);

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.counterparty.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Eksik veya geçersiz bilgi',
        description: 'Fatura başlığı, ilgili kişi/kurum ve sıfırdan büyük tutar zorunludur.',
        variant: 'destructive',
      });
      return;
    }
    if (form.dueDate && form.dueDate < form.date) {
      toast({
        title: 'Son ödeme tarihi geçersiz',
        description: 'Son ödeme tarihi fatura tarihinden önce olamaz.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createInvoice({
        title: form.title.trim(),
        counterparty: form.counterparty.trim(),
        invoiceNumber: form.invoiceNumber.trim() || null,
        category: form.category,
        amount: form.amount,
        date: form.date,
        dueDateUtc: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        reason: form.reason.trim(),
        isPaid: form.paymentStatus === 'paid',
        paymentMethod: form.paymentStatus === 'paid' ? form.paymentMethod : null,
      });
      onCreated(created);
      toast({
        title: 'Fatura oluşturuldu',
        description: `Fatura ${form.paymentStatus === 'paid' ? 'ödendi' : 'ödenmedi'} durumunda kaydedildi.`,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Profesyonel Fatura Kaydı</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenciden hızlı doldur (isteğe bağlı)</Label>
            <Select value={form.studentKey} onValueChange={(value) => {
              const student = students.find((item) => (item.username || item.fullName) === value);
              setForm((prev) => ({
                ...prev,
                studentKey: value,
                counterparty: student?.fullName || prev.counterparty,
                title: student ? `${student.fullName} - Eğitim Hizmeti` : prev.title,
                category: student ? 'Öğrenci Faturaları' : prev.category,
              }));
            }}>
              <SelectTrigger><SelectValue placeholder="Öğrenci seçmeden manuel giriş yapabilirsiniz" /></SelectTrigger>
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
              <Label>İlgili kişi / kurum *</Label>
              <Input value={form.counterparty} placeholder="Öğrenci, veli veya tedarikçi" onChange={(e) => setForm((prev) => ({ ...prev, counterparty: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fatura numarası</Label>
              <Input value={form.invoiceNumber} placeholder="Boşsa otomatik oluşturulur" onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fatura başlığı *</Label>
            <Input value={form.title} placeholder="Örn. Temmuz 2026 eğitim hizmeti" onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Toplam tutar (TL) *</Label>
              <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Öğrenci Faturaları">Öğrenci Faturaları</SelectItem>
                  <SelectItem value="Dershane Mekan Giderleri">Mekân ve İşletme Giderleri</SelectItem>
                  <SelectItem value="Diğer Gider Faturaları">Diğer Gider Faturaları</SelectItem>
                  <SelectItem value="Maaş Faturaları">Personel ve Maaş Giderleri</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fatura tarihi *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Son ödeme tarihi</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input value={form.reason} placeholder="Hizmet dönemi, gider detayı veya kurum içi not" onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Ödeme durumu *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={form.paymentStatus === 'unpaid' ? 'default' : 'outline'} onClick={() => setForm((prev) => ({ ...prev, paymentStatus: 'unpaid' }))}>
                <XCircle className="mr-2 h-4 w-4" />Ödenmedi
              </Button>
              <Button type="button" variant={form.paymentStatus === 'paid' ? 'default' : 'outline'} onClick={() => setForm((prev) => ({ ...prev, paymentStatus: 'paid' }))}>
                <CheckCircle className="mr-2 h-4 w-4" />Ödendi
              </Button>
            </div>
          </div>
          {form.paymentStatus === 'paid' ? (
            <div className="space-y-2">
              <Label>Ödeme yöntemi *</Label>
              <Select value={form.paymentMethod} onValueChange={(value) => setForm((prev) => ({ ...prev, paymentMethod: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nakit">Nakit</SelectItem>
                  <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                  <SelectItem value="Havale/EFT">Havale / EFT</SelectItem>
                  <SelectItem value="Çek">Çek</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
              Fatura ödenmedi olarak kaydedilecek. Ödeme geldiğinde işlem sütunundaki “Ödendi” düğmesini kullanabilirsiniz.
            </p>
          )}
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
  // Öğrenci ADIYLA değil, TEKİL KİMLİKLE seçilir. Aynı isimli iki öğrenci varsa
  // ada göre arama yanlış kişiyi buluyor ve makbuz başkasına kesilebiliyordu.
  const [form, setForm] = useState({
    studentKey: '',
    amount: '',
    method: 'Nakit',
    note: '',
  });

  useEffect(() => {
    if (!open) {
      setForm({ studentKey: '', amount: '', method: 'Nakit', note: '' });
    }
  }, [open]);

  const selectedStudent = useMemo(
    () => students.find((student) => studentKeyOf(student) === form.studentKey),
    [students, form.studentKey],
  );

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
        // Tahsilat ada göre değil kimliğe göre eşleşsin; ad tek başına tekil değil.
        studentUserId: selectedStudent.userId || null,
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
            <Select value={form.studentKey} onValueChange={(value) => setForm((prev) => ({ ...prev, studentKey: value }))}>
              <SelectTrigger><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={studentKeyOf(student)} value={studentKeyOf(student)}>
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

function MarkPaidDialog({
  invoice, onOpenChange, onPaid,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Nakit');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!invoice) {
      setPaymentMethod('Nakit');
      setPaidDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [invoice]);

  const save = async () => {
    if (!invoice) return;
    try {
      setSaving(true);
      const updated = await markInvoicePaid(invoice.id, {
        paymentMethod,
        paidAtUtc: new Date(`${paidDate}T12:00:00`).toISOString(),
        note: note.trim() || null,
      });
      onPaid(updated);
      onOpenChange(false);
      toast({
        title: 'Fatura ödendi olarak işaretlendi',
        description: `${updated.invoiceNumber || updated.id} numaralı faturanın ödeme kaydı tamamlandı.`,
      });
    } catch (error) {
      toast({
        title: 'Ödeme durumu güncellenemedi',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Faturayı Ödendi Olarak İşaretle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="font-semibold">{invoice?.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice?.invoiceNumber || invoice?.id} • {formatCurrency(invoice?.amount)}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Ödeme yöntemi *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nakit">Nakit</SelectItem>
                <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                <SelectItem value="Havale/EFT">Havale / EFT</SelectItem>
                <SelectItem value="Çek">Çek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ödeme tarihi *</Label>
            <Input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ödeme notu</Label>
            <Input value={note} placeholder="Dekont veya açıklama bilgisi (isteğe bağlı)" onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button onClick={save} disabled={saving}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {saving ? 'Kaydediliyor...' : 'Ödendi Olarak İşaretle'}
          </Button>
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
  const [period, setPeriod] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [invoiceToMarkPaid, setInvoiceToMarkPaid] = useState(null);

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

  const periodInvoices = useMemo(() => filterByPeriod(invoices, (inv) => inv.subtitle || inv.date, period, anchor), [invoices, period, anchor]);
  const periodReceipts = useMemo(() => filterByPeriod(receipts, (rec) => rec.time || rec.date, period, anchor), [receipts, period, anchor]);

  const filteredInvoices = useMemo(() => periodInvoices.filter((inv) => {
    const invoiceStatus = statusFromInvoice(inv);
    const matchesSearch = `${inv.title} ${inv.subtitle} ${inv.id}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoiceStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }), [periodInvoices, search, statusFilter]);

  const filteredReceipts = useMemo(() => periodReceipts.filter((rec) => `${rec.name} ${rec.id} ${rec.note}`.toLowerCase().includes(search.toLowerCase())), [periodReceipts, search]);

  const getStatusBadge = (status) => {
    // Etiket ve renk ortak durum sözlüğünden gelir.
    const labels = { paid: 'Ödendi', unpaid: 'Bekliyor', overdue: 'Gecikti' };
    return <StatusBadge status={labels[status]} />;
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
    accent: type === 'invoice' ? getBrandAccentHex() : '#0b8f6f',
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

  const handleInvoicePaid = (updated) => {
    setDashboard((prev) => ({
      ...prev,
      invoices: (prev?.invoices || []).map((invoice) => (invoice.id === updated.id ? updated : invoice)),
    }));
    setSelectedRecord((current) => (current?.id === updated.id ? { ...updated, type: 'invoice' } : current));
  };

  const handleBulkPrint = () => {
    const html = buildFinanceDocumentHtml({
      title: activeTab === 'invoices' ? 'Toplu Fatura Dökümü' : 'Toplu Makbuz Dökümü',
      subtitle: 'Yazdırma için hazır toplu belge görünümü',
      code: `BATCH-${activeTab === 'invoices' ? 'INV' : 'REC'}-${new Date().toISOString().slice(0, 10)}`,
      accent: activeTab === 'invoices' ? getBrandAccentHex() : '#0b8f6f',
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
          <FeatureGate module="billing" action="export">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </FeatureGate>
          <FeatureGate module="billing" action={activeTab === 'invoices' ? 'invoice-create' : 'receipt-create'}>
            <Button onClick={() => (activeTab === 'invoices' ? setDialogOpen(true) : setReceiptDialogOpen(true))}>
              <Plus className="h-4 w-4 mr-2" />
              {activeTab === 'invoices' ? 'Yeni Fatura' : 'Yeni Makbuz'}
            </Button>
          </FeatureGate>
        </div>
      </div>

      {error ? <ErrorBanner title="Fatura ve makbuzlar alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.totalInvoices, 'Toplam Fatura', FileText, 'text-brand-primary'],
          [stats.paidInvoices, 'Ödenen', CheckCircle, 'text-green-600'],
          [formatCurrency(stats.pendingAmount), 'Bekleyen', XCircle, 'text-yellow-600'],
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
          {[['day', 'Günlük'], ['week', 'Haftalık'], ['month', 'Aylık'], ['year', 'Yıllık']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setPeriod(val); setAnchor(new Date()); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${period === val ? 'bg-brand-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center text-sm font-bold">{buildPeriodLabel(period, anchor)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

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
                      <TableCell className="font-mono text-sm">{invoice.invoiceNumber || invoice.id}</TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <p>{invoice.title}</p>
                          <p className="text-xs text-muted-foreground">{invoice.subtitle}</p>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.category}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{getStatusBadge(statusFromInvoice(invoice))}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {statusFromInvoice(invoice) !== 'paid' ? (
                            <Button size="sm" className="h-8 bg-emerald-600 px-2 text-white hover:bg-emerald-700" onClick={() => setInvoiceToMarkPaid(invoice)}>
                              <CircleDollarSign className="mr-1 h-4 w-4" />Ödendi
                            </Button>
                          ) : null}
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
                      <TableCell className="text-green-600">{formatCurrency(receipt.amount)}</TableCell>
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
      <MarkPaidDialog
        invoice={invoiceToMarkPaid}
        onOpenChange={(open) => { if (!open) setInvoiceToMarkPaid(null); }}
        onPaid={handleInvoicePaid}
      />

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecord?.type === 'invoice' ? 'Fatura Detayı' : 'Makbuz Detayı'}</DialogTitle>
          </DialogHeader>
          {selectedRecord ? (
            <div className="space-y-5 py-2">
              <div className={`rounded-3xl p-6 text-white shadow-xl ${selectedRecord.type === 'invoice' ? ' ' : ' '} ci-hero`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-foreground/70">{selectedRecord.type === 'invoice' ? 'Fatura Belgesi' : 'Makbuz Belgesi'}</div>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedRecord.type === 'invoice' ? selectedRecord.title : selectedRecord.name}</h3>
                    <p className="mt-2 text-foreground/80">{selectedRecord.type === 'invoice' ? selectedRecord.category : selectedRecord.className}</p>
                  </div>
                  <div className="rounded-2xl bg-foreground/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-foreground/70">Belge Tutarı</div>
                    <div className="mt-2 text-3xl font-bold">{formatCurrency(selectedRecord.amount)}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Kayıt No</p>
                    <p className="mt-1 font-semibold">{selectedRecord.invoiceNumber || selectedRecord.id}</p>
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
                    <p><strong>İlgili kişi/kurum:</strong> {selectedRecord.counterparty || '-'}</p>
                    <p><strong>Fatura tarihi:</strong> {selectedRecord.issueDateUtc ? formatDate(selectedRecord.issueDateUtc) : selectedRecord.subtitle}</p>
                    <p><strong>Son ödeme tarihi:</strong> {selectedRecord.dueDateUtc ? formatDate(selectedRecord.dueDateUtc) : '-'}</p>
                    <p><strong>Ödeme yöntemi:</strong> {selectedRecord.paymentMethod || '-'}</p>
                    <p><strong>Açıklama:</strong> {selectedRecord.note || selectedRecord.subtitle || '-'}</p>
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
                {selectedRecord.type === 'invoice' && statusFromInvoice(selectedRecord) !== 'paid' ? (
                  <Button onClick={() => setInvoiceToMarkPaid(selectedRecord)}>
                    <CircleDollarSign className="mr-2 h-4 w-4" />Ödendi Olarak İşaretle
                  </Button>
                ) : null}
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
