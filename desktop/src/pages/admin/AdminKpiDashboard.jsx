import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, School, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAdminDashboardData } from '../../lib/api/dashboardData';

export default function AdminKpiDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadKpi = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchAdminDashboardData());
    } catch (err) {
      setError(err.message || 'KPI verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKpi(); }, [loadKpi]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const stats = data?.stats || {};
  const quick = data?.quickStats || {};
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-kpi-dashboard-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">KPI Paneli</h1>
        <p className="text-muted-foreground mt-1">Canlı yönetim metrikleri</p>
      </div>
      {error ? <ErrorBanner title="KPI verisi alınamadı" message={error} onRetry={loadKpi} /> : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['Öğrenci', stats.totalStudents || 0, Users, '/students'],
          ['Öğretmen', stats.totalTeachers || 0, School, '/teachers'],
          ['Sınıf', stats.totalClasses || 0, BookOpen, '/classes'],
          ['Devam', `${stats.todayAttendanceRate || 0}%`, BarChart3, '/reports'],
        ].map(([label, value, Icon, route]) => (
          <Card key={label} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(route)}><CardContent className="p-5 flex items-center gap-4"><Icon className="h-8 w-8 text-brand-primary" /><div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Mesaj yanıt oranı</p><p className="text-3xl font-bold">{quick.answeredMessagesRate || 0}%</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sınav performansı</p><p className="text-3xl font-bold">{quick.examRate || 0}</p></CardContent></Card>
      </div>
    </motion.div>
  );
}
