import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, BarChart3, CheckCircle2, Download, Eye,
  FileDown, FileText, MoreVertical, Printer, Save, Search, Settings2, Upload,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  approveExamSubmission,
  createExamResult,
  fetchExamResults,
  fetchPlannedExams,
  fetchPlannedExamSubmissions,
  fetchReportStudents,
} from '../../lib/api/modules';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';

const weights = { first: 0.4, second: 0.4, performance: 0.2 };

function decodeText(value = '') {
  return String(value)
    .replaceAll('&#xFC;', 'ü').replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç').replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı').replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö').replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş').replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ').replaceAll('&#x11E;', 'Ğ');
}

function clampGrade(value) {
  const text = String(value ?? '').replace(/[^\d]/g, '').slice(0, 3);
  if (text === '') return '';
  return String(Math.min(100, Math.max(0, Number(text))));
}

function initials(name = '') {
  const parts = decodeText(name).trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'Ö'}${parts.at(-1)?.[0] || ''}`;
}

function average(values) {
  const safe = values.map(Number).filter((item) => Number.isFinite(item));
  return safe.length ? safe.reduce((sum, item) => sum + item, 0) / safe.length : 0;
}

function statusFor(value) {
  if (value >= 85) return { label: 'Başarılı', color: 'emerald' };
  if (value >= 70) return { label: 'İyi', color: 'blue' };
  if (value >= 50) return { label: 'Orta', color: 'amber' };
  return { label: 'Geliştirilmeli', color: 'red' };
}

function downloadText(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildRows(students, records, subjectFilter) {
  return students.map((student) => {
    const name = decodeText(student.fullName || student.studentName || '');
    const className = decodeText(student.className || '');
    const related = records
      .filter((item) => decodeText(item.studentName) === name)
      .filter((item) => !subjectFilter || subjectFilter === 'Tüm Dersler' || decodeText(item.subject) === subjectFilter)
      .sort((a, b) => new Date(b.createdAtUtc || b.date || 0) - new Date(a.createdAtUtc || a.date || 0));
    const first = related.find((item) => /1|bir/i.test(`${item.examTitle} ${item.type}`)) || related[0];
    const second = related.find((item) => /2|iki/i.test(`${item.examTitle} ${item.type}`)) || related[1];
    const performance = related.find((item) => /performans|performance/i.test(`${item.examTitle} ${item.type}`)) || related[2];
    const firstGrade = first?.score ?? '';
    const secondGrade = second?.score ?? '';
    const performanceGrade = performance?.score ?? '';
    const entered = [firstGrade, secondGrade, performanceGrade].filter((item) => item !== '');
    const finalGrade = entered.length === 3
      ? Number(firstGrade) * weights.first + Number(secondGrade) * weights.second + Number(performanceGrade) * weights.performance
      : average(entered);
    return {
      id: student.id || student.username || name,
      fullName: name,
      username: student.username || '',
      className,
      parentName: student.parentName || '',
      firstGrade: firstGrade === '' ? '' : String(firstGrade),
      secondGrade: secondGrade === '' ? '' : String(secondGrade),
      performanceGrade: performanceGrade === '' ? '' : String(performanceGrade),
      finalGrade: Number.isFinite(finalGrade) ? Number(finalGrade.toFixed(2)) : 0,
      recent: related.slice(0, 5),
    };
  });
}

function SelectBox({ label, value, options, onChange }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-400 dark:border-foreground/10 dark:bg-[#0B1728] dark:text-white"
      >
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function DetailPanel({ row, rows, subject, onClose }) {
  if (!row) return null;
  const sorted = [...rows].sort((a, b) => b.finalGrade - a.finalGrade);
  const rank = sorted.findIndex((item) => item.id === row.id) + 1;
  const distribution = [
    ['90 - 100', rows.filter((item) => item.finalGrade >= 90).length, '#22C55E'],
    ['70 - 89', rows.filter((item) => item.finalGrade >= 70 && item.finalGrade < 90).length, '#3B82F6'],
    ['50 - 69', rows.filter((item) => item.finalGrade >= 50 && item.finalGrade < 70).length, '#F59E0B'],
    ['0 - 49', rows.filter((item) => item.finalGrade < 50).length, '#EF4444'],
  ];
  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 dark:border-foreground/10 dark:bg-[#0E1A2F] dark:shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15 text-xl font-black text-orange-500">{initials(row.fullName)}</div>
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">{row.fullName}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Öğrenci No: {row.username || '-'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.className}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">×</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          ['Dönem Ortalaması', row.finalGrade.toFixed(2), '#8B5CF6'],
          ['Sınıf Sıralaması', `${rank || '-'} / ${rows.length}`, '#3B82F6'],
          ['Devamsızlık', '-', '#F59E0B'],
          ['Etüt Katılımı', '-', '#22C55E'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-foreground/10 dark:bg-foreground/[0.04]">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-black" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-foreground/10 dark:bg-foreground/[0.04]">
        <p className="font-black text-slate-950 dark:text-white">Not Bilgileri</p>
        {[
          ['1. Yazılı', '%40', row.firstGrade || '-'],
          ['2. Yazılı', '%40', row.secondGrade || '-'],
          ['Performans', '%20', row.performanceGrade || '-'],
        ].map(([label, weight, value]) => (
          <div key={label} className="mt-3 grid grid-cols-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-slate-500 dark:text-slate-400">{weight}</span>
            <span className="text-right font-black text-slate-900 dark:text-white">{value}</span>
          </div>
        ))}
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm dark:border-foreground/10">
          <span className="font-bold text-slate-950 dark:text-white">Dönem Sonu Notu</span>
          <span className="font-black text-emerald-500">{row.finalGrade.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-foreground/10 dark:bg-foreground/[0.04]">
        <p className="font-black text-slate-950 dark:text-white">Not Dağılımı</p>
        <div className="mt-4 space-y-3">
          {distribution.map(([label, count, color]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{label}</span><span>{count} öğrenci</span>
              </div>
              <Progress value={rows.length ? (count / rows.length) * 100 : 0} className="h-2" />
              <div className="sr-only" style={{ color }} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-foreground/10 dark:bg-foreground/[0.04]">
        <div className="flex justify-between">
          <p className="font-black text-slate-950 dark:text-white">Son Sınav Sonuçları</p>
          <span className="text-xs text-blue-500">{subject}</span>
        </div>
        <div className="mt-3 space-y-2">
          {row.recent.length === 0 ? <p className="text-sm text-slate-500">Kayıt bulunamadı.</p> : row.recent.map((item) => (
            <div key={`${item.examTitle}-${item.date}-${item.score}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm dark:bg-foreground/[0.04]">
              <span className="font-bold text-slate-800 dark:text-white">{decodeText(item.examTitle)}</span>
              <span className="text-slate-500 dark:text-slate-400">{item.score}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function TeacherGradeEntry() {
  const { toast } = useToast();
  const { user } = useApp();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [planned, setPlanned] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedClass, setSelectedClass] = useState('Tüm Sınıflar');
  const [selectedSubject, setSelectedSubject] = useState('Tüm Dersler');
  const [period, setPeriod] = useState('2024 - 2025 / 2. Dönem');
  const [assessment, setAssessment] = useState('2. Yazılı');
  const [search, setSearch] = useState('');
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvingId, setApprovingId] = useState('');

  const loadPendingApprovals = useCallback(async (plannedData) => {
    // Öğretmenin planladığı sınavlarda onay bekleyen öğrenci teslimlerini topla.
    const ownExams = (plannedData || []).filter((item) => !user?.name || decodeText(item.teacherName) === decodeText(user.name));
    const results = await Promise.all(ownExams.slice(0, 30).map(async (exam) => {
      try {
        const submissions = await fetchPlannedExamSubmissions(exam.id);
        return (Array.isArray(submissions) ? submissions : [])
          .filter((item) => item.approvalStatus === 'Pending' && item.sessionId)
          .map((item) => ({
            sessionId: item.sessionId,
            studentName: decodeText(item.studentName),
            score: item.score,
            net: item.net,
            examTitle: decodeText(exam.title),
            assessmentLabel: decodeText(exam.type),
            className: decodeText(exam.className),
            subject: decodeText(exam.subject),
          }));
      } catch {
        return [];
      }
    }));
    setPendingApprovals(results.flat());
  }, [user?.name]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentData, recordData, plannedData] = await Promise.all([
        fetchReportStudents(),
        fetchExamResults(),
        fetchPlannedExams().catch(() => []),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setRecords(Array.isArray(recordData) ? recordData : []);
      setPlanned(Array.isArray(plannedData) ? plannedData : []);
      await loadPendingApprovals(Array.isArray(plannedData) ? plannedData : []);
    } catch (err) {
      setError(err.message || 'Not verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [loadPendingApprovals]);

  const approveSubmission = async (item) => {
    try {
      setApprovingId(item.sessionId);
      await approveExamSubmission(item.sessionId);
      toast({ title: 'Sonuç onaylandı', description: `${item.studentName} • ${item.assessmentLabel || item.examTitle} notu (${item.score}) not girişine işlendi.` });
      await load();
    } catch (err) {
      toast({ title: 'Onaylanamadı', description: err.message || 'Tekrar deneyin.' });
    } finally {
      setApprovingId('');
    }
  };

  useEffect(() => { load(); }, [load]);

  const classOptions = useMemo(() => ['Tüm Sınıflar', ...new Set(students.map((item) => decodeText(item.className)).filter(Boolean))], [students]);
  const subjectOptions = useMemo(() => ['Tüm Dersler', ...new Set([
    ...records.map((item) => decodeText(item.subject)),
    ...planned.map((item) => decodeText(item.subject)),
  ].filter(Boolean))], [planned, records]);

  const rows = useMemo(() => {
    const scopedStudents = students.filter((item) => selectedClass === 'Tüm Sınıflar' || decodeText(item.className) === selectedClass);
    return buildRows(scopedStudents, records, selectedSubject)
      .map((row) => ({ ...row, ...(drafts[row.id] || {}) }))
      .filter((row) => `${row.fullName} ${row.className}`.toLowerCase().includes(search.toLowerCase()));
  }, [drafts, records, search, selectedClass, selectedSubject, students]);

  const selectedRow = rows.find((row) => row.id === selectedRowId) || rows[0] || null;
  const stats = useMemo(() => {
    const finals = rows.map((item) => item.finalGrade).filter((item) => item > 0);
    const highest = rows.reduce((best, item) => (item.finalGrade > (best?.finalGrade || 0) ? item : best), null);
    const lowest = rows.filter((item) => item.finalGrade > 0).reduce((best, item) => (!best || item.finalGrade < best.finalGrade ? item : best), null);
    return {
      average: average(finals).toFixed(2),
      highest,
      lowest,
      missing: rows.filter((item) => !item.firstGrade || !item.secondGrade || !item.performanceGrade).length,
      total: rows.length,
    };
  }, [rows]);

  const updateDraft = (id, key, value) => {
    setDrafts((prev) => {
      const current = { ...(prev[id] || {}) };
      current[key] = clampGrade(value);
      const first = key === 'firstGrade' ? current[key] : current.firstGrade;
      const second = key === 'secondGrade' ? current[key] : current.secondGrade;
      const perf = key === 'performanceGrade' ? current[key] : current.performanceGrade;
      const merged = rows.find((item) => item.id === id) || {};
      const a = first ?? merged.firstGrade;
      const b = second ?? merged.secondGrade;
      const c = perf ?? merged.performanceGrade;
      current.finalGrade = [a, b, c].every((item) => item !== '' && item != null)
        ? Number((Number(a) * weights.first + Number(b) * weights.second + Number(c) * weights.performance).toFixed(2))
        : average([a, b, c].filter((item) => item !== '' && item != null));
      return { ...prev, [id]: current };
    });
  };

  const rowsToCsv = () => [
    ['No', 'Öğrenci', 'Sınıf', '1. Yazılı', '2. Yazılı', 'Performans', 'Dönem Sonu Notu'],
    ...rows.map((row, index) => [index + 1, row.fullName, row.className, row.firstGrade, row.secondGrade, row.performanceGrade, row.finalGrade.toFixed(2)]),
  ].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');

  const saveAll = async () => {
    const invalid = rows.filter((row) => !row.firstGrade || !row.secondGrade || !row.performanceGrade);
    if (invalid.length > 0) {
      toast({ title: 'Eksik not var', description: '1. Yazılı, 2. Yazılı ve performans alanları boş bırakılamaz.' });
      return;
    }
    try {
      setSaving(true);
      for (const row of rows) {
        await createExamResult({
          examTitle: `${period} ${assessment}`,
          type: assessment,
          subject: selectedSubject === 'Tüm Dersler' ? (records.find((item) => item.studentName === row.fullName)?.subject || 'Genel') : selectedSubject,
          dateLabel: new Intl.DateTimeFormat('tr-TR').format(new Date()),
          studentName: row.fullName,
          className: row.className,
          score: Math.round(row.finalGrade),
          net: Math.round(row.finalGrade),
        });
      }
      setDrafts({});
      await load();
      toast({ title: 'Notlar kaydedildi', description: `${rows.length} öğrencinin not kaydı backend’e işlendi.` });
    } catch (err) {
      toast({ title: 'Kayıt başarısız', description: err.message || 'Tekrar deneyin.' });
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async (file) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
    const next = {};
    lines.forEach((line) => {
      const cells = line.split(',').map((item) => item.replace(/^"|"$/g, '').trim());
      const row = rows.find((item) => item.fullName === cells[1]);
      if (row) {
        next[row.id] = {
          firstGrade: clampGrade(cells[3]),
          secondGrade: clampGrade(cells[4]),
          performanceGrade: clampGrade(cells[5]),
        };
      }
    });
    setDrafts((prev) => ({ ...prev, ...next }));
    toast({ title: 'İçe aktarma tamamlandı', description: `${Object.keys(next).length} öğrenci eşleşti.` });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-h-[calc(100vh-2rem)] text-slate-950 dark:text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Not Girişi</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Öğrencilerin sınav, performans ve dönem sonu notlarını girip yönetebilirsiniz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadText('e-okul-not-sablonu.csv', rowsToCsv())}><Download className="mr-2 h-4 w-4" />E-Okul Formatını İndir</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />İçe Aktar</Button>
          <Button variant="outline" onClick={() => downloadText('not-girisi.csv', rowsToCsv())}><FileDown className="mr-2 h-4 w-4" />Dışa Aktar</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />PDF Rapor</Button>
          <Button onClick={saveAll} disabled={saving || loading} className="bg-orange-500 text-white hover:bg-orange-600"><Save className="mr-2 h-4 w-4" />{saving ? 'Kaydediliyor' : 'Kaydet'}</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importCsv(event.target.files?.[0])} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/10 dark:bg-[#0E1A2F] lg:grid-cols-5">
        <SelectBox label="Sınıf" value={selectedClass} options={classOptions} onChange={setSelectedClass} />
        <SelectBox label="Ders" value={selectedSubject} options={subjectOptions} onChange={setSelectedSubject} />
        <SelectBox label="Dönem" value={period} options={['2024 - 2025 / 1. Dönem', '2024 - 2025 / 2. Dönem', '2025 - 2026 / 1. Dönem']} onChange={setPeriod} />
        <SelectBox label="Değerlendirme Türü" value={assessment} options={[...new Set(['1. Yazılı', '2. Yazılı', 'Performans', 'Proje', ...planned.map((item) => decodeText(item.type)).filter((item) => item && item !== 'MockExam' && item !== 'Exam')])]} onChange={setAssessment} />
        <Button variant="outline" className="mt-6"><Settings2 className="mr-2 h-4 w-4" />Sınav Ayarları</Button>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-800 dark:text-blue-100">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Sonuçları aşağıdaki tabloya girerek kaydedebilirsiniz. Notlar 100 üzerinden girilir; ağırlıklar 1. Yazılı %40, 2. Yazılı %40, performans %20 olarak uygulanır.</p>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">{error}</div> : null}

      {pendingApprovals.length > 0 ? (
        <div className="mt-4 rounded-3xl border border-orange-400/30 bg-orange-500/[0.07] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-orange-500" />
            <p className="font-black">Onay Bekleyen Sınav Sonuçları</p>
            <Badge className="bg-orange-500/15 text-orange-500 hover:bg-orange-500/15">{pendingApprovals.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Öğrenciler sınavı tamamladı. Onayladığınızda sonuç, sınavı oluştururken yazdığınız tür etiketiyle ({pendingApprovals[0]?.assessmentLabel || '1. Yazılı'} gibi) not girişine otomatik işlenir.</p>
          <div className="mt-3 space-y-2">
            {pendingApprovals.map((item) => (
              <div key={item.sessionId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-foreground/10 dark:bg-[#0E1A2F]">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-xs font-black text-orange-500">{initials(item.studentName)}</span>
                  <div>
                    <p className="text-sm font-black">{item.studentName} <span className="font-bold text-slate-500">• {item.className}</span></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.examTitle} • {item.subject}{item.assessmentLabel ? ` • ${item.assessmentLabel}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-500">{item.score}</p>
                    <p className="text-[11px] text-slate-500">{item.net} net</p>
                  </div>
                  <Button
                    onClick={() => approveSubmission(item)}
                    disabled={approvingId === item.sessionId}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {approvingId === item.sessionId ? 'Onaylanıyor...' : 'Onayla ve Nota İşle'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-foreground/10 dark:bg-[#0E1A2F] dark:shadow-black/20">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-foreground/10 md:flex-row md:items-center">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Öğrenci ara..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-orange-400 dark:border-foreground/10 dark:bg-foreground/[0.04] dark:text-white" />
            </label>
            <p className="text-xs text-slate-500">{rows.length} öğrenci listeleniyor.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-foreground/[0.04] dark:text-slate-400">
                <tr>
                  {['No', 'Öğrenci Adı Soyadı', '1. Yazılı (%40)', '2. Yazılı (%40)', 'Performans (%20)', 'Dönem Sonu Notu', 'Not Durumu', 'İşlemler'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left font-black">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Not verileri yükleniyor...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Seçili filtrelerde öğrenci bulunamadı.</td></tr>
                ) : rows.map((row, index) => {
                  const status = statusFor(row.finalGrade);
                  return (
                    <tr key={row.id} onClick={() => setSelectedRowId(row.id)} className={`cursor-pointer border-t border-slate-100 transition hover:bg-blue-500/5 dark:border-foreground/10 dark:hover:bg-blue-500/10 ${selectedRow?.id === row.id ? 'bg-orange-500/10 ring-1 ring-inset ring-orange-400/50' : ''}`}>
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-xs font-black text-orange-500">{initials(row.fullName)}</span>
                          <span className="font-black">{row.fullName}</span>
                        </div>
                      </td>
                      {[
                        ['firstGrade', row.firstGrade],
                        ['secondGrade', row.secondGrade],
                        ['performanceGrade', row.performanceGrade],
                      ].map(([key, value]) => (
                        <td key={key} className="px-4 py-3">
                          <input
                            value={value}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => updateDraft(row.id, key, event.target.value)}
                            className="h-9 w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 text-center font-bold outline-none focus:border-orange-400 dark:border-foreground/10 dark:bg-foreground/[0.04] dark:text-white"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 font-black text-emerald-500">{row.finalGrade.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge className={{
                          emerald: 'bg-emerald-500/12 text-emerald-500 hover:bg-emerald-500/12',
                          blue: 'bg-blue-500/12 text-blue-500 hover:bg-blue-500/12',
                          amber: 'bg-amber-500/12 text-amber-500 hover:bg-amber-500/12',
                          red: 'bg-red-500/12 text-red-500 hover:bg-red-500/12',
                        }[status.color]}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); setSelectedRowId(row.id); }}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <DetailPanel row={selectedRow} rows={rows} subject={selectedSubject} onClose={() => setSelectedRowId(null)} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {[
          [stats.average, 'Sınıf Ortalaması', BarChart3, 'text-blue-500'],
          [stats.highest ? stats.highest.finalGrade.toFixed(2) : '-', 'En Yüksek Not', CheckCircle2, 'text-emerald-500'],
          [stats.lowest ? stats.lowest.finalGrade.toFixed(2) : '-', 'En Düşük Not', AlertCircle, 'text-amber-500'],
          [stats.missing, 'Notu Girilmeyen', FileText, 'text-purple-500'],
          [stats.total, 'Toplam Öğrenci', Users, 'text-cyan-500'],
        ].map(([value, label, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-foreground/10 dark:bg-[#0E1A2F]">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-2xl font-black">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
