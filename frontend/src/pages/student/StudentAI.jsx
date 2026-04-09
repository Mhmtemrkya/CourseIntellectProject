import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Send, Bot, User, BookOpen, Brain, Target, 
  Lightbulb, MessageSquare, Wand2, Loader2, Copy, ThumbsUp,
  ThumbsDown, RefreshCw, FileQuestion, Zap, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { GlowingOrb, FloatingParticles } from '../../components/animations/AnimatedBackground';
import { LoadingDots } from '../../components/animations/AnimatedIcon';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const suggestedPrompts = [
  { icon: Brain, text: 'Türev nedir ve nasıl hesaplanır?', category: 'Matematik' },
  { icon: Lightbulb, text: 'Newton\'un hareket yasalarını açıkla', category: 'Fizik' },
  { icon: Target, text: 'Bu haftaki sınava nasıl hazırlanmalıyım?', category: 'Strateji' },
  { icon: FileQuestion, text: 'Limit konusundan 5 soru çıkar', category: 'Soru Üret' },
];

const mockMessages = [
  {
    id: 1,
    role: 'assistant',
    content: 'Merhaba! 👋 Ben CourseIntellect AI, senin kişisel eğitim asistanınım. Sana derslerde yardımcı olabilir, konuları açıklayabilir ve sorularını yanıtlayabilirim. Bugün nasıl yardımcı olabilirim?',
    timestamp: new Date(),
  }
];

export default function StudentAI() {
  const [messages, setMessages] = useState(mockMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (will be replaced with actual API call)
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Bu harika bir soru! "${input}" konusunda sana yardımcı olmak için buradayım.\n\n**Not:** AI entegrasyonu yakında aktif edilecek. Şu an için demo modundayım. Gerçek API bağlantısı yapıldığında, sana detaylı ve kişiselleştirilmiş yanıtlar verebileceğim! 🚀`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-[calc(100vh-120px)] flex flex-col relative"
      data-testid="student-ai-page"
    >
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="#D9790B" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="#a855f7" size={250} className="bottom-20 left-20 opacity-20" />
        <FloatingParticles count={10} colors={['#D9790B', '#a855f7', '#3b82f6']} />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex items-center gap-4">
          <motion.div
            className="p-4 rounded-2xl bg-gradient-to-br from-[#D9790B] to-[#f59e0b] shadow-lg shadow-orange-500/30"
            animate={{ 
              boxShadow: [
                '0 10px 30px rgba(217, 121, 11, 0.3)',
                '0 10px 40px rgba(217, 121, 11, 0.5)',
                '0 10px 30px rgba(217, 121, 11, 0.3)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold font-heading bg-gradient-to-r from-[#D9790B] to-[#f59e0b] bg-clip-text text-transparent">
              CourseIntellect AI
            </h1>
            <p className="text-muted-foreground">Yapay zeka destekli kişisel eğitim asistanın</p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1">
            <Zap className="h-3 w-3 mr-1" /> Beta
          </Badge>
        </div>
      </motion.div>

      {/* Chat Area */}
      <motion.div variants={itemVariants} className="flex-1 flex gap-6 min-h-0">
        {/* Main Chat */}
        <Card className="flex-1 flex flex-col border-0 shadow-xl overflow-hidden">
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <motion.div
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                          : 'bg-gradient-to-br from-[#D9790B] to-[#f59e0b]'
                      }`}
                      whileHover={{ scale: 1.1 }}
                    >
                      {message.role === 'user' ? (
                        <User className="h-5 w-5 text-white" />
                      ) : (
                        <Bot className="h-5 w-5 text-white" />
                      )}
                    </motion.div>
                    <div
                      className={`flex-1 max-w-[80%] p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white ml-auto'
                          : 'bg-muted/50 border'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Copy className="h-3 w-3 mr-1" /> Kopyala
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <ThumbsUp className="h-3 w-3 mr-1" /> Faydalı
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" /> Yeniden
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D9790B] to-[#f59e0b] flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-muted/50 border rounded-2xl p-4">
                    <LoadingDots color="#D9790B" />
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Bir soru sor veya yardım iste..."
                  className="pr-12 h-12 text-base rounded-xl border-2 focus:border-[#D9790B] transition-colors"
                />
                <motion.div
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  animate={{ rotate: input ? [0, 10, -10, 0] : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Wand2 className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="h-12 px-6 bg-gradient-to-r from-[#D9790B] to-[#f59e0b] hover:from-[#c66a09] hover:to-[#d97706] rounded-xl"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </motion.div>
            </div>
          </div>
        </Card>

        {/* Sidebar */}
        <div className="w-80 space-y-4 hidden lg:block">
          {/* Suggested Prompts */}
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Önerilen Sorular
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestedPrompts.map((prompt, index) => (
                  <motion.button
                    key={index}
                    className="w-full p-3 rounded-xl text-left bg-muted/50 hover:bg-muted border border-transparent hover:border-[#D9790B]/30 transition-all group"
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePromptClick(prompt.text)}
                  >
                    <div className="flex items-start gap-2">
                      <prompt.icon className="h-4 w-4 mt-0.5 text-[#D9790B] group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-sm font-medium">{prompt.text}</p>
                        <Badge variant="outline" className="mt-1 text-xs">{prompt.category}</Badge>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Features */}
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-500" />
                  AI Özellikleri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Brain, label: 'Konu Açıklamaları', desc: 'Herhangi bir konuyu detaylı açıkla' },
                  { icon: FileQuestion, label: 'Soru Üretimi', desc: 'İstediğin konuda sorular oluştur' },
                  { icon: Target, label: 'Çalışma Planı', desc: 'Kişisel çalışma programı hazırla' },
                  { icon: MessageSquare, label: 'Soru Cevaplama', desc: 'Aklına takılan her şeyi sor' },
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    whileHover={{ x: 5 }}
                  >
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                      <feature.icon className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
