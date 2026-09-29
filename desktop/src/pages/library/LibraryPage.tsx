import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  BarChart3,
  BellRing,
  BookOpen,
  BookPlus,
  Library as LibraryIcon,
  RotateCcw,
  ScanBarcode,
  Search,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { formatMoney } from '../../lib/format';
import {
  checkoutLibraryBook,
  createLibraryBook,
  createLibraryBooksBulk,
  deleteLibraryBook,
  extendLibraryLoan,
  fetchLibraryBooks,
  fetchLibraryLoans,
  fetchLibrarySettings,
  fetchLibraryStats,
  fetchStudents,
  lookupIsbn,
  returnLibraryLoan,
  saveLibrarySettings,
  sendLibraryReminders,
  updateLibraryBook,
} from '../../lib/api/modules';

const TABS = [
  { id: 'catalog', label: 'Katalog', icon: BookOpen },
  { id: 'loans', label: 'Ödünç İşlemleri', icon: RotateCcw },
  { id: 'stats', label: 'İstatistik', icon: BarChart3 },
  { id: 'settings', label: 'Ayarlar', icon: Settings2 },
];

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const EMPTY_BOOK = { title: '', author: '', publisher: '', isbn: '', category: '', shelf: '', totalCopies: 1, notes: '' };

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LibraryPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('catalog');
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [bookDialog, setBookDialog] = useState(null); // null | { mode:'create'|'edit', book }
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [checkoutDialog, setCheckoutDialog] = useState(null); // book
  const [checkoutStudent, setCheckoutStudent] = useState('');
  const [loanFilter, setLoanFilter] = useState('active');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bookList, loanList, studentList, statData, settingsData] = await Promise.all([
        fetchLibraryBooks(),
        fetchLibraryLoans(),
        fetchStudents().catch(() => []),
        fetchLibraryStats().catch(() => null),
        fetchLibrarySettings().catch(() => null),
      ]);
      setBooks(bookList);
      setLoans(loanList);
      setStudents(studentList);
      setStats(statData);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      setError(err?.message || 'Kütüphane verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => [...new Set(books.map((b) => b.category).filter(Boolean))].sort(),
    [books],
  );

  const filteredBooks = useMemo(() => books.filter((b) => {
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    if (!search) return true;
    const q = search.toLocaleLowerCase('tr-TR');
    return b.title.toLocaleLowerCase('tr-TR').includes(q)
      || (b.author || '').toLocaleLowerCase('tr-TR').includes(q)
      || (b.isbn || '').includes(search.trim());
  }), [books, search, categoryFilter]);

  const visibleLoans = useMemo(() => {
    if (loanFilter === 'active') return loans.filter((l) => !l.returnedAtUtc);
    if (loanFilter === 'overdue') return loans.filter((l) => l.overdue);
    return loans;
  }, [loans, loanFilter]);

  const openCreateBook = () => { setBookForm(EMPTY_BOOK); setBookDialog({ mode: 'create' }); };
  const openEditBook = (book) => { setBookForm({ ...book }); setBookDialog({ mode: 'edit', book }); };

  const runIsbnLookup = async () => {
    if (!bookForm.isbn?.trim()) return;
    setIsbnLoading(true);
    try {
      const result = await lookupIsbn(bookForm.isbn.trim());
      if (result?.found) {
        setBookForm((prev) => ({
          ...prev,
          title: result.title || prev.title,
          author: result.author || prev.author,
          publisher: result.publisher || prev.publisher,
        }));
        toast({ title: 'Kitap bilgisi bulundu', description: result.title });
      } else {
        toast({ title: 'ISBN bulunamadı', description: 'Bilgileri elle girebilirsiniz.' });
      }
    } catch (err) {
      toast({ title: 'Sorgu başarısız', description: err?.message, variant: 'destructive' });
    } finally {
      setIsbnLoading(false);
    }
  };

  const saveBook = async () => {
    setSaving(true);
    try {
      if (bookDialog?.mode === 'edit') {
        await updateLibraryBook(bookDialog.book.id, { ...bookForm, totalCopies: Number(bookForm.totalCopies) || 1 });
        toast({ title: 'Kitap güncellendi' });
      } else {
        await createLibraryBook({ ...bookForm, totalCopies: Number(bookForm.totalCopies) || 1 });
        toast({ title: 'Kitap eklendi', description: bookForm.title });
      }
      setBookDialog(null);
      load();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeBook = async (book) => {
    try {
      await deleteLibraryBook(book.id);
      toast({ title: 'Kitap silindi', description: book.title });
      load();
    } catch (err) {
      toast({ title: 'Silinemedi', description: err?.message, variant: 'destructive' });
    }
  };

  // Toplu içe aktarma: her satır "Ad; Yazar; Kategori; Kopya; ISBN; Raf"
  const runBulkImport = async () => {
    const items = bulkText.split('\n')
      .map((line) => line.split(';').map((p) => p.trim()))
      .filter((parts) => parts[0])
      .map((parts) => ({
        title: parts[0],
        author: parts[1] || '',
        category: parts[2] || '',
        totalCopies: parseInt(parts[3], 10) || 1,
        isbn: parts[4] || '',
        shelf: parts[5] || '',
      }));
    if (items.length === 0) {
      toast({ title: 'Satır bulunamadı', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await createLibraryBooksBulk(items);
      toast({ title: 'İçe aktarma tamam', description: `${result?.created ?? items.length} kitap eklendi.` });
      setBulkOpen(false);
      setBulkText('');
      load();
    } catch (err) {
      toast({ title: 'İçe aktarılamadı', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runCheckout = async () => {
    if (!checkoutDialog || !checkoutStudent) return;
    setSaving(true);
    try {
      const student = students.find((s) => s.fullName === checkoutStudent);
      await checkoutLibraryBook({
        bookId: checkoutDialog.id,
        studentName: checkoutStudent,
        className: student?.className || '',
      });
      toast({ title: 'Ödünç verildi', description: `${checkoutDialog.title} → ${checkoutStudent}` });
      setCheckoutDialog(null);
      setCheckoutStudent('');
      load();
    } catch (err) {
      toast({ title: 'Ödünç verilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runReturn = async (loan) => {
    try {
      const result = await returnLibraryLoan(loan.id);
      toast({
        title: 'İade alındı',
        description: result?.fineAmount > 0
          ? `${loan.bookTitle} — ${result.overdueDays} gün gecikme, ceza ${formatMoney(result.fineAmount)}`
          : loan.bookTitle,
      });
      load();
    } catch (err) {
      toast({ title: 'İade alınamadı', description: err?.message, variant: 'destructive' });
    }
  };

  const runExtend = async (loan) => {
    try {
      await extendLibraryLoan(loan.id);
      toast({ title: 'Süre uzatıldı', description: loan.bookTitle });
      load();
    } catch (err) {
      toast({ title: 'Uzatılamadı', description: err?.message, variant: 'destructive' });
    }
  };

  const runReminders = async () => {
    try {
      const result = await sendLibraryReminders();
      toast({ title: 'Hatırlatmalar gönderildi', description: `${result?.notified ?? 0} ödünç için öğrenci ve veliye bildirim üretildi.` });
    } catch (err) {
      toast({ title: 'Gönderilemedi', description: err?.message, variant: 'destructive' });
    }
  };

  const persistSettings = async () => {
    setSaving(true);
    try {
      const saved = await saveLibrarySettings({
        ...settings,
        loanDays: Number(settings.loanDays) || 15,
        maxActiveLoans: Number(settings.maxActiveLoans) || 3,
        maxExtensions: Number(settings.maxExtensions) ?? 1,
        extensionDays: Number(settings.extensionDays) || 7,
        finePerDay: Number(settings.finePerDay) || 0,
      });
      setSettings(saved);
      toast({ title: 'Ayarlar kaydedildi' });
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="library-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
            <LibraryIcon className="h-8 w-8 text-brand-accent" /> Kütüphane
          </h1>
          <p className="text-sm text-muted-foreground">
            {books.length} kitap • {stats?.activeLoans ?? 0} dışarıda • {stats?.overdueLoans ?? 0} geciken
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FeatureGate module="library" action="lend">
            <Button variant="outline" className="rounded-xl" onClick={runReminders}>
              <BellRing className="mr-2 h-4 w-4" /> Hatırlatma Gönder
            </Button>
          </FeatureGate>
          <FeatureGate module="library" action="catalog-manage">
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Toplu Ekle
            </Button>
          </FeatureGate>
          <FeatureGate module="library" action="catalog-manage">
            <Button className="rounded-xl" onClick={openCreateBook} data-testid="library-add-book">
              <BookPlus className="mr-2 h-4 w-4" /> Kitap Ekle
            </Button>
          </FeatureGate>
        </div>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? 'border-brand-accent/40 bg-brand-accent text-white shadow'
                : 'border-transparent bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]'
            }`}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      {/* Katalog */}
      {tab === 'catalog' && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Kitap, yazar veya ISBN ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredBooks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {books.length === 0 ? '"Kitap Ekle" veya "Toplu Ekle" ile kataloğu oluşturun.' : 'Filtreye uyan kitap yok.'}
              </p>
            ) : filteredBooks.map((book) => (
              <div key={book.id} className="grid gap-2 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_140px_120px_220px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-bold">{book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {book.author || 'Yazar belirtilmedi'}
                    {book.category ? ` • ${book.category}` : ''}
                    {book.shelf ? ` • Raf: ${book.shelf}` : ''}
                    {book.isbn ? ` • ${book.isbn}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className={`w-fit rounded-lg ${book.availableCopies > 0 ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}>
                  {book.availableCopies}/{book.totalCopies} müsait
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {book.reservationCount > 0 ? `${book.reservationCount} rezervasyon` : '—'}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-lg" disabled={book.availableCopies <= 0} onClick={() => { setCheckoutDialog(book); setCheckoutStudent(''); }}>
                    Ödünç Ver
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openEditBook(book)}>Düzenle</Button>
                  <Button size="sm" variant="ghost" className="rounded-lg text-red-500" onClick={() => removeBook(book)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ödünç işlemleri */}
      {tab === 'loans' && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            {[['active', 'Aktif'], ['overdue', 'Gecikenler'], ['all', 'Tümü']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLoanFilter(key)}
                className={`rounded-xl px-4 py-1.5 text-sm font-semibold ${loanFilter === key ? 'bg-brand-accent text-white' : 'bg-foreground/[0.05] text-foreground/70'}`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">{visibleLoans.length} kayıt</span>
          </div>
          {visibleLoans.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Kayıt yok. Katalogdan "Ödünç Ver" ile başlayın.</p>
          ) : visibleLoans.map((loan) => (
            <div key={loan.id} className="grid gap-2 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_180px] lg:items-center">
              <div className="min-w-0">
                <p className="truncate font-bold">{loan.bookTitle}</p>
                <p className="text-xs text-muted-foreground">Veren: {loan.issuedBy || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{loan.studentName}</p>
                <p className="text-xs text-muted-foreground">{loan.className || ''}</p>
              </div>
              <div className="text-xs">
                {loan.returnedAtUtc ? (
                  <Badge variant="outline" className="rounded-lg border-sky-500/30 text-sky-500">İade: {formatDate(loan.returnedAtUtc)}</Badge>
                ) : loan.overdue ? (
                  <Badge variant="outline" className="rounded-lg border-red-500/30 text-red-500">
                    <AlarmClock className="mr-1 h-3.5 w-3.5" /> {loan.overdueDays} gün gecikti
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-lg border-emerald-500/30 text-emerald-600">Son: {formatDate(loan.dueAtUtc)}</Badge>
                )}
                {loan.fineAmount > 0 && <p className="mt-1 text-red-500">Ceza: {formatMoney(loan.fineAmount)}</p>}
              </div>
              {!loan.returnedAtUtc && (
                <div className="flex gap-2">
                  <FeatureGate module="library" action="return"><Button size="sm" className="rounded-lg" onClick={() => runReturn(loan)}>İade Al</Button></FeatureGate>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => runExtend(loan)}>Uzat</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* İstatistik */}
      {tab === 'stats' && stats && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Kitap', stats.totalBooks], ['Kopya', stats.totalCopies],
              ['Dışarıda', stats.activeLoans], ['Geciken', stats.overdueLoans],
              ['Okuyucu', stats.distinctReaders],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-card p-5 shadow-sm">
                <p className="text-3xl font-black">{value ?? 0}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="font-black">En Çok Okunanlar</h2>
              {(stats.topBooks || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Henüz ödünç kaydı yok.</p>
              ) : (
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topBooks.map((b) => ({ name: b.title.length > 16 ? `${b.title.slice(0, 16)}…` : b.title, Ödünç: b.count }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Bar dataKey="Ödünç" fill="hsl(var(--brand-accent))" radius={[0, 8, 8, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="font-black">Kategori Dağılımı</h2>
              {(stats.categoryDistribution || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Katalog boş.</p>
              ) : (
                <>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.categoryDistribution.map((c) => ({ name: c.category, value: c.count }))} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={3}>
                          {stats.categoryDistribution.map((entry, index) => (
                            <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(v, n) => [`${v} kitap`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {stats.categoryDistribution.slice(0, 8).map((entry, index) => (
                      <span key={entry.category} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        {entry.category}: {entry.count}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="font-black">Aylık Ödünç Trendi</h2>
              {(stats.monthlyLoans || []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthlyLoans.map((m) => ({ name: m.month, Ödünç: m.count }))}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="Ödünç" stroke="hsl(var(--brand-accent))" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="font-black">Okuma Ligi</h2>
              <p className="mt-1 text-xs text-muted-foreground">İade edilmiş kitap sayısına göre.</p>
              <div className="mt-4 space-y-2">
                {(stats.topReaders || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz tamamlanan okuma yok.</p>
                ) : stats.topReaders.map((reader, index) => (
                  <div key={reader.student} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-orange-300 text-white' : 'bg-foreground/[0.06]'}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{reader.student}</span>
                    <span className="font-black">{reader.count} kitap</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ayarlar */}
      {tab === 'settings' && settings && (
        <div className="max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-black">Kütüphane Kuralları</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Ödünç süresi (gün)</Label>
              <Input type="number" min="1" className="mt-1 rounded-xl" value={settings.loanDays} onChange={(e) => setSettings((p) => ({ ...p, loanDays: e.target.value }))} />
            </div>
            <div>
              <Label>Aynı anda en fazla kitap</Label>
              <Input type="number" min="1" className="mt-1 rounded-xl" value={settings.maxActiveLoans} onChange={(e) => setSettings((p) => ({ ...p, maxActiveLoans: e.target.value }))} />
            </div>
            <div>
              <Label>Uzatma hakkı (adet)</Label>
              <Input type="number" min="0" className="mt-1 rounded-xl" value={settings.maxExtensions} onChange={(e) => setSettings((p) => ({ ...p, maxExtensions: e.target.value }))} />
            </div>
            <div>
              <Label>Uzatma süresi (gün)</Label>
              <Input type="number" min="1" className="mt-1 rounded-xl" value={settings.extensionDays} onChange={(e) => setSettings((p) => ({ ...p, extensionDays: e.target.value }))} />
            </div>
            <div>
              <Label>Günlük gecikme cezası (TL, 0 = yok)</Label>
              <Input type="number" min="0" step="0.5" className="mt-1 rounded-xl" value={settings.finePerDay} onChange={(e) => setSettings((p) => ({ ...p, finePerDay: e.target.value }))} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Ceza tutarı iade sırasında hesaplanıp gösterilir; tahsilat finans modülünden manuel yapılır.
          </p>
          <Button className="mt-4 rounded-xl" onClick={persistSettings} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </Button>
        </div>
      )}

      {/* Kitap ekle/düzenle */}
      <Dialog open={bookDialog != null} onOpenChange={(open) => !open && setBookDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{bookDialog?.mode === 'edit' ? 'Kitabı Düzenle' : 'Kitap Ekle'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ISBN (opsiyonel — otomatik doldurur)</Label>
              <div className="mt-1 flex gap-2">
                <Input className="rounded-xl" value={bookForm.isbn} onChange={(e) => setBookForm((p) => ({ ...p, isbn: e.target.value }))} placeholder="9789750718533" />
                <Button variant="outline" className="rounded-xl" onClick={runIsbnLookup} disabled={isbnLoading || !bookForm.isbn?.trim()}>
                  <ScanBarcode className="mr-1 h-4 w-4" /> {isbnLoading ? '...' : 'Sorgula'}
                </Button>
              </div>
            </div>
            <div>
              <Label>Kitap Adı *</Label>
              <Input className="mt-1 rounded-xl" value={bookForm.title} onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Yazar</Label>
                <Input className="mt-1 rounded-xl" value={bookForm.author} onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))} />
              </div>
              <div>
                <Label>Yayınevi</Label>
                <Input className="mt-1 rounded-xl" value={bookForm.publisher} onChange={(e) => setBookForm((p) => ({ ...p, publisher: e.target.value }))} />
              </div>
              <div>
                <Label>Kategori</Label>
                <Input className="mt-1 rounded-xl" list="library-categories" value={bookForm.category} onChange={(e) => setBookForm((p) => ({ ...p, category: e.target.value }))} placeholder="Roman, Bilim..." />
                <datalist id="library-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Raf</Label>
                  <Input className="mt-1 rounded-xl" value={bookForm.shelf} onChange={(e) => setBookForm((p) => ({ ...p, shelf: e.target.value }))} placeholder="A-3" />
                </div>
                <div>
                  <Label>Kopya</Label>
                  <Input type="number" min="1" className="mt-1 rounded-xl" value={bookForm.totalCopies} onChange={(e) => setBookForm((p) => ({ ...p, totalCopies: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBookDialog(null)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={saveBook} disabled={saving || !bookForm.title?.trim()}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toplu içe aktarma */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Toplu Kitap Ekle</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Her satıra bir kitap: <code>Ad; Yazar; Kategori; Kopya; ISBN; Raf</code> (yalnız ad zorunlu). Excel'den kopyalayıp noktalı virgülle yapıştırabilirsiniz.
          </p>
          <Textarea rows={8} className="rounded-xl font-mono text-xs" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Suç ve Ceza; Dostoyevski; Roman; 2\nNutuk; M. Kemal Atatürk; Tarih; 3'} />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setBulkOpen(false)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={runBulkImport} disabled={saving || !bulkText.trim()}>
              {saving ? 'Ekleniyor...' : 'İçe Aktar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ödünç verme */}
      <Dialog open={checkoutDialog != null} onOpenChange={(open) => !open && setCheckoutDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ödünç Ver — {checkoutDialog?.title}</DialogTitle></DialogHeader>
          <div>
            <Label>Öğrenci</Label>
            <Select value={checkoutStudent || undefined} onValueChange={setCheckoutStudent}>
              <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id || s.fullName} value={s.fullName}>{s.fullName} ({s.className || '—'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {settings ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Süre: {settings.loanDays} gün • Öğrenci limiti: {settings.maxActiveLoans} kitap
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setCheckoutDialog(null)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={runCheckout} disabled={saving || !checkoutStudent}>
              {saving ? 'Veriliyor...' : 'Ödünç Ver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
