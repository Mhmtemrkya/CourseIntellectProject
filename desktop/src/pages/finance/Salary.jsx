import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Plus, Search, DollarSign, Users, Calendar, CheckCircle, Clock,
  Download, Edit, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchStaff, createSalary, fetchAccountingDashboard, calculatePayroll } from '../../lib/api/modules';
import { parseFinanceMoney } from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const months = [
  'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
  'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

function formatCurrency(val) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
}

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function normalizeSalaryStatus(status = '') {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('öd') || normalized.includes('oden') || normalized.includes('paid')) return 'Ödendi';
  if (normalized.includes('redd') || normalized.includes('rejected')) return 'Reddedildi';
  if (normalized.includes('plan')) return 'Planlandı';
  return 'Bekliyor';
}

export default function Salary() {
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth()));
  const [payroll, setPayroll] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const [form, setForm] = useState({
    staffName: '',
    amount: '',
    month: String(new Date().getMonth()),
    year: String(new Date().getFullYear()),
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffData, dashData] = await Promise.all([
        fetchStaff().catch(() => []),
        fetchAccountingDashboard().catch(() => ({})),
      ]);
      setStaff(Array.isArray(staffData) ? staffData : []);

      // Extract salary data from dashboard if available
      const salaryList = dashData?.salaries || dashData?.staffSalaries || [];
      setSalaries(Array.isArray(salaryList) ? salaryList : []);
    } catch (err) {
      setError(err.message || 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = salaries;
    if (filterMonth !== 'all') {
      list = list.filter((s) => {
        const payDate = new Date(s.payDate || '');
        return !Number.isNaN(payDate.getTime()) && payDate.getMonth() === Number(filterMonth);
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => `${s.employee || ''} ${s.role || ''}`.toLowerCase().includes(q));
    }
    return list;
  }, [filterMonth, salaries, search]);

  const totalSalary = useMemo(
    () => filtered.reduce((sum, s) => sum + parseMoney(s.amount), 0),
    [filtered],
  );

  const handleCalculate = async () => {
    const gross = Number(form.amount);
    if (!gross || gross <= 0) {
      toast({ title: 'Geçerli bir brüt maaş girin.', variant: 'destructive' });
      return;
    }
    try {
      setCalculating(true);
      const result = await calculatePayroll({ grossSalary: gross, employee: form.staffName || null, year: Number(form.year) || null });
      setPayroll(result);
    } catch (err) {
      toast({ title: 'Bordro hesaplanamadı', description: err.message, variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const resetForm = () => {
    setForm({ staffName: '', amount: '', month: String(new Date().getMonth()), year: String(new Date().getFullYear()), notes: '' });
    setPayroll(null);
  };

  const handleCreate = async () => {
    if (!form.staffName || !form.amount) {
      toast({ title: 'Personel ve brüt maaş zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const selectedStaff = staff.find((item) => item.fullName === form.staffName);
      const payDate = `${form.year}-${String(Number(form.month) + 1).padStart(2, '0')}-01`;
      const breakdownNote = payroll
        ? `Brüt ${formatCurrency(payroll.gross)} → Net ${formatCurrency(payroll.net)} (SGK ${formatCurrency(payroll.sgkEmployee)}, Gelir V. ${formatCurrency(payroll.incomeTax)}, Damga ${formatCurrency(payroll.stampTax)})`
        : '';
      await createSalary({
        employee: form.staffName,
        role: selectedStaff?.primaryRole || 'Personel',
        amount: form.amount,
        payDate,
        reason: form.notes || breakdownNote || `${months[Number(form.month)]} ${form.year} bordrosu`,
      });
      toast({ title: 'Maaş/bordro kaydı oluşturuldu.' });
      setOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast({ title: err.message || 'Maaş kaydı oluşturulamadı.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Maas Yonetimi</h1>
            <p className="text-sm text-muted-foreground">Personel maas takibi ve odemeler</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Maas Kaydi Ekle</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Maas Kaydi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Personel *</Label>
                <Select value={form.staffName} onValueChange={(v) => setForm((p) => ({ ...p, staffName: v }))}>
                  <SelectTrigger><SelectValue placeholder="Personel secin" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id || s.fullName} value={s.fullName}>{s.fullName} ({s.primaryRole || 'Personel'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ay</Label>
                  <Select value={form.month} onValueChange={(v) => setForm((p) => ({ ...p, month: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Yil</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Brüt Maaş (TL) *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => { setForm((p) => ({ ...p, amount: e.target.value })); setPayroll(null); }}
                  />
                  <Button type="button" variant="outline" onClick={handleCalculate} disabled={calculating}>
                    {calculating ? 'Hesaplanıyor...' : 'Bordro Hesapla'}
                  </Button>
                </div>
              </div>

              {payroll ? (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 font-semibold">Bordro Kırılımı (TR 2025 yaklaşık)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <span className="text-muted-foreground">Brüt Maaş</span><span className="text-right tabular-nums">{formatCurrency(payroll.gross)}</span>
                    <span className="text-muted-foreground">SGK İşçi (%14)</span><span className="text-right tabular-nums text-red-600">-{formatCurrency(payroll.sgkEmployee)}</span>
                    <span className="text-muted-foreground">İşsizlik İşçi (%1)</span><span className="text-right tabular-nums text-red-600">-{formatCurrency(payroll.unemploymentEmployee)}</span>
                    <span className="text-muted-foreground">Gelir Vergisi</span><span className="text-right tabular-nums text-red-600">-{formatCurrency(payroll.incomeTax)}</span>
                    <span className="text-muted-foreground">Damga Vergisi</span><span className="text-right tabular-nums text-red-600">-{formatCurrency(payroll.stampTax)}</span>
                    <span className="font-bold border-t pt-1.5">Net Maaş (Ele Geçen)</span><span className="text-right font-bold tabular-nums text-emerald-600 border-t pt-1.5">{formatCurrency(payroll.net)}</span>
                    <span className="text-muted-foreground">SGK İşveren</span><span className="text-right tabular-nums">{formatCurrency(payroll.sgkEmployer)}</span>
                    <span className="font-semibold">Toplam İşveren Maliyeti</span><span className="text-right font-semibold tabular-nums">{formatCurrency(payroll.totalEmployerCost)}</span>
                  </div>
                </div>
              ) : null}

              <div>
                <Label>Notlar</Label>
                <Input
                  placeholder="Ek bilgi..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Iptal</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{staff.length}</p>
              <p className="text-xs text-muted-foreground">Toplam Personel</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalSalary)}</p>
              <p className="text-xs text-muted-foreground">Toplam Maas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{months[new Date().getMonth()]}</p>
              <p className="text-xs text-muted-foreground">Mevcut Donem</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Personel ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ay filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tum Aylar</SelectItem>
            {months.map((month, index) => (
              <SelectItem key={month} value={String(index)}>{month}</SelectItem>
            ))}
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
                  <TableHead>Personel</TableHead>
                  <TableHead>Donem</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {salaries.length === 0 ? 'Henuz maas kaydi yok.' : 'Sonuc bulunamadi.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s, idx) => (
                    <TableRow key={s.id || idx}>
                      <TableCell className="font-medium">{s.employee || '-'}</TableCell>
                      <TableCell>{s.payDate || '-'}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(parseMoney(s.amount))}</TableCell>
                      <TableCell>
                        <Badge className={normalizeSalaryStatus(s.status) === 'Ödendi' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {normalizeSalaryStatus(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{s.role || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
