import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Users, Video, ClipboardCheck, 
  HelpCircle, TrendingUp, BookOpen, Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockTeacherStats = {
  todayLessons: 4,
  pendingQuestions: 8,
  completedAttendance: 2,
  totalStudents: 120,
};

const mockTodaySchedule = [
  { time: '08:30-09:15', class: '10-A', subject: 'Matematik', room: 'A-101', status: 'completed' },
  { time: '09:25-10:10', class: '10-B', subject: 'Matematik', room: 'A-102', status: 'ongoing' },
  { time: '11:15-12:00', class: '11-A', subject: 'Matematik', room: 'A-101', status: 'upcoming' },
  { time: '14:00-14:45', class: '11-B', subject: 'Matematik', room: 'A-103', status: 'upcoming' },
];

const mockPendingQuestions = [
  { id: 1, student: 'Ali Yılmaz', question: 'Türev probleminde zincir kuralını anlayamadım...', time: '10 dk', class: '10-A' },
  { id: 2, student: 'Zeynep Kaya', question: 'İntegral hesaplamasında hangi yöntemi kullanmalıyım?', time: '30 dk', class: '11-A' },
  { id: 3, student: 'Can Arslan', question: 'Limit sorusunda yaklaşım nasıl yapılır?', time: '1 saat', class: '11-B' },
];

export default function TeacherDashboard() {
  const statusColors = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ongoing: 'bg-brand-accent/10 text-brand-accent',
    upcoming: 'bg-muted text-muted-foreground',
  };

  const statusLabels = {
    completed: 'Tamamlandı',
    ongoing: 'Devam Ediyor',
    upcoming: 'Bekliyor',
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="teacher-dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Hoş Geldiniz, Öğretmenim</h1>
        <p className="text-muted-foreground mt-1">Bugünkü programınız ve görevleriniz</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-primary">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bugünkü Ders</p>
                  <p className="text-3xl font-bold mt-2">{mockTeacherStats.todayLessons}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Calendar className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-brand-accent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen Soru</p>
                  <p className="text-3xl font-bold mt-2">{mockTeacherStats.pendingQuestions}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <HelpCircle className="h-6 w-6 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alınan Yoklama</p>
                  <p className="text-3xl font-bold mt-2">{mockTeacherStats.completedAttendance}/{mockTeacherStats.todayLessons}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <ClipboardCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Öğrenci</p>
                  <p className="text-3xl font-bold mt-2">{mockTeacherStats.totalStudents}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bugünkü Program</CardTitle>
                <CardDescription>Ders programınız</CardDescription>
              </div>
              <Button variant="outline" size="sm">Tam Takvim</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTodaySchedule.map((lesson, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-brand-accent/30 transition-all"
                >
                  <div className="flex-shrink-0 w-20 text-center">
                    <p className="text-sm font-bold text-brand-primary">{lesson.time.split('-')[0]}</p>
                    <p className="text-xs text-muted-foreground">{lesson.time.split('-')[1]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{lesson.subject}</h4>
                      <Badge variant="outline" className="text-xs">{lesson.class}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Derslik: {lesson.room}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[lesson.status]}>
                      {statusLabels[lesson.status]}
                    </Badge>
                    {lesson.status === 'ongoing' && (
                      <Button size="sm" className="bg-brand-accent hover:bg-brand-accent/90">
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Yoklama
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Questions */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-brand-accent" />
                  Bekleyen Sorular
                </CardTitle>
                <CardDescription>{mockPendingQuestions.length} soru yanıt bekliyor</CardDescription>
              </div>
              <Badge className="bg-brand-accent">{mockPendingQuestions.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockPendingQuestions.map((question) => (
                <motion.div
                  key={question.id}
                  variants={itemVariants}
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-brand-primary text-white text-sm">
                      {question.student.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{question.student}</p>
                      <span className="text-xs text-muted-foreground">{question.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{question.question}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{question.class}</Badge>
                  </div>
                </motion.div>
              ))}
              <Button variant="ghost" className="w-full text-brand-accent">
                Tüm Soruları Gör
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <ClipboardCheck className="h-6 w-6 text-brand-primary" />
                <span>Yoklama Al</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <Video className="h-6 w-6 text-brand-accent" />
                <span>Canlı Ders</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <BookOpen className="h-6 w-6 text-green-600" />
                <span>İçerik Yükle</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <HelpCircle className="h-6 w-6 text-blue-600" />
                <span>Soruları Yanıtla</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
