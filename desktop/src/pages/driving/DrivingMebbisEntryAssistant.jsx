import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, Copy, Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { completeDrivingMebbisEntryAssistant, downloadDrivingMebbisPhoto, fetchDrivingMebbisEntryAssistant, runDrivingPhotoInspection, updateDrivingMebbisEntryField } from '../../lib/api/modules';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader } from './_shared';

export default function DrivingMebbisEntryAssistant() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [completing, setCompleting] = useState(false);
  const [inspectingPhoto, setInspectingPhoto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchDrivingMebbisEntryAssistant(profileId)); }
    catch (error) { toast({ title: 'Giriş asistanı açılamadı', description: error.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [profileId, toast]);

  useEffect(() => { load(); }, [load]);

  const copy = async (field) => {
    if (!field.hasValue) return;
    try {
      await navigator.clipboard.writeText(field.value);
      toast({ title: `${field.label} panoya kopyalandı` });
    } catch {
      toast({ title: 'Panoya kopyalanamadı', description: 'Sistem pano iznini kontrol edin.', variant: 'destructive' });
    }
  };

  const toggle = async (field) => {
    setSaving(field.key);
    try {
      const updated = await updateDrivingMebbisEntryField(profileId, field.key, { completed: !field.completed, expectedVersion: field.version });
      setData((current) => {
        const fields = current.fields.map((x) => x.key === field.key ? { ...x, ...updated } : x);
        const completed = fields.filter((x) => x.completed).length;
        return { ...current, fields, progress: { completed, total: fields.length, percent: Math.round(completed * 100 / fields.length) }, canComplete: fields.every((x) => x.hasValue && x.completed) && (current.quality?.blockingCount || 0) === 0 };
      });
    } catch (error) {
      toast({ title: 'Alan güncellenemedi', description: error.message, variant: 'destructive' });
      await load();
    } finally { setSaving(''); }
  };

  const complete = async () => {
    setCompleting(true);
    try {
      await completeDrivingMebbisEntryAssistant(profileId, { expectedWorkItemVersion: data.workItem.version });
      toast({ title: 'MEBBİS girişi tamamlandı', description: 'Kayıt ikinci kullanıcı doğrulamasına hazır.' });
      navigate('/driving/mebbis');
    } catch (error) {
      toast({ title: 'Giriş tamamlanamadı', description: error.message, variant: 'destructive' });
      await load();
    } finally { setCompleting(false); }
  };

  const inspectPhoto = async () => {
    setInspectingPhoto(true);
    try {
      await runDrivingPhotoInspection(profileId);
      toast({ title: 'Fotoğraf denetimi tamamlandı', description: 'Sonuçlar ve MEBBİS kopyası güncellendi.' });
      await load();
    } catch (error) { toast({ title: 'Fotoğraf denetlenemedi', description: error.message, variant: 'destructive' }); }
    finally { setInspectingPhoto(false); }
  };

  const downloadPhoto = async () => {
    try {
      const blob = await downloadDrivingMebbisPhoto(data.photoInspection.id);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `mebbis-fotograf-${data.studentNumber}.jpg`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast({ title: 'Fotoğraf indirilemedi', description: error.message, variant: 'destructive' }); }
  };

  if (loading && !data) return <DrivingLoading />;
  if (!data) return <DrivingNotice icon={AlertTriangle} title="Giriş asistanı yüklenemedi." message="MEBBİS İş Merkezi’ne dönüp yeniden deneyin." />;

  return <DrivingPage testId="driving-mebbis-entry-assistant-page">
    <DrivingPageHeader title="Akıllı MEBBİS Giriş Asistanı" description={`${data.studentName} • Kursiyer #${data.studentNumber}`} icon={Copy} onRefresh={load} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="outline" onClick={() => navigate('/driving/mebbis')}><ArrowLeft className="mr-2 h-4 w-4" />İş Merkezine dön</Button>
      <Badge variant="outline">İş durumu: {data.workItem.status}</Badge>
    </div>

    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 p-4 text-sm">
      <p className="flex gap-2"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><span>{data.warning} Pano içeriğini işlem bittiğinde başka bir veri kopyalayarak temizleyin.</span></p>
    </div>

    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between text-sm"><b>Giriş ilerlemesi</b><span>{data.progress.completed}/{data.progress.total} • %{data.progress.percent}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${data.progress.percent}%` }} /></div>
    </div>

    {data.readinessMissing.length > 0 && <div className="rounded-2xl border border-red-400/40 bg-red-500/5 p-4"><b className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" />Tamamlanması gereken kayıt/evraklar</b><div className="mt-3 flex flex-wrap gap-2">{data.readinessMissing.map((x) => <Badge key={x} variant="outline" className="border-red-300 text-red-700">{x}</Badge>)}</div></div>}

    <PhotoInspectionPanel inspection={data.photoInspection} busy={inspectingPhoto} onInspect={inspectPhoto} onDownload={downloadPhoto} />

    {data.quality && <QualityPanel quality={data.quality} />}

    <div className="space-y-3">{data.fields.map((field, index) => <div key={field.key} className={`rounded-2xl border p-4 ${field.completed ? 'border-emerald-400/50 bg-emerald-500/5' : ''}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">{index + 1}</span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{field.label}</p><p className={`break-words font-semibold ${!field.hasValue ? 'text-red-600' : ''}`}>{field.hasValue ? field.value : 'Bilgi eksik'}</p>{field.completed && <p className="mt-1 text-xs text-emerald-700">{field.completedByName || 'Yetkili kullanıcı'} • {new Date(field.completedAtUtc).toLocaleString('tr-TR')}</p>}</div></div>
        <div className="flex gap-2"><Button variant="outline" disabled={!field.hasValue} onClick={() => copy(field)}><Copy className="mr-2 h-4 w-4" />Kopyala</Button><Button variant={field.completed ? 'default' : 'outline'} disabled={!field.hasValue || saving === field.key} onClick={() => toggle(field)}>{field.completed ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}{field.completed ? 'Girildi' : 'Girdim'}</Button></div>
      </div>
    </div>)}</div>

    <div className="sticky bottom-4 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><p className="text-sm text-muted-foreground">Tamamlama, kaydı “MEBBİS’e girildi” durumuna taşır; ikinci kullanıcı doğrulaması ayrıca yapılır.</p><Button disabled={!data.canComplete || completing} onClick={complete}>{completing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Girişi tamamla</Button></div></div>
  </DrivingPage>;
}

function PhotoInspectionPanel({ inspection, busy, onInspect, onDownload }) {
  const tone = QUALITY[inspection?.overall] || QUALITY.Orange;
  return <section className={`rounded-2xl border p-4 ${inspection ? tone.box : 'border-dashed'}`}>
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div><h2 className="flex items-center gap-2 font-bold"><Camera className="h-5 w-5" />Fotoğraf Uygunluk Denetimi</h2><p className="mt-1 text-xs text-muted-foreground">Yüz, ışık, arka plan, ölçü ve güncellik sunucudaki yerel modelle kontrol edilir; orijinal değiştirilmez.</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={onInspect} disabled={busy}>{busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{inspection ? 'Yeniden denetle' : 'Fotoğrafı denetle'}</Button>{inspection?.mebbisCopyAvailable && <Button variant="outline" onClick={onDownload}><Download className="mr-2 h-4 w-4" />MEBBİS kopyasını indir</Button>}</div>
    </div>
    {!inspection ? <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm">Güncel fotoğraf için denetim kaydı yok. MEBBİS girişine hazır olmak için denetimi çalıştırın.</p> : <>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge className={`border-0 ${tone.badge}`}>{tone.label}</Badge><Badge variant="outline">{inspection.width}×{inspection.height}</Badge><Badge variant="outline">{inspection.faceCount} yüz</Badge><Badge variant="outline">Işık {Number(inspection.averageBrightness).toFixed(0)}/255</Badge>{inspection.mebbisCopyAvailable && <Badge variant="outline">600×800 JPEG hazır</Badge>}</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{inspection.checks.map((check) => { const checkTone = QUALITY[check.severity] || QUALITY.Red; return <div key={check.key} className={`rounded-xl border p-3 ${checkTone.box}`}><div className="flex justify-between gap-2"><b className="text-sm">{check.title}</b><Badge className={`border-0 ${checkTone.badge}`}>{check.severity}</Badge></div><p className="mt-1 text-xs">{check.message}</p></div>; })}</div>
      <p className="mt-3 text-xs text-muted-foreground">Denetim: {new Date(inspection.createdAtUtc).toLocaleString('tr-TR')} • Motor {inspection.analyzerVersion}</p>
    </>}
  </section>;
}

const QUALITY = {
  Red: { label: 'Kırmızı • Girişi engeller', box: 'border-red-400/50 bg-red-500/5', badge: 'bg-red-500/15 text-red-700' },
  Orange: { label: 'Turuncu • Personel kontrolü', box: 'border-orange-400/50 bg-orange-500/5', badge: 'bg-orange-500/15 text-orange-700' },
  Yellow: { label: 'Sarı • Uyarı', box: 'border-amber-400/50 bg-amber-500/5', badge: 'bg-amber-500/15 text-amber-700' },
  Green: { label: 'Yeşil • Hazır', box: 'border-emerald-400/50 bg-emerald-500/5', badge: 'bg-emerald-500/15 text-emerald-700' },
};

function QualityPanel({ quality }) {
  const overall = QUALITY[quality.overall] || QUALITY.Red;
  return <section className={`rounded-2xl border p-4 ${overall.box}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">MEBBİS Veri Kalitesi</h2><p className="text-xs text-muted-foreground">Kırmızı sonuçlar backend tarafından girişe kapatılır.</p></div><Badge className={`border-0 ${overall.badge}`}>{overall.label}</Badge></div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4"><div className="rounded-xl bg-red-500/10 p-2"><b>{quality.blockingCount}</b><br />Engelleyici</div><div className="rounded-xl bg-orange-500/10 p-2"><b>{quality.reviewCount}</b><br />Kontrol</div><div className="rounded-xl bg-amber-500/10 p-2"><b>{quality.warningCount}</b><br />Uyarı</div><div className="rounded-xl bg-emerald-500/10 p-2"><b>{quality.passedCount}</b><br />Başarılı</div></div>
    <div className="mt-4 grid gap-2 lg:grid-cols-2">{quality.checks.map((check) => { const tone = QUALITY[check.severity] || QUALITY.Red; return <div key={check.key} className={`rounded-xl border p-3 ${tone.box}`}><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{check.category}</p><b className="text-sm">{check.title}</b></div><Badge className={`shrink-0 border-0 ${tone.badge}`}>{check.severity}</Badge></div><p className="mt-2 text-xs leading-relaxed">{check.message}</p></div>; })}</div>
  </section>;
}
