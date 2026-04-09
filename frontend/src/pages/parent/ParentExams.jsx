import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileQuestion, Trophy, TrendingUp, TrendingDown, Calendar,
  ChevronRight, AlertTriangle, Target, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockChildren = [
  { id: '1', name: 'Ali Yılmaz', class: '10-A' },
  { id: '2', name: 'Zeynep Yılmaz', class: '8-B' },
];

const mockExamResults = [
  { 
    id: 1, name: 'Matematik Ara Sınav', subject: 'Matematik', date: '2025-01-05',
    score: 85, rank: 5, classAvg: 72, correct: 17, wrong: 3, empty: 0
  },
  { 
    id: 2, name: 'Fizik Quiz 1', subject: 'Fizik', date: '2025-01-03',
    score: 78, rank: 8, classAvg: 68, correct: 15, wrong: 4, empty: 1
  },
  { 
    id: 3, name: 'Türkçe Deneme', subject: 'Türkçe', date: '2024-12-28',
    score: 92, rank: 2, classAvg: 75, correct: 23, wrong: 2, empty: 0
  },
  { 
    id: 4, name: 'Kimya Ara Sınav', subject: 'Kimya', date: '2024-12-20',
    score: 68, rank: 12, classAvg: 65, correct: 13, wrong: 5, empty: 2
  },
];

const mockWeakTopics = [
  { subject: 'Matematik', topic: 'Türev Uygulamaları', score: 45 },
  { subject: 'Fizik', topic: 'Elektrik Devreleri', score: 52 },
  { subject: 'Kimya', topic: 'Organik Kimya', score: 58 },
];

export default function ParentExams() {
  const [selectedChild, setSelectedChild] = useState(mockChildren[0].id);
  
  const avgScore = Math.round(mockExamResults.reduce((a, e) => a + e.score, 0) / mockExamResults.length);
  const avgRank = Math.round(mockExamResults.reduce((a, e) => a + e.rank, 0) / mockExamResults.length);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="parent-exams-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınav Sonuçları</h1>
          <p className="text-muted-foreground mt-1">Çocuğunuzun sınav performansı</p>
        </div>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mockChildren.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name} ({child.class})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <p className="text-2xl font-bold">{avgScore}</p>
                <p className="text-sm text-muted-foreground">Ortalama Puan</p>
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
                <p className="text-2xl font-bold">{avgRank}.</p>
                <p className="text-sm text-muted-foreground">Ort. Sıralama</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">+8%</p>
                <p className="text-sm text-muted-foreground">Son 1 Ay</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileQuestion className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockExamResults.length}</p>
                <p className="text-sm text-muted-foreground">Toplam Sınav</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Son Sınav Sonuçları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockExamResults.map((exam) => (
                <motion.div
                  key={exam.id}
                  variants={itemVariants}
                  className="p-4 rounded-xl border border-border hover:border-brand-accent/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{exam.subject}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(exam.date).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <h3 className="font-semibold">{exam.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-green-600">Doğru: {exam.correct}</span>
                        <span className="text-red-600">Yanlış: {exam.wrong}</span>
                        <span className="text-muted-foreground">Boş: {exam.empty}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${
                        exam.score >= 80 ? 'text-green-600' : 
                        exam.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {exam.score}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sıralama: {exam.rank}. | Ort: {exam.classAvg}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={exam.score} className="h-2" />
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Weak Topics */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Geliştirilmesi Gereken Konular
              </CardTitle>
              <CardDescription>Düşük performans gösteren alanlar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockWeakTopics.map((topic, index) => (
                <div key={index} className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{topic.topic}</span>
                    <Badge variant="outline">{topic.subject}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={topic.score} className="h-2 flex-1" />
                    <span className="text-sm font-medium text-yellow-700">{topic.score}%</span>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground mt-4">
                Bu konularda ek çalışma yapılması önerilir. Öğretmenle görüşme talebinde bulunabilirsiniz.
              </p>
              <Button variant="outline" className="w-full">
                Öğretmenle Görüş
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
