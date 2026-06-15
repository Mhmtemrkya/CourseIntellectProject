import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BusFront,
  CheckCircle2,
  MapPinned,
  Navigation,
  Plus,
  RadioTower,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  createServiceDriver,
  createServiceRoute,
  createServiceRouteStop,
  createServiceVehicle,
  deleteServiceDriver,
  assignServiceStudent,
  deleteServiceAssignment,
  fetchServiceRouteDetail,
  fetchServiceDrivers,
  fetchServiceRoutes,
  fetchServiceVehicles,
  fetchUsers,
  searchServiceStudents,
  setServiceRouteActive,
  deleteServiceRouteStop,
  reorderServiceRouteStops,
  getLiveVehicleLocations,
} from '../../lib/api/modules';
import { serviceTrackingRealtime } from '../../lib/realtime/serviceTrackingRealtime';
import {
  isValidTrPhone, isValidTrPlate, maskPositiveInteger, maskTrPhone, maskTrPlate, maskVehicleNumber,
} from '../../lib/inputMasks';

const emptyVehicleForm = {
  vehicleNumber: '',
  plateNumber: '',
  brand: '',
  model: '',
  capacity: '15',
};

const emptyDriverForm = {
  userId: '',
  phoneNumber: '',
  licenseNumber: '',
};

const emptyRouteForm = {
  name: '',
  routeType: 'Morning',
  vehicleId: '',
  driverId: '',
  startTime: '07:30',
  endTime: '09:00',
};

const emptyStopForm = {
  name: '',
  address: '',
  latitude: '41.0000',
  longitude: '29.0000',
  sortOrder: '1',
};

function routeTypeLabel(value) {
  if (value === 'Morning') return 'Sabah';
  if (value === 'Evening') return 'Akşam';
  return value || '-';
}

function normalizePagedItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getUserName(user) {
  return user?.name || user?.fullName || user?.username || user?.email || 'Kullanıcı';
}

