import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchQuestionThreads, replyQuestionThread } from '../../lib/api/modules';

export default function TeacherQuestionWorkflow() {
  const { toast } = useToast();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState({});
  const [sendingId, setSendingId] = useState('');

  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setThreads(await fetchQuestionThreads().catch(() => []));
    } catch (err) {
      setError(err.message || 'Soru iş akışı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkflow(); }, [loadWorkflow]);

  const handleReply = async (thread) => {
    const text = replyText[thread.id]?.trim();
    if (!text) {
      toast({ title: 'Yanıt bekleniyor', description: 'Lütfen yanıt metni girin.', variant: 'destructive' });
      return;
    }

    try {
      setSendingId(thread.id);
      const updated = await replyQuestionThread(thread.id, { message: text });
      setThreads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setReplyText((prev) => ({ ...prev, [thread.id]: '' }));
      toast({ title: 'Yanıt gönderildi', description: 'Soru akışı backend üzerinde güncellendi.' });
    } catch (err) {
      toast({ title: 'Yanıt gönderilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSendingId('');
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-question-workflow-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Soru İş Akışı</h1>
        <p className="text-muted-foreground mt-1">Öğrenci sorularının detaylı işlem görünümü</p>
      </div>
      {error ? <ErrorBanner title="Soru iş akışı alınamadı" message={error} onRetry={loadWorkflow} /> : null}
      <div className="grid gap-4">
        {threads.map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageCircleQuestion className="h-5 w-5 text-brand-primary" />{item.title || item.subject || 'Soru akışı'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{item.questionText || item.lastReplyPreview || 'Detay yok'}</p>
                  <p className="text-sm text-muted-foreground">{item.studentName || item.createdBy || 'Öğrenci'}</p>
                </div>
                <Badge variant="outline">{item.status || 'Açık'}</Badge>
              </div>
              <div className="space-y-2">
                <Textarea
                  value={replyText[item.id] || ''}
                  onChange={(e) => setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Öğrenciye geri dönüş yazın"
                />
                <div className="flex justify-end">
                  <Button onClick={() => handleReply(item)} disabled={sendingId === item.id}>
                    {sendingId === item.id ? 'Gönderiliyor...' : 'Yanıtla'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
