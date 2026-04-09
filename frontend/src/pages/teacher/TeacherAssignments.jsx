import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Plus, Search, Calendar, Users, Clock, CheckCircle,
  AlertCircle, Eye, Edit, Trash2, MoreVertical, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';

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
    title: 'Türev Alıştırmaları', 
    subject: 'Matematik',
    class: '11-A',
    dueDate: '2025-01-15',
    totalStudents: 28,
    submitted: 18,
    graded: 12,
    status: 'active',
  },
  { 
    id: 2, 
    title: 'Polinom Problemleri', 
    subject: 'Matematik',
    class: '10-A',
    dueDate: '2025-01-12',
    totalStudents: 25,
    submitted: 25,
    graded: 25,
    status: 'completed',
  },
  { 
    id: 3, 
    title: 'Limit Soruları', 
    subject: 'Matematik',
    class: '11-B',
    dueDate: '2025-01-20',
    totalStudents: 26,
    submitted: 5,
    graded: 0,
    status: 'active',
  },
];

const statusConfig = {
  active: { label: 'Aktif', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Tamamlandı', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  draft: { label: 'Taslak', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export default function TeacherAssignments() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssignments = mockAssignments.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    toast({
      title: "Ödev Oluşturuldu",
      description: "Yeni ödev başarıyla oluşturuldu.",
    });
    setCreateOpen(false);
  };

  const stats = {
    total: mockAssignments.length,
    active: mockAssignments.filter(a => a.status === 'active').length,
    pendingGrade: mockAssignments.reduce((sum, a) => sum + (a.submitted - a.graded), 0),
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-assignments-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ödevler</h1>
          <p className="text-muted-foreground mt-1">Ödev oluşturun ve değerlendirin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Ödev
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Ödev Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Ödev Başlığı</Label>
                <Input placeholder="Örn: Türev Alıştırmaları" />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea placeholder="Ödev hakkında açıklama..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select defaultValue="11a">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11a">11-A</SelectItem>
                      <SelectItem value="11b">11-B</SelectItem>
                      <SelectItem value="10a">10-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Son Tarih</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dosya Ekle (Opsiyonel)</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-brand-primary/50 transition-colors cursor-pointer">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Dosya yüklemek için tıklayın</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button onClick={handleCreate}>Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Ödev</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <FileText className="h-5 w-5 text-brand-primary" />
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
                  <p className="text-sm text-muted-foreground">Aktif</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
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
                  <p className="text-sm text-muted-foreground">Değerlendirme Bekleyen</p>
                  <p className="text-2xl font-bold">{stats.pendingGrade}</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ödev ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Assignments List */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ödevlerim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const submissionRate = Math.round((assignment.submitted / assignment.totalStudents) * 100);
              const gradedRate = Math.round((assignment.graded / assignment.totalStudents) * 100);
              
              return (
                <motion.div
                  key={assignment.id}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 rounded-xl border hover:border-brand-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-brand-primary/10">
                        <FileText className="h-6 w-6 text-brand-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{assignment.subject}</span>
                          <span>•</span>
                          <span>{assignment.class}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(assignment.dueDate).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig[assignment.status].color}>
                        {statusConfig[assignment.status].label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Detaylar</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                          <DropdownMenuItem><Download className="h-4 w-4 mr-2" /> Teslim Listesi</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Sil</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Teslim Edilen</span>
                        <span className="font-medium">{assignment.submitted}/{assignment.totalStudents}</span>
                      </div>
                      <Progress value={submissionRate} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Değerlendirilen</span>
                        <span className="font-medium">{assignment.graded}/{assignment.totalStudents}</span>
                      </div>
                      <Progress value={gradedRate} className="h-2 [&>div]:bg-green-500" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
