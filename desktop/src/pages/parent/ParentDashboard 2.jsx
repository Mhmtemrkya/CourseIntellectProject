import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  TrendingUp,
  CreditCard,
  Bell,
  MessageSquare,
  ClipboardCheck,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchParentDashboardData } from '../../lib/api/dashboardData';
import {
  MiniBarChart,
  MiniDonut,
  MiniLineChart,
  PremiumMetricCard,
  PremiumPanel,
} from '../../components/ui/premium-dashboard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function ParentDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchParentDashboardData(user);
      setData(payload);
      setSelectedChildId(payload.selectedChild?.username || payload.selectedChild?.fullName || '');
    } catch (err) {
      setError(err.message || 'Veli paneli alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const selectedChild = useMemo(() => {
    if (!data?.children?.length) return null;
    return data.children.find((child) => (child.username || child.fullName) === selectedChildId) || data.children[0];
  }, [data, selectedChildId]);

  const selectedSummary = useMemo(() => {
    if (!selectedChild || !data?.selectedChildSummary) return data?.selectedChildSummary || null;
    if ((data.selectedChild?.username || data.selectedChild?.fullName) === (selectedChild.username || selectedChild.fullName)) {
      return data.selectedChildSummary;
    }
    return {
      attendance: 0,
      lastExam: { subject: 'Veri hazırlanıyor', score: 0 },
      pendingPayment: 0,
      paidTotal: 0,
    };
  }, [data, selectedChild]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Veli paneli hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="parent-dashboard-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Hoş Geldiniz</h1>
          <p className="text-muted-foreground mt-1">Çocuklarınızın güncel eğitim ve ödeme özeti</p>
        </div>

        {data?.children?.length ? (
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Çocuk seçin" />
            </SelectTrigger>
            <SelectContent>
              {data.children.map((child) => (
                <SelectItem key={child.username || child.fullName} value={child.username || child.fullName}>
                  {child.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button variant="outline" onClick={() => navigate('/p/children')}>Çocuklarım</Button>
        )}
      </div>

      {error ? (
        <ErrorBanner title="Veli verisi alınamadı" message={error} onRetry={loadDashboard} />
      ) : null}

      {selectedChild ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-brand-primary to-brand-primary/80 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 border-4 border-foreground/20">
                  <AvatarFallback className="bg-brand-accent text-white text-2xl">
                    {selectedChild.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedChild.fullName}</h2>
                  <p className="text-foreground/80">{selectedChild.className || 'Sınıf bilgisi yok'}</p>
                </div>
                <div className="hidden md:grid grid-cols-3 gap-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{selectedSummary?.attendance || 0}%</p>
                    <p className="text-foreground/70 text-sm">Devam Oranı</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{selectedSummary?.lastExam?.score || 0}</p>
                    <p className="text-foreground/70 text-sm">Son Sınav</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">₺{(selectedSummary?.pendingPayment || 0).toLocaleString('tr-TR')}</p>
                    <p className="text-foreground/70 text-sm">Bekleyen Ödeme</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Devamsızlık', `${100 - (selectedSummary?.attendance || 0)}%`, ClipboardCheck, 'amber', 'Bu dönem'],
          ['Son Sınav', selectedSummary?.lastExam?.score || 0, FileQuestion, 'violet', selectedSummary?.lastExam?.subject || 'Henüz kayıt yok'],
          ['Bekleyen Ödeme', `₺${(selectedSummary?.pendingPayment || 0).toLocaleString('tr-TR')}`, CreditCard, 'rose', 'Finans'],
          ['Mesajlar', data?.unreadMessages || 0, MessageSquare, 'blue', 'Okunmamış'],
        ].map(([title, value, Icon, tone, subtitle]) => (
          <motion.div variants={itemVariants} key={title}>
            <PremiumMetricCard title={title} value={value} icon={Icon} tone={tone} trend={subtitle} />
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Öğrenci Genel Görünüm" description="Akademik, devamsızlık ve ödeme göstergeleri">
          <div className="grid gap-5 xl:grid-cols-[1fr_180px_220px]">
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Veli takip grafiği</p>
                  <p className="mt-1 text-2xl font-black">{selectedChild?.fullName || 'Öğrenci'}</p>
                </div>
                <Badge variant="outline">{selectedChild?.className || 'Sınıf'}</Badge>
              </div>
              <MiniLineChart values={[selectedSummary?.attendance || 0, selectedSummary?.lastExam?.score || 0, data?.attendanceBreakdown?.present || 0, data?.attendanceBreakdown?.absent || 0, data?.attendanceBreakdown?.excuse || 0, data?.unreadMessages || 0]} className="h-40" />
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Devam Oranı</p>
              <div className="mt-5 flex justify-center">
                <MiniDonut value={selectedSummary?.attendance || 0} label="Devam" />
              </div>
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Finans / Devam</p>
              <MiniBarChart values={[selectedSummary?.pendingPayment || 0, selectedSummary?.paidTotal || 0, data?.attendanceBreakdown?.present || 0, data?.attendanceBreakdown?.absent || 0]} className="mt-5" />
            </div>
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-brand-accent" />
                  Duyurular
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/p/announcements')}>
                Tümü <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.announcements || []).map((announcement) => (
                <div key={announcement.id || announcement.title} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {/kritik|onem/i.test(`${announcement.title} ${announcement.detail || ''}`) ? (
                      <AlertCircle className="h-4 w-4 text-brand-accent" />
                    ) : null}
                    <div>
                      <p className="font-medium">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground">{announcement.dateLabel || announcement.date || 'Bugün'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Devam Durumu
              </CardTitle>
              <CardDescription>Seçili çocuk için backend yoklama özeti</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Devam Oranı</span>
                  <span className="font-bold">{data?.attendanceBreakdown?.rate || 0}%</span>
                </div>
                <Progress value={data?.attendanceBreakdown?.rate || 0} className="h-3" />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-2xl font-bold text-green-600">{data?.attendanceBreakdown?.present || 0}</p>
                  <p className="text-xs text-muted-foreground">Katılım</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-600">{data?.attendanceBreakdown?.absent || 0}</p>
                  <p className="text-xs text-muted-foreground">Devamsız</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="text-2xl font-bold text-yellow-600">{data?.attendanceBreakdown?.excuse || 0}</p>
                  <p className="text-xs text-muted-foreground">İzinli</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
