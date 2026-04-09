import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageSquareQuote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchMeetingRequests, fetchQuestionThreads } from '../../lib/api/modules';

export default function ParentFeedback() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [meetings, threads] = await Promise.all([
        fetchMeetingRequests().catch(() => []),
        fetchQuestionThreads().catch(() => []),
      ]);
      const feedback = [
        ...meetings.map((item) => ({
          id: `meeting-${item.id}`,
          title: item.topic || 'Görüşme notu',
          detail: item.note || item.status || 'Durum güncellendi',
          source: 'Görüşme',
        })),
        ...threads.map((item) => ({
          id: `thread-${item.id}`,
          title: item.title || 'Soru akışı',
          detail: item.lastReplyPreview || item.questionText || 'Yanıt bekleniyor',
          source: 'Soru kutusu',
        })),
      ];
      setItems(feedback.slice(0, 8));
    } catch (err) {
      setError(err.message || 'Geri bildirimler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-feedback-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Öğretmen Geri Bildirimi</h1>
        <p className="text-muted-foreground mt-1">Görüşme ve soru akışlarından derlenmiş geri bildirim akışı</p>
      </div>

      {error ? <ErrorBanner title="Geri bildirimler alınamadı" message={error} onRetry={loadFeedback} /> : null}

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-brand-accent" />{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground">{item.detail}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.source}</Badge>
                <Button variant="outline" size="sm" onClick={() => navigate(item.source === 'Görüşme' ? '/p/meetings' : '/p/chat')}>Aç</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
