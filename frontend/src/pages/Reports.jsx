import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download,
  Filter,
  Calendar,
  Users,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { mockClasses, mockDashboardStats } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';

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

const reportTypes = [
  { id: 'attendance', name: 'Devamsızlık Raporu', icon: ClipboardCheck, description: 'Öğrenci devamsızlık özeti' },
  { id: 'performance', name: 'Performans Raporu', icon: BarChart3, description: 'Sınav ve ödev performansı' },
  { id: 'students', name: 'Öğrenci Listesi', icon: Users, description: 'Detaylı öğrenci bilgileri' },
  { id: 'teachers', name: 'Öğretmen Raporu', icon: GraduationCap, description: 'Öğretmen aktivite özeti' },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState(reportTypes[0]);
  const [classFilter, setClassFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="reports-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Raporlar</h1>
          <p className="text-muted-foreground mt-1">Detaylı analiz ve raporlar</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90">
          <Download className="h-4 w-4 mr-2" />
          Rapor İndir
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Types */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapor Türleri</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-2">
                  {reportTypes.map((report) => {
                    const Icon = report.icon;
                    return (
                      <motion.div
                        key={report.id}
                        whileHover={{ x: 4 }}
                        onClick={() => setSelectedReport(report)}
                        className={`p-4 rounded-lg cursor-pointer transition-all ${
                          selectedReport?.id === report.id 
                            ? 'bg-brand-primary text-white' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedReport?.id === report.id ? 'bg-white/20' : 'bg-muted'}`}>
                            <Icon className={`h-5 w-5 ${selectedReport?.id === report.id ? 'text-white' : 'text-brand-primary'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{report.name}</p>
                            <p className={`text-xs ${selectedReport?.id === report.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {report.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtreler:</span>
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Sınıf" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Sınıflar</SelectItem>
                    {mockClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Dönem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Bu Hafta</SelectItem>
                    <SelectItem value="month">Bu Ay</SelectItem>
                    <SelectItem value="semester">Bu Dönem</SelectItem>
                    <SelectItem value="year">Bu Yıl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Toplam Öğrenci</p>
                      <p className="text-2xl font-bold">{mockDashboardStats.totalStudents}</p>
                    </div>
                    <div className="flex items-center text-green-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm ml-1">+12%</span>
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
                      <p className="text-2xl font-bold">{mockDashboardStats.todayAttendance}%</p>
                    </div>
                    <div className="flex items-center text-green-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm ml-1">+2%</span>
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
                      <p className="text-sm text-muted-foreground">Ortalama Puan</p>
                      <p className="text-2xl font-bold">78</p>
                    </div>
                    <div className="flex items-center text-red-500">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm ml-1">-3%</span>
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
                      <p className="text-sm text-muted-foreground">Aktif Sınav</p>
                      <p className="text-2xl font-bold">{mockDashboardStats.upcomingExams}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Report Preview */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedReport?.name}</CardTitle>
              <CardDescription>{selectedReport?.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReport?.id === 'attendance' && (
                <div className="space-y-4">
                  {mockClasses.slice(0, 4).map((cls, index) => (
                    <div key={cls.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{cls.name}</Badge>
                        <span className="text-sm">{cls.studentCount} öğrenci</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={[92, 88, 95, 85][index]} className="h-2" />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{[92, 88, 95, 85][index]}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedReport?.id === 'performance' && (
                <div className="space-y-4">
                  {['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe'].map((subject, index) => (
                    <div key={subject} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <span className="font-medium">{subject}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={[82, 75, 78, 85, 88][index]} className="h-2" />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{[82, 75, 78, 85, 88][index]}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(selectedReport?.id === 'students' || selectedReport?.id === 'teachers') && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Rapor Hazır</h3>
                  <p className="text-muted-foreground">İndirmek için yukarıdaki butonu kullanın.</p>
                  <Button className="mt-4 bg-brand-primary hover:bg-brand-primary/90">
                    <Download className="h-4 w-4 mr-2" />
                    PDF İndir
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
