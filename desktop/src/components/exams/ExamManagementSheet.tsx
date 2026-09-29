import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '../../hooks/use-toast';
import {
  createExamResult,
  deleteExamResult,
  deletePlannedExam,
  fetchInstitutionProfile,
  fetchPlannedExamAttendance,
  savePlannedExamAttendance,
  updateExamResult,
  updatePlannedExam,
} from '../../lib/api/modules';
import { computeExamStats, downloadExamReportPdf } from '../../lib/examReportPdf';
import { StatusBadge } from '../ui/status-badge';

export const EXAM_TYPES = ['Yazılı', 'Deneme', 'Ünite', 'Quiz', 'Proje'];
export const EXAM_STATUSES = ['Taslak', 'Planlandı', 'Tamamlandı', 'İptal'];

// "1-A Sınıfı" ile "1-A" aynı sınıftır: karşılaştırma için ek/boşluk/işaret atılır.
export function classKey(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/sınıfı|sinifi|sınıf|sinif|şubesi|subesi/g, '')
    .replace(/[^a-z0-9çğıöşü]/g, '');
}

export function scoreTone(score) {
  const value = Number(score) || 0;
  if (value >= 85) return 'text-emerald-600';
  if (value >= 70) return 'text-sky-600';
  if (value >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function SectionHeader({ title, description, onBack }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 px-6 py-4">
      <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" onClick={onBack} aria-label="Geri">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0">
        <p className="truncate text-base font-black">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function MenuRow({ icon: Icon, label, description, onClick, destructive = false, disabled = false, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
        destructive ? 'hover:bg-red-500/10' : 'hover:bg-muted/70'
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
        destructive ? 'bg-red-500/10 text-red-600' : 'bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]'
      }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${destructive ? 'text-red-600' : ''}`}>{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      {badge ? <Badge variant="outline" className="shrink-0">{badge}</Badge> : null}
    </button>
  );
}

/**
 * Sınav "Yönet" penceresi — tablo satırındaki tek butondan açılır.
 *
 * Menüden alt görünümlere (detay / künye düzenleme / sonuç girişi / yoklama)
 * geçilir; her işlem gerçek uçlara yazar. Yazma yetkisi olmayan kullanıcıda
 * ilgili satırlar kapalı gelir (bkz. canEditResults / canEditExam / canDelete).
 */
export default function ExamManagementSheet({
  exam,
  results = [],
  students = [],
  open,
  onOpenChange,
  onChanged,
  // Sonuç girişi yalnız rol yetkisine bağlıdır; künye düzenleme/yoklama/silme ise
  // ayrıca planlı sınav kaydı ister (yalnız sonucu olan eski kayıtlarda yoktur).
  canEditResults = true,
  canEditExam = true,
  canDelete = true,
}) {
  const { toast } = useToast();
  const [view, setView] = useState('menu');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (open) setView('menu'); }, [open, exam?.id]);

  const examResults = useMemo(
    () => results.filter((row) => (row.examTitle || row.title) === exam?.title),
    [results, exam?.title],
  );
  const stats = useMemo(() => computeExamStats(examResults), [examResults]);

  const roster = useMemo(() => {
    const key = classKey(exam?.className);
    const matched = students.filter((student) => classKey(student.className) === key);
    return matched.length > 0 ? matched : students;
  }, [students, exam?.className]);

  const notifyChange = useCallback(async () => { await onChanged?.(); }, [onChanged]);

  const copySummary = async () => {
    const summary = [
      exam?.title,
      [exam?.subject, exam?.className].filter(Boolean).join(' • '),
      [exam?.dateLabel, exam?.startTime].filter(Boolean).join(' '),
      `${stats.count} sonuç · ortalama ${stats.average}`,
      `En yüksek ${stats.highest} · en düşük ${stats.lowest}`,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: 'Özet kopyalandı', description: 'Pano içeriğine yapıştırabilirsiniz.' });
    } catch {
      toast({ title: 'Kopyalanamadı', description: 'Tarayıcı pano erişimine izin vermedi.', variant: 'destructive' });
    }
  };

  const downloadCsv = () => {
    const rows = [
      ['Ogrenci', 'Sinif', 'Sinav', 'Ders', 'Net', 'Puan'],
      ...[...examResults]
        .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
        .map((row) => [row.studentName, row.className, exam?.title, exam?.subject, row.net ?? '', row.score]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // BOM: Excel Türkçe karakterleri doğru açsın.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(exam?.title || 'sinav').replace(/\s+/g, '-').toLowerCase()}-sonuclar.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV indirildi', description: `${examResults.length} sonuç dışa aktarıldı.` });
  };

  const downloadPdf = async () => {
    try {
      setBusy(true);
      const institution = await fetchInstitutionProfile().catch(() => ({}));
      await downloadExamReportPdf(exam, examResults, institution || {});
      toast({ title: 'PDF hazır', description: 'Sınav sonuç raporu indirildi.' });
    } catch (err) {
      toast({ title: 'PDF oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      setBusy(true);
      await updatePlannedExam(exam.id, { status });
      toast({ title: 'Durum güncellendi', description: `Sınav "${status}" olarak işaretlendi.` });
      await notifyChange();
    } catch (err) {
      toast({ title: 'Durum değiştirilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const removeExam = async (alsoResults) => {
    try {
      setBusy(true);
      if (alsoResults) {
        await Promise.all(examResults.map((row) => deleteExamResult(row.id).catch(() => null)));
      }
      await deletePlannedExam(exam.id);
      toast({
        title: 'Sınav silindi',
        description: alsoResults ? 'Sınav ve girilen sonuçlar kaldırıldı.' : 'Sınav kaldırıldı, sonuçlar korundu.',
      });
      setConfirmDelete(false);
      onOpenChange(false);
      await notifyChange();
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!exam) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Sınav Yönetimi</p>
            <SheetTitle className="pr-8 text-2xl font-black leading-tight">{exam.title}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <span>{[exam.subject, exam.className, exam.dateLabel].filter(Boolean).join(' • ')}</span>
              <StatusBadge status={exam.status || 'Planlandı'} />
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {view === 'menu' ? (
              <div className="divide-y divide-border/70">
                <MenuRow
                  icon={Eye}
                  label="Görüntüle"
                  description="Künye, istatistik ve öğrenci sonuçları"
                  onClick={() => setView('detail')}
                  badge={`${stats.count} sonuç`}
                />
                <MenuRow
                  icon={ClipboardCheck}
                  label="Sonuç Gir / Düzenle"
                  description="Sınıf listesiyle toplu puan girişi"
                  onClick={() => setView('scores')}
                  disabled={!canEditResults}
                />
                <MenuRow
                  icon={UserCheck}
                  label="Yoklama"
                  description={canEditExam ? 'Var / yok / geç kaldı işaretle' : 'Planlı sınav kaydı olmadığı için kapalı'}
                  onClick={() => setView('attendance')}
                  disabled={!canEditExam}
                />
                <MenuRow
                  icon={Pencil}
                  label="Sınavı Düzenle"
                  description={canEditExam ? 'Başlık, ders, sınıf, tarih, süre ve durum' : 'Planlı sınav kaydı olmadığı için kapalı'}
                  onClick={() => setView('edit')}
                  disabled={!canEditExam}
                />
                <MenuRow
                  icon={FileText}
                  label="PDF Raporu"
                  description="Kurum künyeli sonuç raporu indir"
                  onClick={downloadPdf}
                  disabled={busy}
                />
                <MenuRow
                  icon={Download}
                  label="CSV İndir"
                  description="Sonuç listesini tabloya aktar"
                  onClick={downloadCsv}
                />
                <MenuRow
                  icon={Copy}
                  label="Özeti Kopyala"
                  description="Sınav künyesi ve ortalamayı panoya al"
                  onClick={copySummary}
                />
                <MenuRow
                  icon={Trash2}
                  label="Sınavı Sil"
                  description="Kayıt listeden kaldırılır"
                  onClick={() => setConfirmDelete(true)}
                  destructive
                  disabled={!canDelete}
                />

                <div className="space-y-2 px-5 py-4">
                  <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Durum</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXAM_STATUSES.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={(exam.status || 'Planlandı') === status ? 'default' : 'outline'}
                        disabled={!canEditExam || busy}
                        onClick={() => changeStatus(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {view === 'detail' ? (
              <ExamDetailView exam={exam} rows={examResults} stats={stats} onBack={() => setView('menu')} />
            ) : null}

            {view === 'edit' ? (
              <ExamEditView
                exam={exam}
                onBack={() => setView('menu')}
                onSaved={async () => { setView('menu'); await notifyChange(); }}
              />
            ) : null}

            {view === 'scores' ? (
              <ExamScoreEntryView
                exam={exam}
                roster={roster}
                rows={examResults}
                onBack={() => setView('menu')}
                onSaved={async () => { await notifyChange(); }}
              />
            ) : null}

            {view === 'attendance' ? (
              <ExamAttendanceView exam={exam} onBack={() => setView('menu')} />
            ) : null}
          </div>

          <div className="border-t border-border/70 p-4">
            <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>“{exam.title}” silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {examResults.length > 0
                ? `Bu sınava girilmiş ${examResults.length} sonuç var. Sonuçları koruyabilir veya sınavla birlikte silebilirsiniz.`
                : 'Sınav kaydı kalıcı olarak silinir.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            {examResults.length > 0 ? (
              <Button variant="outline" disabled={busy} onClick={() => removeExam(false)}>
                Sonuçları koru
              </Button>
            ) : null}
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => { event.preventDefault(); removeExam(examResults.length > 0); }}
              className="bg-red-600 hover:bg-red-600/90"
            >
              {examResults.length > 0 ? 'Sonuçlarla birlikte sil' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExamDetailView({ exam, rows, stats, onBack }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)),
    [rows],
  );

  return (
    <div>
      <SectionHeader title="Sınav Detayı" description="Künye, dağılım ve sonuç listesi" onBack={onBack} />
      <div className="space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Ders', exam.subject || '—'],
            ['Sınıf', exam.className || '—'],
            ['Tür', exam.type || '—'],
            ['Tarih', [exam.dateLabel, exam.startTime].filter(Boolean).join(' ') || '—'],
            ['Süre', exam.duration || '—'],
            ['Soru', exam.questionCount ? `${exam.questionCount} soru` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Sonuç', stats.count],
            ['Ortalama', stats.average],
            ['En Yüksek', stats.highest],
            ['En Düşük', stats.lowest],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-foreground/10 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="h-4 w-4" /> Puan dağılımı
          </p>
          <div className="space-y-2">
            {stats.distribution.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="w-16 text-xs font-semibold text-muted-foreground">{bucket.label}</span>
                <Progress value={stats.count ? (bucket.count / stats.count) * 100 : 0} className="h-2 flex-1" />
                <span className="w-8 text-right text-xs font-bold tabular-nums">{bucket.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-foreground/10">
          <div className="grid grid-cols-[2rem_1fr_5rem_4rem] gap-2 bg-foreground/[0.04] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>#</span><span>Öğrenci</span><span className="text-right">Net</span><span className="text-right">Puan</span>
          </div>
          {sorted.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu sınav için henüz sonuç girilmemiş.</p>
          ) : sorted.map((row, index) => (
            <div key={row.id} className="grid grid-cols-[2rem_1fr_5rem_4rem] items-center gap-2 border-t border-foreground/[0.07] px-4 py-2.5 text-sm">
              <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
              <span className="truncate font-semibold">{row.studentName}</span>
              <span className="text-right text-xs text-muted-foreground tabular-nums">{row.net ?? '—'}</span>
              <span className={`text-right font-black tabular-nums ${scoreTone(row.score)}`}>{row.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExamEditView({ exam, onBack, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: exam.title || '',
    subject: exam.subject || '',
    className: exam.className || '',
    type: exam.type || 'Yazılı',
    dateLabel: exam.dateLabel || '',
    startTime: exam.startTime || '',
    duration: exam.duration || '',
    questionCount: exam.questionCount ?? '',
    totalPoint: exam.totalPoint ?? 100,
    status: exam.status || 'Planlandı',
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.title.trim() || !form.subject.trim() || !form.className.trim()) {
      toast({ title: 'Eksik bilgi', description: 'Başlık, ders ve sınıf zorunlu.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await updatePlannedExam(exam.id, {
        title: form.title.trim(),
        subject: form.subject.trim(),
        className: form.className.trim(),
        type: form.type,
        dateLabel: form.dateLabel.trim(),
        startTime: form.startTime.trim(),
        duration: form.duration.trim(),
        status: form.status,
        questionCount: form.questionCount === '' ? undefined : Number(form.questionCount),
        totalPoint: form.totalPoint === '' ? undefined : Number(form.totalPoint),
      });
      toast({ title: 'Sınav güncellendi', description: 'Künye bilgileri kaydedildi.' });
      await onSaved?.();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Sınavı Düzenle" description="Değişiklikler listeye anında yansır" onBack={onBack} />
      <div className="space-y-4 p-6">
        <div className="space-y-2">
          <Label>Başlık</Label>
          <Input value={form.title} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ders</Label>
            <Input value={form.subject} onChange={(e) => update('subject', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sınıf</Label>
            <Input value={form.className} onChange={(e) => update('className', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tür</Label>
            <Select value={form.type} onValueChange={(value) => update('type', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={form.status} onValueChange={(value) => update('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXAM_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tarih</Label>
            <Input value={form.dateLabel} onChange={(e) => update('dateLabel', e.target.value)} placeholder="17 Haziran 2026" />
          </div>
          <div className="space-y-2">
            <Label>Saat</Label>
            <Input value={form.startTime} onChange={(e) => update('startTime', e.target.value)} placeholder="10:00" />
          </div>
          <div className="space-y-2">
            <Label>Süre</Label>
            <Input value={form.duration} onChange={(e) => update('duration', e.target.value)} placeholder="40 dk" />
          </div>
          <div className="space-y-2">
            <Label>Soru sayısı</Label>
            <Input type="number" min="0" value={form.questionCount} onChange={(e) => update('questionCount', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Toplam puan</Label>
            <Input type="number" min="1" value={form.totalPoint} onChange={(e) => update('totalPoint', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onBack} disabled={saving}>Vazgeç</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExamScoreEntryView({ exam, roster, rows, onBack, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({});

  // Girilmiş sonuçlar forma önceden yüklenir; boş bırakılan öğrenci atlanır.
  useEffect(() => {
    const initial = {};
    roster.forEach((student) => {
      const existing = rows.find((row) => row.studentName === student.fullName);
      initial[student.fullName] = {
        score: existing ? String(existing.score ?? '') : '',
        net: existing ? String(existing.net ?? '') : '',
        id: existing?.id || null,
      };
    });
    setDraft(initial);
  }, [roster, rows]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return roster.filter((student) => !query || student.fullName.toLocaleLowerCase('tr-TR').includes(query));
  }, [roster, search]);

  const save = async () => {
    const entries = Object.entries(draft).filter(([, value]) => String(value.score).trim() !== '');
    if (entries.length === 0) {
      toast({ title: 'Girilen puan yok', description: 'En az bir öğrenciye puan yazın.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      let created = 0;
      let updated = 0;
      for (const [studentName, value] of entries) {
        const student = roster.find((item) => item.fullName === studentName);
        const payload = {
          examTitle: exam.title,
          type: exam.type || 'Yazılı',
          subject: exam.subject || '',
          className: student?.className || exam.className || '',
          dateLabel: exam.dateLabel || new Intl.DateTimeFormat('tr-TR').format(new Date()),
          score: Number(value.score),
          net: Number(value.net || 0),
        };
        if (value.id) {
          // eslint-disable-next-line no-await-in-loop
          await updateExamResult(value.id, payload);
          updated += 1;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await createExamResult({ ...payload, studentName });
          created += 1;
        }
      }
      toast({
        title: 'Sonuçlar kaydedildi',
        description: `${created} yeni, ${updated} güncellenen kayıt.`,
      });
      await onSaved?.();
      onBack();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Sonuç Girişi"
        description={`${exam.className || 'Sınıf'} · puanı boş bırakılan öğrenci kaydedilmez`}
        onBack={onBack}
      />
      <div className="space-y-4 p-6">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci ara..." />

        <div className="overflow-hidden rounded-2xl border border-foreground/10">
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 bg-foreground/[0.04] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Öğrenci</span><span className="text-center">Puan</span><span className="text-center">Net</span>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bu sınıfta öğrenci bulunamadı.</p>
          ) : visible.map((student) => (
            <div key={student.id || student.fullName} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-t border-foreground/[0.07] px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{student.fullName}</p>
                <p className="text-xs text-muted-foreground">{student.className}</p>
              </div>
              <Input
                type="number"
                min="0"
                max="100"
                className="h-9 text-center"
                value={draft[student.fullName]?.score ?? ''}
                onChange={(e) => setDraft((prev) => ({
                  ...prev,
                  [student.fullName]: { ...prev[student.fullName], score: e.target.value },
                }))}
              />
              <Input
                type="number"
                step="0.01"
                className="h-9 text-center"
                value={draft[student.fullName]?.net ?? ''}
                onChange={(e) => setDraft((prev) => ({
                  ...prev,
                  [student.fullName]: { ...prev[student.fullName], net: e.target.value },
                }))}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack} disabled={saving}>Vazgeç</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : 'Sonuçları Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExamAttendanceView({ exam, onBack }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPlannedExamAttendance(exam.id)
      .then((data) => { if (active) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [exam.id]);

  const setStatus = (index, status) => {
    setRows((prev) => prev.map((row, position) => (position === index ? { ...row, status } : row)));
  };

  const save = async () => {
    try {
      setSaving(true);
      await savePlannedExamAttendance(exam.id, {
        entries: rows.map((row) => ({
          studentUserId: row.studentUserId,
          studentUsername: row.studentUsername,
          studentName: row.studentName,
          className: row.className,
          status: row.status,
        })),
      });
      toast({ title: 'Yoklama kaydedildi', description: `${rows.length} öğrenci güncellendi.` });
      onBack();
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const statuses = [['Present', 'Var'], ['Late', 'Geç'], ['Absent', 'Yok']];

  return (
    <div>
      <SectionHeader title="Yoklama" description="Sınava giren öğrencileri işaretleyin" onBack={onBack} />
      <div className="space-y-4 p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu sınav için öğrenci listesi bulunamadı.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-foreground/10">
            {rows.map((row, index) => (
              <div key={row.studentUsername || row.studentName} className="flex items-center gap-3 border-b border-foreground/[0.07] px-4 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.studentName}</p>
                  <p className="text-xs text-muted-foreground">{row.className}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {statuses.map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={row.status === value ? 'default' : 'outline'}
                      className="h-8 px-2.5 text-xs"
                      onClick={() => setStatus(index, value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack} disabled={saving}>Vazgeç</Button>
          <Button className="flex-1" onClick={save} disabled={saving || loading || rows.length === 0}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor</> : 'Yoklamayı Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
