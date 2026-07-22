import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, FileCheck2, Gauge, Lock, Plus, Search, ShieldCheck, UserRoundCheck, Wrench, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  createDrivingVehicle, fetchDrivingAssignments, fetchDrivingVehicleDocuments, fetchDrivingVehicleServiceRecords, fetchDrivingVehicles,
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
            {vehicle.isInMaintenance
              ? <Badge className="border-0 bg-red-500/15 text-red-600"><Wrench className="mr-1 h-3 w-3" />Bakımda</Badge>
              : <Badge className="border-0 bg-emerald-500/15 text-emerald-600">Kullanımda</Badge>}
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
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(initialVehicle);
  const [saving, setSaving] = useState(false);

  const canCreate = can(DRIVING.vehicleCreate);
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
    if (!term) return vehicles;
    return vehicles.filter((v) => `${v.plateNumber} ${v.brand} ${v.model}`.toLocaleLowerCase('tr-TR').includes(term));
  }, [vehicles, search]);

  const inMaintenance = useMemo(() => vehicles.filter((v) => v.isInMaintenance).length, [vehicles]);
  const activeCount = useMemo(() => vehicles.filter((v) => v.isActive && !v.isInMaintenance).length, [vehicles]);

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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <DrivingStatCard label="Toplam Araç" value={vehicles.length} caption="Filoda kayıtlı" icon={CarFront} tone="brand" />
        <DrivingStatCard label="Kullanımda" value={activeCount} caption="Uygun araç" icon={ShieldCheck} tone="emerald" />
        <DrivingStatCard label="Bakımda" value={inMaintenance} caption="Kullanım dışı" icon={Wrench} tone={inMaintenance ? 'rose' : 'emerald'} />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vehicle) => (
            <button
              type="button"
              key={vehicle.id}
              onClick={() => setSelected(vehicle)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition hover:border-[hsl(var(--brand-accent)/0.5)] hover:bg-foreground/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                  <CarFront className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{vehicle.plateNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vehicle.brand} {vehicle.model} • {vehicle.licenseClass} • {transmissionLabel(vehicle.transmissionType)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {vehicle.isInMaintenance
                  ? <Badge className="border-0 bg-red-500/15 text-red-600"><Wrench className="mr-1 h-3 w-3" />Bakımda</Badge>
                  : <Badge className="border-0 bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Uygun</Badge>}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3 w-3" />{Number(vehicle.currentKilometer || 0).toLocaleString('tr-TR')} km
                </span>
              </div>
            </button>
          ))}
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
    </DrivingPage>
  );
}
