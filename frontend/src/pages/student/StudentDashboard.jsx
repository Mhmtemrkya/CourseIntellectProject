import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, BookOpen, FileQuestion, Bell, Clock, Video, TrendingUp, 
  CheckCircle, Star, Flame, Trophy, Target, Zap, Brain, Sparkles,
  Play, ChevronRight, Award, Rocket, Gift
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  BouncingCard, GlowCard, TiltCard, StaggeredList, staggeredItemVariants 
} from '../../components/animations/AnimatedCard';
import { 
  AnimatedCounter, CircularProgress, XPBar, StreakCounter 
} from '../../components/animations/AnimatedCounter';
import { 
  FloatingIcon, PulsingIcon, WiggleIcon, AttentionIcon 
} from '../../components/animations/AnimatedIcon';
import { FloatingParticles, GlowingOrb, Confetti } from '../../components/animations/AnimatedBackground';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 15 }
  },
};

const mockStudentStats = {
  todayLessons: 5,
  upcomingExams: 2,
  completedContent: 68,
  pendingAssignments: 3,
  streak: 5,
  xp: 1250,
  level: 12,
  xpToNext: 750,
  rank: 5,
  totalStudents: 128,
};

const mockTodaySchedule = [
  { time: '08:30', subject: 'Matematik', teacher: 'Dr. Hasan Yıldız', room: 'A-101', status: 'completed', color: '#3b82f6' },
  { time: '09:25', subject: 'Fizik', teacher: 'Aylin Güneş', room: 'Lab-1', status: 'ongoing', color: '#ef4444' },
  { time: '10:20', subject: 'Türkçe', teacher: 'Kemal Eren', room: 'A-101', status: 'upcoming', color: '#8b5cf6' },
  { time: '11:15', subject: 'Kimya', teacher: 'Osman Akça', room: 'Lab-2', status: 'upcoming', color: '#10b981' },
];

const mockUpcomingExams = [
  { subject: 'Matematik', date: '2025-01-15', type: 'Ara Sınav', icon: Target },
  { subject: 'Fizik', date: '2025-01-20', type: 'Quiz', icon: Zap },
];

const mockRecentResults = [
  { subject: 'Matematik', score: 85, date: '2025-01-05', type: 'Deneme' },
  { subject: 'Fizik', score: 78, date: '2025-01-03', type: 'Quiz' },
];

const mockAchievements = [
  { id: 1, name: 'İlk Adım', icon: Rocket, unlocked: true, description: 'İlk dersini tamamladın!' },
  { id: 2, name: 'Quiz Ustası', icon: Brain, unlocked: true, description: '10 quiz tamamladın!' },
  { id: 3, name: 'Ateş Serisi', icon: Flame, unlocked: true, description: '5 gün üst üste giriş yaptın!' },
  { id: 4, name: 'Matematik Dehası', icon: Award, unlocked: false, description: '%90 üzeri puan al' },
];

