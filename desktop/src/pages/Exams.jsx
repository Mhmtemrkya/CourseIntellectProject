import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Atom,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FlaskConical,
  Globe2,
  LayoutList,
  ListChecks,
  Plus,
  Sigma,
  Users,
} from 'lucide-react';
import { FeatureGate } from '../components/FeatureGate';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useApp } from '../context/AppContext';
import { getUserRoles } from '../lib/permissions';
import {
  fetchExamResults,
  fetchPlannedExams,
  fetchStudents,
} from '../lib/api/modules';
import ExamManagementSheet, { classKey } from '../components/exams/ExamManagementSheet';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const PAGE_SIZE = 8;
const ALL = 'all';

// Sınav türüne göre ikon ve renk — listede sınav satırı bir bakışta ayırt edilsin.
const TYPE_STYLES = {
  yazılı: { icon: Sigma, tint: 'bg-sky-500/12 text-sky-600', badge: 'bg-sky-500/12 text-sky-600' },
  deneme: { icon: FlaskConical, tint: 'bg-amber-500/12 text-amber-600', badge: 'bg-amber-500/12 text-amber-600' },
  ünite: { icon: Globe2, tint: 'bg-rose-500/12 text-rose-600', badge: 'bg-rose-500/12 text-rose-600' },
  quiz: { icon: BookOpen, tint: 'bg-emerald-500/12 text-emerald-600', badge: 'bg-emerald-500/12 text-emerald-600' },
  proje: { icon: Atom, tint: 'bg-violet-500/12 text-violet-600', badge: 'bg-violet-500/12 text-violet-600' },
};

const STATUS_STYLES = {
  tamamlandı: 'bg-emerald-500/12 text-emerald-600',
  planlandı: 'bg-sky-500/12 text-sky-600',
  taslak: 'bg-amber-500/12 text-amber-600',
  i̇ptal: 'bg-red-500/12 text-red-600',
  iptal: 'bg-red-500/12 text-red-600',
};

// Sonuç kayıtlarında tür, backend enum adıyla gelir (Written/MockExam...).
// Listede Türkçe etiket göstermek için tek yerden çevrilir.
const TYPE_LABELS = {
  written: 'Yazılı',
  oral: 'Sözlü',
  quiz: 'Quiz',
  mockexam: 'Deneme',
  unit: 'Ünite',
  project: 'Proje',
};

const typeLabel = (type) => TYPE_LABELS[String(type || '').toLocaleLowerCase('tr-TR')] || type || 'Yazılı';
const typeStyle = (type) => TYPE_STYLES[typeLabel(type).toLocaleLowerCase('tr-TR')] || TYPE_STYLES.yazılı;
const statusStyle = (status) => STATUS_STYLES[String(status || '').toLocaleLowerCase('tr-TR')] || STATUS_STYLES.planlandı;

const TR_MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];

// "17 Haziran 2026" / "17.06.2026" / "2026-06-17" biçimlerini tarihe çevirir.
function parseExamDate(label) {
  const raw = String(label || '').trim();
  if (!raw) return null;
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(raw)) return iso;

  const dotted = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dotted) return new Date(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));

  const turkish = raw.match(/^(\d{1,2})\s+([^\s]+)\s*(\d{4})?$/);
  if (turkish) {
    const month = TR_MONTHS.findIndex((name) => name === turkish[2].toLocaleLowerCase('tr-TR'));
    if (month >= 0) return new Date(Number(turkish[3] || new Date().getFullYear()), month, Number(turkish[1]));
  }
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatExamDate(date, fallback) {
  if (!date) return fallback || '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function weekdayLabel(date, startTime) {
  if (!date) return startTime || '';
  const weekday = date.toLocaleDateString('tr-TR', { weekday: 'long' });
  return [weekday, startTime].filter(Boolean).join(' ');
}

