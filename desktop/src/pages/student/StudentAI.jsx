import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, Bot, User, Brain, Target,
  Lightbulb, Wand2, Loader2, FileQuestion, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { GlowingOrb, FloatingParticles } from '../../components/animations/AnimatedBackground';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { createQuestionThread, fetchExamResults, fetchStaff, fetchStudents } from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function buildAssistantReply(input, context) {
  const avgScore = context.results.length
    ? Math.round(context.results.reduce((sum, item) => sum + Number(item.score || 0), 0) / context.results.length)
    : 0;
  const weakExam = [...context.results].sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0];
  const teacher = context.teachers[0]?.fullName || 'öğretmenin';

  return [
    `Sorunuzu aldım: "${input}"`,
    '',
    `Şu anki verilerinize göre ortalama puanınız ${avgScore}.`,
    weakExam ? `Daha çok destek gerektiren alan: ${weakExam.subject} / ${weakExam.title}.` : 'Henüz yeterli sınav verisi yok.',
    `İstersen bu soruyu doğrudan ${teacher} öğretmenine gönderebilirim.`,
    'Ayrıca kısa çalışma önerisi:',
    '- zayıf olduğunuz konudan 20 dakikalık tekrar',
    '- ardından 10 soruluk mini test',
    '- yanlışları not alıp öğretmene gönderme',
  ].join('\n');
}