export default function StudentDashboard() {
  const [showConfetti, setShowConfetti] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Günaydın');
    else if (hour < 18) setGreeting('İyi günler');
    else setGreeting('İyi akşamlar');
  }, []);

  const statusConfig = {
    completed: { 
      bg: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20', 
      text: 'text-green-400',
      border: 'border-green-500/30',
      label: 'Tamamlandı',
      icon: CheckCircle
    },
    ongoing: { 
      bg: 'bg-gradient-to-r from-orange-500/20 to-red-500/20', 
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      label: 'Devam Ediyor',
      icon: Play
    },
    upcoming: { 
      bg: 'bg-gradient-to-r from-slate-500/20 to-gray-500/20', 
      text: 'text-slate-400',
      border: 'border-slate-500/30',
      label: 'Bekliyor',
      icon: Clock
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="student-dashboard-page"
    >
      <Confetti active={showConfetti} />
      
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="#D9790B" size={400} className="top-0 right-0 opacity-30" />
        <GlowingOrb color="#3b82f6" size={300} className="bottom-0 left-0 opacity-20" />
      </div>

      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-2"
            >
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                className="text-4xl"
              >
                👋
              </motion.span>
              <h1 className="text-3xl lg:text-4xl font-bold font-heading bg-gradient-to-r from-[#00354F] to-[#D9790B] bg-clip-text text-transparent dark:from-white dark:to-[#D9790B]">
                {greeting}, Ali!
              </h1>
            </motion.div>
            <p className="text-muted-foreground text-lg">Bugün harika şeyler öğrenmeye hazır mısın?</p>
          </div>
          
          {/* Gamification Stats */}
          <motion.div 
            className="flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <StreakCounter streak={mockStudentStats.streak} />
            
            <motion.div 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 border border-yellow-300 dark:border-yellow-700"
              whileHover={{ scale: 1.05 }}
            >
              <Trophy className="h-5 w-5 text-yellow-600" />
              <span className="font-bold text-yellow-700 dark:text-yellow-400">
                #{mockStudentStats.rank}
              </span>
              <span className="text-sm text-yellow-600 dark:text-yellow-500">/ {mockStudentStats.totalStudents}</span>
            </motion.div>
          </motion.div>
        </div>
        
        {/* XP Progress Bar */}
        <motion.div 
          variants={itemVariants}
          className="mt-6"
        >
          <XPBar 
            current={mockStudentStats.xp} 
            max={mockStudentStats.xp + mockStudentStats.xpToNext} 
            level={mockStudentStats.level} 
          />
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { 
            label: 'Bugünkü Ders', 
            value: mockStudentStats.todayLessons, 
            icon: Calendar, 
            color: '#3b82f6',
            gradient: 'from-blue-500 to-cyan-500'
          },
          { 
            label: 'Yaklaşan Sınav', 
            value: mockStudentStats.upcomingExams, 
            icon: Target, 
            color: '#a855f7',
            gradient: 'from-purple-500 to-pink-500'
          },
          { 
            label: 'İçerik İlerlemesi', 
            value: mockStudentStats.completedContent, 
            suffix: '%',
            icon: BookOpen, 
            color: '#22c55e',
            gradient: 'from-green-500 to-emerald-500'
          },
          { 
            label: 'Bekleyen Ödev', 
            value: mockStudentStats.pendingAssignments, 
            icon: Clock, 
            color: '#f59e0b',
            gradient: 'from-yellow-500 to-orange-500'
          },
        ].map((stat, index) => (
          <BouncingCard key={stat.label} delay={index * 0.1}>
            <TiltCard maxTilt={5}>
              <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
                <CardContent className="p-6 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                      <div className="flex items-baseline gap-1 mt-2">
                        <AnimatedCounter 
                          value={stat.value} 
                          className="text-4xl font-bold"
                          duration={1.5}
                        />
                        {stat.suffix && <span className="text-2xl font-bold">{stat.suffix}</span>}
                      </div>
                    </div>
                    <motion.div 
                      className={`p-4 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <stat.icon className="h-7 w-7 text-white" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </TiltCard>
          </BouncingCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#00354F] to-[#003d5c] text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Calendar className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <CardTitle className="text-white">Bugünkü Dersler</CardTitle>
                    <CardDescription className="text-white/70">Günlük ders programın</CardDescription>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-0">
                  {mockTodaySchedule.filter(l => l.status === 'completed').length}/{mockTodaySchedule.length} Tamamlandı
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <AnimatePresence>
                {mockTodaySchedule.map((lesson, index) => {
                  const config = statusConfig[lesson.status];
                  const StatusIcon = config.icon;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 10 }}
                      className={`flex items-center gap-4 p-4 rounded-xl ${config.bg} border ${config.border} cursor-pointer transition-all`}
                    >
                      <motion.div 
                        className="flex-shrink-0 w-16 text-center"
                        animate={lesson.status === 'ongoing' ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <p className="text-lg font-bold" style={{ color: lesson.color }}>{lesson.time}</p>
                      </motion.div>
                      
                      <div 
                        className="w-1 h-12 rounded-full"
                        style={{ backgroundColor: lesson.color }}
                      />
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{lesson.subject}</h4>
                        <p className="text-sm text-muted-foreground">{lesson.teacher} • {lesson.room}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.bg} ${config.text} border-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {lesson.status === 'ongoing' && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Button size="sm" className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                              <Video className="h-4 w-4 mr-1" /> Katıl
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Ring & Quick Actions */}
        <div className="space-y-6">
          {/* Overall Progress */}
          <motion.div variants={itemVariants}>
            <GlowCard glowColor="#D9790B">
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#D9790B]" />
                    Genel İlerleme
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center py-6">
                  <CircularProgress 
                    value={mockStudentStats.completedContent} 
                    size={140}
                    strokeWidth={12}
                    color="#D9790B"
                    label="Tamamlandı"
                  />
                  <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                    <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                      <p className="text-2xl font-bold text-green-600">24</p>
                      <p className="text-xs text-muted-foreground">Video İzlendi</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                      <p className="text-2xl font-bold text-blue-600">18</p>
                      <p className="text-xs text-muted-foreground">Quiz Çözüldü</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </GlowCard>
          </motion.div>

          {/* Upcoming Exams */}
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                  <AttentionIcon icon={Target} color="#a855f7" size={20} />
                  Yaklaşan Sınavlar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockUpcomingExams.map((exam, index) => {
                  const daysLeft = Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24));
                  const ExamIcon = exam.icon;
                  
                  return (
                    <motion.div 
                      key={index} 
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800"
                      whileHover={{ scale: 1.02, x: 5 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                          <ExamIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{exam.subject}</p>
                          <p className="text-sm text-muted-foreground">{exam.type}</p>
                        </div>
                      </div>
                      <motion.div 
                        className={`text-center px-3 py-1 rounded-lg ${daysLeft <= 3 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}
                        animate={daysLeft <= 3 ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <p className={`text-lg font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-purple-600'}`}>{daysLeft}</p>
                        <p className="text-xs text-muted-foreground">gün</p>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Achievements Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Trophy className="h-6 w-6 text-white" />
                </motion.div>
                <CardTitle className="text-white">Başarılar</CardTitle>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                {mockAchievements.filter(a => a.unlocked).length}/{mockAchievements.length} Açıldı
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockAchievements.map((achievement, index) => {
                const AchievementIcon = achievement.icon;
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className={`relative p-4 rounded-xl text-center cursor-pointer transition-all ${
                      achievement.unlocked 
                        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-700' 
                        : 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 opacity-60'
                    }`}
                    onClick={() => achievement.unlocked && setShowConfetti(true)}
                  >
                    <motion.div
                      className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        achievement.unlocked 
                          ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      animate={achievement.unlocked ? { rotate: [0, 5, -5, 0] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <AchievementIcon className={`h-6 w-6 ${achievement.unlocked ? 'text-white' : 'text-gray-500'}`} />
                    </motion.div>
                    <p className="font-semibold text-sm">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                    {achievement.unlocked && (
                      <motion.div
                        className="absolute -top-2 -right-2"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#D9790B]" />
              Hızlı İşlemler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Video, label: 'Canlı Derse Katıl', color: 'from-red-500 to-orange-500', hoverColor: 'hover:shadow-red-500/30' },
                { icon: BookOpen, label: 'Konu Anlatımı', color: 'from-blue-500 to-cyan-500', hoverColor: 'hover:shadow-blue-500/30' },
                { icon: Brain, label: 'Soru Bankası', color: 'from-green-500 to-emerald-500', hoverColor: 'hover:shadow-green-500/30' },
                { icon: Sparkles, label: 'AI Asistan', color: 'from-purple-500 to-pink-500', hoverColor: 'hover:shadow-purple-500/30' },
              ].map((action, index) => (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button 
                    variant="outline" 
                    className={`h-auto py-6 w-full flex-col gap-3 border-2 ${action.hoverColor} hover:shadow-xl transition-all duration-300`}
                  >
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.color}`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="font-medium">{action.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Results */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Son Sonuçlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockRecentResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 border"
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl ${
                        result.score >= 80 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                          : result.score >= 60 
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-600' 
                            : 'bg-gradient-to-br from-red-500 to-pink-600'
                      }`}
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                    >
                      {result.score}
                    </motion.div>
                    <div>
                      <p className="font-semibold">{result.subject}</p>
                      <p className="text-sm text-muted-foreground">{result.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {new Date(result.date).toLocaleDateString('tr-TR')}
                    </Badge>
                    {result.score >= 80 && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mx-auto" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
