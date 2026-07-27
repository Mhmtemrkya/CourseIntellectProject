import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Archive, Database, FileArchive, HardDriveDownload, Loader2, Lock, ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { downloadTenantBackup, fetchTenantBackupSummary } from '../../lib/api/modules';

const number = (value) => Number(value || 0).toLocaleString('tr-TR');

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />{label}
      </div>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

export default function AdminDataBackup() {
  const { toast } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // 'full' | 'data'
  const [downloaded, setDownloaded] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await fetchTenantBackupSummary());
    } catch (err) {
      setError(err.message || 'Yedek bilgisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function start(includeFiles) {
    setBusy(includeFiles ? 'full' : 'data');
    setDownloaded(0);
    try {
      const blob = await downloadTenantBackup(includeFiles, (event) => setDownloaded(event.loaded || 0));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `yedek-${stamp}${includeFiles ? '' : '-veri'}.zip`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      toast({
        title: 'Yedek indirildi',
        description: includeFiles
          ? 'Arşivi şifreli bir diskte saklayın; kişisel veri içerir.'
          : 'Belgeler hariç, yalnız veri tabloları indirildi.',
      });
      await load();
    } catch (err) {
      toast({ title: 'Yedek alınamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner title="Yedek bilgisi alınamadı" message={error} onRetry={load} />;

  const limitReached = (summary?.remainingToday ?? 1) <= 0;

  return (
    <div className="space-y-5" data-testid="admin-data-backup-page">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg">
          <Archive className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Verilerimi İndir</h1>
          <p className="mt-1 text-muted-foreground">
            {summary?.institutionName} kurumunun tüm verisini tek dosya olarak bilgisayarınıza indirin.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Database} label="Tablo" value={number(summary?.tableCount)} />
        <StatTile icon={Database} label="Öğrenci / Kursiyer" value={number(summary?.students)} />
        <StatTile icon={Database} label="Personel" value={number(summary?.staff)} />
        <StatTile icon={FileArchive} label="Belge" value={number(summary?.documents)} />
        <StatTile icon={Database} label="Tahsilat" value={number(summary?.payments)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-brand-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HardDriveDownload className="h-5 w-5 text-brand-primary" />Tam yedek
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tüm tablolar <b>ve</b> yüklenmiş belgeler (evrak, fotoğraf, sertifika).
              Arşivde hem Excel'de açılan CSV'ler hem ham JSON bulunur.
            </p>
            <p className="text-xs text-muted-foreground">
              Belge sayısına göre birkaç dakika sürebilir ve boyutu büyük olabilir. Pencereyi kapatmayın.
            </p>
            <Button
              className="w-full bg-brand-primary text-white hover:bg-brand-primary/90"
              onClick={() => start(true)}
              disabled={Boolean(busy) || limitReached}
            >
              {busy === 'full'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Hazırlanıyor… {downloaded > 0 ? `${(downloaded / 1024 / 1024).toFixed(1)} MB` : ''}</>
                : <><HardDriveDownload className="mr-2 h-4 w-4" />Tam Yedeği İndir</>}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Bugün kalan hak: <b>{summary?.remainingToday ?? 0}</b> / {summary?.dailyLimit ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />Yalnız veri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Belgeler hariç, sadece tablolar. Çok daha küçük ve saniyeler içinde iner;
              günlük sınıra dahil değildir.
            </p>
            <p className="text-xs text-muted-foreground">
              Kayıt, finans ve sınav verilerini hızlıca incelemek veya arşivlemek için uygundur.
            </p>
            <Button variant="outline" className="w-full" onClick={() => start(false)} disabled={Boolean(busy)}>
              {busy === 'data'
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Hazırlanıyor…</>
                : <><Database className="mr-2 h-4 w-4" />Veri Yedeğini İndir</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/[0.05]">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="flex items-center gap-2 font-black text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />Kişisel veri uyarısı (KVKK)
          </p>
          <p className="text-muted-foreground">
            Bu arşiv kimlik numarası, iletişim bilgisi, sağlık raporu, adli sicil ve fotoğraf gibi
            <b> özel nitelikli kişisel veriler</b> içerir. Saklanmasından, paylaşılmasından ve
            imhasından kurum sorumludur. Şifreli bir diskte saklayın; e-posta veya korumasız bulut
            sürücüsüyle paylaşmayın.
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Parola özetleri ve oturum jetonları güvenlik gereği arşive yazılmaz.
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            Her indirme, kim ve ne zaman aldığı bilgisiyle Kayıt Geçmişi'ne işlenir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
