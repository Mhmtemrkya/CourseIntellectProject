import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Upload, FileText, Video, Image, Plus, Search, 
  Filter, MoreVertical, Eye, Trash2, Download, FolderOpen, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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

const mockContent = [
  { id: 1, title: 'Türev ve İntegral Temelleri', type: 'pdf', subject: 'Matematik', grade: '11', size: '2.4 MB', views: 156, date: '2025-01-05' },
  { id: 2, title: 'Limit Konu Anlatımı', type: 'video', subject: 'Matematik', grade: '11', size: '245 MB', views: 89, date: '2025-01-03', duration: '45:20' },
  { id: 3, title: 'Polinomlar Soru Bankası', type: 'pdf', subject: 'Matematik', grade: '10', size: '1.8 MB', views: 234, date: '2025-01-01' },
  { id: 4, title: 'Trigonometri Görsel Sunumu', type: 'image', subject: 'Matematik', grade: '10', size: '8.5 MB', views: 67, date: '2024-12-28' },
  { id: 5, title: 'Fonksiyonlar Video Ders', type: 'video', subject: 'Matematik', grade: '9', size: '320 MB', views: 198, date: '2024-12-25', duration: '52:10' },
];

const typeIcons = {
  pdf: FileText,
  video: Video,
  image: Image,
};

const typeColors = {
  pdf: 'bg-red-100 text-red-600 dark:bg-red-900/30',
  video: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
  image: 'bg-green-100 text-green-600 dark:bg-green-900/30',
};

export default function TeacherContent() {
  const { toast } = useToast();
  const [content, setContent] = useState(mockContent);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const filteredContent = content.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setUploadProgress(i);
    }
    
    setUploading(false);
    setUploadOpen(false);
    setUploadProgress(0);
    
    toast({
      title: "İçerik Yüklendi",
      description: "Yeni içerik başarıyla eklendi.",
    });
  };

  const stats = {
    total: content.length,
    pdf: content.filter(c => c.type === 'pdf').length,
    video: content.filter(c => c.type === 'video').length,
    totalViews: content.reduce((sum, c) => sum + c.views, 0),
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="teacher-content-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">İçerik Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Ders materyallerinizi yönetin</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">
              <Upload className="h-4 w-4 mr-2" />
              Yeni İçerik Yükle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yeni İçerik Yükle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Başlık</Label>
                <Input placeholder="İçerik başlığı" />
              </div>
              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea placeholder="İçerik hakkında kısa açıklama" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ders</Label>
                  <Select defaultValue="mat">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mat">Matematik</SelectItem>
                      <SelectItem value="fiz">Fizik</SelectItem>
                      <SelectItem value="kim">Kimya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select defaultValue="11">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">9. Sınıf</SelectItem>
                      <SelectItem value="10">10. Sınıf</SelectItem>
                      <SelectItem value="11">11. Sınıf</SelectItem>
                      <SelectItem value="12">12. Sınıf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dosya</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-brand-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Dosyayı sürükleyin veya seçin</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Video, Resim (max 500MB)</p>
                </div>
              </div>
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Yükleniyor...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>İptal</Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam İçerik</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <FolderOpen className="h-5 w-5 text-brand-primary" />
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
                  <p className="text-sm text-muted-foreground">PDF</p>
                  <p className="text-2xl font-bold">{stats.pdf}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <FileText className="h-5 w-5 text-red-600" />
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
                  <p className="text-sm text-muted-foreground">Video</p>
                  <p className="text-2xl font-bold">{stats.video}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Video className="h-5 w-5 text-blue-600" />
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
                  <p className="text-sm text-muted-foreground">Toplam Görüntülenme</p>
                  <p className="text-2xl font-bold">{stats.totalViews}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <Eye className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="İçerik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tür" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Resim</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Content Grid */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredContent.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-card-hover transition-all">
                    <div className={`h-32 ${typeColors[item.type]} flex items-center justify-center relative`}>
                      <Icon className="h-12 w-12" />
                      {item.duration && (
                        <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
                          <Clock className="h-3 w-3 mr-1" />
                          {item.duration}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.subject} • {item.grade}. Sınıf</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Görüntüle</DropdownMenuItem>
                            <DropdownMenuItem><Download className="h-4 w-4 mr-2" /> İndir</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Sil</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {item.views} görüntüleme
                        </span>
                        <span>{item.size}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
