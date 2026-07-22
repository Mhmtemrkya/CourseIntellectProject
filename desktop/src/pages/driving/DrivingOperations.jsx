import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Package, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import { createDrivingPackage, fetchDrivingPackages } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const initialPackage = { name: '', licenseClass: 'B', transmissionType: 1, drivingLessonMinutes: 840, theoryLessonMinutes: 720, price: 0 };

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
  const [packageForm, setPackageForm] = useState(initialPackage);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const canViewPackages = can(DRIVING.packageView);
  const canCreatePackage = can(DRIVING.packageCreate);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const p = canViewPackages ? await fetchDrivingPackages() : [];
      setPackages(p || []);
    } catch (e) {
      toast({ title: 'Paket verileri alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, canViewPackages]);

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

  if (permissionsLoading || loading) return <DrivingLoading />;

  return (
    <DrivingPage testId="driving-operations-page">
      <DrivingPageHeader
        title="Paketler"
        description="Eğitim paketleri: ders süresi ve fiyat tanımları. Araç işlemleri “Araçlar” ekranındadır."
        icon={Package}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
        <DrivingStatCard label="Eğitim Paketi" value={packages.length} caption="Tanımlı paket" icon={Package} tone="violet" />
        <DrivingStatCard label="Mevzuata Uygun" value={packages.filter((p) => !p.belowRegulatoryMinimum).length} caption="Asgari süreyi karşılayan" icon={Package} tone="emerald" />
      </div>

      <div className="grid gap-5">
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
      </div>
    </DrivingPage>
  );
}