export default function ServiceTrackingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const [routeForm, setRouteForm] = useState(emptyRouteForm);
  const [routeDetail, setRouteDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stopForm, setStopForm] = useState(emptyStopForm);
  const [studentKeyword, setStudentKeyword] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');

  const [liveTrips, setLiveTrips] = useState([]);

  const loadLiveTrips = useCallback(async () => {
    try {
      setLiveTrips(await getLiveVehicleLocations());
    } catch {
      // Canlı izleme alınamazsa mevcut liste korunur; ana hata akışını bozmaz.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [vehicleItems, driverItems, routeItems, userPayload] = await Promise.all([
        fetchServiceVehicles(),
        fetchServiceDrivers(),
        fetchServiceRoutes(),
        fetchUsers(1, 500),
      ]);
      await loadLiveTrips();
      const userItems = normalizePagedItems(userPayload);
      setVehicles(vehicleItems);
      setDrivers(driverItems);
      setRoutes(routeItems);
      setUsers(userItems);
      setDriverForm((previous) => ({
        ...previous,
        userId: previous.userId || userItems[0]?.id || '',
        phoneNumber: maskTrPhone(previous.phoneNumber || userItems[0]?.phone || ''),
      }));
      setRouteForm((previous) => ({
        ...previous,
        vehicleId: previous.vehicleId || vehicleItems[0]?.id || '',
        driverId: previous.driverId || driverItems[0]?.id || '',
      }));
    } catch (err) {
      setError(err.message || 'Servis takip verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [loadLiveTrips]);

  // SignalR: araç konumu / sefer / biniş güncellemelerinde canlı listeyi tazele.
  useEffect(() => serviceTrackingRealtime.subscribe(() => {
    loadLiveTrips();
  }), [loadLiveTrips]);

  useEffect(() => {
    load();
  }, [load]);

  const activeDrivers = useMemo(() => drivers.filter((item) => item.isActive), [drivers]);
  const activeVehicles = useMemo(() => vehicles.filter((item) => item.isActive), [vehicles]);
  const serviceSummary = useMemo(() => {
    const activeRoutes = routes.filter((item) => item.isActive);
    const assignedStudents = routes.reduce((sum, route) => sum + Number(route.totalStudents || 0), 0);
    const totalSeats = routes.reduce((sum, route) => sum + Number(route.capacity || 0), 0);
    const occupancy = totalSeats > 0 ? Math.round((assignedStudents / totalSeats) * 100) : 0;
    return {
      activeRoutes: activeRoutes.length,
      assignedStudents,
      totalSeats,
      occupancy,
    };
  }, [routes]);

  const selectedDriverUser = useMemo(
    () => users.find((item) => item.id === driverForm.userId),
    [driverForm.userId, users]
  );

  function openDialog(type) {
    setSuccess('');
    setError('');
    if (type === 'vehicle') setVehicleForm(emptyVehicleForm);
    if (type === 'driver') {
      const firstUser = users[0];
      setDriverForm({
        ...emptyDriverForm,
        userId: firstUser?.id || '',
        phoneNumber: maskTrPhone(firstUser?.phone || ''),
      });
    }
    if (type === 'route') {
      setRouteForm({
        ...emptyRouteForm,
        vehicleId: activeVehicles[0]?.id || vehicles[0]?.id || '',
        driverId: activeDrivers[0]?.id || drivers[0]?.id || '',
      });
    }
    setDialog(type);
  }

  async function openRouteDetail(routeId) {
    try {
      setDialog('route-detail');
      setDetailLoading(true);
      setRouteDetail(null);
      setStudentResults([]);
      setSelectedStudentId('');
      setStudentKeyword('');
      const detail = await fetchServiceRouteDetail(routeId);
      setRouteDetail(detail);
      setSelectedStopId(detail?.stops?.[0]?.stopId || '');
      setStopForm({
        ...emptyStopForm,
        sortOrder: String((detail?.stops?.length || 0) + 1),
      });
    } catch (err) {
      setError(err.message || 'Rota detayı alınamadı.');
      setDialog(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreateVehicle(event) {
    event.preventDefault();
    const capacity = Number(vehicleForm.capacity);
    if (!isValidTrPlate(vehicleForm.plateNumber) || !Number.isInteger(capacity) || capacity < 2) {
      setError('Plaka 34 ABC 123 biçiminde, kapasite en az 2 olmalı.');
      return;
    }
    await submit(async () => {
      await createServiceVehicle({
        vehicleNumber: vehicleForm.vehicleNumber.trim(),
        plateNumber: vehicleForm.plateNumber.trim(),
        brand: vehicleForm.brand.trim(),
        model: vehicleForm.model.trim(),
        capacity,
        isActive: true,
      });
      setSuccess('Servis aracı oluşturuldu.');
    });
  }

  async function handleCreateDriver(event) {
    event.preventDefault();
    if (!driverForm.userId) {
      setError('Şoför yapılacak kullanıcıyı seçmelisin.');
      return;
    }
    if (driverForm.phoneNumber && !isValidTrPhone(driverForm.phoneNumber)) {
      setError('Telefon +90 5XX XXX XX XX biçiminde olmalı.');
      return;
    }
    await submit(async () => {
      await createServiceDriver({
        userId: driverForm.userId,
        phoneNumber: driverForm.phoneNumber.trim() || selectedDriverUser?.phone || '',
        licenseNumber: driverForm.licenseNumber.trim(),
        isActive: true,
      });
      setSuccess('Servis şoförü oluşturuldu.');
    });
  }

  async function handleCreateRoute(event) {
    event.preventDefault();
    if (!routeForm.name.trim() || !routeForm.vehicleId || !routeForm.driverId) {
      setError('Rota adı, araç ve şoför seçimi zorunlu.');
      return;
    }
    await submit(async () => {
      await createServiceRoute({
        name: routeForm.name.trim(),
        routeType: routeForm.routeType,
        vehicleId: routeForm.vehicleId,
        driverId: routeForm.driverId,
        startTime: routeForm.startTime,
        endTime: routeForm.endTime,
        isActive: false,
      });
      setSuccess('Servis rotası oluşturuldu. Aktifleştirmek için en az bir durak ekleyin.');
    });
  }

  async function handleCreateStop(event) {
    event.preventDefault();
    if (!routeDetail?.id) return;
    const latitude = Number(String(stopForm.latitude).replace(',', '.'));
    const longitude = Number(String(stopForm.longitude).replace(',', '.'));
    const sortOrder = Number(stopForm.sortOrder);
    if (!stopForm.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(sortOrder)) {
      setError('Durak adı, koordinat ve sıra bilgisi geçerli olmalı.');
      return;
    }
    await submit(async () => {
      await createServiceRouteStop(routeDetail.id, {
        name: stopForm.name.trim(),
        address: stopForm.address.trim(),
        latitude,
        longitude,
        sortOrder,
      });
      const detail = await fetchServiceRouteDetail(routeDetail.id);
      setRouteDetail(detail);
      setSelectedStopId(detail?.stops?.[0]?.stopId || '');
      setStopForm({ ...emptyStopForm, sortOrder: String((detail?.stops?.length || 0) + 1) });
      setSuccess('Durak eklendi.');
    }, { closeDialog: false });
  }

  async function handleSearchStudent(event) {
    event.preventDefault();
    if (!studentKeyword.trim()) {
      setStudentResults([]);
      return;
    }
    try {
      setSaving(true);
      setError('');
      const results = await searchServiceStudents(studentKeyword.trim());
      setStudentResults(results);
      setSelectedStudentId(results[0]?.studentId || '');
    } catch (err) {
      setError(err.message || 'Öğrenci araması yapılamadı.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignStudent(event) {
    event.preventDefault();
    if (!routeDetail?.id || !selectedStudentId || !selectedStopId) {
      setError('Öğrenci ve durak seçimi zorunlu.');
      return;
    }
    const student = studentResults.find((item) => item.studentId === selectedStudentId);
    await submit(async () => {
      await assignServiceStudent({
        studentId: selectedStudentId,
        parentId: student?.parentId || null,
        routeId: routeDetail.id,
        stopId: selectedStopId,
      });
      const detail = await fetchServiceRouteDetail(routeDetail.id);
      setRouteDetail(detail);
      setSuccess('Öğrenci servise atandı.');
    }, { closeDialog: false });
  }

  async function refreshRouteDetail(routeId = routeDetail?.id) {
    if (!routeId) return;
    const detail = await fetchServiceRouteDetail(routeId);
    setRouteDetail(detail);
    setSelectedStopId(detail?.stops?.[0]?.stopId || '');
  }

  async function handleDeleteStop(stop) {
    if (!window.confirm(`${stop.stopName} durağı silinsin mi?`)) return;
    await submit(async () => {
      await deleteServiceRouteStop(stop.stopId);
      await refreshRouteDetail();
      setSuccess('Durak silindi.');
    }, { closeDialog: false });
  }

  async function handleDeleteAssignment(student) {
    if (!window.confirm(`${student.studentFullName} servis ataması kaldırılsın mı?`)) return;
    await submit(async () => {
      await deleteServiceAssignment(student.assignmentId);
      await refreshRouteDetail();
      setSuccess('Öğrenci servis ataması kaldırıldı.');
    }, { closeDialog: false });
  }

  async function handleMoveStop(stop, direction) {
    if (!routeDetail?.stops?.length) return;
    const stops = [...routeDetail.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = stops.findIndex((item) => item.stopId === stop.stopId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= stops.length) return;
    const nextStops = stops.map((item) => ({ ...item }));
    const currentOrder = nextStops[index].sortOrder;
    nextStops[index].sortOrder = nextStops[target].sortOrder;
    nextStops[target].sortOrder = currentOrder;
    await submit(async () => {
      await reorderServiceRouteStops(routeDetail.id, nextStops.map((item) => ({
        stopId: item.stopId,
        sortOrder: item.sortOrder,
      })));
      await refreshRouteDetail();
      setSuccess('Durak sırası güncellendi.');
    }, { closeDialog: false });
  }

  async function submit(action, { closeDialog = true } = {}) {
    try {
      setSaving(true);
      setError('');
      await action();
      if (closeDialog) setDialog(null);
      await load();
    } catch (err) {
      setError(err.message || 'İşlem tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateDriver(driver) {
    if (!window.confirm(`${driver.fullName} şoför kaydı pasifleştirilsin mi?`)) return;
    await submit(async () => {
      await deleteServiceDriver(driver.id);
      setSuccess('Şoför kaydı pasifleştirildi.');
    });
  }

  async function handleToggleRoute(route) {
    await submit(async () => {
      await setServiceRouteActive(route.id, !route.isActive);
      setSuccess(route.isActive ? 'Rota pasifleştirildi.' : 'Rota aktifleştirildi.');
    });
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-[#08111F] dark:shadow-2xl">
        <div className="relative p-5 sm:p-7">
          <div className="absolute inset-0 opacity-80 dark:opacity-100">
            <div className="absolute right-[-10%] top-[-35%] h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="absolute bottom-[-30%] left-[20%] h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-500">
                <RadioTower className="h-3.5 w-3.5" />
                Servis takip merkezi
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Servis Yönetimi
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Araç, şoför, rota, durak ve öğrenci atamalarını canlı backend verileriyle yönetin. Veri gelmediğinde sahte kayıt gösterilmez; ilgili alan boş durumla kapanır.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={load} className="border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <RefreshCw className="mr-2 h-4 w-4" />
                Yenile
              </Button>
              <Button onClick={() => navigate('/admin/staff-registration')} className="bg-orange-500 text-white hover:bg-orange-600">
                <UserRoundCheck className="mr-2 h-4 w-4" />
                Personelden Şoför Kaydet
              </Button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricCard icon={Route} label="Aktif Rota" value={serviceSummary.activeRoutes} accent="orange" />
            <MetricCard icon={BusFront} label="Araç" value={vehicles.length} accent="blue" />
            <MetricCard icon={UsersRound} label="Atanmış Öğrenci" value={serviceSummary.assignedStudents} accent="green" />
            <MetricCard icon={ShieldCheck} label="Doluluk" value={`%${serviceSummary.occupancy}`} accent="purple" />
          </div>
        </div>
      </div>

      {error ? <ErrorBanner title="Servis işlemi tamamlanamadı" message={error} onRetry={load} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <Card className="overflow-hidden border-slate-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-[#0B1628]/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-orange-500" />
            Canlı İzleme — Bugünün Seferleri
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-emerald-500/15 font-bold text-emerald-500">
              <RadioTower className="mr-1 h-3 w-3" /> SignalR canlı
            </Badge>
            <Button size="sm" variant="outline" onClick={loadLiveTrips}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {liveTrips.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bugün için sefer kaydı yok. Şoför mobil uygulamadan seferi başlattığında konum ve biniş bilgileri burada canlı görünür.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Yön</TableHead>
                  <TableHead>Şoför</TableHead>
                  <TableHead>Plaka</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Binen</TableHead>
                  <TableHead>Hız</TableHead>
                  <TableHead className="text-right">Son Konum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveTrips.map((trip) => {
                  const statusMeta = {
                    NotStarted: ['Başlamadı', 'bg-slate-500/15 text-slate-500'],
                    InProgress: ['Yolda', 'bg-emerald-500/15 text-emerald-500'],
                    ArrivedSchool: ['Okulda', 'bg-blue-500/15 text-blue-500'],
                    Completed: ['Tamamlandı', 'bg-slate-500/15 text-slate-500'],
                    Cancelled: ['İptal', 'bg-red-500/15 text-red-500'],
                  }[trip.status] || [trip.status, 'bg-slate-500/15 text-slate-500'];
                  return (
                    <TableRow key={trip.tripId}>
                      <TableCell className="font-medium">{trip.routeName}</TableCell>
                      <TableCell>{trip.tripType === 'Morning' ? 'Sabah' : 'Akşam'}</TableCell>
                      <TableCell>{trip.driverName}{trip.driverPhone ? ` • ${trip.driverPhone}` : ''}</TableCell>
                      <TableCell>{trip.plateNumber || '-'}</TableCell>
                      <TableCell><Badge className={`border-0 font-bold ${statusMeta[1]}`}>{statusMeta[0]}</Badge></TableCell>
                      <TableCell className="font-bold tabular-nums">{trip.boardedCount} / {trip.studentCount}</TableCell>
                      <TableCell>{trip.speed != null ? `${Math.round(trip.speed)} km/s` : '-'}</TableCell>
                      <TableCell className="text-right">
                        {trip.latitude != null && trip.longitude != null ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${trip.latitude}&mlon=${trip.longitude}#map=16/${trip.latitude}/${trip.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-orange-500 hover:underline"
                          >
                            <MapPinned className="h-3.5 w-3.5" />
                            {trip.lastLocationAt ? new Date(trip.lastLocationAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Haritada Aç'}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Konum yok</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-slate-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-[#0B1628]/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserRoundCheck className="h-5 w-5 text-orange-500" />
              Servis Şoförleri
            </CardTitle>
            <Button size="sm" onClick={() => navigate('/admin/staff-registration')}>
              <Plus className="mr-2 h-4 w-4" />
              Personelden Kaydet
            </Button>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <EmptyCard title="Henüz servis şoförü yok" detail="Bir kullanıcıyı servis şoförü olarak atayıp rotalara bağlayabilirsiniz." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Şoför</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Ehliyet</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.fullName}</TableCell>
                      <TableCell>{driver.phoneNumber || '-'}</TableCell>
                      <TableCell>{driver.licenseNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={driver.isActive ? 'default' : 'outline'}>
                          {driver.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!driver.isActive || saving}
                          onClick={() => handleDeactivateDriver(driver)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Pasifleştir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-gradient-to-br dark:from-[#08111F] dark:via-[#0B1628] dark:to-orange-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-orange-500" />
              Operasyon Paneli
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Canlı araç konumları</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Admin canlı konum endpointi yoksa harita boş durum gösterir.
                  </p>
                </div>
                <Badge className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/10">API bekliyor</Badge>
              </div>
              <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[radial-gradient(circle_at_top_left,rgba(255,157,46,0.18),transparent_35%),linear-gradient(135deg,rgba(8,17,31,0.04),rgba(77,163,255,0.08))] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,157,46,0.20),transparent_35%),linear-gradient(135deg,#07111F,#10223C)]">
                <div className="text-center">
                  <Navigation className="mx-auto h-9 w-9 text-orange-500" />
                  <p className="mt-3 text-sm font-bold">Konum verisi gelmedi</p>
                  <p className="mt-1 text-xs text-muted-foreground">Şoför GPS gönderimi veli/öğrenci canlı takipte çalışır.</p>
                </div>
              </div>
            </div>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/admin/staff-registration')}>
              <BusFront className="mr-2 h-4 w-4" />
              Şoför + Araç + Rota Kaydet
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/admin/staff-registration')}>
              <UserRoundCheck className="mr-2 h-4 w-4" />
              Personelden Şoför Kaydet
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={vehicles.length === 0 || drivers.length === 0}
              onClick={() => openDialog('route')}
            >
              <Route className="mr-2 h-4 w-4" />
              Rota Oluştur
            </Button>
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-muted-foreground">
              Yeni servis şoförü, kişisel bilgiler + araç + rota bilgileriyle Personel Kaydı ekranından tek seferde oluşturulur. Durak ve öğrenci ataması burada tamamlanır.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-slate-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-[#0B1628]/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BusFront className="h-5 w-5 text-orange-500" />
              Araçlar
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/staff-registration')}>
              <Plus className="mr-2 h-4 w-4" />
              Personelden Kaydet
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicles.length === 0 ? (
              <EmptyCard title="Araç yok" detail="Rota oluşturmak için önce servis aracı ekleyin." />
            ) : vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div>
                  <p className="font-semibold">{vehicle.plateNumber}</p>
                  <p className="text-sm text-muted-foreground">{vehicle.vehicleNumber ? `${vehicle.vehicleNumber} • ` : ''}{vehicle.brand || '-'} {vehicle.model || ''} • {vehicle.capacity} koltuk</p>
                </div>
                <Badge variant={vehicle.isActive ? 'default' : 'outline'}>{vehicle.isActive ? 'Aktif' : 'Pasif'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-[#0B1628]/90">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-orange-500" />
              Rotalar
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => openDialog('route')} disabled={vehicles.length === 0 || drivers.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Rota Oluştur
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {routes.length === 0 ? (
              <EmptyCard title="Rota yok" detail="Sabah veya akşam rotası oluşturup şoför ve araç bağlayın." />
            ) : routes.map((route) => (
              <div key={route.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{route.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {routeTypeLabel(route.routeType)} • {String(route.startTime).slice(0, 5)}-{String(route.endTime).slice(0, 5)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {route.vehicle?.plateNumber || 'Araç yok'} • {route.driver?.fullName || 'Şoför yok'} • {route.totalStudents}/{route.capacity} öğrenci
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" variant="outline" onClick={() => openRouteDetail(route.id)}>
                      Detay
                    </Button>
                    <Button size="sm" variant={route.isActive ? 'outline' : 'default'} disabled={saving} onClick={() => handleToggleRoute(route)}>
                      {route.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialog === 'vehicle'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={handleCreateVehicle}>
            <DialogHeader>
              <DialogTitle>Servis Aracı Ekle</DialogTitle>
              <DialogDescription>Plaka ve kapasite bilgileri canlı servis veritabanına kaydedilir.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Araç No"><Input value={vehicleForm.vehicleNumber} onChange={(event) => setVehicleForm((form) => ({ ...form, vehicleNumber: maskVehicleNumber(event.target.value) }))} placeholder="S-01" maxLength={12} /></Field>
                <Field label="Plaka"><Input value={vehicleForm.plateNumber} onChange={(event) => setVehicleForm((form) => ({ ...form, plateNumber: maskTrPlate(event.target.value) }))} placeholder="34 ABC 123" maxLength={11} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marka"><Input value={vehicleForm.brand} onChange={(event) => setVehicleForm((form) => ({ ...form, brand: event.target.value }))} placeholder="Mercedes" /></Field>
                <Field label="Model"><Input value={vehicleForm.model} onChange={(event) => setVehicleForm((form) => ({ ...form, model: event.target.value }))} placeholder="Sprinter" /></Field>
              </div>
              <Field label="Kapasite"><Input value={vehicleForm.capacity} onChange={(event) => setVehicleForm((form) => ({ ...form, capacity: maskPositiveInteger(event.target.value, 2) }))} inputMode="numeric" maxLength={2} placeholder="15" /></Field>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Vazgeç</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'route-detail'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{routeDetail?.name || 'Rota Detayı'}</DialogTitle>
            <DialogDescription>
              Durakları oluşturun, öğrenciyi ilgili durağa atayın ve şoförün göreceği servis listesini hazırlayın.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex min-h-[320px] items-center justify-center"><LoadingDots /></div>
          ) : routeDetail ? (
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{routeTypeLabel(routeDetail.routeType)}</Badge>
                    <Badge variant="outline">{String(routeDetail.startTime).slice(0, 5)}-{String(routeDetail.endTime).slice(0, 5)}</Badge>
                    <Badge variant="outline">{routeDetail.vehicle?.plateNumber || 'Araç yok'}</Badge>
                    <Badge variant="outline">{routeDetail.driver?.fullName || 'Şoför yok'}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Doluluk: {routeDetail.totalStudents}/{routeDetail.capacity} • Boş koltuk: {routeDetail.availableSeats}
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Duraklar ve Öğrenciler</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {routeDetail.stops?.length ? routeDetail.stops.map((stop) => (
                      <div key={stop.stopId} className="rounded-2xl border bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{stop.sortOrder}. {stop.stopName}</p>
                            <p className="text-sm text-muted-foreground">{stop.address || 'Adres girilmedi'}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Badge variant="outline">{stop.students?.length || 0} öğrenci</Badge>
                            <Button size="sm" variant="outline" onClick={() => handleMoveStop(stop, -1)}>Yukarı</Button>
                            <Button size="sm" variant="outline" onClick={() => handleMoveStop(stop, 1)}>Aşağı</Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteStop(stop)}>Sil</Button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {stop.students?.length ? stop.students.map((student) => (
                            <div key={student.assignmentId} className="flex items-center justify-between gap-3 rounded-xl border bg-background/40 p-3 text-sm">
                              <div>
                                <p className="font-medium">{student.studentFullName}</p>
                                <p className="text-muted-foreground">{student.className || '-'} • {student.parentFullName || 'Veli yok'} • {student.parentPhone || 'Telefon yok'}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteAssignment(student)}>
                                Çıkar
                              </Button>
                            </div>
                          )) : (
                            <p className="text-sm text-muted-foreground">Bu durakta henüz öğrenci yok.</p>
                          )}
                        </div>
                      </div>
                    )) : (
                      <EmptyCard title="Durak yok" detail="Rota aktifleşmeden önce en az bir durak eklenmeli." />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Durak Ekle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateStop} className="space-y-3">
                      <Field label="Durak adı"><Input value={stopForm.name} onChange={(event) => setStopForm((form) => ({ ...form, name: event.target.value }))} placeholder="1. Durak" /></Field>
                      <Field label="Adres"><Input value={stopForm.address} onChange={(event) => setStopForm((form) => ({ ...form, address: event.target.value }))} placeholder="Mahalle, cadde..." /></Field>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Lat"><Input value={stopForm.latitude} onChange={(event) => setStopForm((form) => ({ ...form, latitude: event.target.value }))} /></Field>
                        <Field label="Lng"><Input value={stopForm.longitude} onChange={(event) => setStopForm((form) => ({ ...form, longitude: event.target.value }))} /></Field>
                        <Field label="Sıra"><Input value={stopForm.sortOrder} onChange={(event) => setStopForm((form) => ({ ...form, sortOrder: maskPositiveInteger(event.target.value, 3) }))} inputMode="numeric" maxLength={3} /></Field>
                      </div>
                      <Button type="submit" className="w-full" disabled={saving}>
                        <Plus className="mr-2 h-4 w-4" />
                        Durak Ekle
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Öğrenci Ata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form onSubmit={handleSearchStudent} className="flex gap-2">
                      <Input value={studentKeyword} onChange={(event) => setStudentKeyword(event.target.value)} placeholder="Öğrenci adı veya sınıf ara" />
                      <Button type="submit" variant="outline" disabled={saving}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </form>
                    <Field label="Öğrenci">
                      <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={studentResults.length === 0}>
                        <SelectTrigger><SelectValue placeholder="Öğrenci seç" /></SelectTrigger>
                        <SelectContent>
                          {studentResults.map((student) => (
                            <SelectItem key={student.studentId} value={student.studentId}>
                              {student.studentFullName} • {student.className || '-'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <form onSubmit={handleAssignStudent} className="space-y-3">
                      <Field label="Durak">
                        <Select value={selectedStopId} onValueChange={setSelectedStopId} disabled={!routeDetail.stops?.length}>
                          <SelectTrigger><SelectValue placeholder="Durak seç" /></SelectTrigger>
                          <SelectContent>
                            {(routeDetail.stops || []).map((stop) => (
                              <SelectItem key={stop.stopId} value={stop.stopId}>
                                {stop.sortOrder}. {stop.stopName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Button type="submit" className="w-full" disabled={saving || !selectedStudentId || !selectedStopId}>
                        Öğrenciyi Servise Ata
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'driver'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={handleCreateDriver}>
            <DialogHeader>
              <DialogTitle>Servis Şoförü Oluştur</DialogTitle>
              <DialogDescription>Mevcut bir kullanıcı servis şoförü profiline bağlanır. Şoför kendi hesabıyla giriş yapınca bugünkü rotalarını görür.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              {users.length === 0 ? (
                <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  Kullanıcı bulunamadı. Önce personel/kullanıcı kaydı oluşturmalısın.
                </div>
              ) : null}
              <Field label="Kullanıcı">
                <Select
                  value={driverForm.userId}
                  onValueChange={(value) => {
                    const user = users.find((item) => item.id === value);
                    setDriverForm((form) => ({ ...form, userId: value, phoneNumber: maskTrPhone(user?.phone || form.phoneNumber) }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Kullanıcı seç" /></SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {getUserName(user)} • {user.role || 'Rol yok'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefon"><Input value={driverForm.phoneNumber} onChange={(event) => setDriverForm((form) => ({ ...form, phoneNumber: maskTrPhone(event.target.value) }))} placeholder="+90 5XX XXX XX XX" inputMode="tel" autoComplete="tel" maxLength={17} /></Field>
                <Field label="Ehliyet No"><Input value={driverForm.licenseNumber} onChange={(event) => setDriverForm((form) => ({ ...form, licenseNumber: event.target.value }))} placeholder="B / D sınıfı belge no" /></Field>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Vazgeç</Button>
              <Button type="submit" disabled={saving || users.length === 0}>{saving ? 'Kaydediliyor...' : 'Şoför Oluştur'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'route'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={handleCreateRoute}>
            <DialogHeader>
              <DialogTitle>Servis Rotası Oluştur</DialogTitle>
              <DialogDescription>Rota kaydedildikten sonra durak ve öğrenci atamaları mobil yönetim ekranından tamamlanabilir.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4">
              <Field label="Rota adı"><Input value={routeForm.name} onChange={(event) => setRouteForm((form) => ({ ...form, name: event.target.value }))} placeholder="Sabah 1. Bölge" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tip">
                  <Select value={routeForm.routeType} onValueChange={(value) => setRouteForm((form) => ({ ...form, routeType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Sabah</SelectItem>
                      <SelectItem value="Evening">Akşam</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Saat">
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" value={routeForm.startTime} onChange={(event) => setRouteForm((form) => ({ ...form, startTime: event.target.value }))} />
                    <Input type="time" value={routeForm.endTime} onChange={(event) => setRouteForm((form) => ({ ...form, endTime: event.target.value }))} />
                  </div>
                </Field>
              </div>
              <Field label="Araç">
                <Select value={routeForm.vehicleId} onValueChange={(value) => setRouteForm((form) => ({ ...form, vehicleId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Araç seç" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber} • {vehicle.capacity} koltuk</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Şoför">
                <Select value={routeForm.driverId} onValueChange={(value) => setRouteForm((form) => ({ ...form, driverId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Şoför seç" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>{driver.fullName} • {driver.phoneNumber || 'Telefon yok'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Vazgeç</Button>
              <Button type="submit" disabled={saving || vehicles.length === 0 || drivers.length === 0}>{saving ? 'Kaydediliyor...' : 'Rota Oluştur'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, accent = 'orange' }) {
  const accents = {
    orange: 'bg-orange-500/10 text-orange-500 shadow-orange-500/10',
    blue: 'bg-blue-500/10 text-blue-500 shadow-blue-500/10',
    green: 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10',
    purple: 'bg-violet-500/10 text-violet-500 shadow-violet-500/10',
  };
  return (
    <Card className="border-slate-200/70 bg-white/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-2xl p-3 shadow-lg ${accents[accent] || accents.orange}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
          <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ title, detail }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
