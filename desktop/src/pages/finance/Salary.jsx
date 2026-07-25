import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Plus, Search, DollarSign, Users, Calendar, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
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

const deductionFields = [
  ['sgkEmployee', 'SGK İşçi'],
  ['unemploymentEmployee', 'İşsizlik İşçi'],
  ['incomeTax', 'Gelir Vergisi'],
  ['stampTax', 'Damga Vergisi'],
];

const numericPayroll = (payroll, key) => Math.max(0, Number(payroll?.[key]) || 0);

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
  const [customItems, setCustomItems] = useState([]);
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
      setCustomItems([]);
    } catch (err) {
      toast({ title: 'Bordro hesaplanamadı', description: err.message, variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const startManualPayroll = () => {
    const gross = Number(form.amount);
    if (!gross || gross <= 0) {
      toast({ title: 'Önce geçerli bir brüt maaş girin.', variant: 'destructive' });
      return;
    }
    setPayroll({
      gross,
      sgkEmployee: 0,
      unemploymentEmployee: 0,
      incomeTax: 0,
      stampTax: 0,
      sgkEmployer: 0,
      totalEmployerCost: gross,
    });
    setCustomItems([]);
  };

  const updatePayrollField = (key, value) => {
    setPayroll((current) => ({ ...current, [key]: value }));
  };

  const addCustomItem = () => {
    setCustomItems((items) => [...items, {
      id: `${Date.now()}-${items.length}`,
      label: '',
      type: 'deduction',
      amount: '',
    }]);
  };

  const updateCustomItem = (id, patch) => {
    setCustomItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const payrollTotals = useMemo(() => {
    if (!payroll) return null;
    const gross = numericPayroll(payroll, 'gross');
    const legalDeductions = deductionFields.reduce((sum, [key]) => sum + numericPayroll(payroll, key), 0);
    const additions = customItems
      .filter((item) => item.type === 'addition')
      .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
    const deductions = customItems
      .filter((item) => item.type === 'deduction')
      .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
    return {
      gross,
      additions,
      deductions,
      net: Math.max(0, gross + additions - legalDeductions - deductions),
    };
  }, [customItems, payroll]);

  const resetForm = () => {
    setForm({ staffName: '', amount: '', month: String(new Date().getMonth()), year: String(new Date().getFullYear()), notes: '' });
    setPayroll(null);
    setCustomItems([]);
  };

  const handleCreate = async () => {
    if (!form.staffName || !form.amount) {
      toast({ title: 'Personel ve brüt maaş zorunludur.', variant: 'destructive' });
      return;
    }
    if (customItems.some((item) => Number(item.amount) > 0 && !item.label.trim())) {
      toast({ title: 'Tutar girilen özel bordro kalemlerine ad verin.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const selectedStaff = staff.find((item) => item.fullName === form.staffName);
      const payDate = `${form.year}-${String(Number(form.month) + 1).padStart(2, '0')}-01`;
      const customSummary = customItems
        .filter((item) => item.label.trim() && Number(item.amount) > 0)
        .map((item) => `${item.label.trim()}: ${item.type === 'addition' ? '+' : '-'}${formatCurrency(Number(item.amount))}`)
        .join(', ');
      const breakdownNote = payroll && payrollTotals
        ? `Brüt ${formatCurrency(payrollTotals.gross)} → Net ${formatCurrency(payrollTotals.net)} (SGK ${formatCurrency(numericPayroll(payroll, 'sgkEmployee'))}, İşsizlik ${formatCurrency(numericPayroll(payroll, 'unemploymentEmployee'))}, Gelir V. ${formatCurrency(numericPayroll(payroll, 'incomeTax'))}, Damga ${formatCurrency(numericPayroll(payroll, 'stampTax'))}${customSummary ? `; Özel kalemler: ${customSummary}` : ''})`
        : '';
      await createSalary({
        employee: form.staffName,
        role: selectedStaff?.primaryRole || 'Personel',
        amount: form.amount,
        payDate,
        reason: [form.notes.trim(), breakdownNote].filter(Boolean).join(' — ')
          || `${months[Number(form.month)]} ${form.year} bordrosu`,
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
            <FeatureGate module="salary" action="define">
              <Button><Plus className="h-4 w-4 mr-1" /> Maas Kaydi Ekle</Button>
            </FeatureGate>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Maas Kaydi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Personel *</Label>
                <Select value={form.staffName} onValueChange={(v) => setForm((p) => ({ ...p, staffName: v }))}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
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
                <Button type="button" variant="ghost" size="sm" className="mt-1 px-0" onClick={startManualPayroll}>
                  Manuel bordro kırılımı oluştur
                </Button>
              </div>

              {payroll && payrollTotals ? (
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4 text-sm">
                  <div>
                    <p className="font-semibold">Düzenlenebilir Bordro Kırılımı</p>
                    <p className="text-xs text-muted-foreground">Otomatik değerleri değiştirebilir, yeni ek ödeme veya kesinti kalemi ekleyebilirsiniz.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {deductionFields.map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`payroll-${key}`}>{label} (TL)</Label>
                        <Input
                          id={`payroll-${key}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={payroll[key] ?? ''}
                          onChange={(event) => updatePayrollField(key, event.target.value)}
                        />
                      </div>
                    ))}
                    <div>
                      <Label htmlFor="payroll-sgk-employer">SGK İşveren (TL)</Label>
                      <Input
                        id="payroll-sgk-employer"
                        type="number"
                        min="0"
                        step="0.01"
                        value={payroll.sgkEmployer ?? ''}
                        onChange={(event) => updatePayrollField('sgkEmployer', event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payroll-employer-cost">Toplam İşveren Maliyeti (TL)</Label>
                      <Input
                        id="payroll-employer-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={payroll.totalEmployerCost ?? ''}
                        onChange={(event) => updatePayrollField('totalEmployerCost', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {customItems.map((item) => (
                      <div key={item.id} className="grid gap-2 rounded-lg border bg-background/70 p-2 sm:grid-cols-[1fr_130px_120px_auto]">
                        <Input
                          aria-label="Özel bordro kalemi adı"
                          placeholder="Kalem adı (prim, avans...)"
                          value={item.label}
                          onChange={(event) => updateCustomItem(item.id, { label: event.target.value })}
                        />
                        <Select value={item.type} onValueChange={(value) => updateCustomItem(item.id, { type: value })}>
                          <SelectTrigger aria-label="Kalem türü"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="addition">Ek ödeme</SelectItem>
                            <SelectItem value="deduction">Kesinti</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          aria-label="Özel bordro kalemi tutarı"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Tutar"
                          value={item.amount}
                          onChange={(event) => updateCustomItem(item.id, { amount: event.target.value })}
                        />
                        <Button type="button" variant="ghost" size="icon" aria-label="Kalemi kaldır" onClick={() => setCustomItems((items) => items.filter((entry) => entry.id !== item.id))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addCustomItem}>
                      <Plus className="mr-1.5 h-4 w-4" />Özel Kalem Ekle
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3">
                    <span className="text-muted-foreground">Brüt Maaş</span><span className="text-right tabular-nums">{formatCurrency(payrollTotals.gross)}</span>
                    <span className="text-muted-foreground">Ek Ödemeler</span><span className="text-right tabular-nums text-blue-600">+{formatCurrency(payrollTotals.additions)}</span>
                    <span className="text-muted-foreground">Özel Kesintiler</span><span className="text-right tabular-nums text-red-600">-{formatCurrency(payrollTotals.deductions)}</span>
                    <span className="font-bold">Net Maaş (Ele Geçen)</span><span className="text-right font-bold tabular-nums text-emerald-600">{formatCurrency(payrollTotals.net)}</span>
                    <span className="text-muted-foreground">Toplam İşveren Maliyeti</span><span className="text-right tabular-nums">{formatCurrency(numericPayroll(payroll, 'totalEmployerCost'))}</span>
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
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
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
              <p className="text-xs text-muted-foreground">Mevcut Dönem</p>
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
                  <TableHead>Dönem</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {salaries.length === 0 ? 'Henüz maaş kaydı yok.' : 'Sonuç bulunamadı.'}
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
