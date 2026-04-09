import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, CreditCard, Banknote, Building2,
  Receipt, Download, Pencil, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
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
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createCollection, deleteCollection, fetchAccountingDashboard, fetchStudents, updateCollection } from '../../lib/api/modules';
import {
  buildFinanceDocumentHtml,
  downloadCsvRows,
  downloadFinanceHtml,
  formatCurrency,
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
];

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function NewCollectionDialog({
  open, onOpenChange, students, onCreated, initialCollection = null,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentKey: '',
    paymentType: 'Nakit',
    amount: '',
    note: '',
  });

  const selectedStudent = useMemo(
    () => students.find((student) => student.fullName === form.studentKey),
    [students, form.studentKey],
  );

  useEffect(() => {
    if (!open) {
      setForm({
        studentKey: initialCollection ? (initialCollection.name || '') : '',
        paymentType: initialCollection?.method || 'Nakit',
        amount: initialCollection ? String(parseMoney(initialCollection.amount)) : '',
        note: initialCollection?.note || '',
      });
    }
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
      };
      const created = initialCollection
        ? await updateCollection(initialCollection.id, payload)
        : await createCollection(payload);
      onCreated(created);
      toast({
        title: initialCollection ? 'Tahsilat güncellendi' : 'Tahsilat kaydedildi',
        description: initialCollection ? 'Tahsilat kaydı güncellendi.' : 'Tahsilat backend’e işlendi.',
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
          <DialogTitle>Yeni Tahsilat</DialogTitle>
          <DialogDescription>{initialCollection ? 'Tahsilat kaydını güncelleyin' : 'Ödeme bilgilerini girin'}</DialogDescription>
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
                {paymentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tutar (₺)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Örn: Mart taksiti" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave} disabled={saving}>
            <Receipt className="h-4 w-4 mr-2" />
            {saving ? 'Kaydediliyor...' : initialCollection ? 'Güncelle' : 'Kaydet'}
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
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

  const filteredCollections = useMemo(() => collections.filter((collection) => {
    const searchValue = search.toLowerCase();
    const matchesSearch = `${collection.name} ${collection.id} ${collection.note || ''}`.toLowerCase().includes(searchValue);
    const matchesType = typeFilter === 'all' || collection.method === typeFilter;
    return matchesSearch && matchesType;
  }), [collections, search, typeFilter]);

  const getTypeBadge = (type) => {
    const normalized = String(type || '').toLowerCase();
    const config = normalized.includes('nakit')
      ? { label: 'Nakit', className: 'bg-green-100 text-green-700' }
      : normalized.includes('kart')
        ? { label: 'Kredi Kartı', className: 'bg-blue-100 text-blue-700' }
        : { label: 'Havale', className: 'bg-purple-100 text-purple-700' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const totalsByType = useMemo(() => paymentTypes.map((type) => ({
    ...type,
    total: collections
      .filter((item) => item.method === type.value)
      .reduce((sum, item) => sum + parseMoney(item.amount), 0),
  })), [collections]);

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

  const handleDelete = async (collection) => {
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

  const handleExport = () => {
    downloadCsvRows('tahsilatlar.csv', [
      ['Kayit No', 'Ogrenci', 'Sinif', 'Tutar', 'Tur', 'Zaman', 'Not'],
      ...filteredCollections.map((collection) => [
        collection.id,
        collection.name,
        collection.className,
        parseMoney(collection.amount),
        collection.method,
        collection.time || '',
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
        { label: 'Toplam Tutar', value: formatCurrency(filteredCollections.reduce((sum, item) => sum + parseMoney(item.amount), 0)) },
        { label: 'Bugün', value: formatCurrency(totalToday) },
      ],
      sections: [{
        title: 'Export Kapsamı',
        table: {
          headers: ['Kayıt', 'Öğrenci', 'Tür', 'Tutar', 'Zaman'],
          rows: filteredCollections.slice(0, 18).map((collection) => [
            collection.id,
            collection.name,
            collection.method,
            formatCurrency(collection.amount),
            collection.time || '-',
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
          <p className="text-muted-foreground mt-1">Bugün: ₺{totalToday.toLocaleString('tr-TR')}</p>
        </div>
        <Button
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Tahsilat
        </Button>
      </div>

      {error ? <ErrorBanner title="Tahsilatlar alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totalsByType.map((type) => {
          const Icon = type.icon;
          return (
            <Card key={type.value}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₺{type.total.toLocaleString('tr-TR')}</p>
                  <p className="text-xs text-muted-foreground">{type.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
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
                <TableHead>Zaman</TableHead>
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
                      <p className="font-medium">{collection.name}</p>
                      <p className="text-xs text-muted-foreground">{collection.className} • {collection.note}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-green-600">₺{parseMoney(collection.amount).toLocaleString('tr-TR')}</TableCell>
                  <TableCell>{getTypeBadge(collection.method)}</TableCell>
                  <TableCell>{collection.time || 'Zaman yok'}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedCollection(collection)}>
                        <Receipt className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingCollection(collection); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(collection)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewCollectionDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingCollection(null); }}
        students={students}
        onCreated={handleCreated}
        initialCollection={editingCollection}
      />

      <Dialog open={Boolean(selectedCollection)} onOpenChange={(open) => { if (!open) setSelectedCollection(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tahsilat Detayı</DialogTitle>
            <DialogDescription>Seçilen tahsilat kaydının profesyonel görünümü</DialogDescription>
          </DialogHeader>
          {selectedCollection ? (
            <div className="space-y-5 py-2 text-sm text-muted-foreground">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-6 text-white shadow-xl">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/70">Tahsilat Fişi</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedCollection.name}</h3>
                    <p className="mt-2 text-white/80">{selectedCollection.className || 'Sınıf bilgisi yok'} • {selectedCollection.method}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-white/70">Tahsilat Tutarı</div>
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
    </motion.div>
  );
}
