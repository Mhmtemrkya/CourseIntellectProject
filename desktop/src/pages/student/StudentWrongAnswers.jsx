import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Brain, ChevronRight, RotateCcw, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { clearWrongAnswers, fetchWrongAnswers } from '../../lib/api/modules';

function decodeText(value = '') {
  return value
    .replaceAll('&#xFC;', 'ü')
    .replaceAll('&#xDC;', 'Ü')
    .replaceAll('&#xE7;', 'ç')
    .replaceAll('&#xC7;', 'Ç')
    .replaceAll('&#x131;', 'ı')
    .replaceAll('&#x130;', 'İ')
    .replaceAll('&#xF6;', 'ö')
    .replaceAll('&#xD6;', 'Ö')
    .replaceAll('&#x15F;', 'ş')
    .replaceAll('&#x15E;', 'Ş')
    .replaceAll('&#x11F;', 'ğ')
    .replaceAll('&#x11E;', 'Ğ')
    .replaceAll('&uuml;', 'ü')
    .replaceAll('&Uuml;', 'Ü')
    .replaceAll('&ccedil;', 'ç')
    .replaceAll('&Ccedil;', 'Ç')
    .replaceAll('&ouml;', 'ö')
    .replaceAll('&Ouml;', 'Ö')
    .replaceAll('&scedil;', 'ş')
    .replaceAll('&Scedil;', 'Ş')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&');
}

export default function StudentWrongAnswers() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const records = await fetchWrongAnswers({
        studentUsername: user?.username,
        studentName: user?.name,
      }).catch(() => []);
      setWrongAnswers(records);
    } catch (err) {
      setError(err.message || 'Yanlışlarım görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.username]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const weakSubjects = useMemo(() => {
    const grouped = new Map();
    wrongAnswers.forEach((item) => {
      const key = `${decodeText(item.subject)}__${decodeText(item.topic)}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          subject: decodeText(item.subject),
          topic: decodeText(item.topic),
          count: 0,
          questions: [],
          latest: item.submittedAtUtc,
        });
      }
      const current = grouped.get(key);
      current.count += 1;
      current.questions.push(item);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count)
      .map((item) => ({
        ...item,
        preview: item.questions.slice(0, 3),
      }));
  }, [wrongAnswers]);

  const summary = useMemo(() => ({
    weakSubjectCount: weakSubjects.length,
    suggestedQuestionCount: weakSubjects.reduce((sum, item) => sum + item.count, 0),
  }), [weakSubjects]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-wrong-answers-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Yanlışlarım</h1>
        <p className="text-muted-foreground mt-1">Düşük skorlu derslerden türetilen tekrar listesi</p>
      </div>

      {error ? <ErrorBanner title="Yanlışlar görünümü alınamadı" message={error} onRetry={loadData} /> : null}

      {weakSubjects.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Henüz yanlış soru kaydı görünmüyor. Yeni çözdüğün yanlış sorular burada toplanacak.</CardContent></Card>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline">{summary.weakSubjectCount} zayıf ders alanı</Badge>
                <Badge variant="outline">{summary.suggestedQuestionCount} yanlış soru kaydı</Badge>
              </div>
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate('/s/question-practice')}>
                <Target className="mr-2 h-4 w-4" />
                Soru Çözüm Alanına Git
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await clearWrongAnswers({
                    studentUsername: user?.username,
                    studentName: user?.name,
                  });
                  await loadData();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Yanlışlarımı Temizle
              </Button>
            </CardContent>
          </Card>
          {weakSubjects.map((item) => (
            <Card key={`${item.subject}-${item.topic}`} className="overflow-hidden border border-slate-200/80 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950">
              <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/10">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" />{item.subject}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.topic}</p>
                    <p className="text-sm text-muted-foreground">Bu konuda {item.count} yanlış kayıt bulundu.</p>
                  </div>
                  <Badge variant="outline">Tekrar öneriliyor</Badge>
                </div>
                <div className="space-y-3">
                  {item.preview.map((question) => (
                    <div key={question.attemptId} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{decodeText(question.questionText) || 'Soru'}</p>
                          <p className="mt-1 text-sm text-muted-foreground">Senin cevabın: {decodeText(question.yourAnswer) || 'Boş'}</p>
                          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Doğru cevap: {decodeText(question.correctAnswer) || 'Belirtilmemiş'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline"><Brain className="h-3 w-3 mr-1" />{question.difficulty || 'Standart'}</Badge>
                          <Badge className="bg-rose-600 text-white"><RotateCcw className="h-3 w-3 mr-1" />Yanlış</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => navigate('/s/question-practice')}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Bu Konuyu Tekrar Et
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
