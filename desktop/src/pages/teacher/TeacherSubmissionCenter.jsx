import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileCheck2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchHomework } from '../../lib/api/modules';

export default function TeacherSubmissionCenter() {
  const [homework, setHomework] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchHomework();
      setHomework(payload);
      setSelectedId(payload[0]?.id || '');
    } catch (err) {
      setError(err.message || 'Teslim merkezi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const selectedHomework = useMemo(() => homework.find((item) => item.id === selectedId) || homework[0], [homework, selectedId]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-submission-center-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Teslim Merkezi</h1>
        <p className="text-muted-foreground mt-1">Ödev bazlı öğrenci teslimleri</p>
      </div>
      {error ? <ErrorBanner title="Teslimler alınamadı" message={error} onRetry={loadSubmissions} /> : null}
      <Card>
        <CardContent className="p-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Ödev seçin" /></SelectTrigger>
            <SelectContent>
              {homework.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {(selectedHomework?.submissions || []).map((item, index) => (
          <Card key={`${item.studentName}-${index}`}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-brand-primary" />{item.studentName}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{item.note || 'Açıklama yok'}</p>
                <p className="text-sm text-muted-foreground">Not: {item.grade ?? 'Henüz yok'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline"><FileCheck2 className="h-3 w-3 mr-1" />Teslim</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedSubmission(item)}>Detay</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teslim Detayı</DialogTitle>
          </DialogHeader>
          {selectedSubmission ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Öğrenci</p>
                <p className="text-muted-foreground">{selectedSubmission.studentName}</p>
              </div>
              <div>
                <p className="font-medium">Açıklama</p>
                <p className="text-muted-foreground">{selectedSubmission.note || 'Açıklama yok'}</p>
              </div>
              <div>
                <p className="font-medium">Not</p>
                <p className="text-muted-foreground">{selectedSubmission.grade ?? 'Henüz yok'}</p>
              </div>
              <div>
                <p className="font-medium">Ekler</p>
                <div className="space-y-2">
                  {(selectedSubmission.attachments || selectedSubmission.files || []).length > 0 ? (
                    (selectedSubmission.attachments || selectedSubmission.files || []).map((file, index) => (
                      <div key={`${file.name || file.fileName || file}-${index}`} className="rounded-lg border p-3 text-muted-foreground">
                        {file.name || file.fileName || file.url || String(file)}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Ek dosya bulunmuyor.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
