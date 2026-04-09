import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Video, Play, Calendar, Clock, Users, ExternalLink, Plus,
  Copy, CheckCircle, Settings, Monitor
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../../components/ui/dialog';
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

const mockLiveLessons = [
  { 
    id: 1, 
    title: 'Matematik 11 - Türev Dersi', 
    date: '2025-01-08',
    time: '14:00',
    duration: 90,
    class: '11-A, 11-B',
    status: 'scheduled',
    link: 'https://meet.courseintellect.com/mat-11-turev',
    participants: 45,
  },
  { 
    id: 2, 
    title: 'Matematik 10 - Polinomlar', 
    date: '2025-01-09',
    time: '10:00',
    duration: 60,
    class: '10-A',
    status: 'scheduled',
    link: 'https://meet.courseintellect.com/mat-10-polinom',
    participants: 28,
  },
  { 
    id: 3, 
    title: 'Soru Çözüm Seansı', 
    date: '2025-01-06',
    time: '16:00',
    duration: 45,
    class: 'Tüm Sınıflar',
    status: 'live',
    link: 'https://meet.courseintellect.com/soru-cozum',
    participants: 67,
  },
  { 
    id: 4, 
    title: 'Matematik 9 - Denklemler', 
    date: '2025-01-05',
    time: '11:00',
    duration: 60,
    class: '9-C',
    status: 'completed',
    link: null,
    participants: 30,
    recording: true,
  },
];

const statusConfig = {
  scheduled: { label: 'Planlandı', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  live: { label: 'Canlı', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Tamamlandı', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export default function TeacherLive() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const copyLink = (id, link) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Link Kopyalandı",
      description: "Ders linki panoya kopyalandı.",
    });
  };

  const handleCreate = () => {
    toast({
      title: "Canlı Ders Oluşturuldu",
      description: "Yeni canlı ders başarıyla oluşturuldu.",
    });
    setCreateOpen(false);
  };

  const liveLesson = mockLiveLessons.find(l => l.status === 'live');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-live-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Canlı Dersler</h1>
          <p className="text-muted-foreground mt-1">Online ders planlarınızı yönetin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Canlı Ders
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Canlı Ders Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Ders Başlığı</Label>
                <Input placeholder="Örn: Matematik 11 - Türev Dersi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Saat</Label>
                  <Input type="time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Süre (dk)</Label>
                  <Select defaultValue="60">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dakika</SelectItem>
                      <SelectItem value="45">45 dakika</SelectItem>
                      <SelectItem value="60">60 dakika</SelectItem>
                      <SelectItem value="90">90 dakika</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sınıflar</Label>
                  <Select defaultValue="11a">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11a">11-A</SelectItem>
                      <SelectItem value="11b">11-B</SelectItem>
                      <SelectItem value="10a">10-A</SelectItem>
                      <SelectItem value="all">Tüm Sınıflar</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* Active Live Lesson */}
      {liveLesson && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-r from-green-600 to-green-500 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="p-4 rounded-xl bg-white/20">
                      <Video className="h-8 w-8" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                  </div>
                  <div>
                    <Badge className="bg-white/20 text-white mb-2">CANLI</Badge>
                    <h2 className="text-2xl font-bold">{liveLesson.title}</h2>
                    <p className="text-white/80">{liveLesson.class} • {liveLesson.participants} katılımcı</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="secondary" 
                    className="bg-white text-green-600 hover:bg-white/90"
                    onClick={() => window.open(liveLesson.link, '_blank')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Derse Git
                  </Button>
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Ayarlar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bu Hafta</p>
                  <p className="text-2xl font-bold">4 Ders</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Calendar className="h-5 w-5 text-brand-primary" />
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
                  <p className="text-sm text-muted-foreground">Toplam Süre</p>
                  <p className="text-2xl font-bold">255 dk</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600" />
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
                  <p className="text-sm text-muted-foreground">Toplam Katılım</p>
                  <p className="text-2xl font-bold">170</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming & Past Lessons */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ders Takvimi</CardTitle>
            <CardDescription>Planlanmış ve tamamlanmış canlı dersler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockLiveLessons.filter(l => l.status !== 'live').map((lesson) => (
              <motion.div
                key={lesson.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between p-4 rounded-xl border hover:border-brand-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${lesson.status === 'completed' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-brand-primary/10'}`}>
                    <Video className={`h-6 w-6 ${lesson.status === 'completed' ? 'text-gray-500' : 'text-brand-primary'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{lesson.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(lesson.date).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lesson.time} • {lesson.duration} dk
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {lesson.class}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusConfig[lesson.status].color}>
                    {statusConfig[lesson.status].label}
                  </Badge>
                  {lesson.status === 'scheduled' && lesson.link && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyLink(lesson.id, lesson.link)}
                      >
                        {copiedId === lesson.id ? (
                          <><CheckCircle className="h-4 w-4 mr-1 text-green-600" /> Kopyalandı</>
                        ) : (
                          <><Copy className="h-4 w-4 mr-1" /> Link</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(lesson.link, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {lesson.status === 'completed' && lesson.recording && (
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-1" /> Kayıt
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
