import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Clock, CheckCircle, AlertCircle, Upload,
  Calendar, ChevronRight, Download, Eye
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

const mockAssignments = [
  {
    id: 1,
    title: 'Türev Problemleri',
    subject: 'Matematik',
    teacher: 'Dr. Hasan Yıldız',
    dueDate: '2025-01-12',
    status: 'pending',
    description: '10 adet türev problemi çözün ve adım adım açıklayın.',
  },
  {
    id: 2,
    title: 'Newton Yasaları Raporu',
    subject: 'Fizik',
    teacher: 'Aylin Güneş',
    dueDate: '2025-01-15',
    status: 'pending',
    description: 'Newton yasaları hakkında 500 kelimelik rapor hazırlayın.',
  },
  {
    id: 3,
    title: 'Periyodik Tablo Çalışması',
    subject: 'Kimya',
    teacher: 'Osman Akça',
    dueDate: '2025-01-08',
    status: 'overdue',
    description: 'İlk 20 elementin özelliklerini listeleyin.',
  },
  {
    id: 4,
    title: 'Edebiyat Analizi',
    subject: 'Türkçe',
    teacher: 'Kemal Eren',
    dueDate: '2025-01-05',
    status: 'submitted',
    submittedDate: '2025-01-04',
    grade: null,
    description: 'Şiir analizi ödevi.',
  },
  {
    id: 5,
    title: 'Hücre Yapısı Sunumu',
    subject: 'Biyoloji',
    teacher: 'Serpil Aydın',
    dueDate: '2024-12-28',
    status: 'graded',
    submittedDate: '2024-12-27',
    grade: 85,
    feedback: 'İyi bir çalışma. Görsel kullanımı artırılabilir.',
    description: 'Hücre organelleri hakkında sunum.',
  },
];

export default function StudentAssignments() {
  const [activeTab, setActiveTab] = useState('pending');

  const stats = {
    pending: mockAssignments.filter(a => a.status === 'pending').length,
    overdue: mockAssignments.filter(a => a.status === 'overdue').length,
    submitted: mockAssignments.filter(a => a.status === 'submitted' || a.status === 'graded').length,
  };

  const filteredAssignments = mockAssignments.filter(a => {
    if (activeTab === 'pending') return a.status === 'pending';
    if (activeTab === 'overdue') return a.status === 'overdue';
    if (activeTab === 'completed') return a.status === 'submitted' || a.status === 'graded';
    return true;
  });

  const getStatusBadge = (status) => {
    const config = {
      pending: { class: 'bg-yellow-100 text-yellow-700', label: 'Bekliyor' },
      overdue: { class: 'bg-red-100 text-red-700', label: 'Gecikmiş' },
      submitted: { class: 'bg-blue-100 text-blue-700', label: 'Teslim Edildi' },
      graded: { class: 'bg-green-100 text-green-700', label: 'Notlandırıldı' },
    };
    return <Badge className={config[status]?.class}>{config[status]?.label}</Badge>;
  };

  const getDaysRemaining = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)} gün geçti`, color: 'text-red-600' };
    if (diff === 0) return { text: 'Bugün', color: 'text-yellow-600' };
    if (diff === 1) return { text: 'Yarın', color: 'text-yellow-600' };
    return { text: `${diff} gün kaldı`, color: 'text-muted-foreground' };
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-assignments-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Ödevlerim</h1>
        <p className="text-muted-foreground mt-1">Ödevlerini takip et ve teslim et</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card className={stats.overdue > 0 ? 'border-red-200' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Bekleyen Ödev</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className={stats.overdue > 0 ? 'border-red-500 bg-red-50/50' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                <p className="text-sm text-muted-foreground">Gecikmiş</p>
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
                <p className="text-2xl font-bold">{stats.submitted}</p>
                <p className="text-sm text-muted-foreground">Teslim Edilen</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Bekleyen ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="overdue" className={stats.overdue > 0 ? 'text-red-600' : ''}>
            Gecikmiş ({stats.overdue})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Tamamlanan ({stats.submitted})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {filteredAssignments.map((assignment) => {
            const daysInfo = getDaysRemaining(assignment.dueDate);
            return (
              <motion.div key={assignment.id} variants={itemVariants}>
                <Card className="hover:shadow-card-hover transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{assignment.subject}</Badge>
                          {getStatusBadge(assignment.status)}
                        </div>
                        <h3 className="font-semibold text-lg">{assignment.title}</h3>
                        <p className="text-muted-foreground mt-1">{assignment.description}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Öğretmen: {assignment.teacher}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Son Teslim: {new Date(assignment.dueDate).toLocaleDateString('tr-TR')}
                          </span>
                          {(assignment.status === 'pending' || assignment.status === 'overdue') && (
                            <span className={`font-medium ${daysInfo.color}`}>
                              {daysInfo.text}
                            </span>
                          )}
                        </div>
                        {assignment.grade !== undefined && assignment.grade !== null && (
                          <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Notunuz:</span>
                              <span className="text-2xl font-bold text-green-600">{assignment.grade}</span>
                            </div>
                            {assignment.feedback && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Geri Bildirim:</strong> {assignment.feedback}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {(assignment.status === 'pending' || assignment.status === 'overdue') ? (
                          <Button className="bg-brand-primary hover:bg-brand-primary/90">
                            <Upload className="h-4 w-4 mr-2" />
                            Teslim Et
                          </Button>
                        ) : (
                          <Button variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            Görüntüle
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {filteredAssignments.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">Ödev Bulunamadı</h3>
                <p className="text-muted-foreground">Bu kategoride ödev yok.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
