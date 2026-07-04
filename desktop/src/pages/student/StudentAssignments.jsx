import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import {
  Files, Clock, AlertCircle, CheckCircle, Award, Upload, Eye, Download,
  Search, BookOpen, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { getDesktopApiBaseUrl } from '../../lib/appEnv';
import { classMatchesMine, fetchHomework, getMyClassName, submitHomework, uploadFile } from '../../lib/api/modules';
import { openHttpUrl } from '../../lib/safeOpen';

const PAGE_SIZE = 8;
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const STATUS = {
  pending: ['warn', 'Bekleyen', 'bg-amber-400'],
  overdue: ['danger', 'Gecikmiş', 'bg-rose-400'],
  submitted: ['soon', 'Teslim Edildi', 'bg-emerald-400'],
  graded: ['done', 'Değerlendirildi', 'bg-sky-400'],
};

const TABS = [
  ['all', 'Tümü'],
  ['pending', 'Bekleyen'],
  ['overdue', 'Gecikmiş'],
  ['submitted', 'Teslim Edilen'],
  ['graded', 'Değerlendirilen'],
];

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c').replaceAll('ğ', 'g').replaceAll('ı', 'i')
    .replaceAll('ö', 'o').replaceAll('ş', 's').replaceAll('ü', 'u')
    .trim();
}

function decodeText(value = '') {
  return String(value || '')
    .replaceAll('&#xFC;', 'ü').replaceAll('&#xDC;', 'Ü').replaceAll('&#xE7;', 'ç').replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı').replaceAll('&#x130;', 'İ').replaceAll('&#xF6;', 'ö').replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş').replaceAll('&#x15E;', 'Ş').replaceAll('&#x11F;', 'ğ').replaceAll('&#x11E;', 'Ğ')
    .replaceAll('&uuml;', 'ü').replaceAll('&Uuml;', 'Ü').replaceAll('&ccedil;', 'ç').replaceAll('&Ccedil;', 'Ç')
    .replaceAll('&ouml;', 'ö').replaceAll('&Ouml;', 'Ö').replaceAll('&scedil;', 'ş').replaceAll('&Scedil;', 'Ş')
    .replaceAll('&nbsp;', ' ');
}

