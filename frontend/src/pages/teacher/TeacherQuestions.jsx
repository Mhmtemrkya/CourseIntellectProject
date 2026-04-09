import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, MessageSquare, Clock, CheckCircle, Send, Search,
  Filter, User, Paperclip, Image as ImageIcon, X, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockQuestions = [
  { 
    id: 1, 
    student: { name: 'Ali Yılmaz', class: '10-A', avatar: null },
    subject: 'Türev',
    question: 'Hocam türev alırken zincir kuralını ne zaman kullanmamız gerekiyor? Özellikle iç içe fonksiyonlarda kafam karışıyor.',
    date: '2025-01-06T10:30:00',
    status: 'pending',
    hasAttachment: true,
  },
  { 
    id: 2, 
    student: { name: 'Ayşe Demir', class: '11-B', avatar: null },
    subject: 'İntegral',
    question: 'Belirsiz integral ile belirli integral arasındaki fark nedir? Sınav için hangisine daha çok çalışmalıyım?',
    date: '2025-01-06T09:15:00',
    status: 'pending',
    hasAttachment: false,
  },
  { 
    id: 3, 
    student: { name: 'Mehmet Kaya', class: '10-A', avatar: null },
    subject: 'Limit',
    question: 'Limitlerde belirsizlik durumlarını çözerken L\'Hospital kuralını ne zaman uygulamalıyız?',
    date: '2025-01-05T14:20:00',
    status: 'answered',
    hasAttachment: false,
    answer: 'L\'Hospital kuralı, 0/0 veya ∞/∞ belirsizlik durumlarında kullanılır. Pay ve paydanın ayrı ayrı türevini alarak limiti tekrar hesaplarsınız.',
  },
  { 
    id: 4, 
    student: { name: 'Zeynep Öztürk', class: '9-C', avatar: null },
    subject: 'Denklemler',
    question: '2. dereceden denklemlerde delta negatif olunca neden çözüm yok?',
    date: '2025-01-05T11:45:00',
    status: 'answered',
    hasAttachment: true,
    answer: 'Delta (Δ = b² - 4ac) negatif olduğunda, karekök içi negatif olur. Gerçek sayılarda negatif sayının karekökü tanımlı değildir, bu yüzden gerçek çözüm yoktur.',
  },
];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  answered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function TeacherQuestions() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState(mockQuestions);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         q.student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || q.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleAnswer = () => {
    if (!answerText.trim() || !selectedQuestion) return;
    
    setQuestions(prev => prev.map(q => 
      q.id === selectedQuestion.id 
        ? { ...q, status: 'answered', answer: answerText }
        : q
    ));
    
    toast({
      title: "Yanıt Gönderildi",
      description: `${selectedQuestion.student.name}'a yanıtınız iletildi.`,
    });
    
    setAnswerText('');
    setSelectedQuestion(null);
  };

  const stats = {
    pending: questions.filter(q => q.status === 'pending').length,
    answered: questions.filter(q => q.status === 'answered').length,
    avgResponseTime: '2.5 saat',
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Az önce';
    if (hours < 24) return `${hours} saat önce`;
    return date.toLocaleDateString('tr-TR');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-questions-page"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Soru Kutusu</h1>
        <p className="text-muted-foreground mt-1">Öğrencilerden gelen soruları yanıtlayın</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen Sorular</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Yanıtlanan</p>
                  <p className="text-3xl font-bold">{stats.answered}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ort. Yanıt Süresi</p>
                  <p className="text-3xl font-bold">{stats.avgResponseTime}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <MessageSquare className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <motion.div variants={itemVariants}>
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Sorular</CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Soru veya öğrenci ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="pending" className="flex-1">Bekleyen ({stats.pending})</TabsTrigger>
                  <TabsTrigger value="answered" className="flex-1">Yanıtlanan</TabsTrigger>
                  <TabsTrigger value="all" className="flex-1">Tümü</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2 pb-4">
              <AnimatePresence>
                {filteredQuestions.map((q) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedQuestion(q)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedQuestion?.id === q.id 
                        ? 'border-brand-primary bg-brand-primary/5' 
                        : 'border-border hover:border-brand-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={q.student.avatar} />
                        <AvatarFallback className="bg-brand-primary/10 text-brand-primary">
                          {q.student.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{q.student.name}</span>
                          <Badge className={statusColors[q.status]}>
                            {q.status === 'pending' ? 'Bekliyor' : 'Yanıtlandı'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{q.student.class} • {q.subject}</p>
                        <p className="text-sm mt-2 line-clamp-2">{q.question}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(q.date)}
                          {q.hasAttachment && (
                            <>
                              <span>•</span>
                              <Paperclip className="h-3 w-3" />
                              Ek dosya
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Answer Panel */}
        <motion.div variants={itemVariants}>
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle>Yanıt Paneli</CardTitle>
              <CardDescription>Seçili soruyu yanıtlayın</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {selectedQuestion ? (
                <>
                  <div className="flex-1 overflow-y-auto">
                    {/* Question Detail */}
                    <div className="p-4 rounded-xl bg-muted/50 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar>
                          <AvatarImage src={selectedQuestion.student.avatar} />
                          <AvatarFallback className="bg-brand-primary/10 text-brand-primary">
                            {selectedQuestion.student.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedQuestion.student.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedQuestion.student.class} • {selectedQuestion.subject}</p>
                        </div>
                      </div>
                      <p className="text-sm">{selectedQuestion.question}</p>
                      {selectedQuestion.hasAttachment && (
                        <div className="mt-3 p-3 rounded-lg bg-background border flex items-center gap-2">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm">soru_resmi.jpg</span>
                          <Button variant="ghost" size="sm" className="ml-auto">Görüntüle</Button>
                        </div>
                      )}
                    </div>

                    {/* Previous Answer if exists */}
                    {selectedQuestion.answer && (
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-400">Yanıtınız</span>
                        </div>
                        <p className="text-sm">{selectedQuestion.answer}</p>
                      </div>
                    )}
                  </div>

                  {/* Answer Input */}
                  {selectedQuestion.status === 'pending' && (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        placeholder="Yanıtınızı yazın..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        className="min-h-[120px]"
                      />
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm">
                          <Paperclip className="h-4 w-4 mr-2" />
                          Dosya Ekle
                        </Button>
                        <Button 
                          onClick={handleAnswer}
                          disabled={!answerText.trim()}
                          className="bg-brand-primary hover:bg-brand-primary/90"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Yanıtla
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <HelpCircle className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Yanıtlamak için bir soru seçin</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
