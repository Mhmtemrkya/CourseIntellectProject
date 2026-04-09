import { motion } from 'framer-motion';
import { 
  BarChart3, Users, TrendingUp, Calendar, Download, 
  FileText, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockClassPerformance = [
  { class: '11-A', avgScore: 78, improvement: 5, students: 28 },
  { class: '11-B', avgScore: 72, improvement: -2, students: 26 },
  { class: '10-A', avgScore: 82, improvement: 8, students: 25 },
  { class: '10-B', avgScore: 75, improvement: 3, students: 27 },
  { class: '9-C', avgScore: 68, improvement: 1, students: 30 },
];

const mockTopicAnalysis = [
  { topic: 'Türev', correct: 78, total: 100 },
  { topic: 'İntegral', correct: 65, total: 100 },
  { topic: 'Limit', correct: 82, total: 100 },
  { topic: 'Fonksiyonlar', correct: 71, total: 100 },
  { topic: 'Polinomlar', correct: 85, total: 100 },
];

export default function TeacherReports() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-reports-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Raporlar</h1>
          <p className="text-muted-foreground mt-1">Sınıf ve öğrenci performans analizleri</p>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="month">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Bu Hafta</SelectItem>
              <SelectItem value="month">Bu Ay</SelectItem>
              <SelectItem value="semester">Bu Dönem</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Rapor İndir
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Öğrenci</p>
                  <p className="text-2xl font-bold">136</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Users className="h-5 w-5 text-brand-primary" />
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
                  <p className="text-sm text-muted-foreground">Genel Ortalama</p>
                  <p className="text-2xl font-bold">75.2</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-5 w-5 text-green-600" />
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
                  <p className="text-sm text-muted-foreground">Yapılan Sınav</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <FileText className="h-5 w-5 text-blue-600" />
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
                  <p className="text-sm text-muted-foreground">Devam Oranı</p>
                  <p className="text-2xl font-bold">94%</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <Calendar className="h-5 w-5 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Performance */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-primary" />
                Sınıf Performansları
              </CardTitle>
              <CardDescription>Ortalama başarı puanları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockClassPerformance.map((cls) => (
                <div key={cls.class} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{cls.class}</span>
                      <Badge variant="outline" className="text-xs">{cls.students} öğrenci</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{cls.avgScore}</span>
                      {cls.improvement > 0 ? (
                        <span className="flex items-center text-green-600 text-sm">
                          <ArrowUpRight className="h-4 w-4" />
                          +{cls.improvement}
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600 text-sm">
                          <ArrowDownRight className="h-4 w-4" />
                          {cls.improvement}
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={cls.avgScore} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Topic Analysis */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-brand-accent" />
                Konu Analizi
              </CardTitle>
              <CardDescription>Konulara göre başarı oranları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockTopicAnalysis.map((topic) => {
                const percentage = Math.round((topic.correct / topic.total) * 100);
                return (
                  <div key={topic.topic} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{topic.topic}</span>
                      <span className="font-bold">%{percentage}</span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className={`h-2 ${percentage >= 80 ? '[&>div]:bg-green-500' : percentage >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`} 
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance Summary */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Performans Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-green-50 dark:bg-green-900/20">
                <p className="text-4xl font-bold text-green-600">42</p>
                <p className="text-sm text-muted-foreground mt-2">Başarılı Öğrenci (≥70)</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-4xl font-bold text-yellow-600">58</p>
                <p className="text-sm text-muted-foreground mt-2">Orta Düzey (50-69)</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-red-50 dark:bg-red-900/20">
                <p className="text-4xl font-bold text-red-600">36</p>
                <p className="text-sm text-muted-foreground mt-2">Destek Gerekli (&lt;50)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
