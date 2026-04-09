import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Search, Filter, Plus, Edit, Trash2, Eye, CheckCircle,
  Star, Trophy, Zap, Target, ChevronRight, BookOpen, Shuffle,
  BarChart3, Flame, Award, Lightbulb, Upload, Download, Copy,
  Tag, FileQuestion, Clock, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { GlowingOrb } from '../../components/animations/AnimatedBackground';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const subjects = [
  { id: 'mat', name: 'Matematik', icon: '📐', color: '#3b82f6', questions: 120 },
  { id: 'fiz', name: 'Fizik', icon: '⚡', color: '#ef4444', questions: 85 },
  { id: 'kim', name: 'Kimya', icon: '🧪', color: '#10b981', questions: 64 },
  { id: 'bio', name: 'Biyoloji', icon: '🧬', color: '#8b5cf6', questions: 92 },
];

const mockQuestions = [
  { 
    id: 1, 
    question: 'f(x) = x³ + 2x² - 5x + 3 fonksiyonunun türevini bulunuz.',
    subject: 'Matematik',
    topic: 'Türev',
    difficulty: 'Orta',
    type: 'Açık Uçlu',
    usageCount: 45,
    correctRate: 68,
    createdAt: '2025-01-05',
    tags: ['türev', 'polinom', '11. sınıf']
  },
  { 
    id: 2, 
    question: 'Newton\'un birinci hareket yasası nedir? Örneklerle açıklayınız.',
    subject: 'Fizik',
    topic: 'Newton Yasaları',
    difficulty: 'Kolay',
    type: 'Açık Uçlu',
    usageCount: 78,
    correctRate: 82,
    createdAt: '2025-01-03',
    tags: ['newton', 'hareket', '9. sınıf']
  },
  { 
    id: 3, 
    question: 'Limit hesapla: lim(x→0) (sin x) / x',
    subject: 'Matematik',
    topic: 'Limit',
    difficulty: 'Zor',
    type: 'Çoktan Seçmeli',
    usageCount: 123,
    correctRate: 45,
    createdAt: '2025-01-01',
    tags: ['limit', 'trigonometri', '12. sınıf']
  },
  { 
    id: 4, 
    question: 'Organik kimyada alkanların genel formülü nedir?',
    subject: 'Kimya',
    topic: 'Organik Kimya',
    difficulty: 'Kolay',
    type: 'Çoktan Seçmeli',
    usageCount: 56,
    correctRate: 91,
    createdAt: '2024-12-28',
    tags: ['organik', 'alkanlar', '11. sınıf']
  },
];

