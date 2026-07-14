import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink, FileArchive, Files, Search, Upload, AlertTriangle, Clock3, Printer, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchAdminDocuments, createAdminDocument, archiveAdminDocument, uploadFile,
} from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';

const CATEGORIES = ['Genel', 'Gelen Evrak', 'Giden Evrak', 'Sözleşme', 'Politika', 'Resmi Yazı'];
const DIRECTIONS = [['Internal', 'Kurum İçi'], ['Incoming', 'Gelen'], ['Outgoing', 'Giden']];

function fileUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${desktopApiBaseUrl}/${String(path).replace(/^\/+/, '')}`;
}

function safeName(value) {
  return String(value || 'belge').replace(/[^\w\-.]+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

// Belgeyi diske indirir. Sunucudan blob olarak çekilir; doğrudan <a download>
// çapraz kaynak (farklı origin) dosyalarda tarayıcı tarafından yok sayılıyordu.
async function downloadDocument(url, title) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    const extension = (url.split('.').pop() || '').split('?')[0].slice(0, 5);
    anchor.download = `${safeName(title)}${extension ? `.${extension}` : ''}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Gizli iframe'e yükleyip yazdırma diyaloğunu açar (PDF ve görseller için çalışır).
function printDocument(url, title) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.title = safeName(title);
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      // Farklı origin'deki dosyaya iframe'den erişilemiyorsa yeni sekmede aç.
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
}

function expiryInfo(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: 'text-red-600', label: 'Süresi doldu', icon: AlertTriangle };
  if (days <= 30) return { tone: 'text-amber-600', label: `${days} gün kaldı`, icon: Clock3 };
  return { tone: 'text-muted-foreground', label: date.toLocaleDateString('tr-TR'), icon: Clock3 };
}

export default function AdministrativeDocuments() {
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Gelen Evrak', direction: 'Incoming', documentNo: '', relatedParty: '', expiryDate: '', note: '' });
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDocs(await fetchAdminDocuments(categoryFilter ? { category: categoryFilter } : undefined));
    } catch (err) {
      setError(err.message || 'Belgeler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => [d.title, d.documentNo, d.relatedParty, d.category].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [docs, search]);

  const submit = async () => {
    if (!form.title.trim()) { toast({ title: 'Başlık zorunlu.', variant: 'destructive' }); return; }
    try {
      setBusy(true);
      let uploadedUrl = '';
      let contentType = '';
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadFile(fd, 'admin-documents');
        uploadedUrl = res?.fileUrl || res?.url || res?.path || '';
        contentType = file.type || '';
      }
      await createAdminDocument({
        title: form.title.trim(),
        category: form.category,
        direction: form.direction,
        documentNo: form.documentNo.trim() || null,
        relatedParty: form.relatedParty.trim() || null,
        fileUrl: uploadedUrl || null,
        contentType: contentType || null,
        expiryDate: form.expiryDate || null,
        note: form.note.trim() || null,
      });
      toast({ title: 'Belge eklendi' });
      setForm({ title: '', category: 'Gelen Evrak', direction: 'Incoming', documentNo: '', relatedParty: '', expiryDate: '', note: '' });
      setFile(null);
      await load();
    } catch (err) {
      toast({ title: 'Belge eklenemedi', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const archive = async (item) => {
    try {
      setBusy(true);
      await archiveAdminDocument(item.id);
      setDocs((prev) => prev.map((d) => (d.id === item.id ? { ...d, status: 'Archived' } : d)));
      toast({ title: 'Belge arşivlendi' });
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-documents-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><Files className="h-7 w-7 text-brand-primary" />Belge / Evrak Merkezi</h1>
        <p className="text-muted-foreground mt-1">Gelen-giden evrak defteri ve kurumsal belgeler; son kullanma takibi ve arşiv.</p>
      </div>
      {error ? <ErrorBanner title="Belgeler alınamadı" message={error} onRetry={load} /> : null}

      <Card>
        <CardHeader><CardTitle>Yeni Belge / Evrak</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Başlık" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
            {DIRECTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Input placeholder="Evrak No" value={form.documentNo} onChange={(e) => setForm((f) => ({ ...f, documentNo: e.target.value }))} />
          <Input placeholder="İlgili kurum/kişi" value={form.relatedParty} onChange={(e) => setForm((f) => ({ ...f, relatedParty: e.target.value }))} />
          <div>
            <label className="text-xs text-muted-foreground">Son kullanma (varsa)</label>
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <Input className="md:col-span-2" placeholder="Not" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
            <FeatureGate module="documents" action="upload"><Button onClick={submit} disabled={busy}><Upload className="mr-2 h-4 w-4" />{busy ? 'Kaydediliyor...' : 'Belgeyi Kaydet'}</Button></FeatureGate>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Belge ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Belge bulunamadı.</CardContent></Card>
          : filtered.map((item) => {
            const exp = expiryInfo(item.expiryDateUtc);
            const url = fileUrl(item.fileUrl);
            return (
              <Card key={item.id} className={item.status === 'Archived' ? 'opacity-70' : ''}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Badge variant="outline">{item.category}</Badge>
                      {item.documentNo ? <Badge className="bg-muted text-muted-foreground">No: {item.documentNo}</Badge> : null}
                      {item.status === 'Archived' ? <Badge>Arşiv</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.relatedParty || '—'} • {new Date(item.createdAtUtc).toLocaleDateString('tr-TR')}
                      {exp ? <span className={`ml-2 inline-flex items-center gap-1 ${exp.tone}`}><exp.icon className="h-3.5 w-3.5" />{exp.label}</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {url ? (
                      <>
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10"><ExternalLink className="h-4 w-4" />Aç</a>
                        <Button size="sm" variant="outline" onClick={() => printDocument(url, item.title)}><Printer className="mr-1 h-4 w-4" />Yazdır</Button>
                        <Button size="sm" variant="outline" onClick={() => downloadDocument(url, item.title)}><Download className="mr-1 h-4 w-4" />İndir</Button>
                      </>
                    ) : null}
                    {item.status !== 'Archived' ? <Button size="sm" variant="outline" disabled={busy} onClick={() => archive(item)}><FileArchive className="mr-1 h-4 w-4" />Arşivle</Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </motion.div>
  );
}
