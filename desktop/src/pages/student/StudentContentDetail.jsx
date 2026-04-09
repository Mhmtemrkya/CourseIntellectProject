import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Download, Eye, FileText, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchContents } from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';

function buildContentFileUrl(fileName) {
  if (!fileName) return null;
  return new URL(`/uploads/teacher-content/${encodeURIComponent(fileName)}`, desktopApiBaseUrl).toString();
}

export default function StudentContentDetail() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVideoId, setActiveVideoId] = useState(null);

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setContents(await fetchContents(true));
    } catch (err) {
      setError(err.message || 'İçerik detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const openFile = async (fileName, download = false) => {
    const fileUrl = buildContentFileUrl(fileName);
    if (!fileUrl) return;
    if (download) {
      const response = await window.fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Dosya indirilemedi (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'icerik';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      return;
    }
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleVideo = (item) => {
    setActiveVideoId((current) => (current === item.id ? null : item.id));
  };

  const grouped = useMemo(() => {
    return contents.reduce((acc, item) => {
      const key = item.subject || 'Genel';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [contents]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-content-detail-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">İçerik Detayları</h1>
        <p className="text-muted-foreground mt-1">Ders bazlı içerik kırılımı</p>
      </div>
      {error ? <ErrorBanner title="İçerik detayları alınamadı" message={error} onRetry={loadDetails} /> : null}
      <div className="grid gap-6">
        {Object.entries(grouped).map(([subject, items]) => (
          <Card key={subject}>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-brand-primary" />{subject}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description || item.info || 'Açıklama yok'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{String(item.fileType).toLowerCase().includes('video') ? <Video className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}{item.fileType}</Badge>
                      {String(item.fileType).toLowerCase().includes('video') ? (
                        <Button variant="outline" size="sm" onClick={() => toggleVideo(item)}>
                          <Eye className="h-4 w-4 mr-1" />
                          {activeVideoId === item.id ? 'Kapat' : 'Oynat'}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openFile(item.fileName)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Aç
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openFile(item.fileName, true).catch(() => {})}>
                        <Download className="h-4 w-4 mr-1" />
                        İndir
                      </Button>
                    </div>
                  </div>
                  {activeVideoId === item.id && String(item.fileType).toLowerCase().includes('video') && buildContentFileUrl(item.fileName) ? (
                    <div className="overflow-hidden rounded-xl border bg-black">
                      <video
                        controls
                        preload="metadata"
                        className="h-auto max-h-[420px] w-full"
                        src={buildContentFileUrl(item.fileName)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
