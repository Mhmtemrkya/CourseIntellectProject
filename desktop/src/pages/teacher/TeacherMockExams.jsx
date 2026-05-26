import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, FileQuestion, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';
import { deletePlannedExam, fetchPlannedExams } from '../../lib/api/modules';

function isMockExam(exam) {
  const type = String(exam.type || '').trim().toLowerCase();
  return type === 'mockexam' || type.includes('deneme');
}

export default function TeacherMockExams() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchPlannedExams({ teacherName: user?.name });
      setRecords((Array.isArray(response) ? response : []).filter(isMockExam));
    } catch (requestError) {
      setError(requestError.message || 'Deneme sınavları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: records.length,
    questions: records.reduce((total, record) => total + Number(record.questionCount || 0), 0),
    upcoming: records.filter((record) => String(record.status || '').toLowerCase() !== 'tamamlandi').length,
  }), [records]);

  const remove = async (record) => {
    try {
      setDeletingId(record.id);
      await deletePlannedExam(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      toast({ title: 'Deneme sınavı silindi', description: record.title });
    } catch (requestError) {
      toast({ title: 'Deneme silinemedi', description: requestError.message, variant: 'destructive' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-mock-exams-page">
      <header className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-[#070f1c] p-6 text-white lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">Öğretmen</p>
          <h1 className="mt-2 text-3xl font-black">Deneme Sınavları</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">Deneme sorularını oluştur, yayınla ve canlı sınav kayıtlarını tek ekrandan yönet.</p>
        </div>
        <Button onClick={() => navigate('/t/mock-exams/create?mode=exam&type=MockExam')} className="h-12 bg-orange-500 px-5 text-white hover:bg-orange-600">
          <Plus className="mr-2 h-5 w-5" />Yeni Deneme Oluştur
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Toplam Deneme', stats.total, FileQuestion],
          ['Yaklaşan', stats.upcoming, CalendarDays],
          ['Toplam Soru', stats.questions, Clock3],
        ].map(([label, value, Icon]) => (
          <Card key={label} className="border-white/10 bg-[#0a1323] text-white">
            <CardContent className="flex items-center justify-between p-5">
              <div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
              <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300"><Icon className="h-6 w-6" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <ErrorBanner variant="error" title="Deneme sınavları yüklenemedi" message={error} onRetry={load} />}

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-slate-400"><LoadingDots /><p>Canlı deneme kayıtları yükleniyor...</p></div>
      ) : records.length === 0 ? (
        <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[30px] border border-dashed border-white/10 bg-[#070f1c] p-8 text-center text-white">
          <div className="mb-5 rounded-3xl bg-orange-500/15 p-5 text-orange-300"><FileQuestion className="h-10 w-10" /></div>
          <h2 className="text-xl font-black">Henüz deneme sınavı oluşturulmadı</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">Yeni deneme oluşturduğunuzda sorular ve planlama bilgileri canlı olarak burada listelenir.</p>
          <Button onClick={() => navigate('/t/mock-exams/create?mode=exam&type=MockExam')} className="mt-6 bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-2 h-4 w-4" />Deneme Oluştur</Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((record) => (
            <Card key={record.id} className="border-white/10 bg-[#070f1c] text-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="mb-3 border-orange-400/30 bg-orange-500/15 text-orange-200 hover:bg-orange-500/15">Deneme Sınavı</Badge>
                    <h2 className="text-lg font-black">{record.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{record.subject} · {record.className}</p>
                  </div>
                  <Button variant="ghost" size="icon" disabled={deletingId === record.id} onClick={() => remove(record)} className="text-slate-400 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">Tarih</p><p className="mt-1 font-bold text-slate-200">{record.dateLabel || record.date || '-'}</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">Süre</p><p className="mt-1 font-bold text-slate-200">{record.duration || '-'}</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">Soru</p><p className="mt-1 font-bold text-slate-200">{record.questionCount || 0}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && records.length > 0 && (
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Listeyi Yenile</Button>
      )}
    </motion.div>
  );
}
