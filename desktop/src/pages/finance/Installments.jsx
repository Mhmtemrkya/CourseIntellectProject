import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Calendar, CheckCircle, Clock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
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
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createInstallment, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function statusKey(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('gec')) return 'overdue';
  if (normalized.includes('odendi')) return 'completed';
  return 'current';
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
  const [statusFilter, setStatusFilter] = useState('all');
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
  const filteredPlans = useMemo(() => plans.filter((plan) => {
    const matchesSearch = String(plan.student || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || statusKey(plan.status) === statusFilter;
    return matchesSearch && matchesStatus;
  }), [plans, search, statusFilter]);

  const getStatusBadge = (status) => {
    const key = statusKey(status);
    const config = {
      current: { label: 'Güncel', icon: Clock, className: 'bg-yellow-100 text-yellow-700' },
      overdue: { label: 'Gecikmiş', icon: AlertCircle, className: 'bg-red-100 text-red-700' },
      completed: { label: 'Tamamlandı', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
    };
    const { label, icon: Icon, className } = config[key];
    return (
      <Badge className={`${className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const stats = useMemo(() => ({
    completed: plans.filter((item) => statusKey(item.status) === 'completed').length,
    current: plans.filter((item) => statusKey(item.status) === 'current').length,
    overdue: plans.filter((item) => statusKey(item.status) === 'overdue').length,
  }), [plans]);

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
          <p className="text-muted-foreground mt-1">{plans.length} kayıt</p>
        </div>
        <Button
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="current">Güncel</SelectItem>
                <SelectItem value="overdue">Gecikmiş</SelectItem>
                <SelectItem value="completed">Tamamlanan</SelectItem>
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
                <TableHead>Tutar</TableHead>
                <TableHead>İlerleme</TableHead>
                <TableHead>Vade</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => {
                const status = statusKey(plan.status);
                const progress = status === 'completed' ? 100 : status === 'overdue' ? 35 : 70;
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
                    <TableCell>₺{parseMoney(plan.amount).toLocaleString('tr-TR')}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={progress} className="w-24 h-2" />
                        <span className="text-xs text-muted-foreground">%{progress}</span>
                      </div>
                    </TableCell>
                    <TableCell>{plan.due}</TableCell>
                    <TableCell>{getStatusBadge(plan.status)}</TableCell>
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
