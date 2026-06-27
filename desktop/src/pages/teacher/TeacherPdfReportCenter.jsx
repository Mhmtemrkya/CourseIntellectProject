import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  Archive, BarChart3, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download,
  Eye, FileArchive, FilePlus2, FileText, Filter, GraduationCap, Maximize2, MessageSquare,
  Minus, MoreVertical, NotebookPen, PieChart, Printer, QrCode, Search, Sparkles, Trophy,
  TrendingUp, UserRound, Users, X, ZoomIn,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { fetchReportStudents, fetchSolutionSession, fetchTeacherPdfReports, fetchTeacherReportAnalytics } from '../../lib/api/modules';
import { downloadExamPaperPdf } from '../../lib/examPaperPdf';

const reportTypes = ['Tümü', 'Sınav Raporları', 'Ödev Raporları', 'Gelişim Raporları', 'Devamsızlık Raporları', 'Karne Raporları'];
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_HEIGHT = 1123;
const PDF_PREVIEW_BASE_WIDTH = 760;

const emptyReport = {
  id: 'empty',
  type: 'Gelişim Raporları',
  name: 'Öğrenci Başarı Raporu',
  date: '-',
  pages: 6,
  subject: 'Tüm Dersler',
  className: '-',
  student: '-',
  studentNo: '-',
  score: 0,
  ready: false,
};

function FilterSelect({ value, options, onChange, wide = false }) {
  return (
    <label className={`group relative ${wide ? 'min-w-[180px]' : 'min-w-[150px]'}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-foreground/10 bg-foreground/[0.045] px-4 pr-9 text-sm font-semibold text-slate-100 outline-none transition hover:border-orange-400/45 focus:border-orange-400/80"
      >
        {options.map((option) => <option key={option} className="bg-[#08111F]" value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400 transition group-focus-within:text-orange-300" />
    </label>
  );
}

function PdfIcon({ active = false }) {
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${active ? 'border-orange-400/40 bg-orange-500/20 text-orange-200' : 'border-purple-400/15 bg-purple-500/18 text-purple-200'}`}>
      <FileText className="h-6 w-6" />
    </div>
  );
}

function ReportCard({ report, active, onSelect, onPreview, onDownload }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition duration-300 ${active ? 'border-orange-500/70 bg-orange-500/[0.075] shadow-[0_0_42px_-22px_rgba(255,157,46,0.9)]' : 'border-foreground/8 bg-foreground/[0.035] hover:border-orange-400/35 hover:bg-foreground/[0.06]'}`}
    >
      <PdfIcon active={active} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black text-white">{report.name}</h3>
        <p className="mt-1 truncate text-xs text-slate-400">
          {report.source === 'teacher-pdf-report'
            ? `${report.className} • ${report.subject}`
            : `${report.date} • ${report.pages} Sayfa`}
        </p>
      </div>
      {report.source === 'teacher-pdf-report' ? (
        <Badge className="border-violet-400/20 bg-violet-400/12 text-violet-200 hover:bg-violet-400/12">
          Puan {report.score}
        </Badge>
      ) : null}
      <Badge className="border-emerald-400/15 bg-emerald-400/12 text-emerald-300 hover:bg-emerald-400/12">
        {report.ready ? 'Hazır' : 'İşleniyor'}
      </Badge>
      <div className="flex gap-2">
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onPreview?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onPreview?.();
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] text-slate-200 transition group-hover:border-orange-400/30 group-hover:text-orange-200"
          title="Önizleme"
        >
          <Eye className="h-4 w-4" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onDownload?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onDownload?.();
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.04] text-slate-200 transition group-hover:border-orange-400/30 group-hover:text-orange-200"
          title="İndir"
        >
          <Download className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, disabled = false }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className="h-10 w-10 rounded-xl text-slate-200 hover:bg-foreground/10 hover:text-orange-200 disabled:opacity-40"
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function MiniPage({ index, active, children }) {
  return (
    <button type="button" className="group w-full">
      <div className={`aspect-[0.72] overflow-hidden rounded-xl border p-2 transition ${active ? 'border-orange-500 bg-orange-500/10' : 'border-foreground/10 bg-foreground/[0.04] hover:border-orange-400/40'}`}>
        {children}
      </div>
      <p className="mt-2 text-center text-xs font-bold text-slate-300">{index}</p>
    </button>
  );
}

function formatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '-';
  return number % 1 === 0 ? String(number) : number.toFixed(1);
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'Ö') + (parts.at(-1)?.[0] || '');
}

function buildStudentReport(student) {
  if (!student) return emptyReport;
  return {
    id: `student-${student.id || student.username || student.fullName}`,
    type: 'Gelişim Raporları',
    name: `${student.fullName || 'Öğrenci'} Başarı Raporu`,
    date: new Intl.DateTimeFormat('tr-TR').format(new Date()),
    pages: 6,
    subject: 'Tüm Dersler',
    className: student.className || 'Sınıf bilgisi yok',
    student: student.fullName || 'Öğrenci',
    studentNo: student.username || '-',
    score: student.averageScore || 0,
    ready: true,
    source: 'student-live',
    downloadUrl: null,
    status: 'LivePreview',
    createdAtUtc: new Date().toISOString(),
  };
}

function buildPdfReportFromApi(item) {
  const createdAt = item?.createdAtUtc || item?.completedAtUtc || item?.readyAtUtc;
  const examSessionId = item?.examSessionId || '';
  // Sınav kağıdı PDF'i istemci tarafında (HTML→PDF) examSessionId'den üretilir;
  // sunucu dosyası (downloadUrl) zorunlu değildir. Oturum kimliği varsa hazırdır.
  const ready = String(item?.status || '').toLowerCase() === 'ready'
    && (Boolean(item?.downloadUrl) || Boolean(examSessionId));
  const student = (item?.studentName || '').trim();
  const className = (item?.className || '').trim();
  const subject = (item?.subject || item?.title || 'Sınav').trim();
  return {
    id: item?.id || examSessionId,
    type: 'Sınav Raporları',
    name: student || `Çözüm Kağıdı${examSessionId ? ` • ${String(examSessionId).slice(0, 8)}` : ''}`,
    date: createdAt ? new Intl.DateTimeFormat('tr-TR').format(new Date(createdAt)) : '-',
    pages: '-',
    subject,
    examTitle: (item?.title || '').trim(),
    className: className || '-',
    student: student || '-',
    studentNo: '-',
    score: Number(item?.scorePercent) || 0,
    correct: Number(item?.correct) || 0,
    total: Number(item?.total) || 0,
    ready,
    status: item?.status || 'Unknown',
    source: 'teacher-pdf-report',
    downloadUrl: item?.downloadUrl || null,
    errorMessage: item?.errorMessage || '',
    examSessionId,
    createdAtUtc: createdAt || null,
  };
}

function openDownloadUrl(url) {
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function sanitizeFileName(name) {
  return String(name || 'rapor').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'rapor';
}

function normalizeFilterValue(value) {
  return String(value || '').trim();
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function fetchReportBlob(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`PDF indirilemedi (${response.status})`);
  return response.blob();
}

function liveSubjectRows(analytics) {
  const topics = Array.isArray(analytics?.topics) ? analytics.topics : [];
  return topics.map((item, index) => [
    item.name || item.subject || `Konu ${index + 1}`,
    Number(item.success || item.average || 0),
    Number(item.classAverage || item.average || 0),
    ['#FF9D2E', '#30D158', '#4DA3FF', '#7B61FF'][index % 4],
    item.riskLevel || (Number(item.success || 0) >= 80 ? 'Güçlü' : 'Takip'),
  ]);
}

function liveTopicRows(analytics) {
  const topics = Array.isArray(analytics?.topics) ? analytics.topics : [];
  return topics.map((item, index) => {
    const questionCount = Number(item.questionCount || item.totalQuestions || 0);
    const success = Number(item.success || item.average || 0);
    const correct = questionCount > 0 ? Math.round((questionCount * success) / 100) : 0;
    return [
      item.name || item.subject || `Konu ${index + 1}`,
      success,
      questionCount,
      correct,
      Math.max(0, questionCount - correct),
    ];
  });
}

function EmptyPdfSection({ title, detail }) {
  return (
    <div className="rounded-3xl border border-dashed border-foreground/12 bg-foreground/[0.045] p-6 text-center">
      <FileText className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function PdfPageShell({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[4px] border border-foreground/10 bg-[#08111F] text-white shadow-[0_30px_90px_-50px_rgba(0,0,0,0.9)] ${className}`}
      style={{ width: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT }}
    >
      {children}
    </div>
  );
}