const difficultyColors = {
  'Kolay': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Orta': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Zor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function TeacherQuestionBank() {
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState(mockQuestions);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    subject: '',
    topic: '',
    difficulty: '',
    type: '',
    tags: ''
  });

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(search.toLowerCase()) ||
                         q.topic.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || q.subject === subjects.find(s => s.id === selectedSubject)?.name;
    return matchesSearch && matchesSubject;
  });

  const totalQuestions = subjects.reduce((sum, s) => sum + s.questions, 0);

  const handleAddQuestion = () => {
    if (!newQuestion.question || !newQuestion.subject || !newQuestion.topic) {
      toast({
        title: "Hata",
        description: "Lütfen gerekli alanları doldurun.",
        variant: "destructive"
      });
      return;
    }

    const newQ = {
      id: questions.length + 1,
      ...newQuestion,
      tags: newQuestion.tags.split(',').map(t => t.trim()),
      usageCount: 0,
      correctRate: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setQuestions([newQ, ...questions]);
    setShowAddDialog(false);
    setNewQuestion({ question: '', subject: '', topic: '', difficulty: '', type: '', tags: '' });
    
    toast({
      title: "Soru Eklendi",
      description: "Yeni soru başarıyla soru bankasına eklendi.",
    });
  };

  const handleDeleteQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
    toast({
      title: "Soru Silindi",
      description: "Soru soru bankasından kaldırıldı.",
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="teacher-question-bank-page"
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="#3b82f6" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="#8b5cf6" size={250} className="bottom-20 left-20 opacity-20" />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold font-heading">Soru Bankası</h1>
              <p className="text-muted-foreground">Soru ekle, düzenle ve yönet</p>
            </div>
          </div>
          <div className="flex gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white">
                <Upload className="h-4 w-4 mr-2" />
                İçe Aktar
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white">
                <Download className="h-4 w-4 mr-2" />
                Dışa Aktar
              </Button>
            </motion.div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Soru Ekle
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Yeni Soru Ekle</DialogTitle>
                  <DialogDescription>Soru bankasına yeni bir soru ekleyin</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Soru Metni</Label>
                    <Textarea
                      placeholder="Sorunuzu buraya yazın..."
                      value={newQuestion.question}
                      onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ders</Label>
                      <Select value={newQuestion.subject} onValueChange={(v) => setNewQuestion({...newQuestion, subject: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ders seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.icon} {s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Konu</Label>
                      <Input
                        placeholder="Örn: Türev"
                        value={newQuestion.topic}
                        onChange={(e) => setNewQuestion({...newQuestion, topic: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Zorluk</Label>
                      <Select value={newQuestion.difficulty} onValueChange={(v) => setNewQuestion({...newQuestion, difficulty: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Zorluk seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kolay">Kolay</SelectItem>
                          <SelectItem value="Orta">Orta</SelectItem>
                          <SelectItem value="Zor">Zor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Soru Tipi</Label>
                      <Select value={newQuestion.type} onValueChange={(v) => setNewQuestion({...newQuestion, type: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tip seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Çoktan Seçmeli">Çoktan Seçmeli</SelectItem>
                          <SelectItem value="Açık Uçlu">Açık Uçlu</SelectItem>
                          <SelectItem value="Doğru/Yanlış">Doğru/Yanlış</SelectItem>
                          <SelectItem value="Eşleştirme">Eşleştirme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Etiketler (virgülle ayırın)</Label>
                    <Input
                      placeholder="türev, polinom, 11. sınıf"
                      value={newQuestion.tags}
                      onChange={(e) => setNewQuestion({...newQuestion, tags: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
                  <Button onClick={handleAddQuestion} className="bg-brand-primary hover:bg-brand-primary/90 text-white">Soru Ekle</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Soru', value: totalQuestions, icon: FileQuestion, color: 'from-blue-500 to-cyan-500' },
          { label: 'Bu Ay Eklenen', value: 24, icon: Plus, color: 'from-green-500 to-emerald-500' },
          { label: 'Kullanım Oranı', value: 85, suffix: '%', icon: Target, color: 'from-purple-500 to-pink-500' },
          { label: 'Ort. Başarı', value: 72, suffix: '%', icon: Trophy, color: 'from-yellow-500 to-orange-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold">{stat.value}</span>
                      {stat.suffix && <span className="text-xl font-bold">{stat.suffix}</span>}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Subject Selection */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#D9790B]" />
              Dersler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {subjects.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSubject(selectedSubject === subject.id ? 'all' : subject.id)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    selectedSubject === subject.id
                      ? 'border-[#D9790B] bg-[#D9790B]/10 shadow-lg shadow-orange-500/20'
                      : 'border-border hover:border-[#D9790B]/50'
                  }`}
                >
                  <div className="text-center">
                    <motion.span
                      className="text-4xl block mb-2"
                      animate={selectedSubject === subject.id ? { rotate: [0, -10, 10, 0] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {subject.icon}
                    </motion.span>
                    <p className="font-semibold">{subject.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{subject.questions} soru</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Soru veya konu ara..."
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </motion.div>

      {/* Questions List */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Sorular ({filteredQuestions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AnimatePresence>
                {filteredQuestions.map((q, index) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl border hover:border-brand-primary/50 hover:shadow-md transition-all bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{q.subject}</Badge>
                          <Badge className={difficultyColors[q.difficulty]}>{q.difficulty}</Badge>
                          <Badge variant="secondary">{q.type}</Badge>
                        </div>
                        <p className="font-medium mb-2">{q.question}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {q.topic}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {q.usageCount} kullanım
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            %{q.correctRate} başarı
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {q.createdAt}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {q.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-blue-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteQuestion(q.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
