import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Calendar, CheckCircle, Clock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createInstallment, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';
import { formatCurrency, normalizeFinanceText, parseFinanceMoney } from '../../lib/financeDocuments';
import { StatusBadge } from '../../components/ui/status-badge';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

function parseMoney(value) {
  return parseFinanceMoney(value);
}

const monthOptions = [
  { value: 'all', label: 'Tüm Aylar' },
  ...Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Date(2026, index, 1).toLocaleDateString('tr-TR', { month: 'long' }),
  })),
];

function parseFinanceDate(value) {
  if (!value) return null;
  const raw = String(value);
  const trMatch = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (trMatch) {
    const [, day, month, year] = trMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function monthMatches(value, monthFilter) {
  if (monthFilter === 'all') return true;
  const date = parseFinanceDate(value);
  return date ? date.getMonth() + 1 === Number(monthFilter) : false;
}

function statusKey(status) {
  const normalized = normalizeFinanceText(status);
  if (normalized.includes('gec')) return 'overdue';
  if (normalized.includes('odendi') || normalized.includes('paid') || normalized.includes('completed')) return 'completed';
  return 'current';
}

// Vade tarihi geçmiş ve ödenmemiş taksitleri de gecikmiş sayar.
function effectiveStatus(plan) {
  const key = statusKey(plan.status);
  if (key === 'completed' || key === 'overdue') return key;
  const due = parseFinanceDate(plan.dueDate || plan.due);
  return due && due.getTime() < Date.now() ? 'overdue' : 'current';
}

function CreatePlanDialog({
  open, onOpenChange, students, onCreated,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentKey: '',
    amount: '',
    due: new Date().toISOString().slice(0, 10),
    note: '',
  });

  useEffect(() => {
    if (!open) {
      setForm({
        studentKey: '',
        amount: '',
        due: new Date().toISOString().slice(0, 10),
        note: '',
      });
    }
  }, [open]);

  const selectedStudent = useMemo(
    () => students.find((student) => (student.username || student.fullName) === form.studentKey),
    [students, form.studentKey],
  );

  const handleSave = async () => {
    if (!selectedStudent || !form.amount || !form.due) {
      toast({
        title: 'Eksik bilgi',
        description: 'Öğrenci, tutar ve vade zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createInstallment({
        student: selectedStudent.fullName,
        amount: form.amount,
        due: form.due,
        note: form.note || 'Masaüstü panelden oluşturuldu',
      });
      onCreated(created);
      toast({
        title: 'Taksit oluşturuldu',
        description: 'Yeni kayıt backend’e işlendi.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Taksit oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Taksit</DialogTitle>
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
              <Label>Vade</Label>
              <Input type="date" value={form.due} onChange={(e) => setForm((prev) => ({ ...prev, due: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Not</Label>
            <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Taksit Oluştur'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Installments() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(err.message || 'Taksit verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const plans = useMemo(() => dashboard?.installments || [], [dashboard]);
  // Öğrenci adı → {sınıf, şube} eşlemesi (sınıf/şube filtreleri için).
  const studentMeta = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      map.set(String(s.fullName || '').toLowerCase(), { className: s.className || '', branchName: s.branchName || s.branch || '' });
    });
    return map;
  }, [students]);
  const classes = useMemo(() => [...new Set(students.map((s) => s.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [students]);
  const branches = useMemo(() => [...new Set(students.map((s) => s.branchName || s.branch).filter(Boolean))], [students]);

  const filteredPlans = useMemo(() => plans.filter((plan) => {
    const meta = studentMeta.get(String(plan.student || '').toLowerCase()) || {};
    const matchesSearch = String(plan.student || '').toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || meta.className === classFilter;
    const matchesBranch = branchFilter === 'all' || meta.branchName === branchFilter;
    const matchesStatus = statusFilter === 'all' || effectiveStatus(plan) === statusFilter;
    const matchesMonth = monthMatches(plan.dueDate || plan.due, monthFilter);
    return matchesSearch && matchesClass && matchesBranch && matchesStatus && matchesMonth;
  }), [monthFilter, plans, search, classFilter, branchFilter, statusFilter, studentMeta]);

  const getStatusBadge = (plan) => {
    const key = effectiveStatus(plan);
    // Etiket ve ton ortak sözlükten gelir; ikon plana özgüdür.
    const icons = { current: Clock, overdue: AlertCircle, completed: CheckCircle };
    const labels = { current: 'Güncel', overdue: 'Gecikti', completed: 'Tamamlandı' };
    const tones = { current: 'warning', overdue: 'danger', completed: 'success' };
    const Icon = icons[key];
    return (
      <StatusBadge status={labels[key]} tone={tones[key]}>
        <Icon className="h-3 w-3" />
        {labels[key]}
      </StatusBadge>
    );
  };

  const stats = useMemo(() => ({
    completed: filteredPlans.filter((item) => effectiveStatus(item) === 'completed').length,
    current: filteredPlans.filter((item) => effectiveStatus(item) === 'current').length,
    overdue: filteredPlans.filter((item) => effectiveStatus(item) === 'overdue').length,
  }), [filteredPlans]);

  const handleCreated = (created) => {
    setDashboard((prev) => ({
      ...prev,
      installments: [created, ...(prev?.installments || [])],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Taksit planları yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="installments-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Taksit Planları</h1>
          <p className="text-muted-foreground mt-1">
            {filteredPlans.length} kayıt gösteriliyor • Toplam {plans.length} taksit
          </p>
        </div>
        <FeatureGate module="installments" action="plan-create">
          <Button
            className="bg-brand-primary hover:bg-brand-primary/90"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni Plan
          </Button>
        </FeatureGate>
      </div>

      {error ? <ErrorBanner title="Taksit planları alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Tamamlanan</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.current}</p>
              <p className="text-xs text-muted-foreground">Devam Eden</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Gecikmiş</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öğrenci ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-36">
                <SelectValue placeholder="Sınıf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
              </SelectContent>
            </Select>
            {branches.length > 0 ? (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder="Şube" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="current">Güncel</SelectItem>
                <SelectItem value="overdue">Gecikti</SelectItem>
                <SelectItem value="completed">Tamamlanan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Ay seçin" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => {
                const meta = studentMeta.get(String(plan.student || '').toLowerCase()) || {};
                return (
                  <TableRow
                    key={plan.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate('/finance/collection-calendar')}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{plan.student}</p>
                        <p className="text-sm text-muted-foreground">{plan.note}</p>
                      </div>
                    </TableCell>
                    <TableCell>{meta.className ? <Badge variant="outline">{meta.className}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{formatCurrency(parseMoney(plan.amount))}</TableCell>
                    <TableCell>{plan.due || plan.dueDate}</TableCell>
                    <TableCell>{getStatusBadge(plan)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreatePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        students={students}
        onCreated={handleCreated}
      />
    </motion.div>
  );
}