export default function StudentAI() {
  const { user } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{
    id: 1,
    role: 'assistant',
    content: 'Merhaba. Ben CourseIntellect akıllı çalışma merkeziyim. Gerçek sınav ve profil verilerinize göre yönlendirme yapabilirim, istersen sorunu öğretmenine de iletebilirim.',
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [results, setResults] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const suggestedPrompts = useMemo(() => {
    const weakSubjects = [...new Set(results.filter((item) => Number(item.score || 0) < 70).map((item) => item.subject))];
    return [
      { text: `${weakSubjects[0] || 'Matematik'} konusunda bana çalışma planı çıkar`, category: 'Plan' },
      { text: 'Bu haftaki sınavlarım için nasıl hazırlanmalıyım?', category: 'Strateji' },
      { text: 'Yanlış yaptığım konuları özetle', category: 'Analiz' },
      { text: 'Bu soruyu öğretmenime gönder', category: 'Öğretmene İlet' },
    ];
  }, [results]);

  const context = useMemo(() => ({ teachers, results }), [teachers, results]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadContext = useCallback(async () => {
    const [students, teacherList] = await Promise.all([
      fetchStudents().catch(() => []),
      fetchStaff('Teacher').catch(() => []),
    ]);
    const currentStudent = students.find((item) => normalizeText(item.username) === normalizeText(user?.username))
      || students.find((item) => normalizeText(item.fullName) === normalizeText(user?.name));
    const examList = currentStudent ? await fetchExamResults({ studentName: currentStudent.fullName }).catch(() => []) : [];
    setTeachers(teacherList);
    setResults(examList);
  }, [user]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(async () => {
      const reply = buildAssistantReply(userText, context);
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);

      if (/ogretmen/i.test(normalizeText(userText)) && teachers[0]) {
        try {
          await createQuestionThread({
            title: 'AI Merkezi Üzerinden Soru',
            subject: results[0]?.subject || 'Genel',
            teacherName: teachers[0].fullName,
            questionText: userText,
            attachments: [],
          });
          toast({
            title: 'Soru öğretmene iletildi',
            description: `${teachers[0].fullName} için soru kaydı oluşturuldu.`,
          });
        } catch {
          toast({
            title: 'Soru iletilemedi',
            description: 'Öğretmene kayıt açılırken bir sorun oluştu.',
            variant: 'destructive',
          });
        }
      }
    }, 700);
  };

  const handleOpenTeacherQuestion = async () => {
    const teacher = teachers[0];
    const lastUserPrompt = [...messages].reverse().find((item) => item.role === 'user')?.content || 'AI üzerinden destek istiyorum.';

    if (!teacher) {
      toast({
        title: 'Öğretmen bulunamadı',
        description: 'Soruyu gönderebileceğimiz öğretmen kaydı şu an görünmüyor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createQuestionThread({
        title: 'AI yönlendirmeli soru',
        questionText: lastUserPrompt,
        teacherName: teacher.fullName,
        studentName: user?.name || 'Öğrenci',
      });
      toast({
        title: 'Soru oluşturuldu',
        description: `${teacher.fullName} öğretmenine soru kaydı açıldı.`,
      });
      navigate('/s/chat');
    } catch (err) {
      toast({
        title: 'Soru oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-[calc(100vh-120px)] flex flex-col relative" data-testid="student-ai-page">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="#D9790B" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="#a855f7" size={250} className="bottom-20 left-20 opacity-20" />
        <FloatingParticles count={10} colors={['#D9790B', '#a855f7', '#3b82f6']} />
      </div>

      <motion.div className="mb-6">
        <div className="flex items-center gap-4">
          <motion.div className="p-4 rounded-2xl bg-gradient-to-br from-[#D9790B] to-[#f59e0b] shadow-lg shadow-orange-500/30">
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold font-heading bg-gradient-to-r from-[#D9790B] to-[#f59e0b] bg-clip-text text-transparent">CourseIntellect AI</h1>
            <p className="text-muted-foreground">Gerçek verilerinle çalışan akıllı çalışma merkezi</p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1">
            <Zap className="h-3 w-3 mr-1" /> Akıllı Mod
          </Badge>
        </div>
      </motion.div>

      <motion.div className="flex-1 flex gap-6 min-h-0">
        <Card className="flex-1 flex flex-col border-0 shadow-xl overflow-hidden">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div key={message.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${message.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-gradient-to-br from-[#D9790B] to-[#f59e0b]'}`}>
                      {message.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                    </div>
                    <div className={`flex-1 max-w-[80%] p-4 rounded-2xl ${message.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white ml-auto' : 'bg-muted/50 border'}`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading ? (
                <motion.div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D9790B] to-[#f59e0b] flex items-center justify-center"><Bot className="h-5 w-5 text-white" /></div>
                  <div className="bg-muted/50 border rounded-2xl p-4"><LoadingDots color="#D9790B" /></div>
                </motion.div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()} placeholder="Bir soru sor veya yardım iste..." className="pr-12 h-12 text-base rounded-xl border-2 focus:border-[#D9790B] transition-colors" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2"><Wand2 className="h-5 w-5 text-muted-foreground" /></div>
              </div>
              <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="h-12 px-6 bg-gradient-to-r from-[#D9790B] to-[#f59e0b] hover:from-[#c66a09] hover:to-[#d97706] rounded-xl">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </Card>

        <div className="w-80 space-y-4 hidden lg:block">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />Önerilen İstekler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestedPrompts.map((prompt) => (
                <button key={prompt.text} className="w-full p-3 rounded-xl text-left bg-muted/50 hover:bg-muted border border-transparent hover:border-[#D9790B]/30 transition-all group" onClick={() => handlePromptClick(prompt.text)}>
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 mt-0.5 text-[#D9790B]" />
                    <div>
                      <p className="text-sm font-medium">{prompt.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{prompt.category}</p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-brand-accent" />Canlı Akademik Özet</CardTitle>
              <CardDescription>Gerçek sonuç verilerine göre</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm">Toplam Sonuç</span><Badge variant="outline">{results.length}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Düşük Sonuç</span><Badge variant="outline">{results.filter((item) => Number(item.score || 0) < 70).length}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm">Öğretmen</span><Badge variant="outline">{teachers[0]?.fullName || 'Yok'}</Badge></div>
              <Button variant="outline" className="w-full" onClick={handleOpenTeacherQuestion}><FileQuestion className="h-4 w-4 mr-2" />Öğretmene Soru Aç</Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  );
}
