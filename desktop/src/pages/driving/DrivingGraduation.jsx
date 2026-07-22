import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Award, CheckCircle2, Circle, FileBadge2, RefreshCw, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingGraduationOverview, fetchDrivingGraduationChecklist, graduateDrivingStudent, issueDrivingCertificate, updateDrivingCertificateDelivery, updateDrivingCertificateMebbisNo, downloadDrivingCertificate, requestDrivingGraduationOverride, requestDrivingGraduationRevocation, approveDrivingGraduationAction, rejectDrivingGraduationAction, reissueDrivingCertificate, revokeDrivingCertificate } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';
import { DrivingLoading, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

// Ham enum yerine Türkçe etiket: kartlarda "Graduated/Active/Pending" gibi kod görünmesin.
const STATUS_LABELS = {
  PreRegistered: 'Ön kayıt', DocumentsPending: 'Evrak bekliyor', Active: 'Aktif', TheoryOngoing: 'Teorik eğitim',
  PracticeOngoing: 'Direksiyon', ExamPending: 'Sınav bekliyor', GraduationPending: 'Mezuniyet onayı',
  Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal', Revoked: 'Geri alındı', Pending: 'Bekliyor',
};
const CERT_TYPE_LABELS = { Completion: 'Tamamlama Belgesi', Achievement: 'Başarı Belgesi' };
const CERT_STATUS_LABELS = { Active: 'Aktif', Superseded: 'Yenilendi', Revoked: 'İptal edildi' };
const DELIVERY_LABELS = { NotDelivered: 'Teslim edilmedi', Ready: 'Teslime hazır', Delivered: 'Teslim edildi', Returned: 'İade edildi' };
const ACTION_TYPE_LABELS = { EligibilityOverride: 'Uygunluk istisnası', GraduationRevocation: 'Mezuniyet geri alma' };
const ACTION_STATUS_LABELS = { Pending: 'Onay bekliyor', FirstApproved: 'İlk onay verildi', Approved: 'Onaylandı', Rejected: 'Reddedildi', Applied: 'Uygulandı', Cancelled: 'İptal edildi' };
const label = (map, value) => map[value] || value || '—';

export default function DrivingGraduation() {
  const { toast } = useToast(); const { can } = useDrivingPermissions(); const navigate = useNavigate();
  const [data, setData] = useState({ students: [], graduations: [], certificates: [], actionRequests: [] });
  const [checklists, setChecklists] = useState({}); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setData(await fetchDrivingGraduationOverview()); } catch (e) { toast({ title: 'Mezuniyet verileri alınamadı', description: e.message, variant: 'destructive' }); } finally { setLoading(false); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  async function check(id) { try { const value = await fetchDrivingGraduationChecklist(id); setChecklists((x) => ({ ...x, [id]: value })); } catch (e) { toast({ title: 'Kontrol yapılamadı', description: e.message, variant: 'destructive' }); } }
  async function run(action, success) { setSaving(true); try { await action(); toast({ title: success }); await load(); } catch (e) { toast({ title: 'İşlem tamamlanamadı', description: e.message, variant: 'destructive' }); } finally { setSaving(false); } }
  async function download(certificate) { try { const blob = await downloadDrivingCertificate(certificate.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${certificate.documentNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url); } catch (e) { toast({ title: 'Belge indirilemedi', description: e.message, variant: 'destructive' }); } }
  if (loading) return <DrivingLoading />;
  const setup = data.certificateSetup;
  const missingLabels = { directorName: 'Müdür adı', directorTitle: 'Müdür unvanı', logoUrl: 'Kurum logosu', signatureUrl: 'İmza görseli', primaryColor: 'Sertifika rengi' };
  const graduatedCount = (data.graduations || []).filter((x) => x.status === 'Graduated').length;
  return <DrivingPage testId="driving-graduation-page">
    <DrivingPageHeader
      title="Mezuniyet & Sertifika"
      description="Eğitim, sınav, evrak ve finans koşullarını tek kontrol listesinde kapatın."
      icon={Award}
      onRefresh={load}
    />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <DrivingStatCard label="Kursiyer" value={data.students.length} caption="Mezuniyet takibinde" icon={Award} tone="brand" />
      <DrivingStatCard label="Mezun" value={graduatedCount} caption="Mezuniyeti onaylı" icon={CheckCircle2} tone="emerald" />
      <DrivingStatCard label="Sertifika" value={(data.certificates || []).length} caption="Düzenlenen belge" icon={FileBadge2} tone="violet" />
      <DrivingStatCard label="Bekleyen Talep" value={(data.actionRequests || []).filter((x) => x.status === 'Pending' || x.status === 'FirstApproved').length} caption="İki onaylı akış" icon={AlertTriangle} tone="amber" />
    </div>
    {setup && <Card className={setup.complete ? 'border-emerald-500/40' : 'border-amber-500/50'}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="flex items-start gap-3">{setup.complete ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-600" />}<div><b>{setup.complete ? 'Kurum ve sertifika bilgileri hazır' : 'Kurum bilgileri tamamlanmalı'}</b><p className="text-sm text-muted-foreground">{setup.complete ? `${setup.directorName} • ${setup.directorTitle} • Asgari devam %${setup.minimumTheoryAttendancePercent}` : (setup.missingFields || []).map((x) => missingLabels[x] || x).join(', ')}</p></div></div>{can(DRIVING.settingsManage) && <Button variant="outline" onClick={() => navigate('/driving/assignments?tab=rules')}><Settings2 className="mr-2 h-4 w-4" />Kurum Bilgilerini Düzenle</Button>}</CardContent></Card>}
    <div className="grid gap-4 xl:grid-cols-2">{data.students.map((student) => {
      const graduation = data.graduations.find((x) => x.studentDrivingProfileId === student.id);
      const certificates = data.certificates.filter((x) => x.studentDrivingProfileId === student.id);
      const checklist = checklists[student.id];
      const requests = (data.actionRequests || []).filter((x) => x.studentDrivingProfileId === student.id);
      // İki onaylı istisna varsa kontrol listesi tamamlanmasa bile mezun edilebilir.
      const hasApprovedOverride = requests.some((x) => x.actionType === 'EligibilityOverride' && x.status === 'Approved');
      const canGraduateNow = checklist && !graduation?.graduatedAtUtc && (checklist.eligible || hasApprovedOverride);
      const hasActiveType = (type) => certificates.some((c) => c.type === type && c.status === 'Active');
      return <Card key={student.id}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="flex items-center gap-3">{student.photoUrl ? <img src={assetUrl(student.photoUrl)} alt={student.fullName} className="h-12 w-12 rounded-xl border object-cover" /> : null}{student.fullName}</span><Badge>{label(STATUS_LABELS, graduation?.status || student.status)}</Badge></CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{student.licenseClass} • {student.transmissionType}</p>
        <Button variant="outline" disabled={saving} onClick={() => check(student.id)}>Mezuniyet kontrolünü çalıştır</Button>
        {checklist && <div className="space-y-2 rounded-xl border p-3">{checklist.items.map((item) => <div key={item.key} className="flex gap-2 text-sm">{item.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-amber-500" />}<div><b>{item.label}</b><p className="text-muted-foreground">{item.detail}</p></div></div>)}
          <div className="flex flex-wrap gap-2">{can(DRIVING.graduationManage) && canGraduateNow && <Button disabled={saving} onClick={() => run(() => graduateDrivingStudent(student.id, 'Kontrol listesi veya iki onaylı istisna tamamlandı.'), 'Kursiyer mezun edildi')}><Award className="mr-2 h-4 w-4" />Mezun Et</Button>}
          {can(DRIVING.graduationOverrideRequest) && !checklist.eligible && <Button variant="outline" disabled={saving} onClick={() => { const reason = window.prompt('İstisna gerekçesi (en az 20 karakter):'); const checklistKeys = checklist.items.filter((x) => !x.completed && ['documents','theory','practice','finance','schedule'].includes(x.key)).map((x) => x.key); if (reason?.trim().length >= 20 && checklistKeys.length) run(() => requestDrivingGraduationOverride(student.id, { reason, checklistKeys }), 'İki onaylı istisna talebi açıldı'); }}>İstisna Talebi</Button>}</div>
        </div>}
        {graduation?.status === 'Graduated' && <div className="space-y-2 rounded-xl bg-emerald-500/5 p-3"><b>Mezuniyet: {new Date(graduation.graduatedAtUtc).toLocaleDateString('tr-TR')}</b>
          {can(DRIVING.certificateIssue) && (!hasActiveType('Completion') || !hasActiveType('Achievement')) && <div className="flex flex-wrap gap-2">{!hasActiveType('Completion') && <Button size="sm" disabled={saving} onClick={() => run(() => issueDrivingCertificate(student.id, 'Completion'), 'Tamamlama belgesi oluşturuldu')}><FileBadge2 className="mr-1 h-4 w-4" />Tamamlama Belgesi</Button>}{!hasActiveType('Achievement') && <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => issueDrivingCertificate(student.id, 'Achievement'), 'Başarı belgesi oluşturuldu')}>Başarı Belgesi</Button>}</div>}
          {can(DRIVING.graduationRevokeRequest) && <Button size="sm" variant="destructive" onClick={() => { const reason = window.prompt('Mezuniyet geri alma gerekçesi (en az 20 karakter):'); if (reason?.trim().length >= 20) run(() => requestDrivingGraduationRevocation(student.id, reason), 'İki onaylı geri alma talebi açıldı'); }}>Mezuniyeti Geri Alma Talebi</Button>}
        </div>}
        {requests.map((request) => <div key={request.id} className="rounded-xl border border-amber-300/60 bg-amber-500/5 p-3 text-sm"><b>{label(ACTION_TYPE_LABELS, request.actionType)} • {label(ACTION_STATUS_LABELS, request.status)}</b><p>{request.reason}</p>{can(DRIVING.graduationOverrideApprove) && ['Pending','FirstApproved'].includes(request.status) && <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => run(() => approveDrivingGraduationAction(request.id, 'Kontrol edilerek onaylandı.'), 'Onay kaydedildi')}>Onayla</Button><Button size="sm" variant="outline" onClick={() => { const note = window.prompt('Ret gerekçesi:'); if (note?.trim().length >= 10) run(() => rejectDrivingGraduationAction(request.id, note), 'Talep reddedildi'); }}>Reddet</Button></div>}</div>)}
        {certificates.map((certificate) => <div key={certificate.id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between"><b>{certificate.documentNumber} <span className="text-muted-foreground">v{certificate.version}</span></b><div className="flex gap-1"><Badge>{label(CERT_STATUS_LABELS, certificate.status)}</Badge><Badge>{label(DELIVERY_LABELS, certificate.deliveryStatus)}</Badge></div></div><p>{label(CERT_TYPE_LABELS, certificate.type)} • {new Date(certificate.issuedAtUtc).toLocaleDateString('tr-TR')}</p><p className={certificate.mebbisCertificateNo ? 'text-emerald-600' : 'text-amber-600'}>MEBBİS no: {certificate.mebbisCertificateNo || 'girilmedi'}</p>{certificate.reissueReason && <p className="text-muted-foreground">Yeniden basım: {certificate.reissueReason}</p>}<div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => download(certificate)}>PDF İndir</Button>{can(DRIVING.certificateIssue) && <Button size="sm" variant="outline" onClick={() => { const value = window.prompt('MEBBİS sertifika numarası:', certificate.mebbisCertificateNo || ''); if (value !== null) run(() => updateDrivingCertificateMebbisNo(certificate.id, value.trim()), 'MEBBİS sertifika no işlendi'); }}>MEBBİS No</Button>}{can(DRIVING.certificateDeliver) && certificate.deliveryStatus !== 'Delivered' && <Button size="sm" variant="outline" onClick={() => { const deliveredTo = window.prompt('Teslim alan kişi:'); if (deliveredTo?.trim().length >= 3) run(() => updateDrivingCertificateDelivery(certificate.id, { status: 'Delivered', deliveredTo, note: '' }), 'Belge teslim edildi'); }}>Teslim Edildi İşaretle</Button>}{can(DRIVING.certificateIssue) && certificate.status === 'Active' && <Button size="sm" variant="outline" onClick={() => { const reason = window.prompt('Yeniden basım gerekçesi:'); if (reason?.trim().length >= 10) run(() => reissueDrivingCertificate(certificate.id, reason), 'Yeni belge sürümü oluşturuldu'); }}>Yeniden Bas</Button>}{can(DRIVING.certificateRevoke) && certificate.status === 'Active' && <Button size="sm" variant="destructive" onClick={() => { const reason = window.prompt('Sertifika iptal gerekçesi:'); if (reason?.trim().length >= 10) run(() => revokeDrivingCertificate(certificate.id, reason), 'Sertifika iptal edildi'); }}>İptal Et</Button>}</div></div>)}
      </CardContent></Card>;
    })}</div>
  </DrivingPage>;
}
