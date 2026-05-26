import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileQuestion, Plus, BarChart3, CheckCircle, Calendar, ChevronDown, Trophy, Users, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar as DateCalendar } from '../../components/ui/calendar';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { TeacherEmptyState } from '../../components/teacher/TeacherEmptyState';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { createExamResult, createPlannedExam, createQuestionBankItem, deletePlannedExam, fetchExamResults, fetchPlannedExams, fetchQuestionBank, fetchStudents, uploadFile } from '../../lib/api/modules';

const createManualQuestionDraft = () => ({
  id: `manual-${Math.random().toString(36).slice(2, 9)}`,
  topic: '',
  questionText: '',
  type: 'Açık Uçlu',
  difficulty: 'Orta',
  expectedAnswer: '',
  options: '',
  correctOptionIndex: '0',
  imagePath: '',
  imagePlacement: 'Top',
  imageFile: null,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const DEFAULT_SUBJECTS = ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce'];
const DURATION_OPTIONS = ['20 dk', '30 dk', '40 dk', '45 dk', '60 dk', '75 dk', '90 dk', '120 dk'];
const SUBJECT_META = {
  Matematik: { gradient: 'from-sky-500 to-blue-600', tint: 'bg-sky-500/10 text-sky-700', mark: 'M', tagline: 'Soru akışı ve süre yönetimi' },
  'Türkçe': { gradient: 'from-teal-600 to-cyan-500', tint: 'bg-teal-500/10 text-teal-700', mark: 'TR', tagline: 'Dil, yorum ve paragraf dengesi' },
  Fizik: { gradient: 'from-violet-500 to-fuchsia-600', tint: 'bg-violet-500/10 text-violet-700', mark: 'F', tagline: 'Kuvvet ve hareket kontrolü' },
  Kimya: { gradient: 'from-emerald-500 to-teal-600', tint: 'bg-emerald-500/10 text-emerald-700', mark: 'K', tagline: 'Tepkime ve kavram odaklı set' },
  Biyoloji: { gradient: 'from-green-500 to-lime-600', tint: 'bg-lime-500/10 text-lime-700', mark: 'B', tagline: 'Sistemler ve süreç odaklı içerik' },
  'İngilizce': { gradient: 'from-amber-500 to-yellow-500', tint: 'bg-amber-500/10 text-amber-700', mark: 'EN', tagline: 'Kelime, okuma ve yapı pratiği' },
};

function decodeText(value = '') {
  return String(value || '')
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
    .replaceAll('&nbsp;', ' ');
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function subjectMeta(subject) {
  const safeSubject = decodeText(subject);
  return SUBJECT_META[safeSubject] || {
    gradient: 'from-slate-500 to-slate-700',
    tint: 'bg-slate-500/10 text-slate-700',
    mark: 'SN',
    tagline: 'Planlı sınav akışı',
  };
}

export default function TeacherExams() {
  const { toast } = useToast();
  const { user } = useApp();
  const navigate = useNavigate();
  const [examResults, setExamResults] = useState([]);
  const [plannedExams, setPlannedExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [questionSources, setQuestionSources] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    examTitle: '',
    type: 'Quiz',
    subject: '',
    dateLabel: '',
    dateValue: null,
    studentName: '',
    className: '',
    score: '',
    net: '',
  });
  const [plannedForm, setPlannedForm] = useState({
    title: '',
    type: 'Quiz',
    className: '',
    subject: '',
    dateLabel: '',
    dateValue: null,
    duration: '40 dk',
    questionCount: '10',
    sourceType: 'Soru Bankasi',
    sources: [],
    manualQuestions: [],
  });

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [results, studentList, planned, questionItems] = await Promise.all([
        fetchExamResults(),
        fetchStudents(),
        fetchPlannedExams({ teacherName: user?.name }).catch(() => []),
        fetchQuestionBank().catch(() => []),
      ]);
      setExamResults(results);
      setStudents(studentList);
      setPlannedExams(planned);
      setQuestionSources(questionItems);
      setPlannedForm((prev) => ({
        ...prev,
        className: prev.className || studentList[0]?.className || '',
      }));
    } catch (err) {
      setError(err.message || 'Sınav verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const filteredExams = useMemo(() => examResults.filter((item) => (
    `${item.examTitle} ${item.subject} ${item.studentName}`.toLowerCase().includes(searchQuery.toLowerCase())
  )), [examResults, searchQuery]);

  const groupedResults = useMemo(() => {
    const groups = new Map();
    filteredExams.forEach((item) => {
      const key = [
        item.examTitle,
        item.className,
        item.subject,
        item.dateLabel || item.date,
      ].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: item.examTitle,
          subject: item.subject,
          className: item.className,
          dateLabel: item.dateLabel || item.date,
          type: item.type,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    });

    return Array.from(groups.values()).map((group) => {
      const scores = group.items.map((item) => Number(item.score || 0));
      const nets = group.items.map((item) => Number(item.net || 0));
      return {
        ...group,
        participantCount: group.items.length,
        averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        averageNet: nets.length ? (nets.reduce((sum, value) => sum + value, 0) / nets.length).toFixed(1) : '0.0',
      };
    });
  }, [filteredExams]);

  const stats = {
    total: examResults.length + plannedExams.length,
    completed: examResults.length,
    scheduled: plannedExams.length,
    avgScore: examResults.length ? Math.round(examResults.reduce((sum, item) => sum + Number(item.score || 0), 0) / examResults.length) : 0,
  };

  const subjectOptions = useMemo(
    () => [...new Set([
      ...DEFAULT_SUBJECTS,
      ...students.map((item) => item.branchOrDepartment || item.subject).filter(Boolean),
      ...questionSources.map((item) => item.subject).filter(Boolean),
      ...plannedExams.map((item) => item.subject).filter(Boolean),
    ])],
    [students, questionSources, plannedExams],
  );

  const resultExamOptions = useMemo(
    () => [...new Set([
      ...plannedExams.map((item) => decodeText(item.title)).filter(Boolean),
      ...examResults.map((item) => decodeText(item.examTitle)).filter(Boolean),
    ])],
    [plannedExams, examResults],
  );

  const handleStudentChange = (value) => {
    const selected = students.find((item) => item.fullName === value);
    setForm((prev) => ({
      ...prev,
      studentName: value,
      className: prev.className || selected?.className || '',
    }));
  };

  const handleResultExamChange = (value) => {
    const plannedMatch = plannedExams.find((item) => decodeText(item.title) === value);
    const historicalMatch = examResults.find((item) => decodeText(item.examTitle) === value);

    setForm((prev) => ({
      ...prev,
      examTitle: value,
      type: plannedMatch?.type || historicalMatch?.type || prev.type,
      subject: decodeText(plannedMatch?.subject || historicalMatch?.subject || prev.subject),
      dateLabel: plannedMatch?.dateLabel || historicalMatch?.dateLabel || historicalMatch?.date || prev.dateLabel,
      className: plannedMatch?.className || historicalMatch?.className || prev.className,
    }));
  };

  const handleCreateExam = async () => {
    try {
      setSaving(true);
      const created = await createExamResult({
        examTitle: form.examTitle.trim(),
        type: form.type,
        subject: form.subject.trim(),
        dateLabel: form.dateLabel.trim(),
        studentName: form.studentName.trim(),
        className: form.className.trim(),
        score: Number(form.score),
        net: Number(form.net),
      });
      setExamResults((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({
        examTitle: '',
        type: 'Quiz',
        subject: '',
        dateLabel: '',
        dateValue: null,
        studentName: '',
        className: '',
        score: '',
        net: '',
      });
      toast({
        title: 'Sınav sonucu kaydedildi',
        description: `${created.studentName} için sonuç backend’e işlendi.`,
      });
    } catch (err) {
      toast({
        title: 'Kayıt başarısız',
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlannedExam = async () => {
    try {
      setSaving(true);
      let sources = plannedForm.sources;
      if (plannedForm.sourceType === 'Manuel Ekle' && plannedForm.manualQuestions.length > 0) {
        const createdManualQuestions = [];
        for (const item of plannedForm.manualQuestions) {
          let imagePath = item.imagePath || null;
          if (item.imageFile) {
            const imageForm = new FormData();
            imageForm.append('file', item.imageFile);
            const uploaded = await uploadFile(imageForm, 'question-images');
            imagePath = uploaded.fileUrl || uploaded.fileName || item.imageFile.name;
          }
          const created = await createQuestionBankItem({
            subject: plannedForm.subject.trim(),
            topic: item.topic.trim(),
            difficulty: item.difficulty,
            type: item.type,
            questionText: item.questionText.trim(),
            teacher: user?.name || 'Öğretmen',
            imagePath,
            imagePlacement: item.imagePlacement || 'Top',
            options: item.options.split('\n').map((entry) => entry.trim()).filter(Boolean),
            correctOptionIndex: /secmeli|çoktan/i.test(item.type) ? Number(item.correctOptionIndex || 0) : null,
            classTargets: [plannedForm.className.trim()],
            solutionAssetPath: null,
            solutionAssetType: null,
            revealCorrectAnswerToStudent: false,
            expectedAnswer: item.expectedAnswer || null,
          });
          createdManualQuestions.push({
            questionId: created.id,
            title: created.questionText,
            type: created.type,
            subject: created.subject,
            imagePath: created.imagePath,
            imagePlacement: item.imagePlacement || 'Top',
          });
        }
        sources = createdManualQuestions;
      }
      const created = await createPlannedExam({
        title: plannedForm.title.trim(),
        type: plannedForm.type,
        className: plannedForm.className.trim(),
        subject: plannedForm.subject.trim(),
        dateLabel: plannedForm.dateLabel.trim(),
        duration: plannedForm.duration,
        questionCount: plannedForm.sourceType === 'Manuel Ekle' ? plannedForm.manualQuestions.length : Number(plannedForm.questionCount),
        teacherName: user?.name || 'Öğretmen',
        sourceType: plannedForm.sourceType,
        sources,
      });
      setPlannedExams((prev) => [created, ...prev]);
      setPlannedOpen(false);
      setPlannedForm({
        title: '',
        type: 'Quiz',
        className: students[0]?.className || '',
        subject: '',
        dateLabel: '',
        dateValue: null,
        duration: '40 dk',
        questionCount: '10',
        sourceType: 'Soru Bankasi',
        sources: [],
        manualQuestions: [],
      });
      toast({ title: 'Sınav oluşturuldu', description: 'Planlı sınav backend’e kaydedildi.' });
    } catch (err) {
      toast({ title: 'Sınav oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (source) => {
    setPlannedForm((prev) => {
      const exists = prev.sources.some((item) => item.title === source.title);
      const nextSources = exists
        ? prev.sources.filter((item) => item.title !== source.title)
        : [...prev.sources, {
          questionId: source.id,
          title: source.questionText,
          type: source.type,
          subject: source.subject,
          imagePath: source.imagePath || null,
          imagePlacement: source.imagePlacement || 'Top',
        }];
      return {
        ...prev,
        sources: nextSources,
        questionCount: String(nextSources.length || prev.questionCount),
      };
    });
  };

  const updateManualQuestion = (id, key, value) => {
    setPlannedForm((prev) => ({
      ...prev,
      manualQuestions: prev.manualQuestions.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
      questionCount: String(prev.manualQuestions.length),
    }));
  };

  const addManualQuestion = () => {
    setPlannedForm((prev) => {
      const nextManualQuestions = [...prev.manualQuestions, createManualQuestionDraft()];
      return {
        ...prev,
        manualQuestions: nextManualQuestions,
        questionCount: String(nextManualQuestions.length),
      };
    });
  };

  const removeManualQuestion = (id) => {
    setPlannedForm((prev) => {
      const nextManualQuestions = prev.manualQuestions.filter((item) => item.id !== id);
      return {
        ...prev,
        manualQuestions: nextManualQuestions,
        questionCount: String(nextManualQuestions.length),
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Sınav verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teacher-exams-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
          <p className="text-muted-foreground mt-1">Sınav sonucu gir ve mevcut kayıtları incele</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/t/exam-workbench')}>Çalışma Alanı</Button>
          <Button variant="outline" onClick={() => navigate('/t/mock-exams')}>
            <Calendar className="h-4 w-4 mr-2" />
            Deneme Sınavları
          </Button>
          <Dialog open={plannedOpen} onOpenChange={setPlannedOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hidden">
                <Calendar className="h-4 w-4 mr-2" />
                Yeni Sınav Oluştur
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(96vw,1100px)] max-w-[1100px] max-h-[88vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Yeni Sınav Oluştur</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0 space-y-2"><Label>Başlık</Label><Input value={plannedForm.title} onChange={(e) => setPlannedForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Matematik Deneme 4" /></div>
                  <div className="min-w-0 space-y-2"><Label>Tür</Label><Select value={plannedForm.type} onValueChange={(value) => setPlannedForm((prev) => ({ ...prev, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Quiz">Quiz</SelectItem><SelectItem value="Written">Yazılı</SelectItem><SelectItem value="MockExam">Deneme</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="min-w-0 space-y-2"><Label>Sınıf</Label><Select value={plannedForm.className} onValueChange={(value) => setPlannedForm((prev) => ({ ...prev, className: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...new Set(students.map((item) => item.className).filter(Boolean))].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                  <div className="min-w-0 space-y-2">
                    <Label>Ders</Label>
                    <Select value={plannedForm.subject} onValueChange={(value) => setPlannedForm((prev) => ({ ...prev, subject: value }))}>
                      <SelectTrigger><SelectValue placeholder="Ders seçin" /></SelectTrigger>
                      <SelectContent>
                        {subjectOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Tarih</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span className={plannedForm.dateLabel ? '' : 'text-muted-foreground'}>
                            {plannedForm.dateLabel || 'Tarih seçin'}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DateCalendar
                          mode="single"
                          selected={plannedForm.dateValue ?? undefined}
                          onSelect={(value) => {
                            if (!value) return;
                            setPlannedForm((prev) => ({ ...prev, dateLabel: formatDateLabel(value), dateValue: value }));
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="min-w-0 space-y-2"><Label>Soru Sayısı</Label><Input value={plannedForm.questionCount} onChange={(e) => setPlannedForm((prev) => ({ ...prev, questionCount: e.target.value }))} type="number" /></div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label>Süre</Label>
                    <Select value={plannedForm.duration} onValueChange={(value) => setPlannedForm((prev) => ({ ...prev, duration: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Kaynak Türü</Label>
                    <Select value={plannedForm.sourceType} onValueChange={(value) => setPlannedForm((prev) => ({ ...prev, sourceType: value, sources: value === 'Manuel Ekle' ? [] : prev.sources, manualQuestions: value === 'Manuel Ekle' ? prev.manualQuestions : [] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soru Bankasi">Soru Bankasından</SelectItem>
                        <SelectItem value="Manuel Ekle">Manuel Ekle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{plannedForm.sourceType === 'Manuel Ekle' ? 'Manuel Soru Kartları' : 'Soru Havuzu'}</Label>
                  {plannedForm.sourceType === 'Manuel Ekle' ? (
                    <div className="space-y-3 rounded-xl border p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">Manuel Soru Kartları</p>
                          <p className="text-xs text-muted-foreground">Her soru ayrı akışta oluşturulur ve dar ekranda taşmadan görünür.</p>
                        </div>
                        <Button variant="outline" onClick={addManualQuestion}>
                          <Plus className="h-4 w-4 mr-2" />
                          Soru Kartı Ekle
                        </Button>
                      </div>
                      {plannedForm.manualQuestions.map((item, index) => (
                        <div key={item.id} className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-medium">Soru {index + 1}</p>
                            <Button variant="ghost" size="icon" onClick={() => removeManualQuestion(item.id)}>
                              <FileQuestion className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <div className="min-w-0">
                              <Input value={item.topic} onChange={(e) => updateManualQuestion(item.id, 'topic', e.target.value)} placeholder="Konu" />
                            </div>
                            <div className="min-w-0">
                            <Select value={item.type} onValueChange={(value) => updateManualQuestion(item.id, 'type', value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Açık Uçlu">Açık Uçlu</SelectItem>
                                <SelectItem value="Çoktan Seçmeli">Çoktan Seçmeli</SelectItem>
                                <SelectItem value="Doğru / Yanlış">Doğru / Yanlış</SelectItem>
                              </SelectContent>
                            </Select>
                            </div>
                          </div>
                          <Textarea value={item.questionText} onChange={(e) => updateManualQuestion(item.id, 'questionText', e.target.value)} placeholder="Soru metni" />
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <div className="min-w-0 space-y-2">
                              <Label>Görsel</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => updateManualQuestion(item.id, 'imageFile', e.target.files?.[0] || null)}
                              />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <Label>Görsel Yerleşimi</Label>
                              <Select value={item.imagePlacement || 'Top'} onValueChange={(value) => updateManualQuestion(item.id, 'imagePlacement', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Top">Üstte</SelectItem>
                                  <SelectItem value="Bottom">Altta</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {/secmeli|çoktan/i.test(item.type) ? (
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <div className="min-w-0">
                                <Textarea value={item.options} onChange={(e) => updateManualQuestion(item.id, 'options', e.target.value)} placeholder="Her satıra bir şık" />
                              </div>
                              <div className="min-w-0">
                                <Input value={item.correctOptionIndex} onChange={(e) => updateManualQuestion(item.id, 'correctOptionIndex', e.target.value)} type="number" min="0" placeholder="Doğru şık sırası" />
                              </div>
                            </div>
                          ) : (
                            <Textarea value={item.expectedAnswer} onChange={(e) => updateManualQuestion(item.id, 'expectedAnswer', e.target.value)} placeholder="Beklenen cevap" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border p-3">
                      {questionSources
                        .filter((item) => !plannedForm.subject || item.subject === plannedForm.subject)
                        .filter((item) => !plannedForm.className || item.classTargets?.includes('Tüm Sınıflar') || item.classTargets?.includes(plannedForm.className))
                        .map((item) => {
                          const selected = plannedForm.sources.some((source) => source.title === item.questionText);
                          return (
                            <button type="button" key={item.id} className={`rounded-lg border p-3 text-left transition ${selected ? 'border-brand-primary bg-brand-primary/5' : 'hover:bg-muted/40'}`} onClick={() => toggleSource(item)}>
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.questionText}</p>
                                  <p className="text-sm text-muted-foreground">{item.subject} • {item.type} • {item.topic}</p>
                                </div>
                                <Badge variant="outline">{selected ? 'Seçildi' : 'Ekle'}</Badge>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setPlannedOpen(false)}>İptal</Button>
                <Button onClick={handleCreatePlannedExam} disabled={saving || !plannedForm.title || !plannedForm.subject || !plannedForm.className}>{saving ? 'Kaydediliyor...' : 'Sınavı Oluştur'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sonuç
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sınav Sonucu Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Sınav Adı</Label>
                <Select value={form.examTitle} onValueChange={handleResultExamChange}>
                  <SelectTrigger><SelectValue placeholder="Sınav seçin" /></SelectTrigger>
                  <SelectContent>
                    {resultExamOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ders</Label>
                  <Select value={form.subject} onValueChange={(value) => setForm((prev) => ({ ...prev, subject: value }))}>
                    <SelectTrigger><SelectValue placeholder="Ders seçin" /></SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((value) => <SelectItem key={value} value={decodeText(value)}>{decodeText(value)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tür</Label>
                  <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quiz">Quiz</SelectItem>
                      <SelectItem value="MockExam">Deneme</SelectItem>
                      <SelectItem value="Written">Yazılı</SelectItem>
                      <SelectItem value="Oral">Sözlü</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Öğrenci</Label>
                <Select value={form.studentName} onValueChange={handleStudentChange}>
                  <SelectTrigger><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
                  <SelectContent>
                    {students.map((item) => <SelectItem key={item.username || item.fullName} value={item.fullName}>{item.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Input value={form.className} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Puan</Label>
                  <Input value={form.score} onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))} type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Net</Label>
                  <Input value={form.net} onChange={(e) => setForm((prev) => ({ ...prev, net: e.target.value }))} type="number" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className={form.dateLabel ? '' : 'text-muted-foreground'}>
                        {form.dateLabel || 'Tarih seçin'}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateCalendar
                      mode="single"
                      selected={form.dateValue ?? undefined}
                      onSelect={(value) => {
                        if (!value) return;
                        setForm((prev) => ({ ...prev, dateLabel: formatDateLabel(value), dateValue: value }));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreateExam} disabled={saving || !form.examTitle || !form.studentName || !form.score}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınav verileri alınamadı" message={error} onRetry={loadExams} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.total, 'Toplam Sonuç', FileQuestion, 'text-brand-primary'],
          [stats.completed, 'Tamamlanan', CheckCircle, 'text-green-600'],
          [stats.scheduled, 'Planlanan', Calendar, 'text-brand-primary'],
          [stats.avgScore, 'Ortalama', BarChart3, 'text-brand-accent'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <Input placeholder="Sınav ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </motion.div>

      <Tabs defaultValue="planned">
        <TabsList className="mb-4">
          <TabsTrigger value="planned">Yaklaşan Sınavlar</TabsTrigger>
          <TabsTrigger value="completed">Sonuçlar</TabsTrigger>
        </TabsList>
        <TabsContent value="planned" className="space-y-4">
          {plannedExams.map((exam, index) => (
            <motion.div key={`${exam.title}-${index}`} variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-sm transition-all hover:shadow-card-hover">
                <CardContent className="p-0">
                  <div className={`relative overflow-hidden bg-gradient-to-r ${subjectMeta(exam.subject).gradient} p-6 text-white`}>
                    <div className="absolute -right-3 -top-5 text-[88px] font-black leading-none text-white/10">
                      {subjectMeta(exam.subject).mark}
                    </div>
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                          {exam.subject}
                        </div>
                        <h3 className="text-2xl font-black leading-tight">{exam.title}</h3>
                        <p className="mt-2 text-sm text-white/85">{subjectMeta(exam.subject).tagline}</p>
                      </div>
                      <div className="rounded-3xl bg-white/12 px-4 py-3 text-right backdrop-blur">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Planlanan</div>
                        <div className="mt-1 text-base font-semibold">{exam.dateLabel || exam.date}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${subjectMeta(exam.subject).tint}`}>{exam.className}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{exam.type}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{exam.sourceType}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="text-sm text-muted-foreground">Soru Sayısı</div>
                        <div className="mt-2 text-2xl font-bold">{exam.questionCount}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="text-sm text-muted-foreground">Süre</div>
                        <div className="mt-2 text-2xl font-bold">{exam.duration}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="text-sm text-muted-foreground">İçerik</div>
                        <div className="mt-2 text-2xl font-bold">{exam.sources?.length || 0}</div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => deletePlannedExam(exam.id).then(() => setPlannedExams((prev) => prev.filter((item) => item.id !== exam.id)))}>Sil</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {plannedExams.length === 0 ? (
            <TeacherEmptyState
              variant="exam"
              accent="green"
              title="Henüz sınav oluşturulmamış"
              description="Öğrencilerin başarısını ölçmek için ilk sınavını oluştur ve değerlendirme sürecini başlat."
              primaryLabel="Sınav Oluştur"
              onPrimary={() => setPlannedOpen(true)}
              secondaryLabel="Sınav Şablonları"
              onSecondary={() => navigate('/t/question-bank')}
              tipDescription="Hazır soru kaynaklarını kullanarak hızlıca sınav oluşturabilir veya tamamen kendi sınavını tasarlayabilirsin."
            />
          ) : null}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          {groupedResults.map((exam, index) => (
            <motion.div key={exam.key || `${exam.title}-${index}`} variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-sm transition-all hover:shadow-card-hover">
                <CardContent className="p-0">
                  <div className={`relative overflow-hidden bg-gradient-to-r ${subjectMeta(exam.subject).gradient} p-6 text-white`}>
                    <div className="absolute -right-3 -top-5 text-[88px] font-black leading-none text-white/10">
                      {subjectMeta(exam.subject).mark}
                    </div>
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                          {decodeText(exam.subject)}
                        </div>
                        <h3 className="text-2xl font-black leading-tight">{decodeText(exam.title)}</h3>
                        <p className="mt-2 text-sm text-white/85">{exam.className} • {exam.dateLabel}</p>
                      </div>
                      <div className="rounded-3xl bg-white/12 px-4 py-3 text-right backdrop-blur">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">Ortalama</div>
                        <div className="mt-1 text-2xl font-black">{exam.averageScore}</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${subjectMeta(exam.subject).tint}`}>{decodeText(exam.type)}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{exam.participantCount} teslim</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Katılım
                        </div>
                        <div className="mt-2 text-2xl font-bold">{exam.participantCount}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Trophy className="h-4 w-4" />
                          En Yüksek
                        </div>
                        <div className="mt-2 text-2xl font-bold">{exam.highestScore}</div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Target className="h-4 w-4" />
                          Ortalama Net
                        </div>
                        <div className="mt-2 text-2xl font-bold">{exam.averageNet}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Teslim Edenler</p>
                          <p className="text-xs text-muted-foreground">Öğrencilerin puan ve net özeti</p>
                        </div>
                        <Badge variant="outline">{exam.items.length} kayıt</Badge>
                      </div>
                      <div className="space-y-2">
                        {exam.items.slice(0, 4).map((item) => (
                          <div key={`${item.studentName}-${item.date}-${item.score}`} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                            <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{decodeText(item.studentName)}</p>
                              <p className="text-xs text-muted-foreground">{item.net} net</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">{item.score}</p>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">puan</p>
                            </div>
                          </div>
                        ))}
                        {exam.items.length > 4 ? (
                          <p className="pt-1 text-xs text-muted-foreground">+{exam.items.length - 4} öğrenci daha</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => navigate('/t/exam-workbench')}>
                        Sonuçları Aç
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {groupedResults.length === 0 ? (
            <TeacherEmptyState
              variant="exam"
              accent="green"
              title="Henüz gösterilecek sonuç yok"
              description="Sınav sonuçları kaydedildiğinde başarı özetleri ve değerlendirme kayıtları burada görünecek."
              primaryLabel="Sonuç Gir"
              onPrimary={() => setCreateOpen(true)}
              secondaryLabel="Planlı Sınav"
              onSecondary={() => setPlannedOpen(true)}
              tipDescription="Sonuç girdikçe sınıf başarılarını ve öğrenci gelişimini bu ekrandan takip edebilirsin."
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
