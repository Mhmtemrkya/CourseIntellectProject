import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileQuestion, Clock, CheckCircle, AlertCircle, Trophy,
  Calendar, Timer, ChevronRight, BarChart3, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockUpcomingExams = [
  { 
    id: 1, 
    name: 'Matematik Ara Sınav', 
    subject: 'Matematik', 
    date: '2025-01-15',
    time: '09:00',
    duration: 90,
    questions: 25,
    type: 'Ara Sınav'
  },
  { 
    id: 2, 
    name: 'Fizik Quiz 2', 
    subject: 'Fizik', 
    date: '2025-01-18',
    time: '10:30',
    duration: 30,
    questions: 10,
    type: 'Quiz'
  },
  { 
    id: 3, 
    name: 'Kimya Deneme', 
    subject: 'Kimya', 
    date: '2025-01-20',
    time: '14:00',
    duration: 120,
    questions: 40,
    type: 'Deneme'
  },
];

const mockCompletedExams = [
  { 
    id: 1, 
    name: 'Fizik Quiz 1', 
    subject: 'Fizik', 
    date: '2025-01-05',
    score: 85,
    correct: 17,
    wrong: 3,
    empty: 0,
    rank: 5,
    totalStudents: 28,
    avgScore: 72
  },
  { 
    id: 2, 
    name: 'Matematik Deneme 1', 
    subject: 'Matematik', 
    date: '2025-01-03',
    score: 78,
    correct: 31,
    wrong: 7,
    empty: 2,
    rank: 8,
    totalStudents: 28,
    avgScore: 68
  },
  { 
    id: 3, 
    name: 'Türkçe Quiz 1', 
    subject: 'Türkçe', 
    date: '2024-12-28',
    score: 92,
    correct: 23,
    wrong: 2,
    empty: 0,
    rank: 2,
    totalStudents: 28,
    avgScore: 75
  },
  { 
    id: 4, 
    name: 'Biyoloji Ara Sınav', 
    subject: 'Biyoloji', 
    date: '2024-12-20',
    score: 88,
    correct: 22,
    wrong: 3,
    empty: 0,
    rank: 4,
    totalStudents: 28,
    avgScore: 70
  },
];

const mockWeakTopics = [
  { subject: 'Matematik', topic: 'Türev Uygulamaları', score: 45 },
  { subject: 'Fizik', topic: 'Elektrik Devreleri', score: 52 },
  { subject: 'Kimya', topic: 'Organik Kimya', score: 58 },
];

export default function StudentExams() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedExam, setSelectedExam] = useState(null);

  const overallStats = {
    avgScore: Math.round(mockCompletedExams.reduce((acc, e) => acc + e.score, 0) / mockCompletedExams.length),
    totalExams: mockCompletedExams.length,
    bestSubject: 'Türkçe',
    improvement: '+5%'
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-exams-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınavlarım</h1>
          <p className="text-muted-foreground mt-1">Sınav takvimi ve sonuçlarınız</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <BarChart3 className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.avgScore}</p>
                <p className="text-sm text-muted-foreground">Ortalama Puan</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.totalExams}</p>
                <p className="text-sm text-muted-foreground">Tamamlanan</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-accent/10">
                <Trophy className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.bestSubject}</p>
                <p className="text-sm text-muted-foreground">En İyi Ders</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{overallStats.improvement}</p>
                <p className="text-sm text-muted-foreground">Gelişim</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="upcoming" onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="upcoming">
                <Calendar className="h-4 w-4 mr-2" />
                Yaklaşan ({mockUpcomingExams.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                <CheckCircle className="h-4 w-4 mr-2" />
                Tamamlanan ({mockCompletedExams.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {mockUpcomingExams.map((exam) => {
                const daysLeft = Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <motion.div key={exam.id} variants={itemVariants}>
                    <Card className="hover:shadow-card-hover transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{exam.subject}</Badge>
                              <Badge className="bg-brand-accent">{exam.type}</Badge>
                            </div>
                            <h3 className="font-semibold text-lg">{exam.name}</h3>
                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(exam.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {exam.time}
                              </span>
                              <span className="flex items-center gap-1">
                                <Timer className="h-4 w-4" />
                                {exam.duration} dk
                              </span>
                              <span className="flex items-center gap-1">
                                <FileQuestion className="h-4 w-4" />
                                {exam.questions} soru
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${daysLeft <= 3 ? 'text-red-500' : 'text-brand-primary'}`}>
                              {daysLeft} gün
                            </div>
                            <p className="text-sm text-muted-foreground">kaldı</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {mockCompletedExams.map((exam) => (
                <motion.div key={exam.id} variants={itemVariants}>
                  <Card 
                    className="hover:shadow-card-hover transition-all cursor-pointer"
                    onClick={() => setSelectedExam(selectedExam?.id === exam.id ? null : exam)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{exam.subject}</Badge>
                          </div>
                          <h3 className="font-semibold text-lg">{exam.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(exam.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${exam.score >= 80 ? 'text-green-600' : exam.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {exam.score}
                          </div>
                          <p className="text-sm text-muted-foreground">puan</p>
                        </div>
                      </div>

                      {selectedExam?.id === exam.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-4 border-t"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                              <p className="text-2xl font-bold text-green-600">{exam.correct}</p>
                              <p className="text-xs text-muted-foreground">Doğru</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                              <p className="text-2xl font-bold text-red-600">{exam.wrong}</p>
                              <p className="text-xs text-muted-foreground">Yanlış</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20">
                              <p className="text-2xl font-bold text-gray-600">{exam.empty}</p>
                              <p className="text-xs text-muted-foreground">Boş</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-brand-primary/10">
                              <p className="text-2xl font-bold text-brand-primary">{exam.rank}/{exam.totalStudents}</p>
                              <p className="text-xs text-muted-foreground">Sıralama</p>
                            </div>
                          </div>
                          <div className="mt-4 p-3 rounded-lg bg-muted">
                            <div className="flex justify-between text-sm mb-2">
                              <span>Sınıf Ortalaması: {exam.avgScore}</span>
                              <span className={exam.score > exam.avgScore ? 'text-green-600' : 'text-red-600'}>
                                {exam.score > exam.avgScore ? '+' : ''}{exam.score - exam.avgScore} fark
                              </span>
                            </div>
                            <Progress value={(exam.score / 100) * 100} className="h-2" />
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Weak Topics */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-brand-accent" />
                  Geliştirilmesi Gereken Konular
                </CardTitle>
                <CardDescription>Daha fazla çalışmanız gereken konular</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockWeakTopics.map((topic, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{topic.topic}</span>
                      <span className="text-muted-foreground">{topic.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={topic.score} className="h-2 flex-1" />
                      <span className="text-sm font-medium text-red-500">{topic.score}%</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-2">
                  <ChevronRight className="h-4 w-4 mr-2" />
                  İlgili İçeriklere Git
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Hızlı İşlemler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileQuestion className="h-4 w-4 mr-2" />
                  Deneme Sınavına Gir
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Detaylı Analiz
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Target className="h-4 w-4 mr-2" />
                  Hedef Belirle
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
