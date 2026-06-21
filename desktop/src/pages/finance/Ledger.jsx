import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Search, DollarSign, Users, TrendingUp, AlertCircle, Eye, FilePlus2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchStudents, fetchFinanceSummaries, fetchStudentFinanceAccount, createEnrollment } from '../../lib/api/modules';

const emptyEnrollForm = {
  grossAmount: '',
  discountAmount: '',
  discountReason: '',
  downPayment: '',
  installmentCount: '',
  academicYear: '',
  firstInstallmentDate: '',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(val) || 0);
}

function normalizeLedgerKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replaceAll('-', '')
    .replaceAll(' ', '');
}

export default function Ledger() {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [accountDetail, setAccountDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Sonradan sözleşme/ücret ekleme akışı.
  const [enrollStudent, setEnrollStudent] = useState(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [enrollForm, setEnrollForm] = useState(emptyEnrollForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentData, summaryData] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchFinanceSummaries(),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setSummaries(Array.isArray(summaryData) ? summaryData : []);
    } catch (err) {
      setError(err.message || 'Hesap defteri verileri yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Canlı backend ozetlerini (studentUserId / ad ile) hizli erisim icin indeksle.
  const summaryByUserId = useMemo(() => {
    const map = new Map();
    summaries.forEach((item) => { if (item.studentUserId) map.set(String(item.studentUserId), item); });
    return map;
  }, [summaries]);

  const summaryByName = useMemo(() => {
    const map = new Map();
    summaries.forEach((item) => {
      const key = normalizeLedgerKey(item.studentName);
      if (key) map.set(key, item);
    });
    return map;
  }, [summaries]);

  // Tum ogrenci kadrosu listelenir; finansal degerler backend ozetinden
  // (studentUserId, yoksa ad eslesmesi) birebir alinir. Kadroda olmayip yalnizca
  // sozlesmede gecen ogrenciler de eklenir; boylece hicbir canli kayit dusmez.
  const ledger = useMemo(() => {
    const usedSummaryKeys = new Set();
    const resolveSummary = (student) => {
      const byId = student.id != null ? summaryByUserId.get(String(student.id)) : undefined;
      const summary = byId || summaryByName.get(normalizeLedgerKey(student.fullName || student.name || ''))
        || summaryByName.get(normalizeLedgerKey(student.username || ''));
      if (summary) usedSummaryKeys.add(summary);
      return summary;
    };

    const rosterRows = students.map((s) => {
      const summary = resolveSummary(s);
      const totalDue = Number(summary?.netTotal) || 0;
      const totalPaid = Number(summary?.paidTotal) || 0;
      return {
        id: s.id || normalizeLedgerKey(s.fullName || s.name),
        studentUserId: summary?.studentUserId || s.id || null,
        name: s.fullName || s.name || summary?.studentName || '',
        className: summary?.className || s.className || s.class || '-',
        totalDue,
        totalPaid,
        balance: summary ? Number(summary.balance) || 0 : totalDue - totalPaid,
        hasOverdue: (summary?.overdueCount || 0) > 0,
      };
    });

    // Kadroda eslesmeyen (yalnizca finans kaydi olan) ogrenciler.
    const extraRows = summaries
      .filter((summary) => !usedSummaryKeys.has(summary))
      .map((summary) => ({
        id: summary.studentUserId || normalizeLedgerKey(summary.studentName),
        studentUserId: summary.studentUserId || null,
        name: summary.studentName || '',
        className: summary.className || '-',
        totalDue: Number(summary.netTotal) || 0,
        totalPaid: Number(summary.paidTotal) || 0,
        balance: Number(summary.balance) || 0,
        hasOverdue: (summary.overdueCount || 0) > 0,
      }));

    return [...rosterRows, ...extraRows];
  }, [students, summaries, summaryByUserId, summaryByName]);

  const filtered = useMemo(() => {
    let list = ledger;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.className.toLowerCase().includes(q));
    }
    if (filterStatus === 'overdue') list = list.filter((l) => l.hasOverdue);
    if (filterStatus === 'paid') list = list.filter((l) => l.balance <= 0);
    if (filterStatus === 'unpaid') list = list.filter((l) => l.balance > 0);
    return list;
  }, [ledger, search, filterStatus]);

  // Kartlar dogrudan canli backend ozetlerinin toplamindan hesaplanir.
  const totals = useMemo(() => ({
    due: summaries.reduce((s, item) => s + (Number(item.netTotal) || 0), 0),
    paid: summaries.reduce((s, item) => s + (Number(item.paidTotal) || 0), 0),
    balance: summaries.reduce((s, item) => s + (Number(item.balance) || 0), 0),
    overdue: summaries.filter((item) => (item.overdueCount || 0) > 0).length,
  }), [summaries]);

  const openDetail = useCallback(async (row) => {
    setSelectedStudent(row);
    setAccountDetail(null);
    if (!row.studentUserId && !row.name) return;
    try {
      setDetailLoading(true);
      const params = row.studentUserId ? { studentUserId: row.studentUserId } : { studentName: row.name };
      const detail = await fetchStudentFinanceAccount(params);
      setAccountDetail(detail || null);
    } catch {
      setAccountDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEnroll = (row) => {
    if (!row) return;
    setEnrollStudent(row);
    setEnrollForm(emptyEnrollForm);
    setEnrollOpen(true);
    // Detay diyalogunu kapat: tek seferde tek diyalog acik olsun.
    setSelectedStudent(null);
    setAccountDetail(null);
  };

  const handleCreateEnrollment = async () => {
    const gross = Number(enrollForm.grossAmount);
    if (!enrollStudent || !Number.isFinite(gross) || gross <= 0) {
      toast({ title: 'Geçerli bir toplam ücret girin.', variant: 'destructive' });
      return;
    }
    try {
      setEnrollSaving(true);
      await createEnrollment({
        studentUserId: enrollStudent.studentUserId || null,
        studentName: enrollStudent.name,
        className: enrollStudent.className && enrollStudent.className !== '-' ? enrollStudent.className : '',
        academicYear: enrollForm.academicYear.trim(),
        grossAmount: gross,
        discountAmount: Number(enrollForm.discountAmount) || 0,
        discountReason: enrollForm.discountReason.trim() || null,
        downPayment: Number(enrollForm.downPayment) || 0,
        installmentCount: Number(enrollForm.installmentCount) || 0,
        firstInstallmentDate: enrollForm.firstInstallmentDate || null,
        currency: 'TRY',
        note: 'Sonradan eklenen sözleşme',
      });
      toast({ title: 'Sözleşme oluşturuldu', description: `${enrollStudent.name} için ücret/taksit planı eklendi.` });
      setEnrollOpen(false);
      setEnrollStudent(null);
      await loadData();
    } catch (err) {
      toast({
        title: 'Sözleşme oluşturulamadı',
        description: err?.response?.data?.message || err?.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setEnrollSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  const payments = Array.isArray(accountDetail?.payments) ? accountDetail.payments : [];
  const enrollPreview = (() => {
    const gross = Number(enrollForm.grossAmount) || 0;
    if (!gross) return null;
    const discount = Math.min(Number(enrollForm.discountAmount) || 0, gross);
    const net = gross - discount;
    const down = Math.min(Number(enrollForm.downPayment) || 0, net);
    const count = Number(enrollForm.installmentCount) || 0;
    const per = count > 0 ? Math.round(((net - down) / count) * 100) / 100 : 0;
    return { net, down, count, per };
  })();

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ogrenci Hesap Defteri</h1>
          <p className="text-sm text-muted-foreground">Ogrenci bazli borc/alacak takibi</p>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-xs text-muted-foreground">Toplam Ogrenci</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-lg font-bold">{formatCurrency(totals.paid)}</p>
              <p className="text-xs text-muted-foreground">Tahsil Edilen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <TrendingUp className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-lg font-bold">{formatCurrency(totals.balance)}</p>
              <p className="text-xs text-muted-foreground">Kalan Borc</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{totals.overdue}</p>
              <p className="text-xs text-muted-foreground">Gecikme Olan</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Ogrenci veya sinif ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tumu</SelectItem>
            <SelectItem value="overdue">Geciken</SelectItem>
            <SelectItem value="unpaid">Borcu Olan</SelectItem>
            <SelectItem value="paid">Tamamlanan</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ogrenci</TableHead>
                  <TableHead>Sinif</TableHead>
                  <TableHead>Toplam Borc</TableHead>
                  <TableHead>Odenen</TableHead>
                  <TableHead>Kalan</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Sonuc bulunamadi.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id || item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.className}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(item.totalDue)}</TableCell>
                      <TableCell className="font-mono text-green-600">{formatCurrency(item.totalPaid)}</TableCell>
                      <TableCell className="font-mono text-orange-600">{formatCurrency(item.balance)}</TableCell>
                      <TableCell>
                        {item.hasOverdue ? (
                          <Badge className="bg-red-100 text-red-700">Gecikme</Badge>
                        ) : item.balance <= 0 ? (
                          <Badge className="bg-green-100 text-green-700">Tamamlandi</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-700">Devam Ediyor</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.totalDue === 0 && item.totalPaid === 0 ? (
                          <Button variant="ghost" size="sm" onClick={() => openEnroll(item)} title="Sözleşme / Ücret Ekle">
                            <FilePlus2 className="h-4 w-4 text-[hsl(var(--brand-accent))]" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => openDetail(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(v) => { if (!v) { setSelectedStudent(null); setAccountDetail(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.name} - Hesap Detayi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-bold">{formatCurrency(selectedStudent?.totalDue)}</p>
                <p className="text-xs text-muted-foreground">Toplam Borc</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                <p className="font-bold text-green-600">{formatCurrency(selectedStudent?.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Odenen</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                <p className="font-bold text-orange-600">{formatCurrency(selectedStudent?.balance)}</p>
                <p className="text-xs text-muted-foreground">Kalan</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Son Odemeler</h4>
              {detailLoading ? (
                <div className="flex justify-center py-6"><LoadingDots /></div>
              ) : payments.length > 0 ? (
                payments.slice(0, 8).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                    <span className="text-muted-foreground">
                      {payment.paidAtUtc ? new Date(payment.paidAtUtc).toLocaleDateString('tr-TR') : '-'}
                      {payment.method ? ` • ${payment.method}` : ''}
                    </span>
                    <span className="font-mono text-green-600">{formatCurrency(payment.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">Bu ogrenci icin odeme kaydi bulunmuyor.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => openEnroll(selectedStudent)}>
              <FilePlus2 className="h-4 w-4 mr-1.5" /> Sözleşme / Ücret Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sözleşme / Ücret Ekleme Dialog */}
      <Dialog open={enrollOpen} onOpenChange={(v) => { setEnrollOpen(v); if (!v) { setEnrollStudent(null); setEnrollForm(emptyEnrollForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sözleşme / Ücret Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{enrollStudent?.name}</span>
              {enrollStudent?.className && enrollStudent.className !== '-' ? ` • ${enrollStudent.className}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Toplam Ücret (₺) *</Label>
                <Input type="number" min="0" value={enrollForm.grossAmount} onChange={(e) => setEnrollForm((p) => ({ ...p, grossAmount: e.target.value }))} placeholder="Örn: 60000" />
              </div>
              <div>
                <Label>İndirim (₺)</Label>
                <Input type="number" min="0" value={enrollForm.discountAmount} onChange={(e) => setEnrollForm((p) => ({ ...p, discountAmount: e.target.value }))} placeholder="Örn: 5000" />
              </div>
              <div className="col-span-2">
                <Label>İndirim Sebebi</Label>
                <Input value={enrollForm.discountReason} onChange={(e) => setEnrollForm((p) => ({ ...p, discountReason: e.target.value }))} placeholder="Kardeş / erken kayıt vb." maxLength={200} />
              </div>
              <div>
                <Label>Peşinat (₺)</Label>
                <Input type="number" min="0" value={enrollForm.downPayment} onChange={(e) => setEnrollForm((p) => ({ ...p, downPayment: e.target.value }))} placeholder="Örn: 10000" />
              </div>
              <div>
                <Label>Taksit Sayısı</Label>
                <Input type="number" min="0" max="48" value={enrollForm.installmentCount} onChange={(e) => setEnrollForm((p) => ({ ...p, installmentCount: e.target.value }))} placeholder="Örn: 10" />
              </div>
              <div>
                <Label>Akademik Yıl</Label>
                <Input value={enrollForm.academicYear} onChange={(e) => setEnrollForm((p) => ({ ...p, academicYear: e.target.value }))} placeholder="2025-2026" maxLength={40} />
              </div>
              <div>
                <Label>İlk Taksit Tarihi</Label>
                <Input type="date" value={enrollForm.firstInstallmentDate} onChange={(e) => setEnrollForm((p) => ({ ...p, firstInstallmentDate: e.target.value }))} />
              </div>
            </div>
            {enrollPreview ? (
              <div className="rounded-lg bg-muted/40 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span>Net: <b>{formatCurrency(enrollPreview.net)}</b></span>
                <span>Peşinat: <b>{formatCurrency(enrollPreview.down)}</b></span>
                {enrollPreview.count > 0 ? <span>{enrollPreview.count} taksit × <b>{formatCurrency(enrollPreview.per)}</b></span> : <span>Taksit yok</span>}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Taksit sayısı boş/0 bırakılırsa kalan tutar tek ödemeli (vadeli) olarak takibe alınır; gecikme ve hatırlatma akışına girer.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>İptal</Button>
            <Button onClick={handleCreateEnrollment} disabled={enrollSaving}>
              {enrollSaving ? 'Kaydediliyor...' : 'Sözleşme Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
