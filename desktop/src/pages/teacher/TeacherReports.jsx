import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileImage, FilePlus2, FileText, MailCheck, Send, Sparkles, UserRound, UsersRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  createTeacherWeeklyReport,
  fetchClasses,
  fetchReportStudents,
  fetchStudents,
  fetchTeacherWeeklyReportBootstrap,
  fetchTeacherWeeklyReportsForTeacher,
  uploadFile,
} from '../../lib/api/modules';

const weeklyPeriods = ['Bu Hafta', 'Geçen Hafta', 'Aylık Özet'];

function decodeHtmlEntities(value) {
  return String(value || '')
    .replaceAll('&#xFC;', 'ü')
    .replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç')
    .replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı')
    .replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö')
    .replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş')
    .replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ')
    .replaceAll('&#x11E;', 'Ğ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function prettyDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Az once'
    : new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function fileTypeLabel(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (/\.(png|jpg|jpeg|webp)$/i.test(lower)) return 'Görsel';
  if (/\.(mp4|mov|avi|m4v)$/i.test(lower)) return 'Video';
  return 'Dosya';
}

function normalizeClassName(value) {
  return decodeHtmlEntities(value).trim().toLowerCase().replaceAll('-', '').replaceAll(' ', '');
}

export default function TeacherReports() {
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [success, setSuccess] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [bootstrap, setBootstrap] = useState({ classes: [], subjects: [], students: [] });
  const [sentReports, setSentReports] = useState([]);
  const [form, setForm] = useState({
    className: '',
    studentKey: '',
    subject: '',
    title: '',
    summary: '',
    highlights: '',
    supportNotes: '',
    weeklyPeriodLabel: 'Bu Hafta',
    attachments: [],
  });

  const teacherName = user?.name || 'Öğretmen';
  const teacherUsername = user?.username || '';

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setLoadWarning('');
      const [bootstrapResult, reportResult, classResult, studentResult, reportStudentResult] = await Promise.allSettled([
        fetchTeacherWeeklyReportBootstrap({ teacherUsername }),
        fetchTeacherWeeklyReportsForTeacher({ teacherUsername, teacherName }),
        fetchClasses(),
        fetchStudents(),
        fetchReportStudents(),
      ]);

      const bootstrapData = bootstrapResult.status === 'fulfilled' && bootstrapResult.value && typeof bootstrapResult.value === 'object'
        ? bootstrapResult.value
        : null;
      const reportData = reportResult.status === 'fulfilled' && Array.isArray(reportResult.value) ? reportResult.value : [];
      const fallbackClasses = classResult.status === 'fulfilled' && Array.isArray(classResult.value) ? classResult.value : [];
      const fallbackStudents = studentResult.status === 'fulfilled' && Array.isArray(studentResult.value)
        ? studentResult.value.map((item) => ({
          fullName: item.fullName || '',
          username: item.username || '',
          className: item.className || '',
          parentName: item.parentName || '',
          parentEmail: item.parentEmail || '',
        }))
        : [];
      const reportStudents = reportStudentResult.status === 'fulfilled' && Array.isArray(reportStudentResult.value)
        ? reportStudentResult.value.map((item) => ({
          fullName: item.fullName || '',
          username: item.username || item.fullName || '',
          className: item.className || '',
          parentName: item.parentName || '',
          parentEmail: item.parentEmail || '',
        }))
        : [];

      const classes = [...new Map(
        [...(bootstrapData?.classes || []), ...fallbackClasses, ...reportStudents.map((item) => item.className)]
          .filter(Boolean)
          .map((item) => [normalizeClassName(item), decodeHtmlEntities(item)]),
      ).values()];
      const students = (bootstrapData?.students?.length ? bootstrapData.students : [...fallbackStudents, ...reportStudents])
        .map((item) => ({
          ...item,
          fullName: decodeHtmlEntities(item.fullName),
          username: decodeHtmlEntities(item.username),
          className: decodeHtmlEntities(item.className),
          parentName: decodeHtmlEntities(item.parentName),
          parentEmail: decodeHtmlEntities(item.parentEmail),
        }))
        .filter((item) => item.fullName && item.className);
      const subjects = [...new Set([
        ...(bootstrapData?.subjects || []),
        user?.department || '',
        'Matematik',
        'Türkçe',
        'Fen Bilimleri',
        'Sosyal Bilgiler',
      ].filter(Boolean).map((item) => decodeHtmlEntities(item)))];

      const rejectedResults = [bootstrapResult, reportResult, classResult, studentResult, reportStudentResult]
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason?.message || '')
        .filter(Boolean);

      if (rejectedResults.length > 0) {
        setLoadWarning('Bazı rapor servisleri şu an eksik görünüyor. Sayfa fallback verilerle açıldı.');
      }

      setBootstrap({
        classes,
        subjects,
        students,
      });
      setSentReports((reportData || []).map((item) => ({
        ...item,
        teacherUsername: decodeHtmlEntities(item.teacherUsername),
        teacherName: decodeHtmlEntities(item.teacherName),
        studentUsername: decodeHtmlEntities(item.studentUsername),
        studentName: decodeHtmlEntities(item.studentName),
        parentName: decodeHtmlEntities(item.parentName),
        parentEmail: decodeHtmlEntities(item.parentEmail),
        className: decodeHtmlEntities(item.className),
        subject: decodeHtmlEntities(item.subject),
        title: decodeHtmlEntities(item.title),
        summary: decodeHtmlEntities(item.summary),
        highlights: decodeHtmlEntities(item.highlights),
        supportNotes: decodeHtmlEntities(item.supportNotes),
        weeklyPeriodLabel: decodeHtmlEntities(item.weeklyPeriodLabel),
        attachments: (item.attachments || []).map((attachment) => ({
          ...attachment,
          name: decodeHtmlEntities(attachment.name),
          fileType: decodeHtmlEntities(attachment.fileType),
        })),
      })));
      setForm((prev) => ({
        ...prev,
        className: prev.className || classes[0] || '',
        subject: prev.subject || subjects[0] || '',
      }));
    } catch (err) {
      setError(err.message || 'Öğretmen rapor verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [teacherName, teacherUsername, user?.department]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const scopedStudents = useMemo(() => {
    if (!form.className) return bootstrap.students;
    const normalizedSelectedClass = normalizeClassName(form.className);
    return bootstrap.students.filter((item) => normalizeClassName(item.className) === normalizedSelectedClass);
  }, [bootstrap.students, form.className]);

  const selectedStudent = useMemo(
    () => scopedStudents.find((item) => (item.username || item.fullName) === form.studentKey) || null,
    [scopedStudents, form.studentKey],
  );

  const summaryStats = useMemo(() => {
    const uniqueStudents = new Set(sentReports.map((item) => item.studentUsername || item.studentName));
    const attachmentCount = sentReports.reduce((sum, item) => sum + (item.attachments?.length || 0), 0);
    return {
      totalReports: sentReports.length,
      totalStudents: uniqueStudents.size,
      totalAttachments: attachmentCount,
    };
  }, [sentReports]);

  const openComposer = () => {
    setSuccess('');
    setComposerOpen(true);
  };

  const resetComposer = () => {
    setComposerOpen(false);
    setForm({
      className: bootstrap.classes[0] || '',
      studentKey: '',
      subject: bootstrap.subjects[0] || user?.department || '',
      title: '',
      summary: '',
      highlights: '',
      supportNotes: '',
      weeklyPeriodLabel: 'Bu Hafta',
      attachments: [],
    });
  };

  const handleAttachmentPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await uploadFile(formData, 'teacher-weekly-reports');
      const url = uploaded?.fileUrl || uploaded?.url || '';
      const name = uploaded?.fileName || file.name;
      setForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          { name, url, fileType: fileTypeLabel(name) },
        ],
      }));
    } catch (err) {
      setError(err.message || 'Dosya yüklenemedi.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.className || !form.studentKey || !form.subject || !form.summary.trim()) {
      setError('Sınıf, öğrenci, ders ve özet alanlarını doldurun.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const created = await createTeacherWeeklyReport({
        teacherUsername,
        teacherName,
        studentUsername: selectedStudent?.username || '',
        studentName: selectedStudent?.fullName || '',
        className: form.className,
        subject: form.subject,
        title: form.title.trim() || `${form.subject} Haftalık Gelişim Raporu`,
        summary: form.summary.trim(),
        highlights: form.highlights.trim(),
        supportNotes: form.supportNotes.trim(),
        weeklyPeriodLabel: form.weeklyPeriodLabel,
        attachments: form.attachments,
      });
      setSentReports((prev) => [created, ...prev]);
      setSuccess(`${selectedStudent?.fullName || 'Öğrenci'} için haftalık rapor veliye gönderildi.`);
      resetComposer();
    } catch (err) {
      setError(err.message || 'Haftalık rapor gönderilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#38bdf8_100%)] p-8 text-white shadow-[0_24px_80px_rgba(29,78,216,0.26)]">
        <div className="absolute right-6 top-6 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">Haftalık Rapor Merkezi</div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-heading">Öğrenci için haftalık rapor oluştur</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Sınıfını seç, dersindeki öğrencilerden birini belirle, görsel veya PDF ekle ve raporu doğrudan velinin haftalık rapor alanına gönder.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={openComposer} className="bg-white text-slate-900 hover:bg-white/90">
                <FilePlus2 className="mr-2 h-4 w-4" />
                Haftalık Rapor Oluştur
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatGlassCard icon={FileText} label="Gönderilen Rapor" value={summaryStats.totalReports} />
            <StatGlassCard icon={UsersRound} label="Raporlanan Öğrenci" value={summaryStats.totalStudents} />
            <StatGlassCard icon={FileImage} label="Ek Dosya" value={summaryStats.totalAttachments} />
          </div>
        </div>
      </div>

      {error ? <ErrorBanner title="Rapor işlemi başarısız" message={error} onRetry={loadPage} /> : null}
      {!error && loadWarning ? <ErrorBanner title="Rapor servisi kısmen hazır" message={loadWarning} onRetry={loadPage} /> : null}
      {success ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4 text-emerald-900">
            <MailCheck className="h-5 w-5" />
            <p className="text-sm font-semibold">{success}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden border-slate-200/70 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle>Gönderilen haftalık raporlar</CardTitle>
            <CardDescription>Velilere iletilen raporlar burada tutulur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {sentReports.length === 0 ? (
              <EmptyHint title="Henüz rapor gönderilmedi" description="İlk haftalık raporu oluşturduğunda burada profesyonel kart olarak görünecek." />
            ) : sentReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReport(report)}
                className="group w-full rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">{report.className}</Badge>
                      <Badge variant="outline" className="rounded-full">{report.subject}</Badge>
                      <Badge variant="outline" className="rounded-full">{report.weeklyPeriodLabel}</Badge>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{report.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{report.studentName} • {report.parentName || 'Veli bilgisi'}</p>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">{report.summary}</p>
                  </div>
                  <div className="grid shrink-0 gap-2 text-right">
                    <div className="text-sm font-semibold text-slate-500">{prettyDate(report.createdAtUtc)}</div>
                    <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/60">Ekler</div>
                      <div className="mt-1 text-2xl font-bold">{report.attachments?.length || 0}</div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200/70 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle>Hızlı seçim paneli</CardTitle>
            <CardDescription>Rapor oluştururken kullanacağın sınıf, ders ve öğrenci kaynağı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoTile icon={UsersRound} label="Sınıflar" value={bootstrap.classes.length} />
              <InfoTile icon={UserRound} label="Öğrenciler" value={bootstrap.students.length} />
              <InfoTile icon={CalendarDays} label="Dersler" value={bootstrap.subjects.length} />
              <InfoTile icon={Send} label="Bu Hafta" value={summaryStats.totalReports} />
            </div>
            <div className="rounded-[24px] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Son gönderim</p>
                  <h3 className="mt-2 text-xl font-bold">{sentReports[0]?.studentName || 'Bekleniyor'}</h3>
                </div>
                <Sparkles className="h-6 w-6 text-amber-300" />
              </div>
              <p className="mt-3 text-sm leading-6 text-white/75">
                {sentReports[0]?.summary || 'İlk rapor oluşturulduğunda burada veliye giden özet görünecek.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={composerOpen} onOpenChange={(open) => !open && resetComposer()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Haftalık rapor oluştur</DialogTitle>
            <DialogDescription>Rapor seçili öğrencinin velisine haftalık rapor ekranı üzerinden iletilir.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Sınıf</label>
                  <Select value={form.className} onValueChange={(value) => setForm((prev) => ({ ...prev, className: value, studentKey: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Sınıf seç" /></SelectTrigger>
                    <SelectContent>
                      {bootstrap.classes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Ders</label>
                  <Select value={form.subject} onValueChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}>
                    <SelectTrigger><SelectValue placeholder="Ders seç" /></SelectTrigger>
                    <SelectContent>
                      {bootstrap.subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Öğrenci</label>
                  <Select value={form.studentKey} onValueChange={(value) => setForm((prev) => ({ ...prev, studentKey: value }))}>
                    <SelectTrigger><SelectValue placeholder="Öğrenci seç" /></SelectTrigger>
                    <SelectContent>
                      {scopedStudents.map((item) => {
                        const value = item.username || item.fullName;
                        return <SelectItem key={`${item.className}-${value}`} value={value}>{item.fullName}</SelectItem>;
                      })}
                      
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Dönem etiketi</label>
                  <Select value={form.weeklyPeriodLabel} onValueChange={(value) => setForm((prev) => ({ ...prev, weeklyPeriodLabel: value }))}>
                    <SelectTrigger><SelectValue placeholder="Dönem seç" /></SelectTrigger>
                    <SelectContent>
                      {weeklyPeriods.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Rapor başlığı</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Örn. Türkçe haftalık gelişim raporu"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Öğretmen özeti</label>
                <Textarea
                  className="min-h-[140px]"
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Bu hafta öğrencinin derse katılımı, performansı ve genel görünümü..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Güçlü yönler</label>
                  <Textarea
                    className="min-h-[120px]"
                    value={form.highlights}
                    onChange={(event) => setForm((prev) => ({ ...prev, highlights: event.target.value }))}
                    placeholder="Akıcı okuma, ödev disiplini, sınıf içi katkı..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Destek notları</label>
                  <Textarea
                    className="min-h-[120px]"
                    value={form.supportNotes}
                    onChange={(event) => setForm((prev) => ({ ...prev, supportNotes: event.target.value }))}
                    placeholder="Tekrar önerileri, veli takibi, kısa hedefler..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_100%)] p-5 text-white">
                <div className="text-xs uppercase tracking-[0.2em] text-white/55">Veliye gidecek önizleme</div>
                <h3 className="mt-3 text-2xl font-bold">{form.title.trim() || `${form.subject || 'Ders'} Haftalık Raporu`}</h3>
                <p className="mt-2 text-sm text-white/70">{selectedStudent?.fullName || 'Öğrenci seçilmedi'} • {form.className || 'Sınıf'} • {form.weeklyPeriodLabel}</p>
                <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/82">
                  {form.summary.trim() || 'Öğretmen özeti bu alana yansıyacak.'}
                </div>
              </div>

              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">Görsel, PDF veya dosya ekle</p>
                    <p className="text-sm text-slate-500">Veli rapor modalında açılabilir dosya olarak görünür.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    <FilePlus2 className="h-4 w-4" />
                    Dosya Ekle
                    <input type="file" className="hidden" onChange={handleAttachmentPick} />
                  </label>
                </div>
                <div className="mt-4 space-y-2">
                  {uploading ? <p className="text-sm text-slate-500">Dosya yükleniyor...</p> : null}
                  {form.attachments.length === 0 ? (
                    <p className="text-sm text-slate-500">Henüz ek yüklenmedi.</p>
                  ) : form.attachments.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.fileType}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
                        }))}
                      >
                        Kaldır
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetComposer}>Vazgeç</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              <Send className="mr-2 h-4 w-4" />
              {saving ? 'Gönderiliyor...' : 'Rapor Oluştur ve Veliye Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title || 'Haftalık rapor'}</DialogTitle>
            <DialogDescription>{selectedReport ? `${selectedReport.studentName} • ${selectedReport.className}` : ''}</DialogDescription>
          </DialogHeader>
          {selectedReport ? (
            <div className="space-y-5">
              <div className="rounded-[28px] bg-[linear-gradient(135deg,#111827_0%,#334155_100%)] p-6 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedReport.subject}</Badge>
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedReport.weeklyPeriodLabel}</Badge>
                </div>
                <p className="mt-4 text-lg leading-8 text-white/88">{selectedReport.summary}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-slate-200">
                  <CardHeader><CardTitle className="text-base">Güçlü yönler</CardTitle></CardHeader>
                  <CardContent className="text-sm leading-6 text-slate-600">{selectedReport.highlights || 'Bu raporda ayrıca güçlü yön notu eklenmedi.'}</CardContent>
                </Card>
                <Card className="border-slate-200">
                  <CardHeader><CardTitle className="text-base">Destek alanları</CardTitle></CardHeader>
                  <CardContent className="text-sm leading-6 text-slate-600">{selectedReport.supportNotes || 'Bu raporda ayrıca destek notu eklenmedi.'}</CardContent>
                </Card>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ekler</h4>
                {selectedReport.attachments?.length ? selectedReport.attachments.map((item, index) => (
                  <button
                    key={`${item.url}-${index}`}
                    type="button"
                    onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.fileType}</p>
                    </div>
                    <Badge variant="outline">Aç</Badge>
                  </button>
                )) : <EmptyHint title="Ek yüklenmedi" description="Bu raporda sadece öğretmen notu bulunuyor." />}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function StatGlassCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <Icon className="h-5 w-5 text-white/80" />
      <div className="mt-4 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-white/75">{label}</div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ title, description }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
