import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  GraduationCap, 
  School, 
  ClipboardCheck,
  HelpCircle,
  FileQuestion,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { mockDashboardStats, mockTodayLessons, mockActivities, mockQuestions } from '../lib/mockData';

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

function CountUp({ end, duration = 1000 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count}</span>;
}

function StatCard({ title, value, icon: Icon, trend, color }) {
  return (
    <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
      <Card className="relative overflow-hidden group hover:shadow-card-hover transition-all duration-300 border-l-4" style={{ borderLeftColor: color }}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className="text-3xl font-bold mt-2 font-heading">
                <CountUp end={value} />
              </p>
              {trend && (
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">{trend}</span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${color}15` }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
          </div>
        </CardContent>
        <div 
          className="absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
          style={{ backgroundColor: color }}
        />
      </Card>
    </motion.div>
  );
}

function LessonCard({ lesson }) {
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
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-brand-accent/30 transition-all"
    >
      <div className="flex-shrink-0 w-16 text-center">
        <p className="text-lg font-bold text-brand-primary">{lesson.time.split('-')[0]}</p>
        <p className="text-xs text-muted-foreground">Başlangıç</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold truncate">{lesson.subject}</h4>
          <Badge variant="outline" className="text-xs">{lesson.class}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{lesson.teacher} • {lesson.room}</p>
      </div>
      <Badge className={statusColors[lesson.status]}>
        {statusLabels[lesson.status]}
      </Badge>
    </motion.div>
  );
}

function ActivityItem({ activity }) {
  const iconMap = {
    check: CheckCircle2,
    help: HelpCircle,
    upload: ArrowUpRight,
    file: FileQuestion,
    user: Users,
  };
  const Icon = iconMap[activity.icon] || AlertCircle;

  return (
    <motion.div variants={itemVariants} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{activity.message}</p>
        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const pendingQuestions = mockQuestions.filter(q => q.status === 'pending');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="dashboard-page"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Hoş geldiniz! İşte bugünkü özet.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Toplam Öğrenci"
          value={mockDashboardStats.totalStudents}
          icon={Users}
          trend="+12%"
          color="#00354F"
        />
        <StatCard
          title="Toplam Öğretmen"
          value={mockDashboardStats.totalTeachers}
          icon={GraduationCap}
          color="#D9790B"
        />
        <StatCard
          title="Aktif Sınıf"
          value={mockDashboardStats.totalClasses}
          icon={School}
          color="#10B981"
        />
        <StatCard
          title="Bugünkü Devam"
          value={mockDashboardStats.todayAttendance}
          icon={ClipboardCheck}
          trend="+2%"
          color="#3B82F6"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Lessons */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Bugünkü Dersler</CardTitle>
                <CardDescription>Güncel ders programınız</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Takvim
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTodayLessons.map((lesson, index) => (
                <LessonCard key={index} lesson={lesson} />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Questions */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Bekleyen Sorular</CardTitle>
                <CardDescription>{pendingQuestions.length} soru yanıt bekliyor</CardDescription>
              </div>
              <Badge variant="default" className="bg-brand-accent">
                {pendingQuestions.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingQuestions.slice(0, 3).map((question) => (
                <div key={question.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-primary text-white text-xs">
                      {question.studentName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{question.studentName}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{question.question}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{question.subject}</Badge>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-brand-accent">
                Tümünü Gör
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Son Aktiviteler</CardTitle>
              <CardDescription>Sistemdeki son hareketler</CardDescription>
            </CardHeader>
            <CardContent>
              {mockActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Hızlı İstatistikler</CardTitle>
              <CardDescription>Bu haftanın özeti</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Haftalık Devam Oranı</span>
                  <span className="text-sm font-bold">94%</span>
                </div>
                <Progress value={94} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Yanıtlanan Sorular</span>
                  <span className="text-sm font-bold">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">İçerik Tamamlama</span>
                  <span className="text-sm font-bold">65%</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Sınav Performansı</span>
                  <span className="text-sm font-bold">82%</span>
                </div>
                <Progress value={82} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
