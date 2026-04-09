import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Eye, FileText, Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useApp } from '../../context/AppContext';
import { fetchParentDashboardData } from '../../lib/api/dashboardData';
import { fetchTeacherWeeklyReportsForParent } from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';
import { openExternalUrl } from '../../lib/tauri';

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

function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resolveAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${desktopApiBaseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export default function ParentWeeklyReport() {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [teacherReports, setTeacherReports] = useState([]);
  const [selectedTeacherReport, setSelectedTeacherReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const dashboard = await fetchParentDashboardData(user);
      setData(dashboard);
      const child = dashboard?.selectedChild;
      if (child?.fullName) {
        const reports = await fetchTeacherWeeklyReportsForParent({
          studentName: child.fullName,
          studentUsername: child.username || '',
          parentName: child.parentName || user?.name || '',
          parentEmail: child.parentEmail || user?.email || '',
        }).catch(() => []);
        setTeacherReports(reports.map((item) => ({
          ...item,
          teacherName: decodeHtmlEntities(item.teacherName),
          studentName: decodeHtmlEntities(item.studentName),
          parentName: decodeHtmlEntities(item.parentName),
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
      } else {
        setTeacherReports([]);
      }
    } catch (err) {
      setError(err.message || 'Haftalık rapor alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const reportText = useMemo(() => {
    if (!data?.selectedChild) return 'Rapor verisi yok';
    return [
      `Öğrenci: ${data.selectedChild.fullName}`,
      `Sınıf: ${data.selectedChild.className || 'Tanımsız'}`,
      `Devam oranı: %${data.selectedChildSummary?.attendance || 0}`,
      `Son sınav: ${data.selectedChildSummary?.lastExam?.subject || '-'} / ${data.selectedChildSummary?.lastExam?.score || 0}`,
      `Bekleyen ödeme: ₺${Number(data.selectedChildSummary?.pendingPayment || 0).toLocaleString('tr-TR')}`,
      `Duyuru sayısı: ${data.announcements?.length || 0}`,
    ].join('\n');
  }, [data]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-weekly-report-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Haftalık Rapor</h1>
          <p className="text-muted-foreground mt-1">Seçili çocuk için özet rapor</p>
        </div>
        <Button onClick={() => downloadText('haftalik-veli-raporu.txt', reportText)} className="bg-brand-primary hover:bg-brand-primary/90">
          <Download className="h-4 w-4 mr-2" />
          Raporu İndir
        </Button>
      </div>

      {error ? <ErrorBanner title="Haftalık rapor alınamadı" message={error} onRetry={loadReport} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2 overflow-hidden border-slate-200/70">
          <CardHeader className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] text-white">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Öğretmenden Gelen Haftalık Raporlar</CardTitle>
            <CardDescription className="text-white/75">Gönderilen özel raporlar seçili öğrencinin haftalık alanına düşer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {teacherReports.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-slate-900">Henüz özel haftalık rapor yok</p>
                <p className="mt-2 text-sm text-slate-500">Öğretmen rapor gönderdiğinde burada şık kartlar halinde görünecek.</p>
              </div>
            ) : teacherReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedTeacherReport(report)}
                className="w-full rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{report.className}</Badge>
                      <Badge variant="outline">{report.subject}</Badge>
                      <Badge variant="outline">{report.weeklyPeriodLabel}</Badge>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{report.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{report.teacherName} tarafından gönderildi</p>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">{report.summary}</p>
                  </div>
                  <div className="shrink-0 rounded-3xl bg-slate-950 px-5 py-4 text-center text-white">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/55">Ekler</div>
                    <div className="mt-1 text-3xl font-bold">{report.attachments?.length || 0}</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-sm text-white/80"><Eye className="h-4 w-4" />Aç</div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-brand-primary" />Rapor Özeti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 whitespace-pre-wrap text-sm text-muted-foreground">{reportText}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-600" />Haftalık Sinyaller</CardTitle>
            <CardDescription>Canlı backend verisinden türetildi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.announcements || []).slice(0, 4).map((item) => (
              <div key={item.id || item.title} className="rounded-xl bg-muted/40 p-4">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail || 'Detay bulunmuyor.'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTeacherReport} onOpenChange={(open) => !open && setSelectedTeacherReport(null)}>
        <DialogContent className="sm:max-w-4xl overflow-hidden p-0">
          {selectedTeacherReport ? (
            <>
              <div className="bg-[linear-gradient(135deg,#111827_0%,#1e40af_60%,#38bdf8_100%)] px-8 py-8 text-white">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedTeacherReport.subject}</Badge>
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedTeacherReport.weeklyPeriodLabel}</Badge>
                  <Badge className="bg-white/12 text-white hover:bg-white/12">{selectedTeacherReport.className}</Badge>
                </div>
                <DialogHeader className="mt-4 space-y-2 text-left">
                  <DialogTitle className="text-3xl font-bold text-white">{selectedTeacherReport.title}</DialogTitle>
                  <DialogDescription className="text-white/75">
                    {selectedTeacherReport.teacherName} • {new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(selectedTeacherReport.createdAtUtc))}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-6 px-8 py-7">
                <div className="rounded-[28px] bg-slate-50 p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Öğretmen özeti</p>
                  <p className="mt-3 text-base leading-8 text-slate-700">{selectedTeacherReport.summary}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5">
                    <p className="text-sm font-semibold text-emerald-800">Güçlü yönler</p>
                    <p className="mt-3 text-sm leading-7 text-emerald-900/80">{selectedTeacherReport.highlights || 'Bu raporda ayrıca güçlü yön notu paylaşılmadı.'}</p>
                  </div>
                  <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-5">
                    <p className="text-sm font-semibold text-amber-800">Destek alanları</p>
                    <p className="mt-3 text-sm leading-7 text-amber-900/80">{selectedTeacherReport.supportNotes || 'Bu raporda ayrıca destek notu paylaşılmadı.'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ek dosyalar</h4>
                  {selectedTeacherReport.attachments?.length ? selectedTeacherReport.attachments.map((item, index) => (
                    <button
                      key={`${item.url}-${index}`}
                      type="button"
                      onClick={async () => {
                        const url = resolveAssetUrl(item.url);
                        if (!url) return;
                        await openExternalUrl(url);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.fileType}</p>
                      </div>
                      <Badge variant="outline">Aç</Badge>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Bu raporda ek dosya paylaşılmadı.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
