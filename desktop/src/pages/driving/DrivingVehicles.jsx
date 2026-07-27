import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, FileCheck2, Gauge, Lock, Plus, Search, ShieldCheck, UserRoundCheck, Wrench, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createDrivingVehicle, fetchDrivingAssignments, fetchDrivingVehicleDocuments, fetchDrivingVehicleServiceRecords, fetchDrivingVehicles, renewDrivingVehicleCompliance, updateDrivingVehicleStatus,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';
import DrivingFleetCompliance from './DrivingFleetCompliance';

const initialVehicle = { plateNumber: '', brand: '', model: '', modelYear: new Date().getFullYear(), licenseClass: 'B', transmissionType: 1, currentKilometer: 0, inspectionExpiresAtUtc: '', insuranceExpiresAtUtc: '' };

function Field({ label, children }) {
  return <label className="space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}</label>;
}

function TransmissionSelect({ value, onChange }) {
  return (
    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={1}>Manuel</option>
      <option value={2}>Otomatik</option>
    </select>
  );
}

const RECORD_TYPE = { Maintenance: 'Bakım', Fault: 'Arıza', Damage: 'Hasar' };
const PRIORITY = { Low: 'Düşük', Normal: 'Normal', High: 'Yüksek', Critical: 'Kritik' };
const ASSIGNMENT_TYPE = { Primary: 'Birincil', Secondary: 'İkincil', Temporary: 'Geçici', Shared: 'Ortak' };
const DOCUMENT_STATUS = {
  Valid: { label: 'Geçerli', className: 'bg-emerald-500/15 text-emerald-600' },
  ExpiringSoon: { label: 'Süresi yaklaşıyor', className: 'bg-amber-500/15 text-amber-600' },
  Expired: { label: 'Süresi doldu', className: 'bg-red-500/15 text-red-600' },
};

// Bakım seçimi açıkça yapıldıysa onu göster; aksi halde evrakı geçersiz veya
// işletme tarafından kapatılmış araç pasiftir.
const VEHICLE_STATUS = {
  active: { label: 'Uygun', className: 'bg-emerald-500/15 text-emerald-600', icon: CheckCircle2 },
  maintenance: { label: 'Bakımda', className: 'bg-red-500/15 text-red-600', icon: Wrench },
  passive: { label: 'Pasif', className: 'bg-muted text-muted-foreground', icon: Lock },
};
const vehicleStatus = (v) => (v.isInMaintenance ? 'maintenance' : !v.isActive ? 'passive' : 'active');
const STATUS_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Uygun' },
  { key: 'maintenance', label: 'Bakımda' },
  { key: 'passive', label: 'Pasif' },
];

