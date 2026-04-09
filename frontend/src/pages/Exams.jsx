import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileQuestion,
  ClipboardList,
  BarChart3,
  Edit,
  Trash2,
  Play,
  Eye,
  MoreHorizontal,
  Calendar,
  Clock,
  Users
} from 'lucide-react';
import { mockExams, mockQuestionBank, mockClasses } from '../lib/mockData';
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
import { Textarea } from '../components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-muted text-muted-foreground',
};

const statusLabels = {
  scheduled: 'Planlandı',
  completed: 'Tamamlandı',
  draft: 'Taslak',
};

const difficultyColors = {
  'Kolay': 'bg-green-100 text-green-700',
  'Orta': 'bg-yellow-100 text-yellow-700',
  'Zor': 'bg-red-100 text-red-700',
};

function AddQuestionDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Soru Ekle</DialogTitle>
          <DialogDescription>Soru bankasına yeni soru ekleyin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Konu</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Konu seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matematik">Matematik</SelectItem>
                  <SelectItem value="Fizik">Fizik</SelectItem>
                  <SelectItem value="Kimya">Kimya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zorluk</Label>
              <Select>
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
          </div>
          <div className="space-y-2">
            <Label>Soru</Label>
            <Textarea placeholder="Soruyu yazın..." />
          </div>
          <div className="space-y-2">
            <Label>Seçenekler</Label>
            <div className="space-y-2">
              {['A', 'B', 'C', 'D'].map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <Badge variant="outline">{opt}</Badge>
                  <Input placeholder={`${opt} seçeneği`} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Doğru Cevap</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Doğru cevabı seçin" />
              </SelectTrigger>
              <SelectContent>
                {['A', 'B', 'C', 'D'].map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Exams() {
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="exams-page"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
        <p className="text-muted-foreground mt-1">Sınav ve soru yönetimi</p>
      </div>

      <Tabs defaultValue="exams" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4" />
            Soru Bankası
          </TabsTrigger>
          <TabsTrigger value="exams" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Sınavlar
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Sonuçlar
          </TabsTrigger>
        </TabsList>

        {/* Question Bank Tab */}
        <TabsContent value="questions" className="space-y-6">
          <div className="flex justify-end">
            <Button 
              className="bg-brand-primary hover:bg-brand-primary/90"
              onClick={() => setQuestionDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Yeni Soru
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockQuestionBank.map((question, index) => (
              <motion.div key={question.id} variants={itemVariants}>
                <Card className="hover:shadow-card-hover transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex gap-2">
                        <Badge variant="outline">{question.subject}</Badge>
                        <Badge variant="outline">{question.topic}</Badge>
                        <Badge className={difficultyColors[question.difficulty]}>{question.difficulty}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Sil</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm mb-3">{question.question}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {question.options.map((opt, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded-lg ${i === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 border border-green-300' : 'bg-muted'}`}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + i)})</span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams" className="space-y-6">
          <div className="flex justify-end">
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sınav
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockExams.map((exam) => (
              <motion.div key={exam.id} variants={itemVariants}>
                <Card className="hover:shadow-card-hover transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Badge className={statusColors[exam.status]}>{statusLabels[exam.status]}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Görüntüle</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                          {exam.status === 'scheduled' && (
                            <DropdownMenuItem><Play className="h-4 w-4 mr-2" /> Başlat</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="mt-2">{exam.name}</CardTitle>
                    <CardDescription>{exam.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{exam.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{exam.duration} dakika</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <FileQuestion className="h-4 w-4 text-muted-foreground" />
                        <span>{exam.questionCount} soru</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{exam.class}</span>
                      </div>
                      {exam.avgScore && (
                        <div className="pt-3 border-t">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Ortalama Puan</span>
                            <span className="font-bold">{exam.avgScore}</span>
                          </div>
                          <Progress value={exam.avgScore} className="h-2" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Genel Performans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-brand-primary">78%</p>
                    <p className="text-sm text-muted-foreground mt-1">Ortalama Başarı</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>En Yüksek</span>
                      <span className="font-bold text-green-600">95%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>En Düşük</span>
                      <span className="font-bold text-red-600">42%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Konu Bazlı Analiz</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {['Matematik', 'Fizik', 'Kimya'].map((subject, index) => (
                    <div key={subject}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{subject}</span>
                        <span>{[82, 75, 71][index]}%</span>
                      </div>
                      <Progress value={[82, 75, 71][index]} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Son Sınavlar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockExams.filter(e => e.status === 'completed').map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <div>
                        <p className="text-sm font-medium">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">{exam.class}</p>
                      </div>
                      <Badge variant="outline">{exam.avgScore}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>

      <AddQuestionDialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen} />
    </motion.div>
  );
}
