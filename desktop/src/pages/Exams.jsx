import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  FileQuestion,
  ClipboardList,
  BarChart3,
  Calendar,
  Users,
  BookOpen,
  Download,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import {
  createExamResult,
  createQuestionBankItem,
  fetchExamResults,
  fetchQuestionBank,
  fetchStudents,
} from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

function AddQuestionDialog({ open, onOpenChange, classes, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    topic: '',
    difficulty: 'Orta',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    answer: 'A',
    teacher: '',
    classTargets: [],
  });

  const handleCreate = async () => {
    if (!form.subject || !form.topic || !form.questionText) {
      toast({
        title: 'Eksik bilgi',
        description: 'Ders, konu ve soru metni zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      // Backend QuestionBank DTO 'answer' alanını desteklemiyor; çoktan
      // seçmeli soru için 'correctOptionIndex' (0..3) bekleniyor. Eskiden
      // gönderilen 'answer' silent-ignored idi → doğru cevap kaybediliyordu.
      const letterToIndex = { A: 0, B: 1, C: 2, D: 3 };
      const correctOptionIndex = letterToIndex[String(form.answer).toUpperCase()] ?? 0;
      const created = await createQuestionBankItem({
        subject: form.subject,
        topic: form.topic,
        difficulty: form.difficulty,
        questionText: form.questionText,
        type: 'MultipleChoice',
        options: [form.optionA, form.optionB, form.optionC, form.optionD].filter(Boolean),
        correctOptionIndex,
        classTargets: form.classTargets,
        teacher: form.teacher || 'Öğretmen',
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Soru oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleClass = (value) => {
    setForm((prev) => ({
      ...prev,
      classTargets: prev.classTargets.includes(value)
        ? prev.classTargets.filter((item) => item !== value)
        : [...prev.classTargets, value],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni Soru Ekle</DialogTitle>
          <DialogDescription>Soru bankasına yeni soru ekleyin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ders</Label>
              <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Konu</Label>
              <Input value={form.topic} onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zorluk</Label>
              <Select value={form.difficulty} onValueChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kolay">Kolay</SelectItem>
                  <SelectItem value="Orta">Orta</SelectItem>
                  <SelectItem value="Zor">Zor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Doğru Cevap</Label>
              <Select value={form.answer} onValueChange={(value) => setForm((prev) => ({ ...prev, answer: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D'].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Soru</Label>
            <Textarea value={form.questionText} onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {['A', 'B', 'C', 'D'].map((option) => (
              <div key={option} className="space-y-2">
                <Label>{option} Şıkkı</Label>
                <Input
                  value={form[`option${option}`]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [`option${option}`]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Hedef Sınıflar</Label>
            <div className="flex flex-wrap gap-2">
              {classes.map((cls) => (
                <Button key={cls} type="button" size="sm" variant={form.classTargets.includes(cls) ? 'default' : 'outline'} onClick={() => toggleClass(cls)}>
                  {cls}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddExamResultDialog({ open, onOpenChange, students, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentName: '',
    className: '',
    subject: '',
    title: '',
    score: '',
  });

  const selectedStudent = students.find((student) => student.fullName === form.studentName);

  const handleCreate = async () => {
    if (!form.studentName || !form.subject || !form.title || !form.score) {
      toast({
        title: 'Eksik bilgi',
        description: 'Öğrenci, ders, başlık ve puan zorunlu.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await createExamResult({
        studentName: form.studentName,
        className: form.className,
        subject: form.subject,
        title: form.title,
        score: Number(form.score),
      });
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Sonuç oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni Sınav Sonucu</DialogTitle>
          <DialogDescription>Öğrenci için sonuç kaydı oluşturun</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Öğrenci</Label>
            <Select value={form.studentName} onValueChange={(value) => {
              const student = students.find((item) => item.fullName === value);
              setForm((prev) => ({
                ...prev,
                studentName: value,
                className: student?.className || '',
              }));
            }}>
              <SelectTrigger><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
              <SelectContent>
                {students.map((student) => <SelectItem key={student.id} value={student.fullName}>{student.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sınıf</Label>
              <Input value={selectedStudent?.className || form.className} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Puan</Label>
              <Input type="number" value={form.score} onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ders</Label>
              <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Exams() {
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [questionList, resultList, studentList] = await Promise.all([
        fetchQuestionBank().catch(() => []),
        fetchExamResults().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      setQuestions(questionList);
      setResults(resultList);
      setStudents(studentList);
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classes = useMemo(() => [...new Set(students.map((student) => student.className).filter(Boolean))], [students]);
  const subjectPerformance = useMemo(() => {
    const subjects = [...new Set(results.map((item) => item.subject).filter(Boolean))];
    return subjects.map((subject) => {
      const items = results.filter((result) => result.subject === subject);
      return {
        subject,
        average: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : 0,
        count: items.length,
      };
    });
  }, [results]);

  const examSummaries = useMemo(() => {
    const titles = [...new Set(results.map((item) => item.title).filter(Boolean))];
    return titles.map((title) => {
      const items = results.filter((result) => result.title === title);
      return {
        title,
        subject: items[0]?.subject || 'Ders',
        className: items[0]?.className || 'Sınıf',
        count: items.length,
        average: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : 0,
      };
    });
  }, [results]);

  const filteredSummaries = useMemo(() => examSummaries.filter((item) => `${item.title} ${item.subject} ${item.className}`.toLowerCase().includes(search.toLowerCase())), [examSummaries, search]);

  const downloadExamSummary = (item) => {
    const rows = results.filter((result) => result.title === item.title);
    const csv = [
      ['Ogrenci', 'Sinif', 'Sinav', 'Ders', 'Puan'],
      ...rows.map((row) => [row.studentName, row.className, row.title, row.subject, row.score]),
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${item.title.replace(/\s+/g, '_').toLowerCase()}_ozet.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="exams-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
        <p className="text-muted-foreground mt-1">Sınav ve soru yönetimi</p>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [questions.length, 'Soru Bankası'],
          [results.length, 'Toplam Sonuç'],
          [examSummaries.length, 'Sınav Özeti'],
          [classes.length, 'Aktif Sınıf'],
        ].map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="exams" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="questions" className="flex items-center gap-2"><FileQuestion className="h-4 w-4" />Soru Bankası</TabsTrigger>
          <TabsTrigger value="exams" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Sınavlar</TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Sonuçlar</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <div className="flex justify-end">
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setQuestionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Soru
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((question) => (
              <Card key={question.id} className="hover:shadow-card-hover transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">{question.subject}</Badge>
                      <Badge variant="outline">{question.topic}</Badge>
                      <Badge>{question.difficulty}</Badge>
                    </div>
                    <Badge variant="secondary">{question.usageCount || 0} kullanım</Badge>
                  </div>
                  <p className="text-sm mb-3">{question.questionText}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(question.options || []).map((option, index) => (
                      <div key={`${question.id}-option-${index}`} className={`p-2 rounded-lg ${question.answer === String.fromCharCode(65 + index) ? 'bg-green-100 dark:bg-green-900/30 border border-green-300' : 'bg-muted'}`}>
                        <span className="font-medium mr-2">{String.fromCharCode(65 + index)})</span>
                        {option}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(question.classTargets || []).map((item) => <Badge key={`${question.id}-${item}`} variant="outline">{item}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Sınav, ders veya sınıf ara..." />
            </div>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setResultDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sonuç
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSummaries.map((exam) => (
              <Card key={exam.title} className="hover:shadow-card-hover transition-all">
                <CardHeader>
                  <Badge className="w-fit bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Tamamlandı</Badge>
                  <CardTitle className="mt-2">{exam.title}</CardTitle>
                  <CardDescription>{exam.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{exam.className}</span></div>
                    <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /><span>{exam.count} sonuç</span></div>
                    <div className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-muted-foreground" /><span>Ortalama {exam.average}</span></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setSelectedExam(exam)}>Detay</Button>
                    <Button className="flex-1 bg-brand-primary hover:bg-brand-primary/90" onClick={() => downloadExamSummary(exam)}>
                      <Download className="mr-2 h-4 w-4" />
                      İndir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjectPerformance.map((item) => (
              <Card key={item.subject}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{item.subject}</p>
                      <p className="text-sm text-muted-foreground">{item.count} sonuç</p>
                    </div>
                    <Badge variant="outline">{item.average}</Badge>
                  </div>
                  <Progress value={item.average} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sonuç Listesi</CardTitle>
              <CardDescription>Gerçek sınav sonucu kayıtları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{result.studentName}</p>
                    <p className="text-sm text-muted-foreground">{result.className} • {result.title} • {result.subject}</p>
                  </div>
                  <Badge className="bg-brand-primary text-white">{result.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddQuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        classes={classes}
        onCreated={(created) => setQuestions((prev) => [created, ...prev])}
      />

      <AddExamResultDialog
        open={resultDialogOpen}
        onOpenChange={setResultDialogOpen}
        students={students}
        onCreated={(created) => setResults((prev) => [created, ...prev])}
      />

      <Dialog open={Boolean(selectedExam)} onOpenChange={(open) => !open && setSelectedExam(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedExam?.title || 'Sınav detayı'}</DialogTitle>
            <DialogDescription>
              {selectedExam?.subject} • {selectedExam?.className}
            </DialogDescription>
          </DialogHeader>
          {selectedExam ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Sınıf</p>
                    <p className="mt-1 font-semibold">{selectedExam.className}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Katılım</p>
                    <p className="mt-1 font-semibold">{selectedExam.count} öğrenci</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Ortalama</p>
                    <p className="mt-1 font-semibold">{selectedExam.average}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-2xl border">
                <div className="grid grid-cols-[1.8fr_1fr_0.7fr] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Öğrenci</span>
                  <span>Ders</span>
                  <span>Puan</span>
                </div>
                <div className="divide-y">
                  {results.filter((item) => item.title === selectedExam.title).map((item) => (
                    <div key={item.id} className="grid grid-cols-[1.8fr_1fr_0.7fr] gap-3 px-4 py-3 text-sm">
                      <span className="font-medium">{item.studentName}</span>
                      <span className="text-muted-foreground">{item.subject}</span>
                      <Badge className="w-fit bg-brand-primary text-white">{item.score}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {selectedExam ? (
              <Button variant="outline" onClick={() => downloadExamSummary(selectedExam)}>
                <Download className="mr-2 h-4 w-4" />
                Özeti İndir
              </Button>
            ) : null}
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedExam(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
