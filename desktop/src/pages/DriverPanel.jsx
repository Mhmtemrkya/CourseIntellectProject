import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BusFront, CheckCircle2, Flag, LogOut, MapPinned, Play, RefreshCw, School, UserX,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { useApp } from '../context/AppContext';
import {
  arrivedSchoolRoute,
  completeRoute,
  getDriverStudentPickupList,
  getDriverTodayRoute,
  startRoute,
  updateStudentBoardingStatus,
} from '../lib/api/modules';
import { resetDriverGuardCache } from '../lib/driverGuard';

const TRIP_STATUS_LABELS = {
  NotStarted: 'Başlamadı',
  InProgress: 'Yolda',
  ArrivedSchool: 'Okulda',
  Completed: 'Tamamlandı',
  Cancelled: 'İptal',
};

const ATTENDANCE_LABELS = {
  Pending: ['Bekliyor', 'bg-slate-500/15 text-slate-500'],
  Boarded: ['Bindi', 'bg-emerald-500/15 text-emerald-500'],
  BoardedFromSchool: ['Bindi', 'bg-emerald-500/15 text-emerald-500'],
  NotBoarded: ['Binmedi', 'bg-red-500/15 text-red-500'],
  ArrivedSchool: ['Okulda', 'bg-blue-500/15 text-blue-500'],
  ArrivedHome: ['Evde', 'bg-blue-500/15 text-blue-500'],
};

// Şoförün masaüstü ekranı: yalnızca bugünkü rotalar, sefer ve biniş akışı.
// Şoför hesabı diğer panellere erişemez (DashboardLayout yönlendirir).
export default function DriverPanel() {
  const { user, isAuthenticated, logout } = useApp();
  const { toast } = useToast();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStudents = useCallback(async (routeId) => {
    try {
      setStudents(await getDriverStudentPickupList(routeId));
    } catch (err) {
      toast({ title: 'Öğrenci listesi alınamadı', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getDriverTodayRoute();
      setRoutes(items);
      const current = items[0] || null;
      setSelectedRoute(current);
      if (current) await loadStudents(current.routeId);
    } catch (err) {
      toast({ title: 'Rotalar alınamadı', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [loadStudents, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const tripId = selectedRoute?.tripId || null;
  const tripStatus = selectedRoute?.tripStatus || 'NotStarted';

  const selectRoute = async (route) => {
    setSelectedRoute(route);
    await loadStudents(route.routeId);
  };

  const runAction = async (action, successMessage) => {
    if (busy) return;
    try {
      setBusy(true);
      await action();
      toast({ title: successMessage });
      await load();
    } catch (err) {
      toast({ title: 'İşlem tamamlanamadı', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const markStudent = async (student, status) => {
    if (!tripId) {
      toast({ title: 'Önce seferi başlat', variant: 'destructive' });
      return;
    }
    try {
      await updateStudentBoardingStatus({ tripId, studentId: student.studentId, status });
      await loadStudents(selectedRoute.routeId);
    } catch (err) {
      toast({ title: 'Yoklama işaretlenemedi', description: err.message, variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    resetDriverGuardCache();
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-slate-200 bg-white/90 dark:border-white/10 dark:bg-[#0B1628]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
              <BusFront className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-lg font-black leading-tight">Servis Şoförü</h1>
              <p className="text-xs text-muted-foreground">{user?.name || 'Şoför'} • Bugünün seferleri</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Yenile
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="driver-logout">
              <LogOut className="mr-2 h-4 w-4" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><LoadingDots /></div>
        ) : routes.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <MapPinned className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-bold">Bugün için atanmış rota yok</p>
              <p className="mt-1 text-sm text-muted-foreground">Rota ataması için kurum yöneticinle iletişime geç.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {routes.map((route) => (
                <button
                  key={route.routeId}
                  type="button"
                  onClick={() => selectRoute(route)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-colors ${
                    selectedRoute?.routeId === route.routeId
                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                      : 'border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-orange-400'
                  }`}
                >
                  {route.routeName} • {route.routeType === 'Morning' ? 'Sabah' : 'Akşam'}
                </button>
              ))}
            </div>

            {selectedRoute && (
              <Card className="border-0 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {selectedRoute.routeName}
                    <Badge className="border-0 bg-blue-500/15 font-bold text-blue-500">
                      {TRIP_STATUS_LABELS[tripStatus] || tripStatus}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {(!tripId || tripStatus === 'NotStarted') && (
                      <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" disabled={busy} onClick={() => runAction(() => startRoute(selectedRoute.routeId), 'Sefer başlatıldı')}>
                        <Play className="mr-2 h-4 w-4" /> Seferi Başlat
                      </Button>
                    )}
                    {tripId && tripStatus === 'InProgress' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => runAction(() => arrivedSchoolRoute(tripId), 'Okula varış kaydedildi')}>
                        <School className="mr-2 h-4 w-4" /> Okula Vardık
                      </Button>
                    )}
                    {tripId && (tripStatus === 'InProgress' || tripStatus === 'ArrivedSchool') && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => runAction(() => completeRoute(tripId), 'Sefer tamamlandı')}>
                        <Flag className="mr-2 h-4 w-4" /> Seferi Bitir
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {students.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Bu rotaya atanmış öğrenci yok.</p>
                  )}
                  {students.map((student) => {
                    const [label, tone] = ATTENDANCE_LABELS[student.attendanceStatus] || ATTENDANCE_LABELS.Pending;
                    return (
                      <div key={student.assignmentId} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{student.studentFullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {student.stopName} • {student.className}
                            {student.hasAbsenceRequest ? ' • İzin talebi var' : ''}
                          </p>
                        </div>
                        <Badge className={`border-0 font-bold ${tone}`}>{label}</Badge>
                        <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => markStudent(student, 'Boarded')}>
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Bindi
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500" onClick={() => markStudent(student, 'NotBoarded')}>
                          <UserX className="mr-1 h-4 w-4" /> Binmedi
                        </Button>
                      </div>
                    );
                  })}
                  <p className="pt-2 text-xs text-muted-foreground">
                    Not: Canlı GPS konum paylaşımı mobil şoför uygulamasından yapılır; bu ekran sefer ve biniş yönetimi içindir.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}
