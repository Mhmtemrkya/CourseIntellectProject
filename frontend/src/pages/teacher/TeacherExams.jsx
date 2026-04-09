import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileQuestion, Plus, Search, Filter, BarChart3, Users, Clock,
  CheckCircle, Edit, Trash2, Copy, Eye, MoreVertical, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import { Label } from '../../components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
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

const mockExams = [
  { 
    id: 1, 
    title: 'Matematik 11 - Türev Denemesi', 
    subject: 'Matematik',
    grade: '11',
    questionCount: 40,
    duration: 60,
    date: '2025-01-15',
    status: 'scheduled',
    participants: 52,
    avgScore: null,
  },
  { 
    id: 2, 
    title: 'Matematik 10 - Polinomlar Quiz', 
    subject: 'Matematik',
    grade: '10',
    questionCount: 20,
    duration: 30,
    date: '2025-01-10',
    status: 'completed',
    participants: 48,
    avgScore: 72,
  },
  { 
    id: 3, 
    title: 'Matematik 9 - Denklemler Testi', 
    subject: 'Matematik',
    grade: '9',
    questionCount: 25,
    duration: 40,
    date: '2025-01-05',
    status: 'completed',
    participants: 55,
    avgScore: 68,
  },
  { 
    id: 4, 
    title: 'Matematik 11 - İntegral Denemesi', 
    subject: 'Matematik',
    grade: '11',
    questionCount: 40,
    duration: 60,
    date: '2025-01-20',
    status: 'draft',
    participants: 0,
    avgScore: null,
  },
];

const mockQuestionBank = [
  { id: 1, topic: 'Türev', difficulty: 'Kolay', used: 5 },
  { id: 2, topic: 'Türev', difficulty: 'Orta', used: 12 },
  { id: 3, topic: 'İntegral', difficulty: 'Zor', used: 3 },
  { id: 4, topic: 'Limit', difficulty: 'Orta', used: 8 },
];

const statusConfig = {
  draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  scheduled: { label: 'Planlandı', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  active: { label: 'Aktif', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Tamamlandı', color: 'bg-brand-primary/10 text-brand-primary' },
};

export default function TeacherExams() {
  const { toast } = useToast();
  const [exams, setExams] = useState(mockExams);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('exams');
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardStep, setWizardStep] = useState(1);

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: exams.length,
    completed: exams.filter(e => e.status === 'completed').length,
    scheduled: exams.filter(e => e.status === 'scheduled').length,
    avgScore: Math.round(exams.filter(e => e.avgScore).reduce((sum, e) => sum + e.avgScore, 0) / exams.filter(e => e.avgScore).length) || 0,
  };

  const handleCreateExam = () => {
    toast({
      title: "Sınav Oluşturuldu",
      description: "Yeni sınav başarıyla oluşturuldu.",
    });
    setCreateOpen(false);
    setWizardStep(1);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-exams-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlar</h1>
          <p className="text-muted-foreground mt-1">Sınav ve deneme oluşturun, sonuçları analiz edin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Sınav
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yeni Sınav Oluştur</DialogTitle>
            </DialogHeader>
            
            {/* Wizard Steps */}
            <div className="flex items-center justify-center gap-2 py-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    wizardStep >= step ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {step}
                  </div>
                  {step < 4 && (
                    <div className={`w-12 h-1 ${wizardStep > step ? 'bg-brand-primary' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="py-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Temel Bilgiler</h3>
                  <div className="space-y-2">
                    <Label>Sınav Adı</Label>
                    <Input placeholder="Örn: Matematik 11 - Türev Denemesi" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ders</Label>
                      <Select defaultValue="mat">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mat">Matematik</SelectItem>
                          <SelectItem value="fiz">Fizik</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sınıf</Label>
                      <Select defaultValue="11">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9">9. Sınıf</SelectItem>
                          <SelectItem value="10">10. Sınıf</SelectItem>
                          <SelectItem value="11">11. Sınıf</SelectItem>
                          <SelectItem value="12">12. Sınıf</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Soru Seçimi</h3>
                  <p className="text-sm text-muted-foreground">Soru bankasından soru seçin veya yeni soru ekleyin</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {mockQuestionBank.map((q) => (
                      <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-brand-primary/50 cursor-pointer">
                        <div>
                          <p className="font-medium">{q.topic}</p>
                          <p className="text-sm text-muted-foreground">{q.used} kez kullanıldı</p>
                        </div>
                        <Badge variant="outline">{q.difficulty}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Sınav Ayarları</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Süre (dk)</Label>
                      <Input type="number" defaultValue={60} />
                    </div>
                    <div className="space-y-2">
                      <Label>Soru Sayısı</Label>
                      <Input type="number" defaultValue={40} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tarih</Label>
                    <Input type="date" />
                  </div>
                </div>
              )}
              {wizardStep === 4 && (
                <div className="space-y-4 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
                  <h3 className="font-semibold text-lg">Sınav Hazır!</h3>
                  <p className="text-muted-foreground">Sınavınız oluşturulmaya hazır. Özet bilgileri kontrol edin.</p>
                  <div className="bg-muted/50 p-4 rounded-lg text-left">
                    <p><strong>Sınav:</strong> Matematik 11 - Türev Denemesi</p>
                    <p><strong>Soru Sayısı:</strong> 40</p>
                    <p><strong>Süre:</strong> 60 dakika</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                disabled={wizardStep === 1}
              >
                Geri
              </Button>
              {wizardStep < 4 ? (
                <Button onClick={() => setWizardStep(wizardStep + 1)}>
                  İleri
                </Button>
              ) : (
                <Button onClick={handleCreateExam} className="bg-brand-primary hover:bg-brand-primary/90">
                  Sınavı Oluştur
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Sınav</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <FileQuestion className="h-5 w-5 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tamamlanan</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Planlanmış</p>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ort. Başarı</p>
                  <p className="text-2xl font-bold">%{stats.avgScore}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <BarChart3 className="h-5 w-5 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search */}
      <motion.div variants={itemVariants} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sınav ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Exams List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Sınavlarım</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <AnimatePresence>
                {filteredExams.map((exam, idx) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-brand-primary/10">
                        <FileQuestion className="h-6 w-6 text-brand-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{exam.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{exam.questionCount} soru</span>
                          <span>•</span>
                          <span>{exam.duration} dk</span>
                          <span>•</span>
                          <span>{new Date(exam.date).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {exam.avgScore !== null && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Ort. Puan</p>
                          <p className="font-bold text-lg">{exam.avgScore}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge className={statusConfig[exam.status].color}>
                          {statusConfig[exam.status].label}
                        </Badge>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {exam.participants}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Detaylar</DropdownMenuItem>
                          <DropdownMenuItem><BarChart3 className="h-4 w-4 mr-2" /> Sonuçlar</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                          <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Kopyala</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Sil</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
