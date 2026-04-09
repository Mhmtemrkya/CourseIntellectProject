import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  HelpCircle,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare
} from 'lucide-react';
import { mockQuestions, mockTeachers } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { useToast } from '../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export default function Questions() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedQuestion, setSelectedQuestion] = useState(mockQuestions[0]);
  const [replyText, setReplyText] = useState('');

  const filteredQuestions = mockQuestions.filter((q) => {
    const matchesSearch = q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.studentName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || q.status === filter;
    return matchesSearch && matchesFilter;
  });

  const pendingCount = mockQuestions.filter(q => q.status === 'pending').length;
  const answeredCount = mockQuestions.filter(q => q.status === 'answered').length;

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    
    toast({
      title: "Yanıt gönderildi",
      description: `${selectedQuestion.studentName} adlı öğrenciye yanıtınız iletildi.`,
    });
    setReplyText('');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="questions-page"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Sorular</h1>
        <p className="text-muted-foreground mt-1">Öğrenci soruları ve yanıtlar</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-brand-accent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10">
              <Clock className="h-5 w-5 text-brand-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Bekleyen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{answeredCount}</p>
              <p className="text-xs text-muted-foreground">Yanıtlanan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Question List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Gelen Kutusu</CardTitle>
                <div className="flex gap-1">
                  <Button 
                    variant={filter === 'all' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setFilter('all')}
                    className={filter === 'all' ? 'bg-brand-primary' : ''}
                  >
                    Tümü
                  </Button>
                  <Button 
                    variant={filter === 'pending' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setFilter('pending')}
                    className={filter === 'pending' ? 'bg-brand-accent' : ''}
                  >
                    Bekleyen
                  </Button>
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-3 space-y-2">
                  {filteredQuestions.map((question) => (
                    <motion.div
                      key={question.id}
                      variants={itemVariants}
                      whileHover={{ x: 4 }}
                      onClick={() => setSelectedQuestion(question)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedQuestion?.id === question.id 
                          ? 'bg-brand-primary/10 border border-brand-primary/30' 
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`question-item-${question.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-brand-primary text-white text-xs">
                            {question.studentName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{question.studentName}</p>
                            {question.status === 'pending' && (
                              <Badge className="bg-brand-accent text-xs">Yeni</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">{question.question}</p>
                          <Badge variant="outline" className="mt-2 text-xs">{question.subject}</Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Question Detail */}
        <div className="lg:col-span-2">
          {selectedQuestion ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-brand-primary text-white">
                        {selectedQuestion.studentName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedQuestion.studentName}</p>
                      <p className="text-sm text-muted-foreground">{selectedQuestion.subject}</p>
                    </div>
                  </div>
                  <Badge className={selectedQuestion.status === 'pending' ? 'bg-brand-accent' : 'bg-green-500'}>
                    {selectedQuestion.status === 'pending' ? 'Bekliyor' : 'Yanıtlandı'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6 flex flex-col">
                {/* Question */}
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">Soru</span>
                    </div>
                    <p>{selectedQuestion.question}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(selectedQuestion.createdAt).toLocaleString('tr-TR')}
                    </p>
                  </div>

                  {/* Answer */}
                  {selectedQuestion.answer && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Yanıt</span>
                      </div>
                      <p>{selectedQuestion.answer}</p>
                    </div>
                  )}
                </div>

                {/* Reply Box */}
                {selectedQuestion.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t">
                    <Textarea
                      placeholder="Yanıtınızı yazın..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end mt-3">
                      <Button 
                        className="bg-brand-primary hover:bg-brand-primary/90"
                        onClick={handleSendReply}
                        disabled={!replyText.trim()}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Yanıtla
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Soru Seçin</h3>
                <p className="text-muted-foreground">Detayları görmek için sol listeden bir soru seçin.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
