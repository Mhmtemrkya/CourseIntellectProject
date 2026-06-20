import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileQuestion, Trophy, TrendingUp, Calendar,
  AlertTriangle, BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchExamResults, fetchStudents } from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function decodeText(value = '') {
  return String(value)
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
    .replaceAll('&#x11E;', 'Ğ');
}

function normalizeText(value = '') {
  return decodeText(value).trim().toLowerCase();
}

export default function ParentExams() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const students = await fetchStudents();
      const linkedChildren = students.filter((student) => {
        const parentName = normalizeText(student.parentName);
        const parentEmail = normalizeText(student.parentEmail);
        return parentName === normalizeText(user?.name) || parentEmail.includes(normalizeText(user?.username));
      });
      setChildren(linkedChildren);
      const childName = linkedChildren[0]?.fullName || '';
      setSelectedChild((prev) => prev || childName);
      if (childName) {
        const examList = await fetchExamResults({ studentName: childName }).catch(() => []);
        setResults(examList);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err.message || 'Sınav sonuçları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  useEffect(() => {
    if (!selectedChild) return;
    fetchExamResults({ studentName: selectedChild })
      .then(setResults)
      .catch(() => setResults([]));
  }, [selectedChild]);

  const stats = useMemo(() => {
    const avgScore = results.length ? Math.round(results.reduce((sum, item) => sum + Number(item.score || 0), 0) / results.length) : 0;
    return {
      avgScore,
      examCount: results.length,
      topScore: results.length ? Math.max(...results.map((item) => Number(item.score || 0))) : 0,
    };
  }, [results]);

  const weakTopics = useMemo(() => {
    return results
      .filter((item) => Number(item.score || 0) < 70)
      .map((item) => ({
        subject: item.subject,
        topic: item.title,
        score: Number(item.score || 0),
      }))
      .slice(0, 5);
  }, [results]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parent-exams-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınav Sonuçları</h1>
          <p className="text-muted-foreground mt-1">Çocuğunuzun sınav performansı</p>
        </div>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Çocuk seçin" />
          </SelectTrigger>
          <SelectContent>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.fullName}>
                {decodeText(child.fullName)} ({decodeText(child.className)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <ErrorBanner title="Sonuçlar alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-brand-primary/10"><BarChart3 className="h-6 w-6 text-brand-primary" /></div><div><p className="text-2xl font-bold">{stats.avgScore}</p><p className="text-sm text-muted-foreground">Ortalama Puan</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-brand-accent/10"><Trophy className="h-6 w-6 text-brand-accent" /></div><div><p className="text-2xl font-bold">{stats.topScore}</p><p className="text-sm text-muted-foreground">En Yüksek Puan</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30"><TrendingUp className="h-6 w-6 text-green-600" /></div><div><p className="text-2xl font-bold">{results.filter((item) => Number(item.score || 0) >= 70).length}</p><p className="text-sm text-muted-foreground">Başarılı Sonuç</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4"><div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30"><FileQuestion className="h-6 w-6 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.examCount}</p><p className="text-sm text-muted-foreground">Toplam Sınav</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Son Sınav Sonuçları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map((exam) => (
                <motion.div key={exam.id} className="p-4 rounded-xl border border-border hover:border-brand-accent/30 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{decodeText(exam.subject)}</Badge>
                        <span className="text-sm text-muted-foreground">{new Date(exam.createdAt || exam.date || Date.now()).toLocaleDateString('tr-TR')}</span>
                      </div>
                      <h3 className="font-semibold">{decodeText(exam.title)}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-muted-foreground">{decodeText(exam.className)}</span>
                        <span className="text-muted-foreground">Öğrenci: {decodeText(exam.studentName)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${Number(exam.score || 0) >= 80 ? 'text-green-600' : Number(exam.score || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{exam.score}</div>
                    </div>
                  </div>
                  <div className="mt-3"><Progress value={Number(exam.score || 0)} className="h-2" /></div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        <motion.div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600" />Geliştirilmesi Gereken Konular</CardTitle>
              <CardDescription>Düşük performans görülen sonuçlar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weakTopics.map((topic) => (
                <div key={`${topic.subject}-${topic.topic}`} className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{decodeText(topic.topic)}</span>
                    <Badge variant="outline">{decodeText(topic.subject)}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={topic.score} className="h-2 flex-1" />
                    <span className="text-sm font-medium text-yellow-700">{topic.score}%</span>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => navigate('/p/meetings')}>
                <Calendar className="h-4 w-4 mr-2" />
                Öğretmenle Görüş
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