function CoverPage({ selectedReport }) {
  const studentInitial = initials(selectedReport.student || selectedReport.name);
  return (
    <PdfPageShell>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(123,97,255,0.17),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(255,157,46,0.17),transparent_32%)]" />
      <div className="absolute -right-20 top-24 h-72 w-[560px] rounded-full border border-orange-400/12" />
      <div className="absolute -right-16 top-36 h-72 w-[560px] rounded-full border border-orange-400/10" />

      <div className="relative z-10 flex h-full flex-col p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase leading-none tracking-[0.24em] text-white">Course</p>
            <p className="text-lg font-black uppercase leading-none text-orange-300">Intellect</p>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-[240px_1fr] items-center gap-14">
          <div className="relative">
            <div className="absolute inset-[-10px] rounded-full border-2 border-orange-400" />
            <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border border-foreground/12 bg-gradient-to-b from-slate-200 to-slate-400">
              <span className="text-[104px] font-black leading-none text-slate-700">{studentInitial[0]}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-right text-4xl font-black tracking-tight text-white">ÖĞRENCİ</p>
            <p className="text-right text-5xl font-black tracking-tight text-orange-400">BAŞARI RAPORU</p>
            <p className="mt-5 text-right text-base text-slate-300">Akademik Performans Analizi</p>
            <div className="ml-auto mt-6 h-0.5 w-14 bg-orange-400" />
            <h2 className="mt-16 break-words text-4xl font-black text-white">{selectedReport.student || 'Öğrenci'}</h2>
            <div className="mt-5 space-y-4 text-base text-slate-300">
              <p>{selectedReport.className || 'Sınıf bilgisi yok'}</p>
              <p className="break-words">Öğrenci No: {selectedReport.studentNo || '-'}</p>
              <p className="break-words">{selectedReport.name}</p>
              <p>{selectedReport.date} • Rapor Tarihi</p>
            </div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-3 overflow-hidden rounded-[28px] border border-foreground/10 bg-foreground/[0.055] backdrop-blur">
          <div className="flex min-w-0 flex-col items-center justify-center p-6 text-center">
            <GraduationCap className="h-9 w-9 text-orange-300" />
            <p className="mt-3 break-words text-xs font-bold text-white">{selectedReport.institution || 'Kurum'}</p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center border-x border-foreground/10 p-6 text-center">
            <QrCode className="h-12 w-12 text-white" />
            <p className="mt-2 text-xs text-slate-300">Rapor Doğrulama QR Kod</p>
          </div>
          <div className="min-w-0 p-6">
            <p className="text-sm text-slate-300">Rapor No</p>
            <p className="mt-2 break-words text-sm font-bold leading-5 text-white">CI-REPORT-{selectedReport.id || 'PENDING'}</p>
            <p className="mt-4 text-xs leading-5 text-slate-400">Bu rapor Course Intellect tarafından hazırlanmıştır.</p>
          </div>
        </div>
      </div>
    </PdfPageShell>
  );
}

function KpiCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.055] p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5" style={{ color: accent }} />
        <span className="text-xs text-slate-400">Canlı</span>
      </div>
      <p className="mt-4 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function ResultsPage({ selectedReport, analytics }) {
  const classAnalytics = Array.isArray(analytics?.classReports)
    ? analytics.classReports.find((item) => item.className === selectedReport.className)
    : null;
  const score = Number(selectedReport.score || classAnalytics?.average || 0);
  const attendance = Number(classAnalytics?.attendance || 0);
  const completion = Number(classAnalytics?.completion || 0);
  const kpis = [
    ['Toplam Puan', selectedReport.totalPoint ?? '-', BarChart3, '#FF9D2E'],
    ['Ortalama', score ? formatScore(score) : '-', CheckCircle2, '#30D158'],
    ['Devam', attendance ? `%${attendance}` : '-', Calendar, '#4DA3FF'],
    ['Ödev', completion ? `%${completion}` : '-', FileText, '#7B61FF'],
    ['PDF Durumu', selectedReport.ready ? 'Hazır' : selectedReport.status || '-', Sparkles, '#FF9D2E'],
    ['Başarı', score ? `%${Math.round(score)}` : '-', PieChart, '#30D158'],
    ['Sınıf Ort.', classAnalytics?.average ? `%${classAnalytics.average}` : '-', Users, '#7B61FF'],
    ['Sıralama', selectedReport.rank || '-', TrendingUp, '#FF9D2E'],
  ];
  return (
    <PdfPageShell className="p-8">
      <h2 className="text-2xl font-black">Genel Sonuçlar</h2>
      <div className="mt-6 grid grid-cols-4 gap-3">
        {kpis.map(([label, value, Icon, accent]) => <KpiCard key={label} label={label} value={value} icon={Icon} accent={accent} />)}
      </div>
      <div className="mt-8 grid grid-cols-[240px_1fr] gap-5">
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-[18px] border-orange-400 text-3xl font-black">
            {score ? `%${Math.round(score)}` : '-'}
          </div>
          <p className="mt-5 text-center text-sm text-slate-300">Donut başarı grafiği</p>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
          {[
            ['Öğrenci', score],
            ['Sınıf Ort.', Number(classAnalytics?.average || 0)],
            ['Devam', attendance],
            ['Ödev', completion],
          ].map(([label, value]) => (
            <div key={label} className="mb-5">
              <div className="mb-2 flex justify-between text-xs text-slate-300"><span>{label}</span><span>{value ? `${value}%` : '-'}</span></div>
              <Progress value={Number(value || 0)} className="h-2 bg-foreground/10 [&>div]:bg-orange-400" />
            </div>
          ))}
        </div>
      </div>
    </PdfPageShell>
  );
}

