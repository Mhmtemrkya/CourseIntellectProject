import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, CreditCard, Banknote, Building2,
  Receipt, Download, Pencil, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createCollection, deleteCollection, fetchAccountingDashboard, fetchStudents, updateCollection } from '../../lib/api/modules';
import {
  buildFinanceDocumentHtml,
  downloadCsvRows,
  downloadFinanceHtml,
  formatCurrency,
  normalizeFinanceText,
  parseFinanceMoney,
} from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const paymentTypes = [
  { value: 'Nakit', label: 'Nakit', icon: Banknote },
  { value: 'Kredi Karti', label: 'Kredi Kartı', icon: CreditCard },
  { value: 'Havale/EFT', label: 'Havale/EFT', icon: Building2 },
  { value: 'İade', label: 'İade', icon: Receipt },
];

const monthOptions = [
  { value: 'all', label: 'Tüm Aylar' },
  ...Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Date(2026, index, 1).toLocaleDateString('tr-TR', { month: 'long' }),
  })),
];

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function parseFinanceDate(value) {
  if (!value) return null;
  const raw = String(value);
  const trMatch = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (trMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = trMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
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

function plannedCollectionAmount(plan) {
  const remainingMatch = String(plan.note || '').match(/Kalan\s+(.+)$/i);
  if (remainingMatch) {
    return parseMoney(remainingMatch[1]);
  }
  const status = normalizeFinanceText(plan.status);
  if (status.includes('odendi') || status.includes('paid') || status.includes('completed')) {
    return 0;
  }
  return parseMoney(plan.amount);
}

function normalizePaymentMethod(value) {
  const normalized = normalizeFinanceText(value);

  if (normalized.includes('nakit') || normalized.includes('cash')) return 'Nakit';
  if (normalized.includes('kart') || normalized.includes('card') || normalized.includes('pos')) return 'Kredi Karti';
  if (normalized.includes('havale') || normalized.includes('eft') || normalized.includes('banka') || normalized.includes('transfer')) return 'Havale/EFT';
  if (normalized.includes('iade') || normalized.includes('refund')) return 'İade';
  return value || 'Nakit';
}

function NewCollectionDialog({
  open, onOpenChange, students, onCreated, initialCollection = null, mode = 'create',
}) {
  const { toast } = useToast();
  const { user } = useApp();
  const collectorName = user?.name || user?.username || 'Ben';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentKey: '',
    paymentType: 'Nakit',
    amount: '',
    note: '',
  });

  const selectedStudent = useMemo(
    () => students.find((student) => student.fullName === form.studentKey)
      || (initialCollection && form.studentKey === initialCollection.name
        ? { fullName: initialCollection.name, className: initialCollection.className }
        : null),
    [students, form.studentKey, initialCollection],
  );

  useEffect(() => {
    if (!open) return;
    setForm({
      studentKey: initialCollection ? (initialCollection.name || '') : '',
      paymentType: normalizePaymentMethod(initialCollection?.method || 'Nakit'),
      amount: initialCollection ? String(parseMoney(initialCollection.amount)) : '',
      note: initialCollection?.note || '',
    });
  }, [open, initialCollection]);

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
      const payload = {
        name: selectedStudent.fullName,
        className: selectedStudent.className || 'Belirtilmedi',
        amount: form.amount,
        method: form.paymentType,
        note: form.note || 'Manuel tahsilat',
        // Ödemenin doğru öğrencinin taksitlerine mahsubu için id (ad eşleşmesine düşmesin).
        studentUserId: selectedStudent.userId || undefined,
      };
      const created = mode === 'edit' && initialCollection?.id
        ? await updateCollection(initialCollection.id, payload)
        : await createCollection(payload);
      onCreated(created);
      toast({
        title: mode === 'edit' ? 'Tahsilat güncellendi' : 'Tahsilat kaydedildi',
        description: mode === 'edit' ? 'Tahsilat kaydı güncellendi.' : 'Tahsilat backend’e işlendi.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Tahsilat kaydedilemedi',
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
          <DialogTitle>{mode === 'edit' ? 'Tahsilatı Güncelle' : 'Yeni Tahsilat'}</DialogTitle>
          <DialogDescription>{mode === 'edit' ? 'Tahsilat kaydını güncelleyin' : 'Ödeme bilgilerini girin'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select value={form.studentKey} onValueChange={(value) => setForm((prev) => ({ ...prev, studentKey: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Öğrenci seçin" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.username || student.fullName} value={student.fullName}>
                    {student.fullName} ({student.className})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ödeme Yöntemi</Label>
            <Select value={form.paymentType} onValueChange={(value) => setForm((prev) => ({ ...prev, paymentType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Ödeme yöntemi seçin" />
              </SelectTrigger>
              <SelectContent>
                {paymentTypes.filter((type) => type.value !== 'İade').map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tutar (TL)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Örn: Mart taksiti" />
          </div>

          {/* Tahsilatı yapan personel otomatik gösterilir; makbuz bu kişinin adına düşer. */}
          {mode !== 'edit' ? (
            <p className="text-xs text-muted-foreground">Tahsilatı alan: <b className="text-foreground">{collectorName}</b> • Şube kaydınıza göre işlenir.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave} disabled={saving}>
            <Receipt className="h-4 w-4 mr-2" />
            {saving ? 'Kaydediliyor...' : mode === 'edit' ? 'Güncelle' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Collections() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [viewMode, setViewMode] = useState('received');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [prefillCollection, setPrefillCollection] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
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
      setError(err.message || 'Tahsilat verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const collections = useMemo(() => dashboard?.collections || [], [dashboard]);
  const plannedCollections = useMemo(() => dashboard?.installments || [], [dashboard]);
  const displayedRows = viewMode === 'planned' ? plannedCollections : collections;

  const filteredCollections = useMemo(() => displayedRows.filter((collection) => {
    const searchValue = search.toLowerCase();
    const rowName = collection.name || collection.student || '';
    const rowId = collection.id || '';
    const rowNote = collection.note || '';
    const matchesSearch = `${rowName} ${rowId} ${rowNote}`.toLowerCase().includes(searchValue);
    const matchesType = viewMode === 'planned' || typeFilter === 'all' || normalizePaymentMethod(collection.method) === typeFilter;
    const matchesMonth = monthMatches(
      viewMode === 'planned' ? (collection.dueDate || collection.due) : collection.time,
      monthFilter,
    );
    return matchesSearch && matchesType && matchesMonth;
  }), [displayedRows, monthFilter, search, typeFilter, viewMode]);

  const getTypeBadge = (type) => {
    const normalized = normalizePaymentMethod(type);
    const config = normalized === 'İade'
      ? { label: 'İade', className: 'bg-red-100 text-red-700' }
      : normalized === 'Nakit'
      ? { label: 'Nakit', className: 'bg-green-100 text-green-700' }
      : normalized === 'Kredi Karti'
        ? { label: 'Kredi Kartı', className: 'bg-blue-100 text-blue-700' }
        : { label: 'Havale', className: 'bg-purple-100 text-purple-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const totalsByType = useMemo(() => paymentTypes.map((type) => ({
    ...type,
    total: collections
      .filter((item) => normalizePaymentMethod(item.method) === type.value)
      .filter((item) => monthMatches(item.time, monthFilter))
      .reduce((sum, item) => sum + parseMoney(item.amount), 0),
  })), [collections, monthFilter]);

  const plannedTotal = useMemo(() => plannedCollections
    .filter((item) => monthMatches(item.dueDate || item.due, monthFilter))
    .reduce((sum, item) => sum + plannedCollectionAmount(item), 0), [monthFilter, plannedCollections]);

  const totalToday = useMemo(() => {
    const today = new Date().toLocaleDateString('tr-TR');
    return collections
      .filter((item) => String(item.time || '').includes(today))
      .reduce((sum, item) => sum + parseMoney(item.amount), 0);
  }, [collections]);

  const handleCreated = (created) => {
    setDashboard((prev) => ({
      ...prev,
      collections: (prev?.collections || []).some((item) => item.id === created.id)
        ? (prev?.collections || []).map((item) => (item.id === created.id ? created : item))
        : [created, ...(prev?.collections || [])],
    }));
    setEditingCollection(null);
  };

  // Finansal kayıt silme geri alınamaz; tek tıkla silinmemesi için onay istenir.
  const [pendingDelete, setPendingDelete] = useState(null);

  const handleDelete = async (collection) => {
    setPendingDelete(null);
    try {
      await deleteCollection(collection.id);
      setDashboard((prev) => ({
        ...prev,
        collections: (prev?.collections || []).filter((item) => item.id !== collection.id),
      }));
      toast({ title: 'Tahsilat silindi', description: 'Kayıt listeden kaldırıldı.' });
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection(null);
      }
    } catch (err) {
      toast({ title: 'Tahsilat silinemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  const openPlannedCollectionDialog = (plan) => {
    setEditingCollection(null);
    setPrefillCollection({
      name: plan.student || '',
      className: plan.className || '',
      amount: plannedCollectionAmount(plan) || plan.amount || '',
      method: 'Nakit',
      note: plan.note || `Taksit tahsilatı • ${plan.due || 'Vade yok'}`,
    });
    setDialogOpen(true);
  };

  const handleExport = () => {
    const exportAmount = (collection) => (
      viewMode === 'planned' ? plannedCollectionAmount(collection) : parseMoney(collection.amount)
    );

    downloadCsvRows('tahsilatlar.csv', [
      ['Kayit No', 'Ogrenci', 'Sinif', 'Tutar', 'Tur', 'Zaman', 'Not'],
      ...filteredCollections.map((collection) => [
        collection.id,
        collection.name || collection.student || '',
        collection.className,
        exportAmount(collection),
        viewMode === 'planned' ? (collection.status || 'Planlanan') : collection.method,
        viewMode === 'planned' ? (collection.due || '') : (collection.time || ''),
        collection.note || '',
      ]),
    ]);
    const html = buildFinanceDocumentHtml({
      title: 'Tahsilat Export Özeti',
      subtitle: 'Dışa aktarılan tahsilat verileri için yönetim özeti',
      code: `COL-EXP-${new Date().toISOString().slice(0, 10)}`,
      accent: '#0b8f6f',
      badge: `${filteredCollections.length} kayıt`,
      summary: [
        { label: 'Kayıt Sayısı', value: String(filteredCollections.length) },
        { label: 'Toplam Tutar', value: formatCurrency(filteredCollections.reduce((sum, item) => sum + exportAmount(item), 0)) },
        { label: 'Bugün', value: formatCurrency(totalToday) },
      ],
      sections: [{
        title: 'Export Kapsamı',
        table: {
          headers: ['Kayıt', 'Öğrenci', 'Tür', 'Tutar', 'Zaman'],
          rows: filteredCollections.slice(0, 18).map((collection) => [
            collection.id,
            collection.name || collection.student || '',
            viewMode === 'planned' ? (collection.status || 'Planlanan') : collection.method,
            formatCurrency(exportAmount(collection)),
            viewMode === 'planned' ? (collection.due || '-') : (collection.time || '-'),
          ]),
        },
      }],
    });
    downloadFinanceHtml('tahsilatlar-ozet.html', html);
    toast({
      title: 'Tahsilatlar dışa aktarıldı',
      description: `${filteredCollections.length} kayıt için CSV ve özet dosyası hazırlandı.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Tahsilatlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="collections-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Tahsilatlar</h1>
          <p className="text-muted-foreground mt-1">
            Bugün: {formatCurrency(totalToday)} • {filteredCollections.length} kayıt gösteriliyor
          </p>
        </div>
        <FeatureGate module="collections" action="collect">
          <Button
            className="bg-brand-primary hover:bg-brand-primary/90"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Yeni Tahsilat
          </Button>
        </FeatureGate>
      </div>

      {error ? <ErrorBanner title="Tahsilatlar alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {totalsByType.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.value}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(type.total)}</p>
                  <p className="text-xs text-muted-foreground">{type.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(plannedTotal)}</p>
              <p className="text-xs text-muted-foreground">Planlanan</p>
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
                placeholder="Tahsilat ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Görünüm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="received">Alınan Tahsilatlar</SelectItem>
                <SelectItem value="planned">Planlanan Tahsilatlar</SelectItem>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40" disabled={viewMode === 'planned'}>
                <SelectValue placeholder="Ödeme Türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {paymentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Dışa Aktar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kayıt No</TableHead>
                <TableHead>Öğrenci</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>{viewMode === 'planned' ? 'Vade' : 'Zaman'}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCollections.map((collection) => (
                <TableRow
                  key={collection.id}
                  className="hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-sm">{collection.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{collection.name || collection.student}</p>
                      <p className="text-xs text-muted-foreground">{collection.className || collection.status || 'Plan'} • {collection.note}</p>
                      {(collection.collectedByName || collection.branchName) ? (
                        <p className="text-xs text-muted-foreground">
                          {collection.collectedByName ? `Alan: ${collection.collectedByName}` : ''}
                          {collection.collectedByName && collection.branchName ? ' • ' : ''}
                          {collection.branchName ? `Şube: ${collection.branchName}` : ''}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={`font-bold ${collection.entryType === 'Refund' || parseMoney(collection.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(viewMode === 'planned' ? plannedCollectionAmount(collection) : parseMoney(collection.amount))}
                  </TableCell>
                  <TableCell>{viewMode === 'planned' ? <Badge variant="outline">{collection.status || 'Bekleyen'}</Badge> : getTypeBadge(collection.method)}</TableCell>
                  <TableCell>{viewMode === 'planned' ? (collection.due || 'Vade yok') : (collection.time || 'Zaman yok')}</TableCell>
                  <TableCell>
                    {viewMode === 'received' ? (
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedCollection(collection)}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                        {collection.entryType !== 'Refund' && parseMoney(collection.amount) >= 0 ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingCollection(collection); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setPendingDelete(collection)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <FeatureGate module="collections" action="collect">
                        <Button size="sm" variant="outline" onClick={() => openPlannedCollectionDialog(collection)}>
                          Tahsilat Al
                        </Button>
                      </FeatureGate>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewCollectionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCollection(null);
            setPrefillCollection(null);
          }
        }}
        students={students}
        onCreated={handleCreated}
        initialCollection={editingCollection || prefillCollection}
        mode={editingCollection ? 'edit' : 'create'}
      />

      <Dialog open={Boolean(selectedCollection)} onOpenChange={(open) => { if (!open) setSelectedCollection(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tahsilat Detayı</DialogTitle>
            <DialogDescription>Seçilen tahsilat kaydının profesyonel görünümü</DialogDescription>
          </DialogHeader>
          {selectedCollection ? (
            <div className="space-y-5 py-2 text-sm text-muted-foreground">
              <div className="rounded-3xl p-6 text-white shadow-xl ci-hero">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-foreground/70">Tahsilat Fişi</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedCollection.name}</h3>
                    <p className="mt-2 text-foreground/80">{selectedCollection.className || 'Sınıf bilgisi yok'} • {selectedCollection.method}</p>
                  </div>
                  <div className="rounded-2xl bg-foreground/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-foreground/70">Tahsilat Tutarı</div>
                    <div className="mt-2 text-3xl font-bold">{formatCurrency(selectedCollection.amount)}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardContent className="p-4 space-y-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Belge Bilgisi</p><p><strong className="text-foreground">Kayıt No:</strong> {selectedCollection.id}</p><p><strong className="text-foreground">Zaman:</strong> {selectedCollection.time || 'Belirtilmedi'}</p></CardContent></Card>
                <Card><CardContent className="p-4 space-y-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Muhasebe Notu</p><p><strong className="text-foreground">Açıklama:</strong> {selectedCollection.note || 'Ek not yok'}</p><p><strong className="text-foreground">Durum:</strong> İşlendi</p></CardContent></Card>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCollection(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tahsilat kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.name || 'Öğrenci'} • ${pendingDelete.amount} • ${pendingDelete.time || ''}`
                : ''}
              <br />
              Bu işlem geri alınamaz; makbuz kaydı kalıcı olarak silinir ve taksit
              mahsupları yeniden hesaplanır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => handleDelete(pendingDelete)}
            >
              Evet, sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
