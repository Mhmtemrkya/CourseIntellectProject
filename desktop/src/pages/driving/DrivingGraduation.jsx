import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Award, CheckCircle2, Circle, Download, Eye, FileBadge2, Loader2, ShieldAlert,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import {
  approveDrivingGraduationAction,
  downloadDrivingCertificate,
  fetchDrivingCertificateDraft,
  fetchDrivingGraduationChecklist,
  fetchDrivingGraduationOverview,
  forceGraduateDrivingStudent,
  graduateDrivingStudent,
  issueDrivingCertificate,
  rejectDrivingGraduationAction,
  reissueDrivingCertificate,
  requestDrivingGraduationRevocation,
  revokeDrivingCertificate,
  updateDrivingCertificateDelivery,
  updateDrivingCertificateMebbisNo,
} from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';
import { createTypedDocumentUrl } from '../../lib/fileMime';
import { DrivingLoading, DrivingPage, DrivingPageHeader, DrivingStatCard } from './_shared';

const STATUS_LABELS = {
  PreRegistered: 'Ön kayıt', DocumentsPending: 'Evrak bekliyor', Active: 'Aktif', TheoryOngoing: 'Teorik eğitim',
  PracticeOngoing: 'Direksiyon', ExamPending: 'Sınav bekliyor', GraduationPending: 'Mezuniyet onayı',
  Graduated: 'Mezun', Suspended: 'Askıda', Cancelled: 'İptal', Revoked: 'Geri alındı', Pending: 'Bekliyor',
};
const CERT_TYPE_LABELS = { Completion: 'Eğitim Tamamlama Belgesi', Achievement: 'Başarı Belgesi' };
const CERT_STATUS_LABELS = { Active: 'Aktif', Superseded: 'Yenilendi', Revoked: 'İptal edildi' };
const DELIVERY_LABELS = { NotDelivered: 'Teslim edilmedi', Ready: 'Teslime hazır', Delivered: 'Teslim edildi', Returned: 'İade edildi' };
const ACTION_STATUS_LABELS = { Pending: 'Onay bekliyor', FirstApproved: 'İlk onay verildi', Approved: 'Onaylandı', Rejected: 'Reddedildi', Applied: 'Uygulandı', Cancelled: 'İptal edildi' };
const CERTIFICATE_TYPES = ['Completion', 'Achievement'];
const label = (map, value) => map[value] || value || '—';
const CERTIFICATE_FIELD_SECTIONS = [
  {
    title: 'Kurum bilgileri',
    fields: [
      ['institutionName', 'Resmî kurum adı'],
      ['institutionCode', 'MEBBİS kurum kodu'],
      ['institutionCity', 'Kurum ili'],
      ['institutionDistrict', 'Kurum ilçesi'],
    ],
  },
  {
    title: 'Kursiyer bilgileri',
    fields: [
      ['studentName', 'Adı soyadı'],
      ['identityNumber', 'T.C. kimlik numarası'],
      ['fatherName', 'Baba adı'],
      ['motherName', 'Ana adı'],
      ['birthPlace', 'Doğum yeri'],
      ['birthYear', 'Doğum yılı'],
      ['licenseClass', 'İstenen sertifika sınıfı'],
    ],
  },
  {
    title: 'Varsa daha önce aldığı sürücü belgesi',
    fields: [
      ['existingLicenseCity', 'Verildiği il'],
      ['existingLicenseDate', 'Belge tarihi'],
      ['existingLicenseNumber', 'Belge numarası'],
      ['existingLicenseClasses', 'Belge sınıfları'],
    ],
  },
  {
    title: 'Eğitim, sınav ve onay',
    fields: [
      ['courseStartedAtUtc', 'Kurs başlangıç tarihi', 'date'],
      ['examPassedAtUtc', 'Sınavı geçtiği tarih', 'date'],
      ['issuedAtUtc', 'Belge düzenleme tarihi', 'date'],
      ['directorName', 'Kurum müdürü adı'],
      ['directorTitle', 'Belgedeki unvan'],
    ],
  },
];
const CERTIFICATE_DATE_FIELDS = new Set(['courseStartedAtUtc', 'examPassedAtUtc', 'issuedAtUtc']);

function dateInputValue(value) {
  if (!value) return '';
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function certificateRequestData(data) {
  return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [
    key,
    CERTIFICATE_DATE_FIELDS.has(key)
      ? (dateInputValue(value) ? `${dateInputValue(value)}T00:00:00.000Z` : null)
      : String(value ?? ''),
  ]));
}

