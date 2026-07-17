import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CarFront, Lock, Package, Plus, Wrench } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import { createDrivingPackage, createDrivingVehicle, fetchDrivingPackages, fetchDrivingVehicles } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const initialPackage = { name: '', licenseClass: 'B', transmissionType: 1, drivingLessonMinutes: 840, theoryLessonMinutes: 720, price: 0 };
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

export default function DrivingOperations() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [packages, setPackages] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [packageForm, setPackageForm] = useState(initialPackage);
  const [vehicleForm, setVehicleForm] = useState(initialVehicle);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const canViewPackages = can(DRIVING.packageView);
  const canCreatePackage = can(DRIVING.packageCreate);
  const canViewVehicles = can(DRIVING.vehicleView);
  const canCreateVehicle = can(DRIVING.vehicleCreate);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [p, v] = await Promise.all([
        canViewPackages ? fetchDrivingPackages() : Promise.resolve([]),
        canViewVehicles ? fetchDrivingVehicles() : Promise.resolve([]),
      ]);
      setPackages(p || []);
      setVehicles(v || []);
    } catch (e) {
      toast({ title: 'Operasyon verileri alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, canViewPackages, canViewVehicles]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  const savePackage = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createDrivingPackage({
        ...packageForm,
        price: Number(packageForm.price),
        drivingLessonMinutes: Number(packageForm.drivingLessonMinutes),
        theoryLessonMinutes: Number(packageForm.theoryLessonMinutes),
      });
      setPackageForm(initialPackage);
      toast({ title: 'Paket oluşturuldu' });
      await load(true);
    } catch (err) {
      toast({ title: 'Paket kaydedilemedi', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

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
      toast({ title: 'Araç kaydedildi' });
      await load(true);
    } catch (err) {
      toast({ title: 'Araç kaydedilemedi', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (permissionsLoading || loading) return <DrivingLoading />;

  const activeVehicles = vehicles.filter((v) => !v.isInMaintenance).length;
  const maintenanceVehicles = vehicles.length - activeVehicles;

  return (
    <DrivingPage testId="driving-operations-page">
      <DrivingPageHeader
        title="Paket ve Filo Yönetimi"
        description="Ehliyet sınıfı ve vites türüne göre güvenli operasyon tanımları"
        icon={Package}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Eğitim Paketi" value={packages.length} caption="Tanımlı paket" icon={Package} tone="violet" />
        <DrivingStatCard label="Toplam Araç" value={vehicles.length} caption="Filodaki araç" icon={CarFront} tone="brand" />
        <DrivingStatCard label="Aktif Araç" value={activeVehicles} caption="Kullanıma hazır" icon={CarFront} tone="emerald" />
        <DrivingStatCard label="Bakımdaki" value={maintenanceVehicles} caption="Servisteki araç" icon={Wrench} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {canViewPackages ? (
          <motion.div variants={itemVariants}>
            <PremiumPanel title="Eğitim Paketleri" description="Ders süresi ve fiyat tanımları" contentClassName="space-y-4">
              {canCreatePackage ? (
                <form onSubmit={savePackage} className="grid gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:grid-cols-2">
                  <Field label="Paket adı"><Input required value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} /></Field>
                  <Field label="Ehliyet sınıfı"><Input required maxLength={5} value={packageForm.licenseClass} onChange={(e) => setPackageForm({ ...packageForm, licenseClass: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Vites"><TransmissionSelect value={packageForm.transmissionType} onChange={(v) => setPackageForm({ ...packageForm, transmissionType: v })} /></Field>
                  <Field label="Direksiyon (dk)" hint="Mevzuat asgarisi: B sınıfı 14 ders saati (700 dk), A ailesi 12 (600 dk)."><Input required min="30" type="number" value={packageForm.drivingLessonMinutes} onChange={(e) => setPackageForm({ ...packageForm, drivingLessonMinutes: e.target.value })} /></Field>
                  <Field label="Teorik (dk)"><Input required min="0" type="number" value={packageForm.theoryLessonMinutes} onChange={(e) => setPackageForm({ ...packageForm, theoryLessonMinutes: e.target.value })} /></Field>
                  <Field label="Fiyat"><Input required min="0" type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} /></Field>
                  <Button disabled={saving} className="bg-brand-primary text-white hover:bg-brand-primary/90 sm:col-span-2">
                    <Plus className="mr-2 h-4 w-4" />Paket Ekle
                  </Button>
                </form>
              ) : (
                <DrivingNotice icon={Lock} message="Paketleri görüntüleyebilirsiniz; tanımlamak kurum yöneticisinin yetkisindedir." />
              )}
              <div className="space-y-2">
                {packages.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Henüz paket tanımlanmadı.</p>
                ) : packages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 transition-colors hover:border-[hsl(var(--brand-accent)/0.28)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.licenseClass} • {p.transmissionType === 1 ? 'Manuel' : 'Otomatik'} • {p.drivingLessonMinutes} dk</p>
                      {p.belowRegulatoryMinimum && (
                        <p className="mt-0.5 text-xs font-bold text-red-600">Mevzuat asgarisinin altında ({p.regulatoryMinimumMinutes} dk gerekir)</p>
                      )}
                    </div>
                    <span className="shrink-0 font-black tabular-nums">₺{Number(p.price).toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </PremiumPanel>
          </motion.div>
        ) : null}

        {canViewVehicles ? (
          <motion.div variants={itemVariants}>
            <PremiumPanel title="Eğitim Araçları" description="Filo, muayene ve sigorta durumu" contentClassName="space-y-4">
              {canCreateVehicle ? (
                <form onSubmit={saveVehicle} className="grid gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:grid-cols-2">
                  <Field label="Plaka"><Input required placeholder="34 ABC 123" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Marka"><Input required value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /></Field>
                  <Field label="Model"><Input required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></Field>
                  <Field label="Model yılı"><Input required type="number" value={vehicleForm.modelYear} onChange={(e) => setVehicleForm({ ...vehicleForm, modelYear: e.target.value })} /></Field>
                  <Field label="Ehliyet sınıfı"><Input required value={vehicleForm.licenseClass} onChange={(e) => setVehicleForm({ ...vehicleForm, licenseClass: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Vites"><TransmissionSelect value={vehicleForm.transmissionType} onChange={(v) => setVehicleForm({ ...vehicleForm, transmissionType: v })} /></Field>
                  <Field label="Muayene bitiş"><Input required type="date" value={vehicleForm.inspectionExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, inspectionExpiresAtUtc: e.target.value })} /></Field>
                  <Field label="Sigorta bitiş"><Input required type="date" value={vehicleForm.insuranceExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiresAtUtc: e.target.value })} /></Field>
                  <Button disabled={saving} className="bg-brand-primary text-white hover:bg-brand-primary/90 sm:col-span-2">
                    <Plus className="mr-2 h-4 w-4" />Araç Ekle
                  </Button>
                </form>
              ) : (
                <DrivingNotice icon={Lock} message="Araçları görüntüleyebilirsiniz; filoya araç eklemek filo sorumlusunun yetkisindedir." />
              )}
              <div className="space-y-2">
                {vehicles.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Filoda kayıtlı araç yok.</p>
                ) : vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 transition-colors hover:border-[hsl(var(--brand-accent)/0.28)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{v.plateNumber}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.brand} {v.model} • {v.licenseClass} • {v.transmissionType === 1 ? 'Manuel' : 'Otomatik'}</p>
                    </div>
                    <PremiumStatusPill tone={v.isInMaintenance ? 'danger' : 'done'}>
                      {v.isInMaintenance ? 'Bakımda' : 'Aktif'}
                    </PremiumStatusPill>
                  </div>
                ))}
              </div>
            </PremiumPanel>
          </motion.div>
        ) : null}
      </div>
    </DrivingPage>
  );
}
