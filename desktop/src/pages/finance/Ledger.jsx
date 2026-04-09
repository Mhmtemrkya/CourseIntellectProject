import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Search, DollarSign, Users, TrendingUp, AlertCircle,
  ChevronDown, ChevronRight, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchStudents, fetchAccountingDashboard } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
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

function parseAmount(value) {
  const normalized = String(value ?? '0')
    .replaceAll('₺', '')
    .replaceAll('.', '')
    .replaceAll(',', '')
    .trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function Ledger() {
  const [students, setStudents] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentData, dashData] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchAccountingDashboard().catch(() => ({})),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setDashboard(dashData || {});
    } catch (err) {
      setError(err.message || 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const collections = useMemo(() => {
    const list = dashboard?.recentCollections || dashboard?.collections || [];
    return Array.isArray(list) ? list : [];
  }, [dashboard]);

  const installments = useMemo(() => {
    const list = dashboard?.installments || [];
    return Array.isArray(list) ? list : [];
  }, [dashboard]);

  // Build student ledger from collections and installments
  const ledger = useMemo(() => {
    const fallbackNames = new Set([
      ...collections.map((c) => c?.name).filter(Boolean),
      ...installments.map((i) => i?.student).filter(Boolean),
    ]);
    const sourceStudents = students.length > 0
      ? students
      : Array.from(fallbackNames).map((name, index) => ({
        id: `ledger-${index}`,
        fullName: name,
        className: '-',
      }));

    return sourceStudents.map((s) => {
      const name = s.fullName || s.name || '';
      const normalizedFullName = normalizeLedgerKey(name);
      const normalizedUsername = normalizeLedgerKey(s.username || '');
      const studentCollections = collections.filter((c) => {
        const candidate = normalizeLedgerKey(c.name);
        return candidate && (candidate === normalizedFullName || candidate === normalizedUsername);
      });
      const studentInstallments = installments.filter((i) => {
        const candidate = normalizeLedgerKey(i.student);
        return candidate && (candidate === normalizedFullName || candidate === normalizedUsername);
      });
      const totalPaid = studentCollections.reduce((sum, c) => sum + parseAmount(c.amount), 0);
      const totalDue = studentInstallments.reduce((sum, i) => sum + parseAmount(i.amount), 0);
      const balance = totalDue - totalPaid;
      const hasOverdue = studentInstallments.some((i) => {
        const due = new Date(i.due || i.dueDate || i.date);
        const status = String(i.status || '').toLowerCase();
        return status.includes('gecik') || status.includes('overdue') || due < new Date();
      });
      return {
        id: s.id,
        name,
        className: s.className || s.class || '-',
        totalDue,
        totalPaid,
        balance,
        hasOverdue,
        collections: studentCollections,
        installments: studentInstallments,
      };
    });
  }, [students, collections, installments]);

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

  const totals = useMemo(() => ({
    due: ledger.reduce((s, l) => s + l.totalDue, 0),
    paid: ledger.reduce((s, l) => s + l.totalPaid, 0),
    balance: ledger.reduce((s, l) => s + l.balance, 0),
    overdue: ledger.filter((l) => l.hasOverdue).length,
  }), [ledger]);

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

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
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(item)}>
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
      <Dialog open={!!selectedStudent} onOpenChange={(v) => !v && setSelectedStudent(null)}>
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
            {selectedStudent?.collections?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Son Odemeler</h4>
                {selectedStudent.collections.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm border-b last:border-0">
                    <span>{c.date ? new Date(c.date).toLocaleDateString('tr-TR') : '-'}</span>
                    <span className="font-mono text-green-600">{formatCurrency(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