function letterGrade(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return '-';
  if (value >= 90) return 'A';
  if (value >= 85) return 'A-';
  if (value >= 80) return 'B+';
  if (value >= 75) return 'B';
  if (value >= 70) return 'C+';
  if (value >= 60) return 'C';
  return 'D';
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysLeftLabel(deadline) {
  const date = parseDate(deadline);
  if (!date) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days > 0) return { text: `${days} gün kaldı`, tone: days <= 3 ? 'text-rose-400' : 'text-[hsl(var(--brand-accent))]' };
  if (days === 0) return { text: 'Bugün', tone: 'text-rose-400' };
  return { text: `${Math.abs(days)} gün geçti`, tone: 'text-muted-foreground' };
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return value || '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function AssignmentCalendar({ marks }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid h-6 w-6 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid h-6 w-6 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((day) => <span key={day} className="py-1 font-semibold">{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`e${index}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const mark = marks[iso];
          return (
            <span key={iso} className={`relative grid h-8 place-items-center rounded-lg text-xs font-medium ${isToday ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-foreground'}`}>
              {day}
              {mark && !isToday ? <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${mark}`} /> : null}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Bekleyen</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Gecikmiş</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Teslim Edilen</span>
      </div>
    </div>
  );
}

export default function StudentAssignments() {
  const { toast } = useToast();
  const { user } = useApp();
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [detailAssignment, setDetailAssignment] = useState(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const studentName = user?.name || '';

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [payload, myClass] = await Promise.all([fetchHomework(), getMyClassName(user)]);
      const list = Array.isArray(payload) ? payload : [];
      // Yalnızca öğrencinin kendi sınıfına ait (veya genel) ödevler görünür.
      setAssignments(list.filter((item) => classMatchesMine(item.className, myClass)));
    } catch (err) {
      setError(err.message || 'Ödevler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const enriched = useMemo(() => assignments.map((item) => {
    const ownSubmission = (item.submissions || []).find((submission) => normalize(submission.studentName) === normalize(studentName));
    const dueDate = new Date(item.deadline);
    const overdue = dueDate < new Date() && !ownSubmission;
    const status = ownSubmission ? (ownSubmission.grade != null ? 'graded' : 'submitted') : (overdue ? 'overdue' : 'pending');
    return { ...item, ownSubmission, status };
  }), [assignments, studentName]);

  const counts = useMemo(() => ({
    total: enriched.length,
    pending: enriched.filter((item) => item.status === 'pending').length,
    overdue: enriched.filter((item) => item.status === 'overdue').length,
    submitted: enriched.filter((item) => item.status === 'submitted').length,
    graded: enriched.filter((item) => item.status === 'graded').length,
  }), [enriched]);

  const subjects = useMemo(() => Array.from(new Set(enriched.map((item) => item.subject).filter(Boolean))), [enriched]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return enriched
      .filter((item) => activeTab === 'all' || item.status === activeTab)
      .filter((item) => subjectFilter === 'all' || item.subject === subjectFilter)
      .filter((item) => !q || normalize(`${item.title} ${item.subject}`).includes(q))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [enriched, activeTab, subjectFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const upcoming = useMemo(() => enriched
    .filter((item) => ['pending', 'overdue'].includes(item.status))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4), [enriched]);
  const graded = useMemo(() => enriched.filter((item) => item.status === 'graded').slice(0, 4), [enriched]);
  const calendarMarks = useMemo(() => {
    const marks = {};
    enriched.forEach((item) => {
      const date = parseDate(item.deadline);
      if (!date) return;
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      marks[iso] = STATUS[item.status]?.[2] || 'bg-muted';
    });
    return marks;
  }, [enriched]);

  const normalizeAttachment = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes('::')) {
      const [name, url] = raw.split('::');
      return { name: decodeText(name?.trim() || 'Dosya'), url: url?.trim() || '' };
    }
    return { name: decodeText(raw.split('/').pop() || raw), url: raw };
  };

  const resolveAssetUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const baseUrl = getDesktopApiBaseUrl();
    return raw.startsWith('/') ? `${baseUrl}${raw}` : `${baseUrl}/${raw}`;
  };

  const openAttachment = (attachment) => {
    const url = resolveAssetUrl(attachment?.url);
    if (url) openHttpUrl(url);
  };

  const downloadAttachment = async (attachment) => {
    const url = resolveAssetUrl(attachment?.url);
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = attachment?.name || 'dosya';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleSubmitHomework = async () => {
    if (!selectedAssignment) return;
    try {
      setSubmitting(true);
      const uploadedFiles = [];
      for (const file of submissionFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await uploadFile(formData, 'homework-submissions');
        const fileName = uploaded.fileName || file.name;
        const fileUrl = uploaded.fileUrl || uploaded.fileName || file.name;
        uploadedFiles.push(`${fileName}::${fileUrl}`);
      }
      const updated = await submitHomework(selectedAssignment.id, {
        studentName,
        note: submissionNote.trim(),
        files: uploadedFiles,
      });
      setAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAssignment(null);
      setSubmissionNote('');
      setSubmissionFiles([]);
      toast({ title: 'Ödev teslim edildi', description: `${updated.title} backend üzerinde güncellendi.` });
    } catch (err) {
      toast({ title: 'Teslim başarısız', description: err.message || 'Lütfen tekrar deneyin.' });
    } finally {
      setSubmitting(false);
    }
  };

  const rowAction = (item) => {
    if (['pending', 'overdue'].includes(item.status)) return { label: 'Teslim Et', onClick: () => setSelectedAssignment(item) };
    if (item.status === 'graded') return { label: 'Sonucu Gör', onClick: () => setDetailAssignment(item) };
    return { label: 'Görüntüle', onClick: () => setDetailAssignment(item) };
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Ödevler yükleniyor...</p>
      </div>
    );
  }

  const statCards = [
    ['Toplam Ödev', counts.total, Files, 'from-sky-400 to-blue-600', 'Tüm derslerden'],
    ['Bekleyen', counts.pending, Clock, 'from-amber-400 to-orange-600', 'Teslim süresi yaklaşan'],
    ['Gecikmiş', counts.overdue, AlertCircle, 'from-rose-400 to-red-600', 'Süresi geçen'],
    ['Teslim Edilen', counts.submitted, CheckCircle, 'from-emerald-400 to-teal-600', 'Değerlendirme bekleyen'],
    ['Değerlendirilen', counts.graded, Award, 'from-violet-400 to-fuchsia-600', 'Sonuçlanan ödevler'],
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="student-assignments-page">
      <div>
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Ödevlerim</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tüm ödevlerini takip et, zamanında teslim et.</p>
      </div>

      {error ? <ErrorBanner title="Ödevler alınamadı" message={error} onRetry={loadAssignments} /> : null}

      {/* Stat kartları */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(([label, value, Icon, gradient, sub]) => (
          <div key={label} className="ci-metric-card flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
            <div className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_12px_28px_hsl(var(--brand-accent)/0.22)] ${gradient}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-3xl font-black tracking-tight">{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Sol: liste */}
        <div className="space-y-4 xl:col-span-2">
          {/* Sekmeler */}
          <div className="flex flex-wrap gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setActiveTab(value); setPage(1); }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}{value !== 'all' ? ` (${counts[value] ?? 0})` : ''}
              </button>
            ))}
          </div>

          {/* Filtre çubuğu */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Ödev ara..."
                className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] py-2 pl-9 pr-3 text-sm outline-none"
              />
            </div>
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-sm outline-none"
            >
              <option value="all">Tüm Dersler</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{decodeText(subject)}</option>)}
            </select>
          </div>

          <PremiumPanel title="Ödev Listesi" description={`${filtered.length} ödev listeleniyor`} contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="ci-table w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Ödev</th>
                    <th className="px-4 py-3 font-semibold">Ders</th>
                    <th className="px-4 py-3 font-semibold">Teslim Tarihi</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                    <th className="px-4 py-3 text-right font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length ? pageItems.map((item) => {
                    const [tone, label] = STATUS[item.status] || ['default', item.status];
                    const due = daysLeftLabel(item.deadline);
                    const action = rowAction(item);
                    return (
                      <tr key={item.id} className="border-b border-foreground/[0.06] transition-colors hover:bg-foreground/[0.025]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{decodeText(item.title)}</p>
                              {item.description ? <p className="truncate text-xs text-muted-foreground">{decodeText(item.description)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{decodeText(item.subject) || '-'}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{formatDate(item.deadline)}</p>
                          {due ? <p className={`text-xs ${due.tone}`}>{due.text}</p> : null}
                        </td>
                        <td className="px-4 py-3"><PremiumStatusPill tone={tone}>{label}</PremiumStatusPill></td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant={['pending', 'overdue'].includes(item.status) ? 'default' : 'outline'} className="text-xs" onClick={action.onClick}>{action.label}</Button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Bu filtrede ödev bulunmuyor.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-foreground/10 px-4 py-3">
                <span className="text-xs text-muted-foreground">{filtered.length} ödev listeleniyor</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-2 text-xs font-semibold tabular-nums">{safePage} / {pageCount}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : null}
          </PremiumPanel>
        </div>

        {/* Sağ ray */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <PremiumPanel title="Ödev Takvimi" description="Teslim tarihleri">
            <AssignmentCalendar marks={calendarMarks} />
          </PremiumPanel>

          <PremiumPanel title="Yaklaşan Teslimler" description="Süresi yaklaşan ödevler" contentClassName="space-y-2.5">
            {upcoming.length ? upcoming.map((item) => {
              const date = parseDate(item.deadline);
              const due = daysLeftLabel(item.deadline);
              return (
                <button key={item.id} onClick={() => setDetailAssignment(item)} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-sm font-black tabular-nums">{date ? date.getDate() : '-'}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{date ? new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(date) : ''}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{decodeText(item.title)}</p>
                    <p className="truncate text-xs text-muted-foreground">{decodeText(item.subject)}</p>
                  </div>
                  {due ? <span className={`shrink-0 text-xs font-semibold ${due.tone}`}>{due.text}</span> : null}
                </button>
              );
            }) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Yaklaşan teslim yok.</div>}
          </PremiumPanel>

          <PremiumPanel title="Sonuçlanan Ödevler" description="Değerlendirilen ödevlerin" contentClassName="space-y-2.5">
            {graded.length ? graded.map((item) => (
              <button key={item.id} onClick={() => setDetailAssignment(item)} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><Award className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{decodeText(item.title)}</p>
                  <p className="truncate text-xs text-muted-foreground">{decodeText(item.subject)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black text-[hsl(var(--brand-accent))]">{letterGrade(item.ownSubmission?.grade)}</p>
                  <p className="text-[10px] text-muted-foreground">{item.ownSubmission?.grade ?? '-'}/100</p>
                </div>
              </button>
            )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Henüz sonuçlanan ödev yok.</div>}
          </PremiumPanel>
        </div>
      </div>

      {/* Teslim modalı */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decodeText(selectedAssignment?.title)} ödevini teslim et</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Teslim notu veya dosya açıklaması" value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} />
            <div className="space-y-3 rounded-xl border border-dashed p-4">
              <input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.avi" onChange={(e) => setSubmissionFiles(Array.from(e.target.files || []))} />
              <div className="flex flex-wrap gap-2">
                {submissionFiles.length > 0 ? submissionFiles.map((file) => (
                  <Badge key={`${file.name}-${file.size}`} variant="outline" className="gap-2 px-3 py-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold">{submissionFileTag(file)}</span>
                    {describeSubmissionFile(file)}
                  </Badge>
                )) : <span className="text-sm text-muted-foreground">PDF, video, resim ve belge ekleyebilirsiniz.</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAssignment(null)}>İptal</Button>
            <Button onClick={handleSubmitHomework} disabled={submitting}>{submitting ? 'Teslim ediliyor...' : 'Teslim Et'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detay modalı */}
      <Dialog open={!!detailAssignment} onOpenChange={() => setDetailAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödev Detayı</DialogTitle>
          </DialogHeader>
          {detailAssignment ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Başlık</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.title)}</p>
              </div>
              <div>
                <p className="font-medium">Açıklama</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.description)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Ders</p>
                  <p className="text-muted-foreground">{decodeText(detailAssignment.subject)}</p>
                </div>
                <div>
                  <p className="font-medium">Son Teslim</p>
                  <p className="text-muted-foreground">{formatDate(detailAssignment.deadline)}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">Teslim Notu</p>
                <p className="text-muted-foreground">{decodeText(detailAssignment.ownSubmission?.note || 'Henüz not eklenmemiş.')}</p>
              </div>
              <div>
                <p className="font-medium">Öğretmen Materyalleri</p>
                <div className="mt-2 space-y-2">
                  {(detailAssignment.materials || []).length > 0 ? detailAssignment.materials.map((value, index) => {
                    const attachment = normalizeAttachment(value);
                    if (!attachment) return null;
                    return (
                      <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">Öğretmen tarafından paylaşıldı</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openAttachment(attachment)}>Aç</Button>
                          <Button variant="outline" size="icon" onClick={() => downloadAttachment(attachment)}><Download className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-muted-foreground">Öğretmen materyal yüklememiş.</p>}
                </div>
              </div>
              <div>
                <p className="font-medium">Teslim Dosyaları</p>
                <div className="mt-2 space-y-2">
                  {((detailAssignment.ownSubmission?.attachments || detailAssignment.ownSubmission?.files || [])).length > 0 ? (detailAssignment.ownSubmission?.attachments || detailAssignment.ownSubmission?.files || []).map((value, index) => {
                    const attachment = normalizeAttachment(value);
                    if (!attachment) return null;
                    return (
                      <div key={`${attachment.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">Yüklediğin dosya</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openAttachment(attachment)}>Aç</Button>
                          <Button variant="outline" size="icon" onClick={() => downloadAttachment(attachment)}><Download className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    );
                  }) : <p className="text-muted-foreground">Henüz teslim dosyası yüklenmemiş.</p>}
                </div>
              </div>
              {detailAssignment.ownSubmission?.grade != null ? (
                <div>
                  <p className="font-medium">Not</p>
                  <p className="font-semibold text-emerald-400">{detailAssignment.ownSubmission.grade} ({letterGrade(detailAssignment.ownSubmission.grade)})</p>
                </div>
              ) : null}
              {['pending', 'overdue'].includes(detailAssignment.status) ? (
                <Button className="w-full" onClick={() => { setSelectedAssignment(detailAssignment); setDetailAssignment(null); }}>
                  <Upload className="mr-2 h-4 w-4" />Teslim Et
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function describeSubmissionFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'Görsel hazır';
  if (name.endsWith('.pdf')) return 'PDF hazır';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'Video hazır';
  return 'Ek dosya hazır';
}

function submissionFileTag(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(name)) return 'IMG';
  if (name.endsWith('.pdf')) return 'PDF';
  if (/\.(mp4|mov|avi|m4v|webm)$/.test(name)) return 'VID';
  return 'DOS';
}
