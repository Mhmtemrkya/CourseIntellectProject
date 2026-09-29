import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, School, Users, ShieldCheck, CalendarClock, ClipboardList, FileWarning } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { fetchAdminDashboardData } from '../../lib/api/dashboardData';
import { fetchAdminOverview } from '../../lib/api/modules';

export default function AdminKpiDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadKpi = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dash, ov] = await Promise.all([
        fetchAdminDashboardData(),
        fetchAdminOverview().catch(() => null),
      ]);
      setData(dash);
      const firstClass = dash?.questionResponseByClass?.[0]?.className || dash?.classOptions?.[0] || '';
      setSelectedClass((current) => current || firstClass);
      setOverview(ov);
    } catch (err) {
      setError(err.message || 'KPI verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKpi(); }, [loadKpi]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const stats = data?.stats || {};
  const responseRows = data?.questionResponseByClass || [];
  const classOptions = responseRows.length > 0 ? responseRows.map((item) => item.className) : (data?.classOptions || []);
  const selectedResponse = responseRows.find((item) => item.className === selectedClass) || responseRows[0] || null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-kpi-dashboard-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Kurum Özeti</h1>
        <p className="text-muted-foreground mt-1">Canlı kurum metrikleri ve sınıf bazlı iletişim özeti</p>
      </div>
      {error ? <ErrorBanner title="Kurum özeti verisi alınamadı" message={error} onRetry={loadKpi} /> : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['Öğrenci', stats.totalStudents || 0, Users, '/students'],
          ['Öğretmen', stats.totalTeachers || 0, School, '/teachers'],
          ['Sınıf', stats.totalClasses || 0, BookOpen, '/classes'],
        ].map(([label, value, Icon, route]) => (
          <Card key={label} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(route)}><CardContent className="p-5 flex items-center gap-4"><Icon className="h-8 w-8 text-brand-primary" /><div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mesaj yanıt oranı</p>
              <h2 className="text-xl font-bold">Sınıf bazlı soru-cevap özeti</h2>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Sınıf seç" /></SelectTrigger>
              <SelectContent>
                {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedResponse ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['Sorulan soru', selectedResponse.askedCount],
                  ['Cevaplanan soru', selectedResponse.answeredCount],
                  ['Yanıt oranı', `%${selectedResponse.responseRate}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {selectedResponse.teachers.map((teacher) => (
                  <div key={teacher.teacherName} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{teacher.teacherName}</p>
                        <p className="text-sm text-muted-foreground">{selectedResponse.className} sınıfından gelen sorular</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="rounded-full border px-3 py-1 text-xs">Soru: {teacher.askedCount}</span>
                        <span className="rounded-full border px-3 py-1 text-xs">Cevap: {teacher.answeredCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Seçilen sınıf için soru-cevap kaydı bulunmuyor.</p>
          )}
        </CardContent>
      </Card>

      {overview ? (
        <div>
          <h2 className="mb-3 text-lg font-bold">İdari Bekleyenler</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Bekleyen Onay', overview.pendingApprovals || 0, ShieldCheck, '/admin/personnel-approvals'],
              ['İzin Talebi', overview.pendingLeaves || 0, CalendarClock, '/admin/staff-hr'],
              ['Açık Görev', overview.openTasks || 0, ClipboardList, '/admin/task-center'],
              ['Süresi Dolan Evrak', overview.expiringDocuments || 0, FileWarning, '/admin/documents'],
            ].map(([label, value, Icon, route]) => (
              <Card key={label} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(route)}>
                <CardContent className="p-5 flex items-center gap-3">
                  <Icon className="h-7 w-7 text-brand-primary" />
                  <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
