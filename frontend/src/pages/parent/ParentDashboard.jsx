import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, ChevronRight, Calendar, TrendingUp, CreditCard, 
  Bell, MessageSquare, ClipboardCheck, FileQuestion, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
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

const mockChildren = [
  { 
    id: 1, 
    name: 'Ali Yılmaz', 
    class: '10-A', 
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    attendance: 92,
    lastExam: { subject: 'Matematik', score: 85 },
    pendingPayment: 7000,
    nextPaymentDate: '2025-01-15'
  },
  { 
    id: 2, 
    name: 'Ayşe Yılmaz', 
    class: '8-B', 
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    attendance: 98,
    lastExam: { subject: 'Fen Bilgisi', score: 92 },
    pendingPayment: 0,
    nextPaymentDate: null
  },
];

const mockAnnouncements = [
  { id: 1, title: 'Yarıyıl Tatili Duyurusu', date: '2025-01-06', important: true },
  { id: 2, title: 'Veli Toplantısı', date: '2025-01-10', important: false },
  { id: 3, title: 'Ara Sınav Takvimi', date: '2025-01-08', important: true },
];

export default function ParentDashboard() {
  const [selectedChild, setSelectedChild] = useState(mockChildren[0]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="parent-dashboard-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Hoş Geldiniz</h1>
          <p className="text-muted-foreground mt-1">Çocuklarınızın eğitim durumu</p>
        </div>
        
        {/* Child Selector */}
        {mockChildren.length > 1 && (
          <Select 
            value={selectedChild.id.toString()} 
            onValueChange={(v) => setSelectedChild(mockChildren.find(c => c.id === parseInt(v)))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockChildren.map((child) => (
                <SelectItem key={child.id} value={child.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={child.avatar} />
                      <AvatarFallback>{child.name[0]}</AvatarFallback>
                    </Avatar>
                    {child.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selected Child Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-brand-primary to-brand-primary/80 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-4 border-white/20">
                <AvatarImage src={selectedChild.avatar} alt={selectedChild.name} />
                <AvatarFallback className="bg-brand-accent text-white text-2xl">
                  {selectedChild.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{selectedChild.name}</h2>
                <p className="text-white/80">{selectedChild.class} Sınıfı</p>
              </div>
              <div className="hidden md:grid grid-cols-3 gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold">{selectedChild.attendance}%</p>
                  <p className="text-white/70 text-sm">Devam Oranı</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{selectedChild.lastExam.score}</p>
                  <p className="text-white/70 text-sm">Son Sınav</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">₺{selectedChild.pendingPayment.toLocaleString()}</p>
                  <p className="text-white/70 text-sm">Bekleyen Ödeme</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="cursor-pointer hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devamsızlık</p>
                  <p className="text-3xl font-bold mt-2">{100 - selectedChild.attendance}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Bu dönem</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <ClipboardCheck className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cursor-pointer hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Son Sınav</p>
                  <p className="text-3xl font-bold mt-2">{selectedChild.lastExam.score}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedChild.lastExam.subject}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-accent/10">
                  <FileQuestion className="h-6 w-6 text-brand-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cursor-pointer hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen Ödeme</p>
                  <p className="text-3xl font-bold mt-2">₺{selectedChild.pendingPayment.toLocaleString()}</p>
                  {selectedChild.nextPaymentDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Son: {new Date(selectedChild.nextPaymentDate).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-xl ${selectedChild.pendingPayment > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                  <CreditCard className={`h-6 w-6 ${selectedChild.pendingPayment > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cursor-pointer hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mesajlar</p>
                  <p className="text-3xl font-bold mt-2">3</p>
                  <p className="text-xs text-muted-foreground mt-1">Okunmamış</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Announcements */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-brand-accent" />
                  Duyurular
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm">
                Tümü <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAnnouncements.map((announcement) => (
                <div key={announcement.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {announcement.important && (
                      <AlertCircle className="h-4 w-4 text-brand-accent" />
                    )}
                    <div>
                      <p className="font-medium">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(announcement.date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Overview */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Devam Durumu
              </CardTitle>
              <CardDescription>Bu dönemki devam istatistikleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Devam Oranı</span>
                  <span className="font-bold">{selectedChild.attendance}%</span>
                </div>
                <Progress value={selectedChild.attendance} className="h-3" />
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-2xl font-bold text-green-600">45</p>
                  <p className="text-xs text-muted-foreground">Katılım</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-600">3</p>
                  <p className="text-xs text-muted-foreground">Devamsız</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <p className="text-2xl font-bold text-yellow-600">2</p>
                  <p className="text-xs text-muted-foreground">İzinli</p>
                </div>
              </div>
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
                <span>Devamsızlık</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <FileQuestion className="h-6 w-6 text-brand-accent" />
                <span>Sınav Sonuçları</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <CreditCard className="h-6 w-6 text-green-600" />
                <span>Ödeme Yap</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <MessageSquare className="h-6 w-6 text-blue-600" />
                <span>Mesaj Gönder</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
