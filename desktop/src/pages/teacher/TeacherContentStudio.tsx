import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, FileText, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchContents } from '../../lib/api/modules';

export default function TeacherContentStudio() {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStudio = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setContents(await fetchContents(false));
    } catch (err) {
      setError(err.message || 'İçerik stüdyosu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudio(); }, [loadStudio]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-content-studio-page">
      <div className="flex items-center justify-between gap-4">
        <div>
        <h1 className="text-3xl font-bold font-heading">İçerik Stüdyosu</h1>
        <p className="text-muted-foreground mt-1">Oluşturulan içeriklerin prodüksiyon görünümü</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/t/content')}>İçerik Yönetimi</Button>
      </div>
      {error ? <ErrorBanner title="İçerik stüdyosu alınamadı" message={error} onRetry={loadStudio} /> : null}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {contents.slice(0, 10).map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clapperboard className="h-5 w-5 text-brand-primary" />{item.title}</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{item.subject} • {item.grade}</p>
                <p className="text-sm text-muted-foreground">{item.publishStatus || 'Durum yok'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{String(item.fileType).toLowerCase().includes('video') ? <Video className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}{item.fileType}</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedContent(item)}>Detay</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!selectedContent} onOpenChange={(open) => !open && setSelectedContent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İçerik Detayı</DialogTitle>
          </DialogHeader>
          {selectedContent ? (
            <div className="space-y-3 text-sm">
              <div><p className="font-medium">Başlık</p><p className="text-muted-foreground">{selectedContent.title}</p></div>
              <div><p className="font-medium">Açıklama</p><p className="text-muted-foreground">{selectedContent.description || 'Açıklama yok'}</p></div>
              <div><p className="font-medium">Sınıf / Ders</p><p className="text-muted-foreground">{selectedContent.grade} • {selectedContent.subject}</p></div>
              <div><p className="font-medium">Dosya</p><p className="text-muted-foreground">{selectedContent.fileName || selectedContent.fileType || 'Dosya yok'}</p></div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