function StatTile({ icon: Icon, tint, label, value, caption }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-black leading-tight tabular-nums">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

export default function Exams() {
  const navigate = useNavigate();
  const { user } = useApp();
  const roles = useMemo(() => getUserRoles(user), [user]);
  const canManage = roles.includes('admin') || roles.includes('superadmin') || roles.includes('teacher');

  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(ALL);
  const [classFilter, setClassFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);

  // Açık modal, satırın KOPYASINI değil kimliğini tutar: bir işlem sonrası liste
  // tazelenince (durum/puan değişimi) pencere de anında güncel veriyi gösterir.
  const [managedExamId, setManagedExamId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [examList, resultList, studentList] = await Promise.all([
        fetchPlannedExams().catch(() => []),
        fetchExamResults().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      setExams(Array.isArray(examList) ? examList : []);
      setResults(Array.isArray(resultList) ? resultList : []);
      setStudents(Array.isArray(studentList) ? studentList : []);
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Planlı sınavlar listenin omurgasıdır. Sınav künyesi olmadan yalnız sonucu
  // girilmiş kayıtlar da (eski veriler) listede görünsün diye başlığa göre
  // türetilmiş satırlar eklenir — aksi hâlde girilmiş sonuçlar kaybolur.
  const rows = useMemo(() => {
    const planned = exams.map((exam) => {
      const examResults = results.filter((row) => (row.examTitle || row.title) === exam.title);
      const average = exam.averageScore ?? (examResults.length
        ? Math.round((examResults.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / examResults.length) * 10) / 10
        : null);
      return {
        ...exam,
        type: typeLabel(exam.type),
        resultCount: exam.resultCount ?? examResults.length,
        averageScore: average,
        date: parseExamDate(exam.dateLabel),
        synthetic: false,
      };
    });

    const knownTitles = new Set(planned.map((row) => String(row.title || '').toLocaleLowerCase('tr-TR')));
    const orphanTitles = [...new Set(results
      .map((row) => row.examTitle || row.title)
      .filter((title) => title && !knownTitles.has(String(title).toLocaleLowerCase('tr-TR'))))];

    const orphans = orphanTitles.map((title) => {
      const examResults = results.filter((row) => (row.examTitle || row.title) === title);
      const first = examResults[0] || {};
      return {
        id: `result:${title}`,
        title,
        subject: first.subject || 'Ders',
        className: first.className || '',
        type: typeLabel(first.type),
        dateLabel: first.dateLabel || '',
        startTime: '',
        duration: '',
        questionCount: 0,
        status: 'Tamamlandı',
        attendancePresent: examResults.length,
        attendanceTotal: examResults.length,
        resultCount: examResults.length,
        averageScore: examResults.length
          ? Math.round((examResults.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / examResults.length) * 10) / 10
          : null,
        date: parseExamDate(first.dateLabel),
        synthetic: true,
      };
    });

    return [...planned, ...orphans].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [exams, results]);

  const subjectOptions = useMemo(() => [...new Set(rows.map((row) => row.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [rows]);
  const classOptions = useMemo(() => [...new Set(rows.map((row) => row.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [rows]);
  const typeOptions = useMemo(() => [...new Set(rows.map((row) => row.type).filter(Boolean))], [rows]);
  const statusOptions = useMemo(() => [...new Set(rows.map((row) => row.status).filter(Boolean))], [rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return rows.filter((row) => {
      if (query && !`${row.title} ${row.subject} ${row.className}`.toLocaleLowerCase('tr-TR').includes(query)) return false;
      if (subjectFilter !== ALL && row.subject !== subjectFilter) return false;
      if (classFilter !== ALL && classKey(row.className) !== classKey(classFilter)) return false;
      if (typeFilter !== ALL && row.type !== typeFilter) return false;
      if (statusFilter !== ALL && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, subjectFilter, classFilter, typeFilter, statusFilter]);

  useEffect(() => { setPage(1); }, [search, subjectFilter, classFilter, typeFilter, statusFilter, view]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const managedExam = useMemo(
    () => rows.find((row) => row.id === managedExamId) || null,
    [rows, managedExamId],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((row) => String(row.status).toLocaleLowerCase('tr-TR') === 'tamamlandı').length;
    const now = new Date();
    const weekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const upcoming = rows.filter((row) => row.date && row.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && row.date <= weekAhead).length;
    return {
      total,
      completed,
      completedRate: total ? Math.round((completed / total) * 1000) / 10 : 0,
      upcoming,
    };
  }, [rows]);

  // Takvim görünümü: sınavlar tarihine göre gruplanır (gerçek veriden, dekor değil).
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const key = row.date ? row.date.toISOString().slice(0, 10) : 'tarihsiz';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5" data-testid="exams-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
          <p className="mt-1 text-muted-foreground">Sınav sonuç girişi ve mevcut kayıtları incele.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FeatureGate module="exams" action="create">
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/exams/create?mode=exam&type=Exam')}>
              <Plus className="mr-2 h-4 w-4" /> Yeni Sınav
            </Button>
          </FeatureGate>
          <Button variant="outline" onClick={() => navigate('/t/question-studio')}>
            <ClipboardList className="mr-2 h-4 w-4" /> Çalışma Alanı
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadData} /> : null}

      {/* Kenar çubuğu açıkken istatistik + filtre tek satıra sığmıyor ve etiketler
          kırpılıyordu; yalnız çok geniş ekranda yan yana dururlar. */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-3 2xl:w-auto">
          <StatTile icon={ClipboardList} tint="bg-sky-500/12 text-sky-600" label="Toplam Sınav" value={stats.total} caption="Tüm zamanlar" />
          <StatTile icon={CheckCircle2} tint="bg-emerald-500/12 text-emerald-600" label="Tamamlanan" value={stats.completed} caption={`%${stats.completedRate} tamamlandı`} />
          <StatTile icon={Clock} tint="bg-violet-500/12 text-violet-600" label="Yaklaşan" value={stats.upcoming} caption="7 gün içinde" />
        </div>

        <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sınav ara..."
            className="h-10 w-full sm:w-44"
          />
          <FilterSelect value={subjectFilter} onChange={setSubjectFilter} placeholder="Tüm Dersler" options={subjectOptions} />
          <FilterSelect value={classFilter} onChange={setClassFilter} placeholder="Tüm Sınıflar" options={classOptions} />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="Tüm Türler" options={typeOptions} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Tüm Durumlar" options={statusOptions} />
          <div className="flex overflow-hidden rounded-xl border border-foreground/10">
            <button
              type="button"
              onClick={() => setView('calendar')}
              aria-label="Takvim görünümü"
              className={`grid h-10 w-10 place-items-center transition ${view === 'calendar' ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="Liste görünümü"
              className={`grid h-10 w-10 place-items-center transition ${view === 'list' ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 py-16 text-center">
          <ListChecks className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="mt-3 font-bold">Kayıtlı sınav bulunamadı</p>
          <p className="mt-1 text-sm text-muted-foreground">Filtreleri değiştirin veya yeni bir sınav oluşturun.</p>
        </div>
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-foreground/10">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_5.5rem] gap-4 border-b border-foreground/10 bg-foreground/[0.035] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Sınav Bilgisi</span>
            <span>Ders - Sınıf</span>
            <span>Tarih</span>
            <span>Katılım</span>
            <span>Ortalama</span>
            <span>Durum</span>
            <span className="text-right">İşlemler</span>
          </div>
          <div className="divide-y divide-foreground/[0.07]">
            {paged.map((row) => (
              <ExamRow key={row.id} row={row} onManage={() => setManagedExamId(row.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items]) => (
            <div key={key} className="overflow-hidden rounded-2xl border border-foreground/10">
              <div className="flex items-center gap-2 border-b border-foreground/10 bg-foreground/[0.035] px-5 py-2.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold">
                  {key === 'tarihsiz' ? 'Tarihi belirtilmemiş' : formatExamDate(new Date(`${key}T00:00:00`))}
                </span>
                <Badge variant="outline" className="ml-auto">{items.length} sınav</Badge>
              </div>
              <div className="divide-y divide-foreground/[0.07]">
                {items.map((row) => <ExamRow key={row.id} row={row} onManage={() => setManagedExamId(row.id)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && filtered.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Toplam {filtered.length} sınav</p>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: pageCount }, (_, index) => index + 1)
                .filter((number) => number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1)
                .map((number, index, list) => (
                  <span key={number} className="flex items-center gap-1">
                    {index > 0 && number - list[index - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
                    <Button
                      variant={number === currentPage ? 'default' : 'outline'}
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </Button>
                  </span>
                ))}
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ExamManagementSheet
        exam={managedExam}
        results={results}
        students={students}
        open={Boolean(managedExam)}
        onOpenChange={(open) => !open && setManagedExamId(null)}
        onChanged={loadData}
        canEditResults={canManage}
        canEditExam={canManage && !managedExam?.synthetic}
        canDelete={canManage && !managedExam?.synthetic}
      />
    </motion.div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full sm:w-[9.5rem]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ExamRow({ row, onManage }) {
  const style = typeStyle(row.type);
  const Icon = style.icon;
  const participation = row.attendanceTotal
    ? Math.round((row.attendancePresent / row.attendanceTotal) * 100)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-4 transition hover:bg-foreground/[0.02] lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_5.5rem] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.tint}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${style.badge}`}>
            {typeLabel(row.type)}
          </span>
          <p className="mt-1 truncate text-sm font-black">{row.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {row.questionCount ? <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{row.questionCount} Soru</span> : null}
            {row.duration ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{row.duration}</span> : null}
            {row.className ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{row.className}</span> : null}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{row.subject || '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{row.className || '—'}</p>
      </div>

      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          {formatExamDate(row.date, row.dateLabel)}
        </p>
        <p className="truncate text-xs text-muted-foreground">{weekdayLabel(row.date, row.startTime) || '—'}</p>
      </div>

      <div>
        {row.attendanceTotal ? (
          <>
            <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {row.attendancePresent} / {row.attendanceTotal}
            </p>
            <p className="text-xs text-muted-foreground">%{participation}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground">%0</p>
          </>
        )}
      </div>

      <div>
        {row.averageScore != null ? (
          <>
            <p className={`text-lg font-black tabular-nums ${
              row.averageScore >= 85 ? 'text-emerald-600'
                : row.averageScore >= 70 ? 'text-sky-600'
                  : row.averageScore >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}
            >
              {row.averageScore}
            </p>
            <p className="text-[11px] text-muted-foreground">Puan</p>
            <div className="mt-1 h-1.5 w-full max-w-[6rem] overflow-hidden rounded-full bg-foreground/10">
              <div
                className={`h-full rounded-full ${
                  row.averageScore >= 85 ? 'bg-emerald-500'
                    : row.averageScore >= 70 ? 'bg-sky-500'
                      : row.averageScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, row.averageScore))}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-black text-muted-foreground">—</p>
            <p className="text-[11px] text-muted-foreground">Puan</p>
          </>
        )}
      </div>

      <div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(row.status)}`}>
          {row.status || 'Planlandı'}
        </span>
      </div>

      <div className="lg:text-right">
        <Button size="sm" className="w-full lg:w-auto" onClick={onManage}>Yönet</Button>
      </div>
    </div>
  );
}
