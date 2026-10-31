import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney as formatCurrency } from '../../lib/format';
import { motion, type Variants } from 'framer-motion';
import {
  Wallet, Plus, Search, DollarSign, Users, Calendar, CheckCircle2,
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
import { fetchStaff, createSalary, fetchAccountingDashboard, paySalary } from '../../lib/api/modules';
import { parseFinanceMoney } from '../../lib/financeDocuments';
import { errorMessage } from '../../lib/errors';
import type { AccountingSalaryDto, StaffSummaryDto } from '../../types/api/generated';

interface SalaryForm {
  staffName: string;
  amount: string;
  month: string;
  year: string;
  notes: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const months = [
  'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
  'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

function parseMoney(value: unknown): number {
  return parseFinanceMoney(value);
}

function statusClass(status: string): string {
  if (status === 'Ödendi') return 'bg-green-100 text-green-700';
  if (status === 'Planlandı') return 'bg-blue-100 text-blue-700';
  if (status === 'Reddedildi') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

function normalizeSalaryStatus(status: string = ''): string {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('öd') || normalized.includes('oden') || normalized.includes('paid')) return 'Ödendi';
  if (normalized.includes('redd') || normalized.includes('rejected')) return 'Reddedildi';
  if (normalized.includes('plan')) return 'Planlandı';
  return 'Bekliyor';
}

export default function Salary() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffSummaryDto[]>([]);
  const [salaries, setSalaries] = useState<AccountingSalaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth()));
  // Ödeme kaydı: yalnız yönetici onaylı (Planlandı) bordro için.
  const [payTarget, setPayTarget] = useState<AccountingSalaryDto | null>(null);
  const [payMethod, setPayMethod] = useState('Havale');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paying, setPaying] = useState(false);

  const [form, setForm] = useState<SalaryForm>({
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
        fetchStaff().catch(() => null),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setStaff(Array.isArray(staffData) ? staffData : []);

      // Extract salary data from dashboard if available
      const salaryList = dashData?.salaries || [];
      setSalaries(Array.isArray(salaryList) ? salaryList : []);
    } catch (err) {
      setError(errorMessage(err, 'Veriler yuklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

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

  const resetForm = () => {
    setForm({ staffName: '', amount: '', month: String(new Date().getMonth()), year: String(new Date().getFullYear()), notes: '' });
  };

  const handlePay = async () => {
    if (!payTarget) return;
    try {
      setPaying(true);
      // Seçilen gün öğle saatiyle gönderilir; saat dilimi kayması günü değiştirmesin.
      const paidAtUtc = new Date(`${payDate}T12:00:00`).toISOString();
      await paySalary(payTarget.id, { paymentMethod: payMethod, paidAtUtc });
      toast({ title: 'Maaş ödemesi kaydedildi.' });
      setPayTarget(null);
      void loadData();
    } catch (err) {
      toast({ title: errorMessage(err, 'Ödeme kaydedilemedi.'), variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const handleCreate = async () => {
    if (!form.staffName || !(Number(form.amount) > 0)) {
      toast({ title: 'Personel ve maaş tutarı zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const selectedStaff = staff.find((item) => item.fullName === form.staffName);
      const payDate = `${form.year}-${String(Number(form.month) + 1).padStart(2, '0')}-01`;
      await createSalary({
        employee: form.staffName,
        // Personel özetinde rol 'role' alanındadır (eskiden olmayan primaryRole okunup hep 'Personel' gidiyordu).
        role: selectedStaff?.role || 'Personel',
        amount: form.amount,
        payDate,
        reason: form.notes.trim() || `${months[Number(form.month)]} ${form.year} bordrosu`,
      });
      toast({ title: 'Maaş/bordro kaydı oluşturuldu.' });
      setOpen(false);
      resetForm();
      void loadData();
    } catch (err) {
      toast({ title: errorMessage(err, 'Maaş kaydı oluşturulamadı.'), variant: 'destructive' });
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
            <h1 className="text-2xl font-bold">Maaş Yönetimi</h1>
            <p className="text-sm text-muted-foreground">Personel maaş takibi ve ödemeler</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
          <DialogTrigger asChild>
            <FeatureGate module="salary" action="define">
              <Button><Plus className="h-4 w-4 mr-1" /> Maaş Kaydı Ekle</Button>
            </FeatureGate>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Maaş Kaydı</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Personel *</Label>
                <Select value={form.staffName} onValueChange={(v) => setForm((p) => ({ ...p, staffName: v }))}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id || s.fullName} value={s.fullName}>{s.fullName} ({s.role || 'Personel'})</SelectItem>
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
                <Label htmlFor="salary-amount">Maaş Tutarı (TL) *</Label>
                <Input
                  id="salary-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Personele ödenecek tutar"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Kayıt yönetici onayına gider; onaylanınca ödeme kaydedilebilir.</p>
              </div>

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
              <p className="text-xs text-muted-foreground">Toplam Maaş</p>
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
                  <TableHead className="text-right">Ödeme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        <Badge className={statusClass(normalizeSalaryStatus(s.status))}>
                          {normalizeSalaryStatus(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{s.role || '-'}</TableCell>
                      <TableCell className="text-right">
                        {normalizeSalaryStatus(s.status) === 'Ödendi' ? (
                          <span className="text-xs text-muted-foreground">
                            {s.paidAtUtc ? new Date(s.paidAtUtc).toLocaleDateString('tr-TR') : ''}{s.paymentMethod ? ` • ${s.paymentMethod}` : ''}
                          </span>
                        ) : normalizeSalaryStatus(s.status) === 'Planlandı' ? (
                          <FeatureGate module="salary" action="define">
                            <Button size="sm" variant="outline" onClick={() => setPayTarget(s)}>
                              <CheckCircle2 className="mr-1 h-4 w-4" />Ödendi Kaydet
                            </Button>
                          </FeatureGate>
                        ) : (
                          <span className="text-xs text-muted-foreground">{normalizeSalaryStatus(s.status) === 'Bekliyor' ? 'Yönetici onayı bekliyor' : '-'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={payTarget !== null} onOpenChange={(value) => { if (!value) setPayTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Maaş Ödemesini Kaydet</DialogTitle>
          </DialogHeader>
          {payTarget ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {payTarget.employee} • {formatCurrency(parseMoney(payTarget.amount))}. Ödeme gider ve kasaya bu tarihte yazılır.
              </p>
              <div>
                <Label>Ödeme Yöntemi</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Havale">Havale/EFT</SelectItem>
                    <SelectItem value="Nakit">Nakit</SelectItem>
                    <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="salary-paid-date">Ödeme Tarihi</Label>
                <Input id="salary-paid-date" type="date" value={payDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPayDate(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Vazgeç</Button>
            <Button onClick={handlePay} disabled={paying}>{paying ? 'Kaydediliyor...' : 'Ödendi Kaydet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
