import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, CircleCheck, Send, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchQuestionBank, fetchQuestionPracticeAttempts, submitQuestionPracticeAttempt } from '../../lib/api/modules';

export default function StudentQuestionPractice() {
  const { toast } = useToast();
  const { user } = useApp();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [writtenAnswers, setWrittenAnswers] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [submittingId, setSubmittingId] = useState(null);

  const loadPractice = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [questionList, attemptList] = await Promise.all([
        fetchQuestionBank(),
        fetchQuestionPracticeAttempts(user?.username).catch(() => []),
      ]);
      setQuestions(questionList);
      setAttempts(attemptList);
    } catch (err) {
      setError(err.message || 'Soru pratik ekranı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => { loadPractice(); }, [loadPractice]);

  const visibleQuestions = useMemo(() => questions, [questions]);

  const attemptsByQuestion = useMemo(() => attempts.reduce((acc, item) => {
    acc[item.questionId] = item;
    return acc;
  }, {}), [attempts]);

  const handleSubmitAnswer = async (question) => {
    const answer = question.options?.length
      ? selectedAnswers[question.id]
      : writtenAnswers[question.id]?.trim();

    if (!answer) {
      toast({
        title: 'Cevap eksik',
        description: 'Göndermeden önce bir seçenek işaretleyin veya cevabınızı yazın.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingId(question.id);
      const saved = await submitQuestionPracticeAttempt(question.id, {
        studentName: user?.name || 'Öğrenci',
        studentUsername: user?.username || 'student',
        answerText: answer,
      });
      setAttempts((prev) => [saved, ...prev.filter((item) => item.questionId !== saved.questionId)]);
      toast({
        title: 'Cevap kaydedildi',
        description: saved.isCorrect
          ? `${question.topic || question.subject} için doğru cevap kaydedildi.`
          : `${question.topic || question.subject} için cevap kaydedildi, tekrar gözden geçirilebilir.`,
      });
    } catch (err) {
      toast({
        title: 'Cevap kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-question-practice-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Soru Çözüm Alanı</h1>
        <p className="text-muted-foreground mt-1">Soru bankasından detaylı çözüm görünümü</p>
      </div>
      {error ? <ErrorBanner title="Soru çözüm alanı alınamadı" message={error} onRetry={loadPractice} /> : null}
      <div className="grid gap-4">
        {visibleQuestions.map((item) => (
          <Card key={item.id}>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5 text-brand-primary" />{item.topic}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2"><Badge variant="outline">{item.subject}</Badge><Badge variant="outline">{item.type}</Badge><Badge variant="outline">{item.difficulty}</Badge></div>
              <p className="text-sm text-muted-foreground">{item.questionText}</p>
              {(item.options || []).length > 0 ? (
                <div className="grid gap-2">
                  {item.options.map((option, index) => (
                    <button
                      type="button"
                      key={`${item.id}-${index}`}
                      onClick={() => setSelectedAnswers((prev) => ({ ...prev, [item.id]: option }))}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                        selectedAnswers[item.id] === option
                          ? 'border-brand-primary bg-brand-primary/10 text-foreground'
                          : 'hover:border-brand-primary/40'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Açık uçlu soru. Beklenen cevap: {item.expectedAnswer || 'Öğretmen açıklayacak.'}</div>
                  <Textarea
                    value={writtenAnswers[item.id] || ''}
                    onChange={(event) => setWrittenAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder="Cevabınızı buraya yazın"
                    className="min-h-[120px]"
                  />
                </div>
              )}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  {attemptsByQuestion[item.id] ? <CircleCheck className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                  {attemptsByQuestion[item.id]
                    ? (attemptsByQuestion[item.id].isCorrect ? 'Doğru cevap kaydedildi' : 'Cevap kaydedildi')
                    : 'Çözüm odaklı görünüm hazır'}
                </div>
                <Button
                  className="bg-brand-primary hover:bg-brand-primary/90"
                  onClick={() => handleSubmitAnswer(item)}
                  disabled={submittingId === item.id}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submittingId === item.id ? 'Gönderiliyor...' : attemptsByQuestion[item.id] ? 'Tekrar Gönder' : 'Cevabı Gönder'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