const transmissionLabel = (value) => (value === 1 || value === 'Manual' ? 'Manuel' : 'Otomatik');
const money = (value) => `₺${Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('tr-TR') : '—');
const dateTime = (value) => (value ? new Date(value).toLocaleString('tr-TR') : '—');

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-foreground/10 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right">{value ?? '—'}</b>
    </div>
  );
}

function VehicleDetailModal({ vehicle, onClose }) {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchDrivingVehicleServiceRecords({ vehicleId: vehicle.id }).catch(() => []),
      fetchDrivingAssignments({ includeInactive: true }).catch(() => []),
      fetchDrivingVehicleDocuments().catch(() => []),
    ])
      .then(([recordList, assignmentList, documentList]) => {
        if (!active) return;
        setRecords(recordList || []);
        setAssignments((assignmentList || []).filter((a) => a.vehicleId === vehicle.id));
        setDocuments((documentList || []).filter((d) => d.plateNumber === vehicle.plateNumber));
      })
      .catch((error) => toast({ title: 'Araç detayı alınamadı', description: error.message, variant: 'destructive' }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vehicle.id, vehicle.plateNumber, toast]);

  const openRecords = useMemo(() => records.filter((r) => r.status === 'Open'), [records]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CarFront className="h-5 w-5 text-[hsl(var(--brand-accent))]" />
            {vehicle.plateNumber}
            {(() => { const t = VEHICLE_STATUS[vehicleStatus(vehicle)]; const I = t.icon; return <Badge className={`border-0 ${t.className}`}><I className="mr-1 h-3 w-3" />{t.label}</Badge>; })()}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><LoadingDots /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row label="Marka / Model" value={`${vehicle.brand} ${vehicle.model}`} />
              <Row label="Model yılı" value={vehicle.modelYear} />
              <Row label="Ehliyet sınıfı" value={vehicle.licenseClass} />
              <Row label="Vites" value={transmissionLabel(vehicle.transmissionType)} />
              <Row label="Kilometre" value={`${Number(vehicle.currentKilometer || 0).toLocaleString('tr-TR')} km`} />
              <Row label="Durum" value={vehicle.isActive ? 'Aktif' : 'Pasif'} />
              <Row label="Muayene bitiş" value={dateOnly(vehicle.inspectionExpiresAtUtc)} />
              <Row label="Sigorta bitiş" value={dateOnly(vehicle.insuranceExpiresAtUtc)} />
            </div>

            {/* Kime atanmış */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-black"><UserRoundCheck className="h-4 w-4 text-sky-500" />Atanan öğretmenler</h3>
              {assignments.length === 0 ? (
                <p className="rounded-xl border border-foreground/10 p-3 text-sm text-muted-foreground">Bu araca atanmış öğretmen yok.</p>
              ) : assignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/10 p-3">
                  <div>
                    <b>{a.instructorName}</b>
                    <p className="text-xs text-muted-foreground">
                      {ASSIGNMENT_TYPE[a.assignmentType] || a.assignmentType || 'Atama'}
                      {a.note ? ` • ${a.note}` : ''}
                    </p>
                  </div>
                  <Badge className={`border-0 ${a.isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {a.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </div>
              ))}
            </section>

            {/* Bakım / arıza kayıtları */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-black">
                <Wrench className="h-4 w-4 text-amber-500" />Bakım ve arıza kayıtları
                {openRecords.length > 0 && <Badge className="border-0 bg-amber-500/15 text-amber-600">{openRecords.length} açık</Badge>}
              </h3>
              {records.length === 0 ? (
                <p className="rounded-xl border border-foreground/10 p-3 text-sm text-muted-foreground">Kayıt yok.</p>
              ) : records.map((r) => (
                <div key={r.id} className="rounded-xl border border-foreground/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{r.title}</b>
                    <div className="flex items-center gap-2">
                      {!r.vehicleUsable && <Badge className="border-0 bg-red-500/15 text-red-600"><AlertTriangle className="mr-1 h-3 w-3" />Kullanım dışı</Badge>}
                      <Badge className={`border-0 ${r.status === 'Open' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                        {r.status === 'Open' ? 'Açık' : 'Kapandı'}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {RECORD_TYPE[r.recordType] || r.recordType} • {PRIORITY[r.priority] || r.priority} • {money(r.totalCost)}
                    {r.serviceProvider ? ` • ${r.serviceProvider}` : ''} • {dateTime(r.reportedAtUtc)}
                  </p>
                  {r.description && <p className="mt-1 text-sm">{r.description}</p>}
                  {r.nextServiceAtUtc && <p className="mt-1 text-xs text-muted-foreground">Sonraki bakım: {dateOnly(r.nextServiceAtUtc)}</p>}
                  {r.resolution && <p className="mt-1 text-xs text-emerald-600">Çözüm: {r.resolution} ({dateTime(r.completedAtUtc)})</p>}
                </div>
              ))}
            </section>

            {/* Araç evrakları */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-black"><FileCheck2 className="h-4 w-4 text-blue-500" />Araç evrakları</h3>
              {documents.length === 0 ? (
                <p className="rounded-xl border border-foreground/10 p-3 text-sm text-muted-foreground">Evrak yüklenmedi.</p>
              ) : documents.map((d) => {
                const tone = DOCUMENT_STATUS[d.status] || { label: d.status, className: 'bg-muted text-foreground' };
                return (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/10 p-3">
                    <div className="min-w-0">
                      <b>{d.documentType}</b>
                      <p className="text-xs text-muted-foreground">{d.documentNumber} • Bitiş: {dateOnly(d.expiresAtUtc)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {d.fileUrl && <a className="text-xs font-bold text-blue-600 hover:underline" href={d.fileUrl} target="_blank" rel="noreferrer">Dosya</a>}
                      <Badge className={`border-0 ${tone.className}`}>{tone.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DrivingVehicles() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(initialVehicle);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState('');
  const [renewalVehicle, setRenewalVehicle] = useState(null);
  const [renewalForm, setRenewalForm] = useState({ inspectionExpiresAtUtc: '', insuranceExpiresAtUtc: '' });
  const [renewalSaving, setRenewalSaving] = useState(false);

  const canCreate = can(DRIVING.vehicleCreate);
  const canUpdate = can(DRIVING.vehicleUpdate);

  const changeStatus = async (vehicle, status) => {
    if (status === vehicleStatus(vehicle)) return;
    if (status === 'active' && (vehicle.requiresInspectionRenewal || vehicle.requiresInsuranceRenewal)) {
      setRenewalVehicle(vehicle);
      setRenewalForm({ inspectionExpiresAtUtc: '', insuranceExpiresAtUtc: '' });
      return;
    }
    setStatusSaving(vehicle.id);
    try {
      const updated = await updateDrivingVehicleStatus(vehicle.id, status);
      setVehicles((list) => list.map((v) => (v.id === vehicle.id ? { ...v, ...updated } : v)));
      toast({ title: 'Araç durumu güncellendi', description: `${vehicle.plateNumber} → ${VEHICLE_STATUS[status].label}` });
    } catch (error) {
      toast({ title: 'Durum değiştirilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setStatusSaving('');
    }
  };

  const renewCompliance = async (event) => {
    event.preventDefault();
    if (!renewalVehicle) return;
    setRenewalSaving(true);
    try {
      await renewDrivingVehicleCompliance(renewalVehicle.id, {
        inspectionExpiresAtUtc: renewalVehicle.requiresInspectionRenewal && renewalForm.inspectionExpiresAtUtc
          ? new Date(`${renewalForm.inspectionExpiresAtUtc}T12:00:00`).toISOString()
          : null,
        insuranceExpiresAtUtc: renewalVehicle.requiresInsuranceRenewal && renewalForm.insuranceExpiresAtUtc
          ? new Date(`${renewalForm.insuranceExpiresAtUtc}T12:00:00`).toISOString()
          : null,
        activateWhenCompliant: true,
      });
      toast({
        title: 'Araç yeniden uygun',
        description: `${renewalVehicle.plateNumber} için eksik/geçmiş bilgiler yenilendi ve araç uygun duruma alındı.`,
      });
      setRenewalVehicle(null);
      await load(true);
    } catch (error) {
      toast({ title: 'Uygunluk bilgileri yenilenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setRenewalSaving(false);
    }
  };
  // Evrak & Bakım sekmesi, eskiden ayrı sayfa olan ekranın izinlerini taşır;
  // ikisinden birini göremeyen kullanıcıya sekme hiç açılmaz.
  const canSeeCompliance = can(DRIVING.vehicleDocumentView) || can(DRIVING.vehicleServiceView);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setVehicles(await fetchDrivingVehicles() || []);
    } catch (error) {
      toast({ title: 'Araçlar alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const saveVehicle = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createDrivingVehicle({
        ...vehicleForm,
        modelYear: Number(vehicleForm.modelYear),
        currentKilometer: Number(vehicleForm.currentKilometer),
        inspectionExpiresAtUtc: vehicleForm.inspectionExpiresAtUtc ? new Date(vehicleForm.inspectionExpiresAtUtc).toISOString() : null,
        insuranceExpiresAtUtc: vehicleForm.insuranceExpiresAtUtc ? new Date(vehicleForm.insuranceExpiresAtUtc).toISOString() : null,
      });
      setVehicleForm(initialVehicle);
      setShowAdd(false);
      toast({ title: 'Araç kaydedildi' });
      load(true);
    } catch (err) {
      toast({ title: 'Araç kaydedilemedi', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return vehicles.filter((v) => {
      if (statusFilter !== 'all' && vehicleStatus(v) !== statusFilter) return false;
      if (term && !`${v.plateNumber} ${v.brand} ${v.model}`.toLocaleLowerCase('tr-TR').includes(term)) return false;
      return true;
    });
  }, [vehicles, search, statusFilter]);

  const inMaintenance = useMemo(() => vehicles.filter((v) => v.isInMaintenance).length, [vehicles]);
  const activeCount = useMemo(() => vehicles.filter((v) => v.isActive && !v.isInMaintenance).length, [vehicles]);
  const passiveCount = useMemo(() => vehicles.filter((v) => !v.isActive && !v.isInMaintenance).length, [vehicles]);
  const statusCounts = useMemo(() => ({
    all: vehicles.length, active: activeCount, maintenance: inMaintenance, passive: passiveCount,
  }), [vehicles.length, activeCount, inMaintenance, passiveCount]);

  if (loading) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-vehicles-page">
      <DrivingPageHeader
        title="Araçlar"
        description="Araçla ilgili her şey burada: filo, araç ekleme, evrak arşivi ve bakım/arıza kayıtları."
        icon={CarFront}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <Tabs defaultValue="fleet">
        <TabsList>
          <TabsTrigger value="fleet"><CarFront className="mr-2 h-4 w-4" />Filo</TabsTrigger>
          {canSeeCompliance && (
            <TabsTrigger value="compliance"><FileCheck2 className="mr-2 h-4 w-4" />Evrak & Bakım</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="fleet" className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Toplam Araç" value={vehicles.length} caption="Filoda kayıtlı" icon={CarFront} tone="brand" />
        <DrivingStatCard label="Uygun" value={activeCount} caption="Kullanıma hazır" icon={ShieldCheck} tone="emerald" />
        <DrivingStatCard label="Bakımda" value={inMaintenance} caption="Kullanım dışı" icon={Wrench} tone={inMaintenance ? 'rose' : 'emerald'} />
        <DrivingStatCard label="Pasif" value={passiveCount} caption="Hizmet dışı" icon={Lock} tone={passiveCount ? 'amber' : 'emerald'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Plaka veya marka ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canCreate && (
          <Button className="bg-brand-primary text-white hover:bg-brand-primary/90" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <><X className="mr-2 h-4 w-4" />Vazgeç</> : <><Plus className="mr-2 h-4 w-4" />Araç Ekle</>}
          </Button>
        )}
      </div>

      {/* Duruma göre filtrele */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === f.key ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'}`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === f.key ? 'bg-brand-primary/20' : 'bg-foreground/10'}`}>{statusCounts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {showAdd && canCreate && (
        <form onSubmit={saveVehicle} className="grid gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Plaka"><Input required placeholder="34 ABC 123" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value.toUpperCase() })} /></Field>
          <Field label="Marka"><Input required value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /></Field>
          <Field label="Model"><Input required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></Field>
          <Field label="Model yılı"><Input required type="number" value={vehicleForm.modelYear} onChange={(e) => setVehicleForm({ ...vehicleForm, modelYear: e.target.value })} /></Field>
          <Field label="Ehliyet sınıfı"><Input required value={vehicleForm.licenseClass} onChange={(e) => setVehicleForm({ ...vehicleForm, licenseClass: e.target.value.toUpperCase() })} /></Field>
          <Field label="Vites"><TransmissionSelect value={vehicleForm.transmissionType} onChange={(v) => setVehicleForm({ ...vehicleForm, transmissionType: v })} /></Field>
          <Field label="Muayene bitiş"><Input required type="date" value={vehicleForm.inspectionExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, inspectionExpiresAtUtc: e.target.value })} /></Field>
          <Field label="Sigorta bitiş"><Input required type="date" value={vehicleForm.insuranceExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiresAtUtc: e.target.value })} /></Field>
          <Button disabled={saving} className="bg-brand-primary text-white hover:bg-brand-primary/90 sm:col-span-2 lg:col-span-1 lg:self-end">
            <Plus className="mr-2 h-4 w-4" />{saving ? 'Kaydediliyor…' : 'Araç Ekle'}
          </Button>
        </form>
      )}

      {filtered.length === 0 ? (
        <DrivingNotice
          icon={CarFront}
          title={search ? 'Eşleşen araç yok.' : 'Filoda araç yok.'}
          message={search ? 'Aramanızı değiştirin.' : (canCreate ? 'Yukarıdaki “Araç Ekle” ile filoya araç ekleyin.' : 'Filoya araç eklemek filo sorumlusunun yetkisindedir.')}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((vehicle) => {
            const status = vehicleStatus(vehicle);
            const tone = VEHICLE_STATUS[status];
            const StatusIcon = tone.icon;
            return (
              <div
                key={vehicle.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 transition hover:border-[hsl(var(--brand-accent)/0.5)] sm:p-4"
              >
                <button type="button" onClick={() => setSelected(vehicle)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                    <CarFront className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{vehicle.plateNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {vehicle.brand} {vehicle.model} • {vehicle.licenseClass} • {transmissionLabel(vehicle.transmissionType)}
                    </p>
                    {vehicle.automaticComplianceHold && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {[
                          vehicle.requiresInspectionRenewal ? 'Muayene süresi dolmuş' : null,
                          vehicle.requiresInsuranceRenewal ? 'Sigorta süresi dolmuş' : null,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </button>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <Gauge className="h-3 w-3" />{Number(vehicle.currentKilometer || 0).toLocaleString('tr-TR')} km
                </span>
                <Badge className={`border-0 ${tone.className}`}><StatusIcon className="mr-1 h-3 w-3" />{tone.label}</Badge>
                {canUpdate && (
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold disabled:opacity-50"
                    value={status}
                    disabled={statusSaving === vehicle.id}
                    onChange={(e) => changeStatus(vehicle, e.target.value)}
                    title="Araç durumunu değiştir"
                  >
                    <option value="active">Uygun</option>
                    <option value="maintenance">Bakımda</option>
                    <option value="passive">Pasif</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

        </TabsContent>

        {canSeeCompliance && (
          <TabsContent value="compliance" className="mt-5">
            {/* Ayrı sayfa olarak da erişilebilir; burada gömülü çalışır. */}
            <DrivingFleetCompliance embedded />
          </TabsContent>
        )}
      </Tabs>

      {selected && <VehicleDetailModal vehicle={selected} onClose={() => setSelected(null)} />}

      <Dialog open={Boolean(renewalVehicle)} onOpenChange={(open) => { if (!open && !renewalSaving) setRenewalVehicle(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eksik Bilgileri Yenile · {renewalVehicle?.plateNumber}</DialogTitle>
            <DialogDescription>
              Araç, zorunlu belgesi eksik veya süresi dolduğu için otomatik pasife alındı. Yalnızca eksik alanları yenilediğinizde otomatik olarak “Uygun” olacaktır.
            </DialogDescription>
          </DialogHeader>
          {renewalVehicle && (
            <form className="space-y-4" onSubmit={renewCompliance}>
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm">
                <b>Yenilenmesi gerekenler</b>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {renewalVehicle.requiresInspectionRenewal && <li>Muayene geçerlilik tarihi</li>}
                  {renewalVehicle.requiresInsuranceRenewal && <li>Trafik sigortası geçerlilik tarihi</li>}
                </ul>
              </div>
              {renewalVehicle.requiresInspectionRenewal && (
                <Field label="Yeni muayene bitiş tarihi">
                  <Input required type="date" min={new Date().toISOString().slice(0, 10)} value={renewalForm.inspectionExpiresAtUtc} onChange={(e) => setRenewalForm((form) => ({ ...form, inspectionExpiresAtUtc: e.target.value }))} />
                </Field>
              )}
              {renewalVehicle.requiresInsuranceRenewal && (
                <Field label="Yeni sigorta bitiş tarihi">
                  <Input required type="date" min={new Date().toISOString().slice(0, 10)} value={renewalForm.insuranceExpiresAtUtc} onChange={(e) => setRenewalForm((form) => ({ ...form, insuranceExpiresAtUtc: e.target.value }))} />
                </Field>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={renewalSaving} onClick={() => setRenewalVehicle(null)}>Vazgeç</Button>
                <Button disabled={renewalSaving}>{renewalSaving ? 'Yenileniyor…' : 'Yenile ve Uygun Yap'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DrivingPage>
  );
}
