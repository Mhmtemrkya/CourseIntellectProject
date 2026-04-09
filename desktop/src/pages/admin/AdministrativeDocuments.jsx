import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink, FileArchive, Files, Search, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements, fetchContents } from '../../lib/api/modules';

export default function AdministrativeDocuments() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [announcementItems, contentItems] = await Promise.all([
        fetchAnnouncements().catch(() => []),
        fetchContents(false).catch(() => []),
      ]);
      setAnnouncements(announcementItems);
      setContents(contentItems);
    } catch (err) {
      setError(err.message || 'Evrak görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const docs = useMemo(() => [
    ...announcements.slice(0, 5).map((item) => ({ id: `ann-${item.id}`, title: item.title, type: 'Duyuru', detail: item.detail, route: '/admin/announcements' })),
    ...contents.slice(0, 5).map((item) => ({ id: `content-${item.id}`, title: item.title, type: item.fileType || 'İçerik', detail: item.description, route: '/content' })),
  ], [announcements, contents]);

  const filteredDocs = useMemo(() => docs.filter((item) => `${item.title} ${item.type} ${item.detail || ''}`.toLowerCase().includes(search.toLowerCase())), [docs, search]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="administrative-documents-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Belge Merkezi</h1>
        <p className="text-muted-foreground mt-1">Duyuru, içerik ve operasyon kayıtlarını idari görünümde yönetin</p>
      </div>
      {error ? <ErrorBanner title="Belge merkezi alınamadı" message={error} onRetry={loadDocuments} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [docs.length, 'Toplam Belge', Files, 'bg-brand-primary/10 text-brand-primary'],
          [announcements.length, 'Duyuru Kayıtları', FileArchive, 'bg-amber-500/10 text-amber-600'],
          [contents.length, 'İçerik Kayıtları', ShieldCheck, 'bg-emerald-500/10 text-emerald-600'],
          [docs.filter((item) => item.type === 'Duyuru').length, 'İşleme Açık', ExternalLink, 'bg-blue-500/10 text-blue-600'],
        ].map(([value, label, Icon, tone]) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <div className={`rounded-2xl p-3 ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Belge, tür veya içerik ara..." />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {filteredDocs.length === 0 ? (
          <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Files className="h-10 w-10 text-brand-primary" />
              <div>
                <p className="font-medium text-foreground">Henüz evrak kaydı görünmüyor</p>
                <p className="text-sm">Duyurular ve içerikler oluştukça belge merkezi bunları idari görünümde listeler.</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/content')}>İçerik Merkezini Aç</Button>
            </CardContent>
          </Card>
        ) : filteredDocs.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileArchive className="h-5 w-5 text-brand-primary mt-0.5" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail || 'Detay yok'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedDoc(item)}>Detay</Button>
                <Button variant="outline" size="sm" onClick={() => navigate(item.route)}>Aç</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title || 'Belge detayı'}</DialogTitle>
            <DialogDescription>Seçili duyuru veya içerik kaydının idari görünümü.</DialogDescription>
          </DialogHeader>
          {selectedDoc ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedDoc.type}</Badge>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedDoc.detail || 'Bu kayıt için ayrıntı görünmüyor.'}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => selectedDoc && navigate(selectedDoc.route)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              İlgili Modülü Aç
            </Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedDoc(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
