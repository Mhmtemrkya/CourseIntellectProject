import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CarFront, CheckCircle2, FileCheck2, Plus, ShieldAlert, Upload, Wrench } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FileButton } from '../../components/ui/file-button';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import {
  completeDrivingVehicleServiceRecord, createDrivingVehicleDocument, createDrivingVehicleServiceRecord,
  fetchDrivingVehicleDocuments, fetchDrivingVehicleServiceRecords, fetchDrivingVehicles, uploadFile,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const initialDocument = { vehicleId: '', documentType: 'Inspection', documentNumber: '', startsAtUtc: '', expiresAtUtc: '', reminderDays: 30, description: '', file: null };
const initialService = { vehicleId: '', recordType: 'Maintenance', title: '', serviceProvider: '', description: '', priority: 'Normal', kilometer: 0, vehicleUsable: false, laborCost: 0, partsCost: 0, nextServiceAtUtc: '', nextServiceKilometer: '' };

function Field({ label, children }) {
  return <label className="space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}</label>;
}

const DOCUMENT_STATUS = {
  Valid: ['done', 'Geçerli'],
  ExpiringSoon: ['warn', 'Süresi Yaklaşıyor'],
  Expired: ['danger', 'Süresi Doldu'],
};

/**
 * Filo evrak ve bakım ekranı. `embedded` verildiğinde kendi sayfa sarmalayıcısını
 * ve başlığını çizmez; "Araçlar" ekranında sekme olarak gömülür (araçla ilgili
 * her şey tek yerde). Kendi rotası (/driving/fleet-compliance) çalışmaya devam
 * eder — eski yer imleri kırılmasın.
 */
export default function DrivingFleetCompliance({ embedded = false }) {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [data, setData] = useState({ vehicles: [], documents: [], records: [] });
  const [documentForm, setDocumentForm] = useState(initialDocument);
  const [serviceForm, setServiceForm] = useState(initialService);
  const [resolutions, setResolutions] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const canUploadDocument = can(DRIVING.vehicleDocumentUpload);
  const canManageService = can(DRIVING.vehicleServiceManage);
  const canReportService = canManageService || can(DRIVING.vehicleServiceReport);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [vehicles, documents, records] = await Promise.all([
        fetchDrivingVehicles(),
        fetchDrivingVehicleDocuments(),
        fetchDrivingVehicleServiceRecords(),
      ]);
      setData({ vehicles: vehicles || [], documents: documents || [], records: records || [] });
    } catch (error) {
      toast({ title: 'Filo uygunluk verileri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);

  // Yalnızca bildirim yetkisi olan (öğretmen) bakım kaydı açamaz; varsayılan türü
  // arızaya çekmezsek backend'in reddedeceği bir form gönderirdi.
  useEffect(() => {
    if (!permissionsLoading && !canManageService) {
      setServiceForm((form) => (form.recordType === 'Maintenance' ? { ...form, recordType: 'Fault' } : form));
    }
  }, [permissionsLoading, canManageService]);

  const selectedVehicle = data.vehicles.find((x) => x.id === serviceForm.vehicleId);
  useEffect(() => {
    if (selectedVehicle) setServiceForm((form) => ({ ...form, kilometer: selectedVehicle.currentKilometer }));
  }, [selectedVehicle]);

  const openRecords = useMemo(() => data.records.filter((x) => x.status === 'Open'), [data.records]);
  const invalidDocuments = useMemo(() => data.documents.filter((x) => x.status !== 'Valid'), [data.documents]);
  const groundedVehicles = useMemo(() => openRecords.filter((x) => !x.vehicleUsable).length, [openRecords]);
  const warnings = invalidDocuments.length + groundedVehicles;

  async function saveDocument(event) {
    event.preventDefault();
    if (!documentForm.file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set('file', documentForm.file);
      const upload = await uploadFile(formData, 'driving-vehicle-documents');
      await createDrivingVehicleDocument({
        ...documentForm,
        file: undefined,
        reminderDays: Number(documentForm.reminderDays),
        startsAtUtc: documentForm.startsAtUtc ? new Date(documentForm.startsAtUtc).toISOString() : null,
        expiresAtUtc: new Date(documentForm.expiresAtUtc).toISOString(),
        fileUrl: upload.fileUrl,
      });
      setDocumentForm(initialDocument);
      toast({ title: 'Araç evrakı güvenli arşive kaydedildi' });
      await load(true);
    } catch (error) {
      toast({ title: 'Evrak kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function saveService(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await createDrivingVehicleServiceRecord({
        ...serviceForm,
        kilometer: Number(serviceForm.kilometer),
        laborCost: Number(serviceForm.laborCost),
        partsCost: Number(serviceForm.partsCost),
        nextServiceAtUtc: serviceForm.nextServiceAtUtc ? new Date(serviceForm.nextServiceAtUtc).toISOString() : null,
        nextServiceKilometer: serviceForm.nextServiceKilometer ? Number(serviceForm.nextServiceKilometer) : null,
        reportedAtUtc: new Date().toISOString(),
      });
      setServiceForm(initialService);
      const affected = result?.affectedAppointments?.length || 0;
      toast({
        title: 'Bakım / arıza kaydı oluşturuldu',
        description: affected ? `${affected} gelecek randevu etkilendi; planlama ekranından araçlarını değiştirin.` : undefined,
      });
      await load(true);
    } catch (error) {
      toast({ title: 'Servis kaydı oluşturulamadı', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function complete(record) {
    const resolution = (resolutions[record.id] || '').trim();
    if (resolution.length < 3) return;
    setSaving(true);
    try {
      await completeDrivingVehicleServiceRecord(record.id, resolution);
      toast({ title: 'Servis kaydı kapatıldı' });
      setResolutions((x) => ({ ...x, [record.id]: '' }));
      await load(true);
    } catch (error) {
      toast({ title: 'Kayıt kapatılamadı', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  if (loading) return <DrivingLoading />;

  const Wrapper = embedded ? 'div' : DrivingPage;
  const wrapperProps = embedded ? { className: 'space-y-5' } : { testId: 'driving-fleet-page' };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <DrivingPageHeader
          title="Filo Evrak ve Bakım"
          description="Zorunlu evrakı veya güvenlik kaydı uygun olmayan araçlar randevuya otomatik kapanır."
          icon={ShieldAlert}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Filodaki Araç" value={data.vehicles.length} caption="Kayıtlı araç" icon={CarFront} tone="brand" />
        <DrivingStatCard
          label="Uygunluk Uyarısı"
          value={warnings}
          caption={warnings ? 'Aksiyon bekliyor' : 'Filo uygun'}
          icon={ShieldAlert}
          tone={warnings ? 'rose' : 'emerald'}
        />
        <DrivingStatCard label="Süresi Sorunlu Evrak" value={invalidDocuments.length} caption="Dolan veya yaklaşan" icon={FileCheck2} tone="amber" />
        <DrivingStatCard label="Kullanım Dışı Araç" value={groundedVehicles} caption="Açık güvenlik kaydı" icon={Wrench} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {canUploadDocument ? (
          <motion.div variants={itemVariants}>
            <PremiumPanel title="Yeni Araç Evrakı" description="Muayene, sigorta ve ruhsat arşivi">
              <form onSubmit={saveDocument} className="grid gap-3 sm:grid-cols-2">
                <Field label="Araç">
                  <select required className={selectClass} value={documentForm.vehicleId} onChange={(e) => setDocumentForm({ ...documentForm, vehicleId: e.target.value })}>
                    <option value="">Seçin</option>
                    {data.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}
                  </select>
                </Field>
                <Field label="Belge türü">
                  <select className={selectClass} value={documentForm.documentType} onChange={(e) => setDocumentForm({ ...documentForm, documentType: e.target.value })}>
                    <option value="Inspection">Muayene</option>
                    <option value="TrafficInsurance">Trafik Sigortası</option>
                    <option value="Registration">Ruhsat</option>
                    <option value="Casco">Kasko</option>
                    <option value="Emission">Egzoz Emisyon</option>
                    <option value="Tax">Vergi</option>
                    <option value="CourseUsage">Kurs Kullanım Belgesi</option>
                    <option value="DualControl">Çift Kumanda / Ekspertiz</option>
                    <option value="Other">Diğer</option>
                  </select>
                </Field>
                <Field label="Belge numarası"><Input required minLength={2} maxLength={100} value={documentForm.documentNumber} onChange={(e) => setDocumentForm({ ...documentForm, documentNumber: e.target.value })} /></Field>
                <Field label="Hatırlatma (gün)"><Input required type="number" min="1" max="365" value={documentForm.reminderDays} onChange={(e) => setDocumentForm({ ...documentForm, reminderDays: e.target.value })} /></Field>
                <Field label="Başlangıç"><Input type="date" value={documentForm.startsAtUtc} onChange={(e) => setDocumentForm({ ...documentForm, startsAtUtc: e.target.value })} /></Field>
                <Field label="Bitiş"><Input required type="date" value={documentForm.expiresAtUtc} onChange={(e) => setDocumentForm({ ...documentForm, expiresAtUtc: e.target.value })} /></Field>
                <Field label="Belge dosyası"><FileButton required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocumentForm({ ...documentForm, file: e.target.files?.[0] || null })} /></Field>
                <Field label="Açıklama"><Input maxLength={1000} value={documentForm.description} onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })} /></Field>
                <Button disabled={saving} className="bg-brand-primary text-white hover:bg-brand-primary/90 sm:col-span-2">
                  <Upload className="mr-2 h-4 w-4" />Yükle ve Onayla
                </Button>
              </form>
            </PremiumPanel>
          </motion.div>
        ) : null}

        {canReportService ? (
          <motion.div variants={itemVariants}>
            <PremiumPanel
              title={canManageService ? 'Bakım / Arıza Bildir' : 'Arıza / Hasar Bildir'}
              description="Güvenli olmayan araç randevuya kapanır"
            >
              <form onSubmit={saveService} className="grid gap-3 sm:grid-cols-2">
                <Field label="Araç">
                  <select required className={selectClass} value={serviceForm.vehicleId} onChange={(e) => setServiceForm({ ...serviceForm, vehicleId: e.target.value })}>
                    <option value="">Seçin</option>
                    {data.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}
                  </select>
                </Field>
                <Field label="Kayıt türü">
                  <select className={selectClass} value={serviceForm.recordType} onChange={(e) => setServiceForm({ ...serviceForm, recordType: e.target.value })}>
                    {canManageService ? <option value="Maintenance">Bakım</option> : null}
                    <option value="Fault">Arıza</option>
                    <option value="Damage">Hasar</option>
                  </select>
                </Field>
                <Field label="Başlık"><Input required minLength={3} maxLength={180} value={serviceForm.title} onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })} /></Field>
                <Field label="Servis"><Input maxLength={180} value={serviceForm.serviceProvider} onChange={(e) => setServiceForm({ ...serviceForm, serviceProvider: e.target.value })} /></Field>
                <Field label="Kilometre"><Input required type="number" min="0" value={serviceForm.kilometer} onChange={(e) => setServiceForm({ ...serviceForm, kilometer: e.target.value })} /></Field>
                <Field label="Öncelik">
                  <select className={selectClass} value={serviceForm.priority} onChange={(e) => setServiceForm({ ...serviceForm, priority: e.target.value })}>
                    <option value="Low">Düşük</option>
                    <option value="Normal">Normal</option>
                    <option value="High">Yüksek</option>
                    <option value="Critical">Kritik</option>
                  </select>
                </Field>
                {canManageService ? (
                  <>
                    <Field label="İşçilik maliyeti"><Input type="number" min="0" value={serviceForm.laborCost} onChange={(e) => setServiceForm({ ...serviceForm, laborCost: e.target.value })} /></Field>
                    <Field label="Parça maliyeti"><Input type="number" min="0" value={serviceForm.partsCost} onChange={(e) => setServiceForm({ ...serviceForm, partsCost: e.target.value })} /></Field>
                  </>
                ) : null}
                <Field label="Açıklama"><Input required maxLength={2000} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} /></Field>
                <label className="flex items-center gap-2 self-end rounded-xl border border-foreground/10 p-2.5 text-sm font-bold">
                  <input type="checkbox" checked={serviceForm.vehicleUsable} onChange={(e) => setServiceForm({ ...serviceForm, vehicleUsable: e.target.checked })} />
                  Araç güvenle kullanılabilir
                </label>
                <Button disabled={saving} className="bg-brand-primary text-white hover:bg-brand-primary/90 sm:col-span-2">
                  <Plus className="mr-2 h-4 w-4" />Kayıt Oluştur
                </Button>
              </form>
            </PremiumPanel>
          </motion.div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Evrak Durumları" description={`${data.documents.length} belge`} contentClassName="space-y-2">
            {data.documents.length === 0 ? (
              <DrivingNotice icon={FileCheck2} title="Henüz evrak yüklenmedi." message="Muayene ve sigorta belgelerini yükleyin." />
            ) : data.documents.map((item) => {
              const [tone, label] = DOCUMENT_STATUS[item.status] || ['default', item.status];
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.plateNumber} • {item.documentType}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.documentNumber} • {new Date(item.expiresAtUtc).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a className="text-xs font-bold text-[hsl(var(--brand-accent))] hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">Dosya</a>
                    <PremiumStatusPill tone={tone}>{label}</PremiumStatusPill>
                  </div>
                </div>
              );
            })}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Açık Bakım ve Arızalar" description={`${openRecords.length} açık kayıt`} contentClassName="space-y-3">
            {openRecords.length === 0 ? (
              <DrivingNotice icon={CheckCircle2} title="Açık servis kaydı yok." message="Filodaki tüm araçlar güvenli görünüyor." />
            ) : openRecords.map((item) => (
              <div key={item.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.plateNumber} • {item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.recordType} • {item.priority} • ₺{Number(item.totalCost).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  {!item.vehicleUsable ? (
                    <PremiumStatusPill tone="danger"><AlertTriangle className="mr-1 h-3 w-3" />Kullanım dışı</PremiumStatusPill>
                  ) : null}
                </div>
                {canManageService ? (
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Çözüm ve yapılan işlem"
                      maxLength={2000}
                      value={resolutions[item.id] || ''}
                      onChange={(e) => setResolutions((x) => ({ ...x, [item.id]: e.target.value }))}
                    />
                    <Button disabled={saving || (resolutions[item.id] || '').trim().length < 3} onClick={() => complete(item)}>Kapat</Button>
                  </div>
                ) : null}
              </div>
            ))}
          </PremiumPanel>
        </motion.div>
      </div>
    </Wrapper>
  );
}
