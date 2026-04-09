import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Search, Filter, Play, CheckCircle, XCircle, Clock,
  Star, Trophy, Zap, Target, ChevronRight, BookOpen, Shuffle,
  BarChart3, Flame, Award, Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BouncingCard, GlowCard, TiltCard } from '../../components/animations/AnimatedCard';
import { AnimatedCounter, CircularProgress } from '../../components/animations/AnimatedCounter';
import { GlowingOrb, Confetti } from '../../components/animations/AnimatedBackground';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const subjects = [
  { id: 'mat', name: 'Matematik', icon: '📐', color: '#3b82f6', questions: 450, solved: 280 },
  { id: 'fiz', name: 'Fizik', icon: '⚡', color: '#ef4444', questions: 320, solved: 150 },
  { id: 'kim', name: 'Kimya', icon: '🧪', color: '#10b981', questions: 280, solved: 120 },
  { id: 'bio', name: 'Biyoloji', icon: '🧬', color: '#8b5cf6', questions: 350, solved: 200 },
  { id: 'tur', name: 'Türkçe', icon: '📚', color: '#f59e0b', questions: 400, solved: 250 },
  { id: 'tar', name: 'Tarih', icon: '🏛️', color: '#ec4899', questions: 300, solved: 180 },
];

const topics = [
  { id: 1, name: 'Türev', subject: 'Matematik', difficulty: 'Orta', questions: 45, progress: 65, xp: 150 },
  { id: 2, name: 'İntegral', subject: 'Matematik', difficulty: 'Zor', questions: 52, progress: 40, xp: 200 },
  { id: 3, name: 'Limit', subject: 'Matematik', difficulty: 'Kolay', questions: 38, progress: 85, xp: 100 },
  { id: 4, name: 'Newton Yasaları', subject: 'Fizik', difficulty: 'Orta', questions: 40, progress: 55, xp: 150 },
  { id: 5, name: 'Elektrik', subject: 'Fizik', difficulty: 'Zor', questions: 48, progress: 30, xp: 200 },
  { id: 6, name: 'Organik Kimya', subject: 'Kimya', difficulty: 'Zor', questions: 55, progress: 25, xp: 200 },
];

const difficultyColors = {
  'Kolay': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Orta': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Zor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function StudentQuestions() {
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const filteredTopics = topics.filter(topic => {
    const matchesSearch = topic.name.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || topic.subject === subjects.find(s => s.id === selectedSubject)?.name;
    return matchesSearch && matchesSubject;
  });

  const totalQuestions = subjects.reduce((sum, s) => sum + s.questions, 0);
  const totalSolved = subjects.reduce((sum, s) => sum + s.solved, 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="student-questions-page"
    >
      <Confetti active={showConfetti} />
      
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="#14b8a6" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="#3b82f6" size={250} className="bottom-20 left-20 opacity-20" />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold font-heading">Soru Bankası</h1>
              <p className="text-muted-foreground">Binlerce soru ile kendini geliştir</p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
              <Shuffle className="h-4 w-4 mr-2" />
              Rastgele Soru Çöz
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Soru', value: totalQuestions, icon: BookOpen, color: 'from-blue-500 to-cyan-500' },
          { label: 'Çözülen', value: totalSolved, icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
          { label: 'Başarı Oranı', value: Math.round((totalSolved / totalQuestions) * 100), suffix: '%', icon: Target, color: 'from-purple-500 to-pink-500' },
          { label: 'Kazanılan XP', value: 2450, icon: Zap, color: 'from-yellow-500 to-orange-500' },
        ].map((stat, index) => (
          <BouncingCard key={stat.label} delay={index * 0.1}>
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <AnimatedCounter value={stat.value} className="text-3xl font-bold" />
                      {stat.suffix && <span className="text-xl font-bold">{stat.suffix}</span>}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </BouncingCard>
        ))}
      </div>

      {/* Subject Selection */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#D9790B]" />
              Dersler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {subjects.map((subject, index) => {
                const percentage = Math.round((subject.solved / subject.questions) * 100);
                return (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedSubject(selectedSubject === subject.id ? 'all' : subject.id)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      selectedSubject === subject.id
                        ? 'border-[#D9790B] bg-[#D9790B]/10 shadow-lg shadow-orange-500/20'
                        : 'border-border hover:border-[#D9790B]/50'
                    }`}
                  >
                    <div className="text-center">
                      <motion.span
                        className="text-4xl block mb-2"
                        animate={selectedSubject === subject.id ? { rotate: [0, -10, 10, 0] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        {subject.icon}
                      </motion.span>
                      <p className="font-semibold">{subject.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{subject.solved}/{subject.questions}</p>
                      <Progress value={percentage} className="h-1.5 mt-2" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Konu ara..."
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      </motion.div>

      {/* Topics Grid */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((topic, index) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlowCard glowColor="#14b8a6">
                <Card className="border-0 shadow-lg overflow-hidden cursor-pointer group hover:shadow-xl transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{topic.subject}</Badge>
                            <Badge className={difficultyColors[topic.difficulty]}>{topic.difficulty}</Badge>
                          </div>
                          <h3 className="text-lg font-semibold">{topic.name}</h3>
                        </div>
                        <motion.div
                          className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                        >
                          <Zap className="h-5 w-5 text-yellow-600" />
                          <span className="text-xs font-bold text-yellow-700">+{topic.xp}</span>
                        </motion.div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-muted-foreground">{topic.questions} soru</span>
                        <span className="text-sm font-medium">{topic.progress}% tamamlandı</span>
                      </div>
                      <Progress value={topic.progress} className="h-2" />
                    </div>

                    <motion.div 
                      className="flex border-t"
                      initial={{ opacity: 0.8 }}
                      whileHover={{ opacity: 1 }}
                    >
                      <Button 
                        variant="ghost" 
                        className="flex-1 rounded-none h-12 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                      >
                        <Play className="h-4 w-4 mr-2" /> Başla
                      </Button>
                      <div className="w-px bg-border" />
                      <Button 
                        variant="ghost" 
                        className="flex-1 rounded-none h-12 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" /> İstatistik
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </GlowCard>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Daily Challenge */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                >
                  <Trophy className="h-10 w-10 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Günlük Meydan Okuma</h3>
                  <p className="text-white/80">10 soru çöz, 500 XP kazan!</p>
                </div>
              </div>
              <div className="text-center">
                <CircularProgress value={70} size={80} strokeWidth={8} color="#fff" bgColor="rgba(255,255,255,0.2)" />
                <p className="text-white text-sm mt-2">7/10 tamamlandı</p>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="bg-white text-purple-600 hover:bg-white/90">
                  <Flame className="h-4 w-4 mr-2" /> Devam Et
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
