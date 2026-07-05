import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock, BookMarked, BookOpen, Library as LibraryIcon, Search, Send, Star,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';
import {
  cancelLibraryReservation,
  createLibraryRecommendation,
  fetchClasses,
  fetchLibraryBooks,
  fetchLibraryRecommendations,
  fetchMyLibrary,
  fetchParentLibrary,
  fetchStudents,
  reserveLibraryBook,
} from '../../lib/api/modules';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

// Öğrenci: katalog + rezervasyon + kitaplarım + önerilenler.
// Veli: çocukların kitapları. Öğretmen/Rehber: kitap önerme.
export default function LibraryUserPage() {
  const { user } = useApp();
  const { toast } = useToast();
  const role = user?.role;

  const [books, setBooks] = useState([]);
  const [my, setMy] = useState(null);
  const [children, setChildren] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [recForm, setRecForm] = useState({ bookId: '', target: 'class', studentName: '', className: '', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bookList = await fetchLibraryBooks();
      setBooks(bookList);
      if (role === 'student') {
        setMy(await fetchMyLibrary());
      } else if (role === 'parent') {
        setChildren(await fetchParentLibrary());
      } else {
        const [studentList, classList, recList] = await Promise.all([
          fetchStudents().catch(() => []),
          fetchClasses().catch(() => []),
          fetchLibraryRecommendations().catch(() => []),
        ]);
        setStudents(studentList);
        setClasses(classList);
        setRecommendations(recList);
      }
    } catch (err) {
      setError(err?.message || 'Kütüphane verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const filteredBooks = useMemo(() => books.filter((b) => {
    if (!search) return true;
    const q = search.toLocaleLowerCase('tr-TR');
    return b.title.toLocaleLowerCase('tr-TR').includes(q)
      || (b.author || '').toLocaleLowerCase('tr-TR').includes(q);
  }), [books, search]);

  const reserve = async (book) => {
    try {
      const result = await reserveLibraryBook(book.id);
      toast({ title: 'Rezervasyon alındı', description: `${book.title} — sıradaki konumun: ${result?.queuePosition ?? 1}` });
      load();
    } catch (err) {
      toast({ title: 'Rezerve edilemedi', description: err?.message, variant: 'destructive' });
    }
  };

  const cancelReservation = async (reservation) => {
    try {
      await cancelLibraryReservation(reservation.id);
      toast({ title: 'Rezervasyon iptal edildi', description: reservation.bookTitle });
      load();
    } catch (err) {
      toast({ title: 'İptal edilemedi', description: err?.message, variant: 'destructive' });
    }
  };

  const sendRecommendation = async () => {
    setSaving(true);
    try {
      await createLibraryRecommendation({
        bookId: recForm.bookId,
        studentName: recForm.target === 'student' ? recForm.studentName : '',
        className: recForm.target === 'class' ? recForm.className : '',
        note: recForm.note,
      });
      toast({ title: 'Öneri gönderildi' });
      setRecForm({ bookId: '', target: recForm.target, studentName: '', className: '', note: '' });
      load();
    } catch (err) {
      toast({ title: 'Gönderilemedi', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="library-user-page">
      <div>
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <LibraryIcon className="h-8 w-8 text-brand-accent" /> Kütüphane
        </h1>
        <p className="text-sm text-muted-foreground">
          {role === 'student' ? 'Katalogda ara, kitap ayırt, iade tarihlerini takip et.'
            : role === 'parent' ? 'Çocuğunuzun üzerindeki kitaplar ve okuma durumu.'
              : 'Öğrencilerine veya sınıfına kitap öner.'}
        </p>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      {/* ── Öğrenci ── */}
      {role === 'student' && my && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-3xl font-black">{(my.activeLoans || []).length}</p>
              <p className="text-xs text-muted-foreground">Üzerimdeki Kitap</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-3xl font-black">{my.readCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Okuduğum Kitap</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-3xl font-black">{(my.reservations || []).length}</p>
              <p className="text-xs text-muted-foreground">Rezervasyonum</p>
            </div>
          </div>

          {(my.activeLoans || []).length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="border-b p-4"><h2 className="font-black">Üzerimdeki Kitaplar</h2></div>
              {my.activeLoans.map((loan) => (
                <div key={loan.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
                  <BookOpen className="h-5 w-5 shrink-0 text-brand-accent" />
                  <p className="min-w-0 flex-1 truncate font-bold">{loan.bookTitle}</p>
                  <Badge variant="outline" className={`rounded-lg ${loan.overdue ? 'border-red-500/30 text-red-500' : 'border-emerald-500/30 text-emerald-600'}`}>
                    {loan.overdue ? <><AlarmClock className="mr-1 h-3.5 w-3.5" /> Gecikti!</> : `İade: ${formatDate(loan.dueAtUtc)}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {(my.reservations || []).length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="border-b p-4"><h2 className="font-black">Rezervasyonlarım</h2></div>
              {my.reservations.map((reservation) => (
                <div key={reservation.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
                  <BookMarked className="h-5 w-5 shrink-0 text-brand-accent" />
                  <p className="min-w-0 flex-1 truncate font-bold">{reservation.bookTitle}</p>
                  <Badge variant="outline" className={`rounded-lg ${reservation.status === 'Hazır' ? 'border-emerald-500/30 text-emerald-600' : 'border-amber-500/30 text-amber-500'}`}>
                    {reservation.status === 'Hazır' ? 'Hazır — kütüphaneden al!' : `Sırada ${reservation.queuePosition}.`}
                  </Badge>
                  <Button size="sm" variant="ghost" className="rounded-lg text-red-500" onClick={() => cancelReservation(reservation)}>İptal</Button>
                </div>
              ))}
            </div>
          )}

          {(my.recommendations || []).length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-black"><Star className="h-4 w-4 text-amber-500" /> Sana Önerilenler</h2>
              <div className="mt-3 space-y-2">
                {my.recommendations.map((rec, index) => (
                  <div key={index} className="rounded-xl border bg-card p-3">
                    <p className="font-bold">{rec.bookTitle}</p>
                    <p className="text-xs text-muted-foreground">{rec.teacherName} önerdi{rec.note ? ` — "${rec.note}"` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Veli ── */}
      {role === 'parent' && (
        children.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Bağlı öğrenci bulunamadı.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {children.map((child) => (
              <div key={child.studentName} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-sm font-black text-white">
                    {child.studentName?.slice(0, 2)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{child.studentName}</p>
                    <p className="text-xs text-muted-foreground">{child.className} • {child.readCount} kitap okudu</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {(child.activeLoans || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Üzerinde kitap yok.</p>
                  ) : child.activeLoans.map((loan, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                      <span className="min-w-0 truncate font-semibold">{loan.bookTitle}</span>
                      <Badge variant="outline" className={`shrink-0 rounded-lg ${loan.overdue ? 'border-red-500/30 text-red-500' : 'border-emerald-500/30 text-emerald-600'}`}>
                        {loan.overdue ? 'Gecikti' : formatDate(loan.dueAtUtc)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Öğretmen / Rehber: öneri ── */}
      {(role === 'teacher' || role === 'counselor') && (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><Send className="h-4 w-4 text-brand-accent" /> Kitap Öner</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Kitap</Label>
                <Select value={recForm.bookId || undefined} onValueChange={(v) => setRecForm((p) => ({ ...p, bookId: v }))}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Kitap seçin" /></SelectTrigger>
                  <SelectContent>
                    {books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Hedef</Label>
                  <Select value={recForm.target} onValueChange={(v) => setRecForm((p) => ({ ...p, target: v }))}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">Sınıfa</SelectItem>
                      <SelectItem value="student">Öğrenciye</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{recForm.target === 'class' ? 'Sınıf' : 'Öğrenci'}</Label>
                  {recForm.target === 'class' ? (
                    <Select value={recForm.className || undefined} onValueChange={(v) => setRecForm((p) => ({ ...p, className: v }))}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Sınıf" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => {
                          const name = c.name || c.className || c;
                          return <SelectItem key={name} value={name}>{name}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={recForm.studentName || undefined} onValueChange={(v) => setRecForm((p) => ({ ...p, studentName: v }))}>
                      <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Öğrenci" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s) => <SelectItem key={s.id || s.fullName} value={s.fullName}>{s.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <Label>Not (opsiyonel)</Label>
                <Textarea rows={2} className="mt-1 rounded-xl" value={recForm.note} onChange={(e) => setRecForm((p) => ({ ...p, note: e.target.value }))} placeholder="Neden bu kitap?" />
              </div>
              <Button
                className="w-full rounded-xl"
                onClick={sendRecommendation}
                disabled={saving || !recForm.bookId || (recForm.target === 'class' ? !recForm.className : !recForm.studentName)}
              >
                {saving ? 'Gönderiliyor...' : 'Öneriyi Gönder'}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4"><h2 className="font-black">Gönderdiğim Öneriler</h2></div>
            {recommendations.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Henüz öneri göndermedin.</p>
            ) : recommendations.slice(0, 15).map((rec) => (
              <div key={rec.id} className="border-b p-4 last:border-b-0">
                <p className="font-bold">{rec.bookTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {rec.studentName || rec.className} • {formatDate(rec.createdAtUtc)}{rec.note ? ` — "${rec.note}"` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Katalog (öğrenci arar + rezerve eder; diğer roller görüntüler) */}
      {role !== 'parent' && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <h2 className="font-black">Katalog</h2>
            <div className="relative ml-auto min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Kitap veya yazar ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" />
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {filteredBooks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Kitap bulunamadı.</p>
            ) : filteredBooks.map((book) => (
              <div key={book.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {book.author || '—'}{book.category ? ` • ${book.category}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className={`rounded-lg ${book.availableCopies > 0 ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}>
                  {book.availableCopies > 0 ? `${book.availableCopies} müsait` : 'Dolu'}
                </Badge>
                {role === 'student' && book.availableCopies <= 0 && (
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => reserve(book)}>
                    <BookMarked className="mr-1 h-3.5 w-3.5" /> Ayırt
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
