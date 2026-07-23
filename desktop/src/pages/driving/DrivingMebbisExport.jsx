import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Image, Download, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { fetchMebbisExportSections, downloadMebbisExport } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingPage, DrivingPageHeader } from './_shared';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);

export default function DrivingMebbisExport() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const canView = can(DRIVING.mebbisView);
  const canExport = can(DRIVING.reportExport);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(''); // `${sectionKey}:${format}`

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchMebbisExportSections());
    } catch (e) {
      toast({ title: 'Bölümler alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const sections = data?.sections || [];
  const groups = data?.groups || [];

  const download = async (section, format) => {
    if (!canExport) {
      toast({ title: 'Yetki yok', description: 'Dışa aktarma için rapor dışa aktarma izniniz olmalı.', variant: 'destructive' });
      return;
    }
    setBusy(`${section.key}:${format}`);
    try {
      const blob = await downloadMebbisExport(section.key, { groupId: groupId || undefined, format });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mebbis-${section.key}-${stamp()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: `${section.label} indirildi`, description: format === 'pdf' ? 'PDF hazırlandı.' : 'Excel (.xlsx) hazırlandı.' });
    } catch (e) {
      const msg = e?.response?.status === 403 ? 'Bu işlem için yetkiniz yok.' : e.message;
      toast({ title: 'Dışa aktarılamadı', description: msg, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  if (loading) return <DrivingLoading />;
  if (!canView) {
    return (
      <DrivingPage testId="mebbis-export-page">
        <DrivingNotice icon={FileSpreadsheet} title="Yetki yok" message="MEBBİS dışa aktarımını görüntülemek için MEBBİS görüntüleme izniniz olmalı." />
      </DrivingPage>
    );
  }

  const selectedGroupName = groupId ? (groups.find((g) => g.id === groupId)?.name || '') : '';

  return (
    <DrivingPage testId="mebbis-export-page">
      <DrivingPageHeader
        title="MEBBİS Dışa Aktar"
        description="Kursiyerleri ve bilgilerini MEBBİS'e yüklemeye uygun biçimde bölüm bölüm indirin. Her bölüm Excel (.xlsx) ve PDF olarak alınır; aday kaydında biyometrik fotoğraf da gömülüdür."
        icon={FileSpreadsheet}
        onRefresh={load}
      />

      {/* Grup (dönem) seçici — boş bırakılırsa tüm kurum kursiyerleri indirilir. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold text-muted-foreground">Kapsam</span>
        <select
          className="h-10 min-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">Tüm kursiyerler (kurum geneli)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}{g.termYear ? ` — ${g.termYear}/${g.termNumber}` : ''}{g.mebbisTermCode ? ` (${g.mebbisTermCode})` : ''}
            </option>
          ))}
        </select>
        {selectedGroupName && <span className="text-xs text-muted-foreground">Seçili: <b className="text-foreground">{selectedGroupName}</b></span>}
      </div>

      {!canExport && (
        <DrivingNotice icon={Download} title="İndirme kısıtlı" message="Bölümleri görüntüleyebilirsiniz ancak dosya indirmek için 'rapor dışa aktarma' izni gerekir." />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <b className="text-base">{section.label}</b>
                  {section.hasPhotos && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-bold text-brand-primary">
                      <Image className="h-3 w-3" />Fotoğraflı
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canExport || busy === `${section.key}:xlsx`}
                onClick={() => download(section, 'xlsx')}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                {busy === `${section.key}:xlsx` ? 'Hazırlanıyor…' : 'Excel indir'}
              </Button>
              <Button
                variant="outline"
                disabled={!canExport || busy === `${section.key}:pdf`}
                onClick={() => download(section, 'pdf')}
              >
                <FileText className="mr-2 h-4 w-4 text-rose-600" />
                {busy === `${section.key}:pdf` ? 'Hazırlanıyor…' : 'PDF indir'}
              </Button>
            </div>
          </section>
        ))}
      </div>
    </DrivingPage>
  );
}