function SubjectPage({ analytics }) {
  const subjectRows = liveSubjectRows(analytics);
  return (
    <PdfPageShell className="p-8">
      <h2 className="text-2xl font-black">Ders Bazlı Analiz</h2>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {subjectRows.length === 0 ? (
          <div className="col-span-2">
            <EmptyPdfSection title="Ders analizi yok" detail="ExamResults verisi geldiğinde ders başarı kartları burada canlı olarak listelenir." />
          </div>
        ) : subjectRows.map(([name, score, average, color, level]) => (
          <div key={name} className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black">{name}</h3>
              <Badge className="border-foreground/10 bg-foreground/10 text-white hover:bg-foreground/10">{level}</Badge>
            </div>
            <p className="mt-4 text-3xl font-black" style={{ color }}>{score}%</p>
            <p className="mt-1 text-xs text-slate-400">Ortalama: {average}%</p>
            <Progress value={score} className="mt-4 h-2 bg-foreground/10" style={{ '--tw-bg-opacity': 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
          <h3 className="font-black text-emerald-200">Güçlü Alanlar</h3>
          <p className="mt-3 text-sm leading-6 text-emerald-50/80">Denklem, okuduğunu anlama ve sosyal bilgiler yorum soruları.</p>
        </div>
        <div className="rounded-3xl border border-orange-400/20 bg-orange-400/10 p-5">
          <h3 className="font-black text-orange-200">Geliştirilmesi Gereken Alanlar</h3>
          <p className="mt-3 text-sm leading-6 text-orange-50/80">Problemler, İngilizce okuma ve fen enerji kazanımları.</p>
        </div>
      </div>
    </PdfPageShell>
  );
}

function TopicPage({ analytics }) {
  const rows = liveTopicRows(analytics);
  return (
    <PdfPageShell className="p-8">
      <h2 className="text-2xl font-black">Konu Bazlı Analiz</h2>
      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <EmptyPdfSection title="Konu analizi yok" detail="Konu bazlı ExamResults verisi oluştuğunda bu bölüm otomatik dolacak." />
        ) : rows.map(([topic, percent, total, correct, wrong]) => (
          <div key={topic} className="rounded-2xl border border-foreground/10 bg-foreground/[0.055] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-black">{topic}</h3>
                <p className="text-xs text-slate-400">{total} soru • {correct} doğru • {wrong} yanlış</p>
              </div>
              <span className="font-black text-orange-300">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2 bg-foreground/10 [&>div]:bg-orange-400" />
          </div>
        ))}
      </div>
    </PdfPageShell>
  );
}

function QuestionDetailsPage({ selectedReport }) {
  const hasRealPdf = Boolean(selectedReport.downloadUrl);
  return (
    <PdfPageShell className="p-8">
      <h2 className="text-2xl font-black">Soru Bazlı Detaylar</h2>
      <div className="mt-6">
        <EmptyPdfSection
          title={hasRealPdf ? 'Soru detayları PDF dosyasında hazır' : 'Soru detayı verisi yok'}
          detail={hasRealPdf ? 'Hazır PDF raporunu indirerek gerçek soru-cevap detaylarını görüntüleyebilirsiniz.' : 'Bu öğrenci için çözüm oturumu PDF’i oluştuğunda soru detayları canlı rapordan açılır.'}
        />
      </div>
    </PdfPageShell>
  );
}

function GrowthPage({ selectedReport }) {
  const studentName = selectedReport.student && selectedReport.student !== '-' ? selectedReport.student : 'Öğrenci';
  return (
    <PdfPageShell className="p-8">
      <h2 className="text-2xl font-black">Gelişim Raporu</h2>
      <div className="mt-6 rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
        <EmptyPdfSection title="Gelişim grafiği bekleniyor" detail={`${studentName} için zaman serisi rapor endpointi geldiğinde son sınavlar burada canlı grafik olarak gösterilecek.`} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {[
          ['Devam Oranı', selectedReport.attendanceRate ? `%${selectedReport.attendanceRate}` : '-'],
          ['Ödev Tamamlama', selectedReport.completionRate ? `%${selectedReport.completionRate}` : '-'],
          ['Rozet', selectedReport.badgeCount ?? '-'],
          ['Toplam Puan', selectedReport.totalPoint ?? '-'],
          ['Sıralama Değişimi', selectedReport.rankChange ?? '-'],
          ['Aylık Başarı', selectedReport.score ? `%${Math.round(selectedReport.score)}` : '-'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.055] p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-5">
          <p className="font-black">Öğretmen Yorumu</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{studentName} için öğretmen değerlendirmesi PDF çıktısında kayıtlı yorum verisiyle gösterilir.</p>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-5 text-center">
          <p className="font-black">İmza / Mühür</p>
          <div className="mx-auto mt-5 h-16 w-16 rounded-full border border-dashed border-orange-400/60" />
        </div>
      </div>
    </PdfPageShell>
  );
}

function ThumbnailContent({ page }) {
  if (page === 1) return <div className="h-full rounded-lg bg-[#08111F] p-2"><div className="h-4 w-10 rounded bg-orange-400" /><div className="mt-9 h-16 rounded-full bg-slate-400" /><div className="mt-3 h-3 rounded bg-foreground/70" /><div className="mt-1 h-3 w-3/4 rounded bg-orange-400" /></div>;
  if (page === 2) return <div className="h-full rounded-lg bg-[#08111F] p-2"><div className="grid grid-cols-2 gap-1">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 rounded bg-foreground/10" />)}</div><div className="mt-3 h-12 rounded-full border-8 border-orange-400" /></div>;
  if (page === 3) return <div className="h-full rounded-lg bg-[#08111F] p-2"><div className="grid grid-cols-2 gap-1">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 rounded bg-foreground/10" />)}</div></div>;
  if (page === 4) return <div className="h-full rounded-lg bg-[#08111F] p-2">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="mb-2 h-2 rounded bg-orange-400/70" />)}</div>;
  if (page === 5) return <div className="h-full rounded-lg bg-[#08111F] p-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="mb-2 h-5 rounded bg-foreground/10" />)}</div>;
  return <div className="h-full rounded-lg bg-[#08111F] p-2"><div className="flex h-20 items-end gap-1">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex-1 rounded bg-orange-400" style={{ height: `${35 + i * 7}%` }} />)}</div><div className="mt-4 grid grid-cols-2 gap-1">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 rounded bg-foreground/10" />)}</div></div>;
}

function PreviewPage({ page, selectedReport, analytics }) {
  if (page === 1) return <CoverPage selectedReport={selectedReport} />;
  if (page === 2) return <ResultsPage selectedReport={selectedReport} analytics={analytics} />;
  if (page === 3) return <SubjectPage analytics={analytics} />;
  if (page === 4) return <TopicPage analytics={analytics} />;
  if (page === 5) return <QuestionDetailsPage selectedReport={selectedReport} />;
  return <GrowthPage selectedReport={selectedReport} />;
}

function StudentMetric({ icon: Icon, label, value, detail, color = '#FF9D2E' }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.055] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}22`, color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-black text-white">{value}</p>
        </div>
      </div>
      {detail ? <p className="mt-3 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function StudentDetailModal({
  student,
  classAnalytics,
  rank,
  onClose,
  onOpenPdf,
}) {
  const [tab, setTab] = useState('overview');
  if (!student) return null;

  const messageStudent = () => {
    if (student.parentEmail) {
      window.location.href = `mailto:${student.parentEmail}?subject=${encodeURIComponent(`${student.fullName} raporu`)}`;
      return;
    }
    window.alert('Bu öğrenci için veli e-posta bilgisi bulunamadı.');
  };

  const addTeacherNote = () => {
    window.alert('Öğretmen notu için canlı backend endpointi bulunamadı. Sahte veya lokal not kaydı oluşturulmadı.');
  };

  const score = formatScore(student.averageScore);
  const attendance = Number(student.attendanceRate || 0);
  const absence = attendance > 0 ? `%${Math.max(0, 100 - attendance)}` : '-';
  const tabs = [
    ['overview', 'Genel Bakış'],
    ['lessons', 'Dersler'],
    ['exams', 'Sınavlar'],
    ['attendance', 'Devamsızlık'],
    ['pdf', 'PDF Modu'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020817]/70 p-6 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-foreground/10 bg-[#08111F] text-white shadow-[0_35px_110px_-45px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-start gap-5 border-b border-foreground/10 bg-[radial-gradient(circle_at_20%_0%,rgba(255,157,46,0.13),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-orange-400/35 bg-foreground/10 text-2xl font-black text-orange-200">
            {initials(student.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black tracking-tight">{student.fullName}</h2>
              <Badge className="bg-emerald-400/14 text-emerald-300 hover:bg-emerald-400/14">{student.status || 'Aktif'}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {student.className || 'Sınıf bilgisi yok'} • Öğrenci No: {student.username || '-'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Veli: {student.parentName || '-'} • {student.parentEmail || '-'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={messageStudent} className="border-foreground/10 bg-foreground/[0.04] text-white hover:bg-foreground/10">
              <MessageSquare className="mr-2 h-4 w-4" />
              Mesaj Gönder
            </Button>
            <Button variant="outline" onClick={addTeacherNote} className="border-foreground/10 bg-foreground/[0.04] text-white hover:bg-foreground/10">
              <NotebookPen className="mr-2 h-4 w-4" />
              Not Ekle
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenPdf} className="text-slate-300 hover:bg-foreground/10 hover:text-white" title="PDF moduna geç">
              <MoreVertical className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-300 hover:bg-foreground/10 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-132px)] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StudentMetric icon={TrendingUp} label="Genel Başarı" value={score === '-' ? '-' : `${score} / 100`} detail="ExamResults ortalaması" color="#7B61FF" />
            <StudentMetric icon={Calendar} label="Devamsızlık" value={absence} detail={`Katılım: %${attendance || 0}`} color="#FF9D2E" />
            <StudentMetric icon={Trophy} label="Sınıf Sıralaması" value={rank || '-'} detail={classAnalytics?.className || student.className} color="#30D158" />
            <StudentMetric icon={Sparkles} label="Genel Puan" value={student.totalPoint ?? '-'} detail="Puan verisi gelirse burada görünür" color="#4DA3FF" />
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto border-b border-foreground/10">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (value === 'pdf') onOpenPdf();
                  else setTab(value);
                }}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-black transition ${tab === value ? 'border-orange-400 text-orange-300' : 'border-transparent text-slate-300 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
                <p className="font-black">Akademik Ortalama</p>
                <div className="mx-auto mt-8 flex h-44 w-44 items-center justify-center rounded-full border-[16px] border-purple-500/80 text-4xl font-black">
                  {score}
                </div>
                <p className="mt-5 text-center text-sm text-slate-400">Gerçek sınav sonuçlarından hesaplandı.</p>
              </div>
              <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
                <div className="flex items-center justify-between">
                  <p className="font-black">Sınıf Performansı</p>
                  <Badge className="bg-orange-400/12 text-orange-200 hover:bg-orange-400/12">{student.className || '-'}</Badge>
                </div>
                <div className="mt-6 space-y-5">
                  {[
                    ['Sınıf Ortalaması', classAnalytics?.average ?? 0, '#FF9D2E'],
                    ['Devam Oranı', classAnalytics?.attendance ?? 0, '#30D158'],
                    ['Görev Tamamlama', classAnalytics?.completion ?? 0, '#7B61FF'],
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <div className="mb-2 flex justify-between text-sm text-slate-300"><span>{label}</span><span>%{value}</span></div>
                      <Progress value={Number(value)} className="h-2 bg-foreground/10 [&>div]:bg-orange-400" />
                      <div className="sr-only" style={{ color }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab !== 'overview' ? (
            <div className="mt-5 rounded-3xl border border-foreground/10 bg-foreground/[0.055] p-6">
              <p className="font-black">{tabs.find((item) => item[0] === tab)?.[1]}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Bu bölüm seçili öğrenci için API’den gelen kayıtlarla doldurulur. Veri bulunmadığında sabit değer yerine boş durum gösterilir.
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 border-t border-foreground/10 pt-5 sm:flex-row sm:justify-between">
            <p className="text-xs text-slate-500">Son güncelleme: {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onOpenPdf} className="border-foreground/10 bg-foreground/[0.04] text-white hover:bg-foreground/10">
                <FileText className="mr-2 h-4 w-4" />
                PDF Raporu Oluştur
              </Button>
              <Button onClick={onClose} className="bg-purple-600 text-white hover:bg-purple-700">Kapat</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StudentReportMode({
  studentsData,
  analytics,
  loading,
  error,
  selectedStudent,
  onSelectStudent,
  onOpenPdf,
  onReload,
}) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('Tüm Sınıflar');

  const classesFromStudents = useMemo(() => ['Tüm Sınıflar', ...new Set(studentsData.map((item) => item.className).filter(Boolean))], [studentsData]);
  // Üst metrik kartları sınıf filtresine göre daralsın (Genel Ortalama = seçili sınıfın ortalaması).
  const scopedStudents = useMemo(
    () => (classFilter === 'Tüm Sınıflar' ? studentsData : studentsData.filter((item) => item.className === classFilter)),
    [classFilter, studentsData],
  );
  const scopedAverage = useMemo(
    () => (scopedStudents.length
      ? formatScore(scopedStudents.reduce((sum, item) => sum + Number(item.averageScore || 0), 0) / scopedStudents.length)
      : '-'),
    [scopedStudents],
  );
  const scopedAttendance = useMemo(
    () => (scopedStudents.length
      ? `%${Math.round(scopedStudents.reduce((sum, item) => sum + Number(item.attendanceRate || 0), 0) / scopedStudents.length)}`
      : '-'),
    [scopedStudents],
  );
  const filteredStudents = useMemo(() => studentsData.filter((item) => {
    const matchesClass = classFilter === 'Tüm Sınıflar' || item.className === classFilter;
    const haystack = `${item.fullName || ''} ${item.username || ''} ${item.className || ''}`.toLowerCase();
    return matchesClass && haystack.includes(query.toLowerCase());
  }), [classFilter, query, studentsData]);

  const selectedClassAnalytics = analytics.classReports?.find((item) => item.className === selectedStudent?.className);
  const selectedRank = selectedStudent
    ? (() => {
      const peers = studentsData
        .filter((item) => item.className === selectedStudent.className)
        .sort((a, b) => Number(b.averageScore || 0) - Number(a.averageScore || 0));
      const index = peers.findIndex((item) => item.id === selectedStudent.id || item.fullName === selectedStudent.fullName);
      return index >= 0 ? `${index + 1} / ${peers.length}` : '-';
    })()
    : '-';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[calc(100vh-2rem)] rounded-[28px] border border-foreground/10 bg-[#08111F] p-6 text-white shadow-[0_35px_110px_-55px_rgba(0,0,0,0.9)]"
      data-testid="teacher-student-report-mode"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-black text-orange-200">
            <UserRound className="h-3.5 w-3.5" />
            Öğrenci Detay Merkezi
          </div>
          <h1 className="text-3xl font-black tracking-tight">Raporlar</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Öğrenciye tıklayın, detay modalından PDF moduna geçin ve premium raporu oluşturun.</p>
        </div>
        <Button onClick={onReload} variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-white hover:bg-foreground/10">
          Verileri Yenile
        </Button>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <StudentMetric icon={Users} label="Toplam Öğrenci" value={loading ? '...' : scopedStudents.length} detail={classFilter === 'Tüm Sınıflar' ? 'Tüm sınıflar' : classFilter} color="#4DA3FF" />
        <StudentMetric icon={BarChart3} label="Genel Ortalama" value={loading ? '...' : scopedAverage} detail={classFilter === 'Tüm Sınıflar' ? 'Tüm sınıfların ortalaması' : `${classFilter} ortalaması`} color="#FF9D2E" />
        <StudentMetric icon={Calendar} label="Ortalama Katılım" value={loading ? '...' : scopedAttendance} detail={classFilter === 'Tüm Sınıflar' ? 'Tüm sınıflar' : classFilter} color="#30D158" />
        <StudentMetric icon={FileText} label="PDF Modu" value="Hazır" detail="Detay modalından açılır" color="#7B61FF" />
      </div>

      <div className="mt-6 rounded-3xl border border-foreground/10 bg-foreground/[0.045] p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Öğrenci ara..."
              className="h-12 w-full rounded-2xl border border-foreground/10 bg-[#0B1728] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/70"
            />
          </label>
          <FilterSelect value={classFilter} options={classesFromStudents} onChange={setClassFilter} wide />
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-foreground/10">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr] bg-foreground/[0.06] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-400">
            <span>Öğrenci</span><span>Sınıf / Şube</span><span>Devam</span><span>Ortalama</span><span>Durum</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Öğrenci verileri yükleniyor...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Seçili filtrelerde öğrenci bulunamadı.</div>
          ) : filteredStudents.map((item) => (
            <button
              key={item.id || item.username || item.fullName}
              type="button"
              onClick={() => onSelectStudent(item)}
              className="grid w-full grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr] items-center border-t border-foreground/10 px-4 py-4 text-left text-sm transition hover:bg-orange-400/10"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-400/14 text-xs font-black text-orange-200">{initials(item.fullName)}</span>
                <span className="font-bold text-white">{item.fullName}</span>
              </span>
              <span className="text-slate-300">{item.className || '-'}</span>
              <span className="text-slate-300">%{item.attendanceRate || 0}</span>
              <span className="font-black text-orange-200">{formatScore(item.averageScore)}</span>
              <span><Badge className="bg-emerald-400/12 text-emerald-300 hover:bg-emerald-400/12">{item.status || 'Aktif'}</Badge></span>
            </button>
          ))}
        </div>
      </div>

      <StudentDetailModal
        student={selectedStudent}
        classAnalytics={selectedClassAnalytics}
        rank={selectedRank}
        onClose={() => onSelectStudent(null)}
        onOpenPdf={onOpenPdf}
      />
    </motion.div>
  );
}

export default function TeacherPdfReportCenter() {
  const [viewMode, setViewMode] = useState('students');
  const [studentsData, setStudentsData] = useState([]);
  const [analytics, setAnalytics] = useState({ classReports: [], topics: [] });
  const [pdfReports, setPdfReports] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [activeType, setActiveType] = useState('Tümü');
  const [subject, setSubject] = useState('Tüm Dersler');
  const [dateFilter, setDateFilter] = useState('Tüm Tarihler');
  const [className, setClassName] = useState('Tüm Sınıflar');
  const [student, setStudent] = useState('Tüm Öğrenciler');
  const [selectedId, setSelectedId] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);

  const loadStudentReports = useCallback(async () => {
    try {
      setLoadingStudents(true);
      setLoadError('');
      const [studentResult, analyticsResult, pdfResult] = await Promise.all([
        fetchReportStudents(),
        fetchTeacherReportAnalytics(),
        fetchTeacherPdfReports().catch(() => []),
      ]);
      setStudentsData(Array.isArray(studentResult) ? studentResult : []);
      setPdfReports(Array.isArray(pdfResult) ? pdfResult.map(buildPdfReportFromApi).filter((item) => item.id) : []);
      setAnalytics({
        classReports: Array.isArray(analyticsResult?.classReports) ? analyticsResult.classReports : [],
        topics: Array.isArray(analyticsResult?.topics) ? analyticsResult.topics : [],
      });
    } catch (error) {
      setLoadError(error.message || 'Öğrenci rapor verileri alınamadı.');
      setStudentsData([]);
      setPdfReports([]);
      setAnalytics({ classReports: [], topics: [] });
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    loadStudentReports();
  }, [loadStudentReports]);

  const selectedStudentReport = useMemo(() => {
    const report = buildStudentReport(selectedStudentDetail);
    const classAnalytics = analytics.classReports?.find((item) => item.className === report.className);
    return {
      ...report,
      attendanceRate: selectedStudentDetail?.attendanceRate || classAnalytics?.attendance || 0,
      completionRate: classAnalytics?.completion || 0,
    };
  }, [analytics.classReports, selectedStudentDetail]);

  const dynamicReports = useMemo(() => {
    const reports = [...pdfReports];
    if (selectedStudentDetail) {
      reports.unshift(selectedStudentReport);
    }
    return reports;
  }, [pdfReports, selectedStudentDetail, selectedStudentReport]);

  const filteredReports = useMemo(() => dynamicReports.filter((report) => (
    (activeType === 'Tümü' || report.type === activeType)
    && (subject === 'Tüm Dersler' || report.subject === subject)
    && (className === 'Tüm Sınıflar' || report.className === className)
    && (student === 'Tüm Öğrenciler' || report.student === student)
    && (() => {
      if (dateFilter === 'Tüm Tarihler') return true;
      const created = report.createdAtUtc ? new Date(report.createdAtUtc) : null;
      if (!created || Number.isNaN(created.getTime())) return false;
      const now = new Date();
      if (dateFilter === 'Bu Ay') return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      if (dateFilter === 'Son 90 Gün') return now.getTime() - created.getTime() <= 90 * 24 * 60 * 60 * 1000;
      return true;
    })()
  )), [activeType, className, dateFilter, dynamicReports, student, subject]);

  const selectedReport = filteredReports.find((report) => report.id === selectedId)
    || (selectedStudentDetail ? selectedStudentReport : null)
    || filteredReports[0]
    || emptyReport;

  const reportStudentOptions = useMemo(() => ['Tüm Öğrenciler', ...new Set(dynamicReports.map((item) => item.student).filter(Boolean))], [dynamicReports]);
  const reportClassOptions = useMemo(() => ['Tüm Sınıflar', ...new Set(dynamicReports.map((item) => item.className).filter(Boolean))], [dynamicReports]);
  const reportSubjectOptions = useMemo(() => {
    const realSubjects = dynamicReports
      .map((item) => normalizeFilterValue(item.subject))
      .filter((item) => item && item !== '-' && item !== 'Tüm Dersler');

    return ['Tüm Dersler', ...Array.from(new Set(realSubjects)).sort((a, b) => a.localeCompare(b, 'tr'))];
  }, [dynamicReports]);

  useEffect(() => {
    if (!reportSubjectOptions.includes(subject)) {
      setSubject('Tüm Dersler');
    }
  }, [reportSubjectOptions, subject]);

  const openPdfMode = useCallback(() => {
    setSelectedId(selectedStudentReport.id);
    setStudent(selectedStudentReport.student || 'Tüm Öğrenciler');
    setClassName(selectedStudentReport.className || 'Tüm Sınıflar');
    setActiveType('Tümü');
    setActivePage(1);
    setViewMode('pdf');
  }, [selectedStudentReport]);

  const selectReport = useCallback((report) => {
    setSelectedId(report.id);
    setActivePage(1);
    setActionMessage('');
  }, []);

  const generatePdfBlob = useCallback(async () => {
    const nodes = exportRef.current?.querySelectorAll('[data-export-page]');
    if (!nodes || nodes.length === 0) throw new Error('Önizleme sayfaları bulunamadı.');
    const pdf = new jsPDF({ unit: 'px', format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], orientation: 'portrait', compress: true });
    for (let index = 0; index < nodes.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(nodes[index], {
        scale: 2,
        width: PDF_PAGE_WIDTH,
        height: PDF_PAGE_HEIGHT,
        windowWidth: PDF_PAGE_WIDTH,
        windowHeight: PDF_PAGE_HEIGHT,
        backgroundColor: '#08111F',
        useCORS: true,
        logging: false,
      });
      if (index > 0) pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
    }
    return pdf.output('blob');
  }, []);

  const handleGeneratePdf = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      setActionMessage('PDF oluşturuluyor...');
      const blob = await generatePdfBlob();
      saveBlob(blob, `${sanitizeFileName(selectedReport.name)}.pdf`);
      setActionMessage('PDF oluşturuldu ve indirildi.');
    } catch (error) {
      setActionMessage(error.message || 'PDF oluşturulamadı.');
    } finally {
      setExporting(false);
    }
  }, [exporting, generatePdfBlob, selectedReport.name]);

  const handleDownloadReport = useCallback(async (report = selectedReport) => {
    // Çözülen sınav kağıtları: canlı oturum verisinden birebir tasarımla üretilir.
    if (report?.source === 'teacher-pdf-report' && report?.examSessionId) {
      try {
        setActionMessage('Sınav kağıdı oluşturuluyor...');
        const session = await fetchSolutionSession(report.examSessionId);
        if (!session || !Array.isArray(session.questions) || session.questions.length === 0) {
          throw new Error('Sınav verisi bulunamadı.');
        }
        await downloadExamPaperPdf(session, `sinav-kagidi-${session.title || report.examSessionId}`);
        setActionMessage('Sınav kağıdı indirildi.');
      } catch (error) {
        setActionMessage(error.message || 'Sınav kağıdı oluşturulamadı.');
      }
      return;
    }
    if (report?.downloadUrl) {
      try {
        setActionMessage('PDF indiriliyor...');
        const blob = await fetchReportBlob(report.downloadUrl);
        saveBlob(blob, `${sanitizeFileName(report.name)}.pdf`);
        setActionMessage('PDF indirildi.');
      } catch {
        openDownloadUrl(report.downloadUrl);
        setActionMessage('PDF yeni sekmede açıldı.');
      }
      return;
    }
    if (report?.id === selectedReport?.id) {
      await handleGeneratePdf();
      return;
    }
    setActionMessage('Bu rapor için hazır PDF dosyası yok.');
  }, [handleGeneratePdf, selectedReport]);

  const handlePrint = useCallback(() => {
    window.print();
    setActionMessage('Yazdırma penceresi açıldı. Hedef olarak PDF kaydet seçebilirsiniz.');
  }, []);

  const collectReportFiles = useCallback(async (reports) => {
    const files = [];
    const readyReports = reports.filter((item) => item.downloadUrl);
    for (const item of readyReports) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const blob = await fetchReportBlob(item.downloadUrl);
        files.push({ name: `${sanitizeFileName(item.name)}.pdf`, blob });
      } catch {
        // indirilemeyen raporu atla
      }
    }
    if (!selectedReport?.downloadUrl && selectedReport?.id !== 'empty') {
      try {
        const blob = await generatePdfBlob();
        files.push({ name: `${sanitizeFileName(selectedReport.name)}.pdf`, blob });
      } catch {
        // canlı önizleme üretilemezse atla
      }
    }
    return files;
  }, [generatePdfBlob, selectedReport]);

  const handleBulkDownload = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      setActionMessage('Raporlar hazırlanıyor...');
      const files = await collectReportFiles(filteredReports);
      if (files.length === 0) {
        setActionMessage('İndirilecek PDF bulunamadı.');
        return;
      }
      files.forEach((file) => saveBlob(file.blob, file.name));
      setActionMessage(`${files.length} PDF indirildi.`);
    } catch (error) {
      setActionMessage(error.message || 'Toplu indirme başarısız oldu.');
    } finally {
      setExporting(false);
    }
  }, [collectReportFiles, exporting, filteredReports]);

  const handleZipDownload = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      setActionMessage('ZIP arşivi hazırlanıyor...');
      const files = await collectReportFiles(filteredReports);
      if (files.length === 0) {
        setActionMessage('Arşive eklenecek PDF bulunamadı.');
        return;
      }
      const zip = new JSZip();
      files.forEach((file) => zip.file(file.name, file.blob));
      const archive = await zip.generateAsync({ type: 'blob' });
      saveBlob(archive, `pdf-raporlari-${new Date().toISOString().slice(0, 10)}.zip`);
      setActionMessage(`${files.length} PDF içeren ZIP indirildi.`);
    } catch (error) {
      setActionMessage(error.message || 'ZIP oluşturulamadı.');
    } finally {
      setExporting(false);
    }
  }, [collectReportFiles, exporting, filteredReports]);

  const handleFullscreen = useCallback(() => {
    const target = document.querySelector('[data-testid="teacher-pdf-report-center-page"]');
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    target?.requestFullscreen?.();
  }, []);

  const previewScale = (PDF_PREVIEW_BASE_WIDTH / PDF_PAGE_WIDTH) * (zoom / 100);
  const previewWidth = Math.round(PDF_PAGE_WIDTH * previewScale);
  const previewHeight = Math.round(PDF_PAGE_HEIGHT * previewScale);

  if (viewMode === 'students') {
    return (
      <StudentReportMode
        studentsData={studentsData}
        analytics={analytics}
        loading={loadingStudents}
        error={loadError}
        selectedStudent={selectedStudentDetail}
        onSelectStudent={setSelectedStudentDetail}
        onOpenPdf={openPdfMode}
        onReload={loadStudentReports}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-foreground/10 bg-[#08111F] text-white shadow-[0_35px_110px_-55px_rgba(0,0,0,0.9)]"
      data-testid="teacher-pdf-report-center-page"
    >
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 xl:grid-cols-[minmax(380px,0.92fr)_minmax(0,1.45fr)]">
        <aside className="flex min-w-0 flex-col border-b border-foreground/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-6 xl:border-b-0 xl:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-black text-orange-200">
                <Sparkles className="h-3.5 w-3.5" />
                Premium PDF Merkezi
              </div>
              <h1 className="text-3xl font-black tracking-tight">PDF Raporları</h1>
              <p className="mt-2 text-sm text-slate-400">Oluşturulan veya indirilebilecek tüm raporları görüntüleyin.</p>
            </div>
            <Button onClick={() => setViewMode('students')} variant="outline" className="rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/10 hover:text-white">
              Öğrenci Detayına Dön
            </Button>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {reportTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${activeType === type ? 'border-orange-400/40 bg-orange-500/18 text-orange-200 shadow-[0_0_28px_-14px_rgba(255,157,46,0.95)]' : 'border-foreground/10 bg-foreground/[0.035] text-slate-300 hover:border-foreground/20'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 2xl:grid-cols-2">
            <FilterSelect value={subject} options={reportSubjectOptions} onChange={setSubject} />
            <FilterSelect value={dateFilter} options={['Tüm Tarihler', 'Bu Ay', 'Son 90 Gün']} onChange={setDateFilter} wide />
            <FilterSelect value={className} options={reportClassOptions} onChange={setClassName} />
            <FilterSelect value={student} options={reportStudentOptions} onChange={setStudent} wide />
            <FilterSelect value={activeType} options={reportTypes} onChange={setActiveType} wide />
          </div>

          <div className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
            {loadError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{loadError}</div>
            ) : null}
            {loadingStudents ? (
              <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-8 text-center text-sm text-slate-400">Raporlar yükleniyor...</div>
            ) : filteredReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-foreground/12 bg-foreground/[0.035] p-8 text-center text-sm text-slate-400">
                Hazır PDF raporu bulunamadı. Öğrenci detayından canlı önizleme açabilir veya öğrenciler sınav bitirince oluşan gerçek PDF raporlarını burada görebilirsiniz.
              </div>
            ) : filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                active={selectedReport.id === report.id}
                onSelect={() => selectReport(report)}
                onPreview={() => selectReport(report)}
                onDownload={() => handleDownloadReport(report)}
              />
            ))}
          </div>

          {actionMessage ? (
            <div className="mt-4 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3 text-sm text-orange-100">
              {actionMessage}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Button variant="outline" disabled={exporting} onClick={handleBulkDownload} className="h-12 rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/10 hover:text-white disabled:opacity-50">
              <Archive className="mr-2 h-4 w-4" />
              Toplu PDF
            </Button>
            <Button variant="outline" disabled={exporting} onClick={handleZipDownload} className="h-12 rounded-xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/10 hover:text-white disabled:opacity-50">
              <FileArchive className="mr-2 h-4 w-4" />
              ZIP İndir
            </Button>
            <Button disabled={exporting} onClick={handleGeneratePdf} className="h-12 rounded-xl bg-orange-500 text-white shadow-[0_18px_40px_-20px_rgba(255,157,46,0.9)] hover:bg-orange-600 disabled:opacity-60">
              <FilePlus2 className="mr-2 h-4 w-4" />
              {exporting ? 'Hazırlanıyor...' : 'PDF Oluştur'}
            </Button>
          </div>
        </aside>

        <main className="min-w-0 bg-[radial-gradient(circle_at_20%_0%,rgba(77,163,255,0.12),transparent_25%),radial-gradient(circle_at_90%_8%,rgba(123,97,255,0.13),transparent_28%)] p-6">
          <div className="flex h-full flex-col rounded-[24px] border border-foreground/10 bg-foreground/[0.035] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-[#0B1728]/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={() => setZoom((value) => Math.min(160, value + 10))} />
                <ToolbarButton icon={Minus} label="Zoom Out" onClick={() => setZoom((value) => Math.max(70, value - 10))} />
                <div className="mx-2 h-6 w-px bg-foreground/10" />
                <ToolbarButton icon={ChevronLeft} label="Önceki Sayfa" disabled={activePage <= 1} onClick={() => setActivePage((page) => Math.max(1, page - 1))} />
                <span className="px-3 text-sm font-black text-white">{activePage} / 6</span>
                <ToolbarButton icon={ChevronRight} label="Sonraki Sayfa" disabled={activePage >= 6} onClick={() => setActivePage((page) => Math.min(6, page + 1))} />
                <span className="mx-3 text-sm font-semibold text-slate-300">{zoom}%</span>
              </div>
              <div className="flex items-center gap-2">
                <ToolbarButton icon={Maximize2} label="Tam Ekran" onClick={handleFullscreen} />
                <ToolbarButton icon={Download} label="İndir" disabled={exporting} onClick={() => handleDownloadReport(selectedReport)} />
                <ToolbarButton icon={Printer} label="Yazdır" onClick={handlePrint} />
              </div>
            </div>

            <div className="mt-5 grid min-h-0 flex-1 grid-cols-[110px_minmax(0,1fr)] gap-5">
              <div className="overflow-y-auto pr-1">
                <p className="mb-3 text-xs font-bold text-slate-400">Sayfa Önizleme</p>
                <div className="space-y-4">
                  {Array.from({ length: 6 }, (_, index) => index + 1).map((page) => (
                    <div key={page} onClick={() => setActivePage(page)}>
                      <MiniPage index={page} active={activePage === page}>
                        <ThumbnailContent page={page} />
                      </MiniPage>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-h-0 overflow-auto rounded-[18px] border border-foreground/10 bg-[#111827] p-4">
                <motion.div
                  key={`${selectedReport.id}-${activePage}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.22 }}
                  className="mx-auto"
                  style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                >
                  <div style={{ width: `${PDF_PAGE_WIDTH}px`, height: `${PDF_PAGE_HEIGHT}px`, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                    <PreviewPage page={activePage} selectedReport={selectedReport} analytics={analytics} />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div ref={exportRef} aria-hidden className="pointer-events-none fixed left-[-12000px] top-0">
        {[1, 2, 3, 4, 5, 6].map((page) => (
          <div key={page} data-export-page className="overflow-hidden bg-[#08111F]" style={{ width: `${PDF_PAGE_WIDTH}px`, height: `${PDF_PAGE_HEIGHT}px` }}>
            <PreviewPage page={page} selectedReport={selectedReport} analytics={analytics} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
