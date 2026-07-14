import { useCallback, useEffect, useState } from 'react';
import { CarFront, Lock, Package, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createDrivingPackage, createDrivingVehicle, fetchDrivingPackages, fetchDrivingVehicles } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';

const initialPackage = { name: '', licenseClass: 'B', transmissionType: 1, drivingLessonMinutes: 840, theoryLessonMinutes: 720, price: 0 };
const initialVehicle = { plateNumber: '', brand: '', model: '', modelYear: new Date().getFullYear(), licenseClass: 'B', transmissionType: 1, currentKilometer: 0, inspectionExpiresAtUtc: '', insuranceExpiresAtUtc: '' };

function Field({ label, children }) { return <label className="space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}</label>; }
function TransmissionSelect({ value, onChange }) { return <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(Number(e.target.value))}><option value={1}>Manuel</option><option value={2}>Otomatik</option></select>; }

// Yetkisi olmayan kullanıcıya formu gizleyip nedenini söyleriz — boş bir alan
// bırakmak "sistem bozuk" hissi verir.
function ReadOnlyNotice({ message }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4 shrink-0" />{message}</div>;
}

export default function DrivingOperations() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [packages, setPackages] = useState([]); const [vehicles, setVehicles] = useState([]);
  const [packageForm, setPackageForm] = useState(initialPackage); const [vehicleForm, setVehicleForm] = useState(initialVehicle);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  const canViewPackages = can(DRIVING.packageView);
  const canCreatePackage = can(DRIVING.packageCreate);
  const canViewVehicles = can(DRIVING.vehicleView);
  const canCreateVehicle = can(DRIVING.vehicleCreate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v] = await Promise.all([
        canViewPackages ? fetchDrivingPackages() : Promise.resolve([]),
        canViewVehicles ? fetchDrivingVehicles() : Promise.resolve([]),
      ]);
      setPackages(p || []); setVehicles(v || []);
    } catch (e) {
      toast({ title: 'Operasyon verileri alınamadı', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast, canViewPackages, canViewVehicles]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  const savePackage = async (e) => { e.preventDefault(); setSaving(true); try { await createDrivingPackage({ ...packageForm, price: Number(packageForm.price), drivingLessonMinutes: Number(packageForm.drivingLessonMinutes), theoryLessonMinutes: Number(packageForm.theoryLessonMinutes) }); setPackageForm(initialPackage); toast({ title: 'Paket oluşturuldu' }); await load(); } catch (err) { toast({ title: 'Paket kaydedilemedi', description: err.message, variant: 'destructive' }); } finally { setSaving(false); } };
  const saveVehicle = async (e) => { e.preventDefault(); setSaving(true); try { await createDrivingVehicle({ ...vehicleForm, modelYear: Number(vehicleForm.modelYear), currentKilometer: Number(vehicleForm.currentKilometer), inspectionExpiresAtUtc: vehicleForm.inspectionExpiresAtUtc ? new Date(vehicleForm.inspectionExpiresAtUtc).toISOString() : null, insuranceExpiresAtUtc: vehicleForm.insuranceExpiresAtUtc ? new Date(vehicleForm.insuranceExpiresAtUtc).toISOString() : null }); setVehicleForm(initialVehicle); toast({ title: 'Araç kaydedildi' }); await load(); } catch (err) { toast({ title: 'Araç kaydedilemedi', description: err.message, variant: 'destructive' }); } finally { setSaving(false); } };

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><Badge className="mb-2 border-0 bg-orange-500/15 text-orange-600"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Uyumluluk kontrollü</Badge><h1 className="text-3xl font-black">Paket ve Filo Yönetimi</h1><p className="text-muted-foreground">Ehliyet sınıfı ve vites türüne göre güvenli operasyon tanımları</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button></div>
    <div className="grid gap-5 xl:grid-cols-2">
      {canViewPackages && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="text-violet-500" /> Eğitim Paketleri</CardTitle></CardHeader><CardContent className="space-y-4">
        {canCreatePackage
          ? <form onSubmit={savePackage} className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2"><Field label="Paket adı"><Input required value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} /></Field><Field label="Ehliyet sınıfı"><Input required maxLength={5} value={packageForm.licenseClass} onChange={(e) => setPackageForm({ ...packageForm, licenseClass: e.target.value.toUpperCase() })} /></Field><Field label="Vites"><TransmissionSelect value={packageForm.transmissionType} onChange={(v) => setPackageForm({ ...packageForm, transmissionType: v })} /></Field><Field label="Direksiyon (dk)"><Input required min="30" type="number" value={packageForm.drivingLessonMinutes} onChange={(e) => setPackageForm({ ...packageForm, drivingLessonMinutes: e.target.value })} /></Field><Field label="Teorik (dk)"><Input required min="0" type="number" value={packageForm.theoryLessonMinutes} onChange={(e) => setPackageForm({ ...packageForm, theoryLessonMinutes: e.target.value })} /></Field><Field label="Fiyat"><Input required min="0" type="number" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} /></Field><Button disabled={saving} className="sm:col-span-2 bg-violet-600 text-white"><Plus className="mr-2 h-4 w-4" />Paket Ekle</Button></form>
          : <ReadOnlyNotice message="Paketleri görüntüleyebilirsiniz; tanımlamak kurum yöneticisinin yetkisindedir." />}
        <div className="space-y-2">{packages.map((p) => <div key={p.id} className="flex items-center justify-between rounded-xl border p-3"><div><b>{p.name}</b><p className="text-xs text-muted-foreground">{p.licenseClass} • {p.transmissionType === 1 ? 'Manuel' : 'Otomatik'} • {p.drivingLessonMinutes} dk</p></div><b>₺{Number(p.price).toLocaleString('tr-TR')}</b></div>)}</div>
      </CardContent></Card>}

      {canViewVehicles && <Card><CardHeader><CardTitle className="flex items-center gap-2"><CarFront className="text-orange-500" /> Eğitim Araçları</CardTitle></CardHeader><CardContent className="space-y-4">
        {canCreateVehicle
          ? <form onSubmit={saveVehicle} className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2"><Field label="Plaka"><Input required placeholder="34 ABC 123" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value.toUpperCase() })} /></Field><Field label="Marka"><Input required value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} /></Field><Field label="Model"><Input required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} /></Field><Field label="Model yılı"><Input required type="number" value={vehicleForm.modelYear} onChange={(e) => setVehicleForm({ ...vehicleForm, modelYear: e.target.value })} /></Field><Field label="Ehliyet sınıfı"><Input required value={vehicleForm.licenseClass} onChange={(e) => setVehicleForm({ ...vehicleForm, licenseClass: e.target.value.toUpperCase() })} /></Field><Field label="Vites"><TransmissionSelect value={vehicleForm.transmissionType} onChange={(v) => setVehicleForm({ ...vehicleForm, transmissionType: v })} /></Field><Field label="Muayene bitiş"><Input required type="date" value={vehicleForm.inspectionExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, inspectionExpiresAtUtc: e.target.value })} /></Field><Field label="Sigorta bitiş"><Input required type="date" value={vehicleForm.insuranceExpiresAtUtc} onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiresAtUtc: e.target.value })} /></Field><Button disabled={saving} className="sm:col-span-2 bg-orange-600 text-white"><Plus className="mr-2 h-4 w-4" />Araç Ekle</Button></form>
          : <ReadOnlyNotice message="Araçları görüntüleyebilirsiniz; filoya araç eklemek filo sorumlusunun yetkisindedir." />}
        <div className="space-y-2">{vehicles.map((v) => <div key={v.id} className="flex items-center justify-between rounded-xl border p-3"><div><b>{v.plateNumber}</b><p className="text-xs text-muted-foreground">{v.brand} {v.model} • {v.licenseClass} • {v.transmissionType === 1 ? 'Manuel' : 'Otomatik'}</p></div><Badge className={v.isInMaintenance ? 'bg-red-500' : 'bg-emerald-500'}>{v.isInMaintenance ? 'Bakımda' : 'Aktif'}</Badge></div>)}</div>
      </CardContent></Card>}
    </div>
  </div>;
}
