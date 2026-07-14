import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, Plus, RefreshCw, ShieldAlert, Upload, Wrench } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  completeDrivingVehicleServiceRecord, createDrivingVehicleDocument, createDrivingVehicleServiceRecord,
  fetchDrivingVehicleDocuments, fetchDrivingVehicleServiceRecords, fetchDrivingVehicles, uploadFile,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const initialDocument = { vehicleId: '', documentType: 'Inspection', documentNumber: '', startsAtUtc: '', expiresAtUtc: '', reminderDays: 30, description: '', file: null };
const initialService = { vehicleId: '', recordType: 'Maintenance', title: '', serviceProvider: '', description: '', priority: 'Normal', kilometer: 0, vehicleUsable: false, laborCost: 0, partsCost: 0, nextServiceAtUtc: '', nextServiceKilometer: '' };
function Field({ label, children }) { return <label className="space-y-1.5 text-sm font-semibold"><span>{label}</span>{children}</label>; }
const statusTone = (status) => status === 'Valid' ? 'bg-emerald-500' : status === 'ExpiringSoon' ? 'bg-amber-500' : 'bg-red-500';

export default function DrivingFleetCompliance() {
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = useDrivingPermissions();
  const [data, setData] = useState({ vehicles: [], documents: [], records: [] });
  const [documentForm, setDocumentForm] = useState(initialDocument);
  const [serviceForm, setServiceForm] = useState(initialService);
  const [resolutions, setResolutions] = useState({});
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  const canUploadDocument = can(DRIVING.vehicleDocumentUpload);
  const canManageService = can(DRIVING.vehicleServiceManage);
  const canReportService = canManageService || can(DRIVING.vehicleServiceReport);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [vehicles, documents, records] = await Promise.all([fetchDrivingVehicles(), fetchDrivingVehicleDocuments(), fetchDrivingVehicleServiceRecords()]); setData({ vehicles: vehicles || [], documents: documents || [], records: records || [] }); }
    catch (error) { toast({ title: 'Filo uygunluk verileri alınamadı', description: error.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { if (!permissionsLoading) load(); }, [load, permissionsLoading]);
  // Yalnızca bildirim yetkisi olan (öğretmen) bakım kaydı açamaz; varsayılan türü
  // arızaya çekmezsek backend'in reddedeceği bir form gönderirdi.
  useEffect(() => { if (!permissionsLoading && !canManageService) setServiceForm((form) => (form.recordType === 'Maintenance' ? { ...form, recordType: 'Fault' } : form)); }, [permissionsLoading, canManageService]);
  const selectedVehicle = data.vehicles.find((x) => x.id === serviceForm.vehicleId);
  useEffect(() => { if (selectedVehicle) setServiceForm((form) => ({ ...form, kilometer: selectedVehicle.currentKilometer })); }, [selectedVehicle]);
  const warnings = useMemo(() => data.documents.filter((x) => x.status !== 'Valid').length + data.records.filter((x) => x.status === 'Open' && !x.vehicleUsable).length, [data]);

  async function saveDocument(event) {
    event.preventDefault(); if (!documentForm.file) return;
    setSaving(true);
    try {
      const formData = new FormData(); formData.set('file', documentForm.file);
      const upload = await uploadFile(formData, 'driving-vehicle-documents');
      await createDrivingVehicleDocument({ ...documentForm, file: undefined, reminderDays: Number(documentForm.reminderDays), startsAtUtc: documentForm.startsAtUtc ? new Date(documentForm.startsAtUtc).toISOString() : null, expiresAtUtc: new Date(documentForm.expiresAtUtc).toISOString(), fileUrl: upload.fileUrl });
      setDocumentForm(initialDocument); toast({ title: 'Araç evrakı güvenli arşive kaydedildi' }); await load();
    } catch (error) { toast({ title: 'Evrak kaydedilemedi', description: error.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  }

  async function saveService(event) {
    event.preventDefault(); setSaving(true);
    try {
      const result = await createDrivingVehicleServiceRecord({ ...serviceForm, kilometer: Number(serviceForm.kilometer), laborCost: Number(serviceForm.laborCost), partsCost: Number(serviceForm.partsCost), nextServiceAtUtc: serviceForm.nextServiceAtUtc ? new Date(serviceForm.nextServiceAtUtc).toISOString() : null, nextServiceKilometer: serviceForm.nextServiceKilometer ? Number(serviceForm.nextServiceKilometer) : null, reportedAtUtc: new Date().toISOString() });
      setServiceForm(initialService); const affected = result?.affectedAppointments?.length || 0; toast({ title: 'Bakım / arıza kaydı oluşturuldu', description: affected ? `${affected} gelecek randevu etkilendi; planlama ekranından araçlarını değiştirin.` : undefined }); await load();
    } catch (error) { toast({ title: 'Servis kaydı oluşturulamadı', description: error.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  }

  async function complete(record) {
    const resolution = (resolutions[record.id] || '').trim(); if (resolution.length < 3) return;
    setSaving(true); try { await completeDrivingVehicleServiceRecord(record.id, resolution); toast({ title: 'Servis kaydı kapatıldı' }); setResolutions((x) => ({ ...x, [record.id]: '' })); await load(); } catch (error) { toast({ title: 'Kayıt kapatılamadı', description: error.message, variant: 'destructive' }); } finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Badge className={`mb-2 border-0 ${warnings ? 'bg-red-500/15 text-red-600' : 'bg-emerald-500/15 text-emerald-600'}`}><ShieldAlert className="mr-1 h-3.5 w-3.5" />{warnings ? `${warnings} açık uygunluk uyarısı` : 'Filo uygun'}</Badge><h1 className="text-3xl font-black">Filo Evrak ve Bakım</h1><p className="text-muted-foreground">Zorunlu evrakı veya güvenlik kaydı uygun olmayan araçlar randevuya otomatik kapanır.</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button></div>
    <div className="grid gap-5 xl:grid-cols-2">
      {canUploadDocument && <Card><CardHeader><CardTitle className="flex gap-2"><FileCheck2 className="text-blue-500" />Yeni Araç Evrakı</CardTitle></CardHeader><CardContent><form onSubmit={saveDocument} className="grid gap-3 sm:grid-cols-2"><Field label="Araç"><select required className={selectClass} value={documentForm.vehicleId} onChange={(e) => setDocumentForm({ ...documentForm, vehicleId: e.target.value })}><option value="">Seçin</option>{data.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}</select></Field><Field label="Belge türü"><select className={selectClass} value={documentForm.documentType} onChange={(e) => setDocumentForm({ ...documentForm, documentType: e.target.value })}><option value="Inspection">Muayene</option><option value="TrafficInsurance">Trafik Sigortası</option><option value="Registration">Ruhsat</option><option value="Casco">Kasko</option><option value="Emission">Egzoz Emisyon</option><option value="Tax">Vergi</option><option value="CourseUsage">Kurs Kullanım Belgesi</option><option value="Other">Diğer</option></select></Field><Field label="Belge numarası"><Input required minLength={2} maxLength={100} value={documentForm.documentNumber} onChange={(e) => setDocumentForm({ ...documentForm, documentNumber: e.target.value })} /></Field><Field label="Hatırlatma (gün)"><Input required type="number" min="1" max="365" value={documentForm.reminderDays} onChange={(e) => setDocumentForm({ ...documentForm, reminderDays: e.target.value })} /></Field><Field label="Başlangıç"><Input type="date" value={documentForm.startsAtUtc} onChange={(e) => setDocumentForm({ ...documentForm, startsAtUtc: e.target.value })} /></Field><Field label="Bitiş"><Input required type="date" value={documentForm.expiresAtUtc} onChange={(e) => setDocumentForm({ ...documentForm, expiresAtUtc: e.target.value })} /></Field><Field label="Belge dosyası"><Input required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocumentForm({ ...documentForm, file: e.target.files?.[0] || null })} /></Field><Field label="Açıklama"><Input maxLength={1000} value={documentForm.description} onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })} /></Field><Button disabled={saving} className="sm:col-span-2"><Upload className="mr-2 h-4 w-4" />Yükle ve Onayla</Button></form></CardContent></Card>}
      {canReportService && <Card><CardHeader><CardTitle className="flex gap-2"><Wrench className="text-orange-500" />{canManageService ? 'Bakım / Arıza Bildir' : 'Arıza / Hasar Bildir'}</CardTitle></CardHeader><CardContent><form onSubmit={saveService} className="grid gap-3 sm:grid-cols-2"><Field label="Araç"><select required className={selectClass} value={serviceForm.vehicleId} onChange={(e) => setServiceForm({ ...serviceForm, vehicleId: e.target.value })}><option value="">Seçin</option>{data.vehicles.map((x) => <option key={x.id} value={x.id}>{x.plateNumber}</option>)}</select></Field><Field label="Kayıt türü"><select className={selectClass} value={serviceForm.recordType} onChange={(e) => setServiceForm({ ...serviceForm, recordType: e.target.value })}>{canManageService && <option value="Maintenance">Bakım</option>}<option value="Fault">Arıza</option><option value="Damage">Hasar</option></select></Field><Field label="Başlık"><Input required minLength={3} maxLength={180} value={serviceForm.title} onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })} /></Field><Field label="Servis"><Input maxLength={180} value={serviceForm.serviceProvider} onChange={(e) => setServiceForm({ ...serviceForm, serviceProvider: e.target.value })} /></Field><Field label="Kilometre"><Input required type="number" min="0" value={serviceForm.kilometer} onChange={(e) => setServiceForm({ ...serviceForm, kilometer: e.target.value })} /></Field><Field label="Öncelik"><select className={selectClass} value={serviceForm.priority} onChange={(e) => setServiceForm({ ...serviceForm, priority: e.target.value })}><option value="Low">Düşük</option><option value="Normal">Normal</option><option value="High">Yüksek</option><option value="Critical">Kritik</option></select></Field>{canManageService && <><Field label="İşçilik maliyeti"><Input type="number" min="0" value={serviceForm.laborCost} onChange={(e) => setServiceForm({ ...serviceForm, laborCost: e.target.value })} /></Field><Field label="Parça maliyeti"><Input type="number" min="0" value={serviceForm.partsCost} onChange={(e) => setServiceForm({ ...serviceForm, partsCost: e.target.value })} /></Field></>}<Field label="Açıklama"><Input required maxLength={2000} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} /></Field><label className="flex items-center gap-2 self-end rounded-xl border p-2.5 text-sm font-bold"><input type="checkbox" checked={serviceForm.vehicleUsable} onChange={(e) => setServiceForm({ ...serviceForm, vehicleUsable: e.target.checked })} />Araç güvenle kullanılabilir</label><Button disabled={saving} className="sm:col-span-2 bg-orange-600 text-white"><Plus className="mr-2 h-4 w-4" />Kayıt Oluştur</Button></form></CardContent></Card>}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Evrak Durumları</CardTitle></CardHeader><CardContent className="space-y-2">{data.documents.length === 0 ? <p className="py-8 text-center text-muted-foreground">Henüz evrak yüklenmedi.</p> : data.documents.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><b>{item.plateNumber} • {item.documentType}</b><p className="text-xs text-muted-foreground">{item.documentNumber} • {new Date(item.expiresAtUtc).toLocaleDateString('tr-TR')}</p></div><div className="flex items-center gap-2"><a className="text-xs font-bold text-blue-600 hover:underline" href={item.fileUrl} target="_blank" rel="noreferrer">Dosya</a><Badge className={statusTone(item.status)}>{item.status}</Badge></div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Açık Bakım ve Arızalar</CardTitle></CardHeader><CardContent className="space-y-3">{data.records.filter((x) => x.status === 'Open').length === 0 ? <div className="py-8 text-center text-emerald-600"><CheckCircle2 className="mx-auto mb-2 h-10 w-10" /><b>Açık servis kaydı yok.</b></div> : data.records.filter((x) => x.status === 'Open').map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><b>{item.plateNumber} • {item.title}</b><p className="text-xs text-muted-foreground">{item.recordType} • {item.priority} • ₺{Number(item.totalCost).toLocaleString('tr-TR')}</p></div>{!item.vehicleUsable && <Badge className="bg-red-500"><AlertTriangle className="mr-1 h-3 w-3" />Kullanım dışı</Badge>}</div>{canManageService && <div className="mt-3 flex gap-2"><Input placeholder="Çözüm ve yapılan işlem" maxLength={2000} value={resolutions[item.id] || ''} onChange={(e) => setResolutions((x) => ({ ...x, [item.id]: e.target.value }))} /><Button disabled={saving || (resolutions[item.id] || '').trim().length < 3} onClick={() => complete(item)}>Kapat</Button></div>}</div>)}</CardContent></Card>
    </div>
  </div>;
}