export default function DrivingGraduation() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const [data, setData] = useState({ students: [], graduations: [], certificates: [], actionRequests: [] });
  const [checklists, setChecklists] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forceTarget, setForceTarget] = useState(null);
  const [forceReason, setForceReason] = useState('');
  const [documentPreview, setDocumentPreview] = useState(null);
  const [certificateForm, setCertificateForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchDrivingGraduationOverview());
    } catch (error) {
      toast({ title: 'Mezuniyet verileri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => {
    if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
  }, [documentPreview?.url]);

  async function check(profileId) {
    try {
      const value = await fetchDrivingGraduationChecklist(profileId);
      setChecklists((current) => ({ ...current, [profileId]: value }));
    } catch (error) {
      toast({ title: 'Kontrol yapılamadı', description: error.message, variant: 'destructive' });
    }
  }

  async function run(action, success) {
    setSaving(true);
    try {
      await action();
      toast({ title: success });
      await load();
      return true;
    } catch (error) {
      toast({ title: 'İşlem tamamlanamadı', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(certificate) {
    setDocumentPreview({ certificate, url: '', loading: true });
    try {
      const blob = await downloadDrivingCertificate(certificate.id);
      // Sertifika PDF'tir; MIME'i uzantıdan zorla, yoksa Tauri webview'inde iframe boş çıkar.
      const { url } = await createTypedDocumentUrl(blob, `${certificate.documentNumber || 'mezuniyet-belgesi'}.pdf`);
      setDocumentPreview({ certificate, url, loading: false });
    } catch (error) {
      setDocumentPreview(null);
      toast({ title: 'Belge görüntülenemedi', description: error.message, variant: 'destructive' });
    }
  }

  async function openCertificateForm(student, type) {
    setCertificateForm({ student, type, loading: true, data: {}, missingFields: [] });
    try {
      const draft = await fetchDrivingCertificateDraft(student.id);
      setCertificateForm({
        student,
        type,
        loading: false,
        data: draft?.data || {},
        missingFields: draft?.missingFields || [],
        logoConfigured: Boolean(draft?.logoConfigured),
        signatureConfigured: Boolean(draft?.signatureConfigured),
      });
    } catch (error) {
      setCertificateForm(null);
      toast({ title: 'Belge bilgileri alınamadı', description: error.message, variant: 'destructive' });
    }
  }

  async function createAndOpenDocument(student, type, documentData) {
    setSaving(true);
    try {
      const created = await issueDrivingCertificate(student.id, type, certificateRequestData(documentData));
      const certificate = {
        ...created,
        id: created.id,
        studentDrivingProfileId: student.id,
        type,
        status: 'Active',
        version: 1,
        deliveryStatus: 'Ready',
        issuedAtUtc: new Date().toISOString(),
      };
      setCertificateForm(null);
      await openDocument(certificate);
      toast({ title: `${CERT_TYPE_LABELS[type]} oluşturuldu` });
      await load();
    } catch (error) {
      toast({ title: 'Belge oluşturulamadı', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function downloadPreview() {
    if (!documentPreview?.url) return;
    const anchor = document.createElement('a');
    anchor.href = documentPreview.url;
    anchor.download = `${documentPreview.certificate.documentNumber || 'mezuniyet-belgesi'}.pdf`;
    anchor.click();
  }

  async function submitForceGraduation() {
    if (!forceTarget || forceReason.trim().length < 20) return;
    const student = forceTarget.student;
    const ok = await run(
      () => forceGraduateDrivingStudent(student.id, forceReason.trim()),
      `${student.fullName} yetkili kararıyla mezun edildi`,
    );
    if (ok) {
      setForceTarget(null);
      setForceReason('');
      setChecklists((current) => ({ ...current, [student.id]: forceTarget.checklist }));
    }
  }

  if (loading) return <DrivingLoading />;

  const graduatedCount = (data.graduations || []).filter((item) => item.status === 'Graduated').length;
  const certificateEmptyFieldCount = certificateForm?.loading
    ? 0
    : CERTIFICATE_FIELD_SECTIONS
      .flatMap((section) => section.fields)
      .filter(([key]) => !String(certificateForm?.data?.[key] ?? '').trim())
      .length;
  const pendingRevocations = (data.actionRequests || []).filter((item) =>
    item.actionType === 'GraduationRevocation' && ['Pending', 'FirstApproved'].includes(item.status)).length;
  const canPrintCertificate = data.canPrintCertificate === true;

  return (
    <DrivingPage testId="driving-graduation-page">
      <DrivingPageHeader
        title="Mezuniyet & Belgeler"
        description="Kursiyer mezuniyetlerini tamamlayın; başarı ve tamamlama belgelerini güvenli biçimde görüntüleyip indirin."
        icon={Award}
        onRefresh={load}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Kursiyer" value={data.students.length} caption="Mezuniyet takibinde" icon={Award} tone="brand" />
        <DrivingStatCard label="Mezun" value={graduatedCount} caption="Mezuniyeti tamamlanan" icon={CheckCircle2} tone="emerald" />
        <DrivingStatCard label="Belge" value={(data.certificates || []).length} caption="Güvenli PDF belgesi" icon={FileBadge2} tone="violet" />
        <DrivingStatCard label="Geri Alma Talebi" value={pendingRevocations} caption="Karar bekleyen" icon={AlertTriangle} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.students.map((student) => {
          const graduation = data.graduations.find((item) => item.studentDrivingProfileId === student.id);
          const certificates = data.certificates.filter((item) => item.studentDrivingProfileId === student.id);
          const checklist = checklists[student.id];
          const revocationRequests = (data.actionRequests || []).filter((item) =>
            item.studentDrivingProfileId === student.id && item.actionType === 'GraduationRevocation');
          const graduated = graduation?.status === 'Graduated';
          const activeCertificate = (type) => certificates.find((item) => item.type === type && item.status === 'Active');
          const canForceGraduate = can(DRIVING.graduationManage) && can(DRIVING.graduationOverrideApprove);

          return (
            <Card key={student.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    {student.photoUrl
                      ? <img src={assetUrl(student.photoUrl)} alt={student.fullName} className="h-12 w-12 shrink-0 rounded-xl border object-cover" />
                      : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted"><Award className="h-5 w-5" /></span>}
                    <span className="truncate">{student.fullName}</span>
                  </span>
                  {/* Rozet kursiyerin eğitim durumunu gösterir. Önce mezuniyet
                      KAYDININ durumu (Active/Pending gibi yaşam döngüsü değeri)
                      okunuyordu; evrak bekleyen kursiyer "Aktif" görünüyordu. */}
                  <Badge>{label(STATUS_LABELS, graduated ? 'Graduated' : student.status)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{student.licenseClass} sınıfı • {student.transmissionType}</p>

                {!graduated && (
                  <Button variant="outline" disabled={saving} onClick={() => check(student.id)}>
                    Mezuniyet kontrolünü çalıştır
                  </Button>
                )}

                {checklist && !graduated && (
                  <div className="space-y-3 rounded-xl border p-3">
                    {checklist.items.map((item) => (
                      <div key={item.key} className="flex gap-2 text-sm">
                        {item.completed
                          ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                          : <Circle className="h-5 w-5 shrink-0 text-amber-500" />}
                        <div><b>{item.label}</b><p className="text-muted-foreground">{item.detail}</p></div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {can(DRIVING.graduationManage) && checklist.eligible && (
                        <Button disabled={saving} onClick={() => run(
                          () => graduateDrivingStudent(student.id, 'Mezuniyet kontrol listesi tamamlandı.'),
                          'Kursiyer mezun edildi',
                        )}>
                          <Award className="mr-2 h-4 w-4" /> Mezun Et
                        </Button>
                      )}
                      {!checklist.eligible && canForceGraduate && (
                        <Button
                          variant="outline"
                          className="border-amber-500/50 text-amber-700"
                          disabled={saving}
                          onClick={() => { setForceTarget({ student, checklist }); setForceReason(''); }}
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" /> Yine de Mezun Et
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {graduated && (
                  <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b className="text-emerald-700">Mezuniyet: {new Date(graduation.graduatedAtUtc).toLocaleDateString('tr-TR')}</b>
                      <Badge className="border-0 bg-emerald-600 text-white">Tamamlandı</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {CERTIFICATE_TYPES.map((type) => {
                        const certificate = activeCertificate(type);
                        return (
                          <div key={type} className="rounded-xl border bg-background p-3">
                            <div className="flex items-start gap-2">
                              <FileBadge2 className="mt-0.5 h-5 w-5 text-violet-600" />
                              <div className="min-w-0">
                                <p className="font-black">{CERT_TYPE_LABELS[type]}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {certificate ? certificate.documentNumber : 'Henüz oluşturulmadı'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              {certificate && canPrintCertificate ? (
                                <Button size="sm" variant="outline" className="w-full" onClick={() => openDocument(certificate)}>
                                  <Eye className="mr-2 h-4 w-4" /> Görüntüle
                                </Button>
                              ) : !certificate && canPrintCertificate && can(DRIVING.certificateIssue) ? (
                                <Button size="sm" variant="outline" className="w-full" disabled={saving} onClick={() => openCertificateForm(student, type)}>
                                  <FileBadge2 className="mr-2 h-4 w-4" /> Oluştur ve Görüntüle
                                </Button>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Yalnız Şube Müdürü veya Kurum Yöneticisi belge oluşturup görüntüleyebilir.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {can(DRIVING.graduationRevokeRequest) && (
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = window.prompt('Mezuniyet geri alma gerekçesi (en az 20 karakter):');
                        if (reason?.trim().length >= 20) {
                          run(() => requestDrivingGraduationRevocation(student.id, reason), 'İki onaylı geri alma talebi açıldı');
                        }
                      }}>
                        Mezuniyeti Geri Alma Talebi
                      </Button>
                    )}
                  </div>
                )}

                {revocationRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-amber-300/60 bg-amber-500/5 p-3 text-sm">
                    <b>Mezuniyet geri alma • {label(ACTION_STATUS_LABELS, request.status)}</b>
                    <p>{request.reason}</p>
                    {can(DRIVING.graduationOverrideApprove) && ['Pending', 'FirstApproved'].includes(request.status) && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => run(
                          () => approveDrivingGraduationAction(request.id, 'Kontrol edilerek onaylandı.'),
                          'Onay kaydedildi',
                        )}>Onayla</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const note = window.prompt('Ret gerekçesi:');
                          if (note?.trim().length >= 10) run(() => rejectDrivingGraduationAction(request.id, note), 'Talep reddedildi');
                        }}>Reddet</Button>
                      </div>
                    )}
                  </div>
                ))}

                {certificates.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Belge geçmişi</p>
                    {certificates.map((certificate) => (
                      <div key={certificate.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button type="button" className="text-left" disabled={!canPrintCertificate} onClick={() => canPrintCertificate && openDocument(certificate)}>
                            <b className="hover:underline">{label(CERT_TYPE_LABELS, certificate.type)}</b>
                            <p className="text-xs text-muted-foreground">{certificate.documentNumber} • v{certificate.version}</p>
                          </button>
                          <div className="flex gap-1">
                            <Badge>{label(CERT_STATUS_LABELS, certificate.status)}</Badge>
                            <Badge>{label(DELIVERY_LABELS, certificate.deliveryStatus)}</Badge>
                          </div>
                        </div>
                        <p className={certificate.mebbisCertificateNo ? 'mt-2 text-emerald-600' : 'mt-2 text-amber-600'}>
                          MEBBİS no: {certificate.mebbisCertificateNo || 'girilmedi'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {canPrintCertificate && <Button size="sm" variant="outline" onClick={() => openDocument(certificate)}><Eye className="mr-1 h-3.5 w-3.5" />Görüntüle</Button>}
                          {canPrintCertificate && can(DRIVING.certificateIssue) && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const value = window.prompt('MEBBİS sertifika numarası:', certificate.mebbisCertificateNo || '');
                              if (value !== null) run(() => updateDrivingCertificateMebbisNo(certificate.id, value.trim()), 'MEBBİS sertifika no işlendi');
                            }}>MEBBİS No</Button>
                          )}
                          {can(DRIVING.certificateDeliver) && certificate.deliveryStatus !== 'Delivered' && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const deliveredTo = window.prompt('Teslim alan kişi:');
                              if (deliveredTo?.trim().length >= 3) {
                                run(() => updateDrivingCertificateDelivery(certificate.id, { status: 'Delivered', deliveredTo, note: '' }), 'Belge teslim edildi');
                              }
                            }}>Teslim Edildi</Button>
                          )}
                          {canPrintCertificate && can(DRIVING.certificateIssue) && certificate.status === 'Active' && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const reason = window.prompt('Yeniden basım gerekçesi:');
                              if (reason?.trim().length >= 10) run(() => reissueDrivingCertificate(certificate.id, reason), 'Yeni belge sürümü oluşturuldu');
                            }}>Yeniden Bas</Button>
                          )}
                          {can(DRIVING.certificateRevoke) && certificate.status === 'Active' && (
                            <Button size="sm" variant="destructive" onClick={() => {
                              const reason = window.prompt('Belge iptal gerekçesi:');
                              if (reason?.trim().length >= 10) run(() => revokeDrivingCertificate(certificate.id, reason), 'Belge iptal edildi');
                            }}>İptal Et</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!certificateForm}
        onOpenChange={(open) => { if (!open && !saving) setCertificateForm(null); }}
      >
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge2 className="h-5 w-5 text-violet-600" />
              {label(CERT_TYPE_LABELS, certificateForm?.type)} Bilgileri
            </DialogTitle>
          </DialogHeader>

          {certificateForm?.loading ? (
            <div className="grid min-h-64 place-items-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Kayıtlı belge bilgileri hazırlanıyor…</p>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-2">
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-3 text-sm">
                  <b>{certificateForm?.student?.fullName}</b> için sistemde bulunan bilgiler getirildi.
                  Eksik alanları elle yazabilir, gerekli değilse boş bırakabilirsiniz. Boş alanlar belge üzerinde boş görünür.
                  {certificateEmptyFieldCount > 0 && (
                    <p className="mt-1 font-semibold text-amber-700">
                      {certificateEmptyFieldCount} metin veya tarih alanı boş bırakılmış.
                    </p>
                  )}
                </div>

                {CERTIFICATE_FIELD_SECTIONS.map((section) => (
                  <section key={section.title} className="space-y-3 rounded-xl border p-4">
                    <h3 className="font-black">{section.title}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.fields.map(([key, fieldLabel, type = 'text']) => {
                        const value = certificateForm?.data?.[key];
                        const empty = !String(value ?? '').trim();
                        return (
                          <label key={key} className="text-sm font-semibold">
                            <span className="flex items-center justify-between gap-2">
                              {fieldLabel}
                              {empty && <span className="text-[10px] font-medium text-amber-600">Boş bırakılabilir</span>}
                            </span>
                            <Input
                              className={`mt-1 ${empty ? 'border-amber-400/70' : ''}`}
                              type={type}
                              value={type === 'date' ? dateInputValue(value) : (value ?? '')}
                              maxLength={type === 'date' ? undefined : 200}
                              onChange={(event) => setCertificateForm((current) => ({
                                ...current,
                                data: { ...current.data, [key]: event.target.value },
                              }))}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {(!certificateForm?.logoConfigured || !certificateForm?.signatureConfigured) && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
                    {!certificateForm?.logoConfigured && <p>Kurum logosu kayıtlı değil; belgede logo alanı boş/yer tutucu olarak oluşturulur.</p>}
                    {!certificateForm?.signatureConfigured && <p>Müdür imzası kayıtlı değil; imza alanı boş bırakılarak belge oluşturulur.</p>}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" disabled={saving} onClick={() => setCertificateForm(null)}>Vazgeç</Button>
                <Button
                  disabled={saving}
                  onClick={() => createAndOpenDocument(
                    certificateForm.student,
                    certificateForm.type,
                    certificateForm.data,
                  )}
                >
                  {saving
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <FileBadge2 className="mr-2 h-4 w-4" />}
                  {certificateEmptyFieldCount > 0 ? 'Bu Bilgilerle Oluştur' : 'Belgeyi Oluştur'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!forceTarget} onOpenChange={(open) => { if (!open && !saving) setForceTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" /> Yine de Mezun Et</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <b>{forceTarget?.student.fullName}</b> tüm mezuniyet koşullarını tamamlamadı. Bu işlem kursiyeri doğrudan mezun eder ve eksik maddelerle birlikte denetim kaydına yazılır.
            </div>
            <div className="space-y-2">
              {(forceTarget?.checklist.items || []).filter((item) => !item.completed).map((item) => (
                <div key={item.key} className="flex gap-2 rounded-lg border p-2 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span><b>{item.label}:</b> {item.detail}</span>
                </div>
              ))}
            </div>
            <label className="text-sm font-bold">Zorunlu karar gerekçesi
              <textarea
                className="mt-1 min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                minLength={20}
                maxLength={500}
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                placeholder="En az 20 karakter; audit kaydında saklanır."
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{forceReason.trim().length}/20 minimum</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setForceTarget(null)}>Vazgeç</Button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700" disabled={saving || forceReason.trim().length < 20} onClick={submitForceGraduation}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />} Yine de Mezun Et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!documentPreview} onOpenChange={(open) => { if (!open) setDocumentPreview(null); }}>
        <DialogContent className="h-[92vh] w-[96vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <span>{label(CERT_TYPE_LABELS, documentPreview?.certificate?.type)}</span>
              {documentPreview?.url && (
                <Button size="sm" onClick={downloadPreview}><Download className="mr-2 h-4 w-4" /> PDF İndir</Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-3">
            {documentPreview?.loading
              ? <div className="grid h-full place-items-center"><Loader2 className="h-8 w-8 animate-spin text-brand-primary" /></div>
              : documentPreview?.url
                ? <iframe title="Belge önizleme" src={documentPreview.url} className="h-full min-h-[72vh] w-full rounded-xl border bg-white" />
                : null}
          </div>
        </DialogContent>
      </Dialog>
    </DrivingPage>
  );
}
