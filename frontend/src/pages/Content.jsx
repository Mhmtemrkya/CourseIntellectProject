import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Upload,
  FileText,
  Video,
  Download,
  Eye,
  Trash2,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { mockContent, mockClasses } from '../lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

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

function UploadDialog({ open, onOpenChange }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = () => {
    setUploading(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          onOpenChange(false);
        }, 500);
      }
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>İçerik Yükle</DialogTitle>
          <DialogDescription>PDF, video veya sunum dosyası yükleyin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!uploading ? (
            <>
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Dosyaları buraya sürükleyin veya
                </p>
                <Button variant="link" className="mt-1 text-brand-accent">
                  Dosya Seç
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Başlık</Label>
                <Input id="title" placeholder="İçerik başlığı" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sınıf</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sınıf seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Konu</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Konu seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Matematik">Matematik</SelectItem>
                      <SelectItem value="Fizik">Fizik</SelectItem>
                      <SelectItem value="Kimya">Kimya</SelectItem>
                      <SelectItem value="Biyoloji">Biyoloji</SelectItem>
                      <SelectItem value="Türkçe">Türkçe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Yükleniyor...</p>
                <p className="text-2xl font-bold">{progress}%</p>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            İptal
          </Button>
          <Button 
            className="bg-brand-primary hover:bg-brand-primary/90" 
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Yükleniyor...' : 'Yükle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Content() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredContent = mockContent.filter((content) => {
    const matchesSearch = content.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || content.type === typeFilter;
    const matchesSubject = subjectFilter === 'all' || content.subject === subjectFilter;
    return matchesSearch && matchesType && matchesSubject;
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="content-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">İçerikler</h1>
          <p className="text-muted-foreground mt-1">{mockContent.length} içerik mevcut</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
          data-testid="upload-content-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          İçerik Yükle
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İçerik ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Konu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Konular</SelectItem>
                <SelectItem value="Matematik">Matematik</SelectItem>
                <SelectItem value="Fizik">Fizik</SelectItem>
                <SelectItem value="Kimya">Kimya</SelectItem>
                <SelectItem value="Biyoloji">Biyoloji</SelectItem>
                <SelectItem value="Türkçe">Türkçe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContent.map((content) => (
          <motion.div key={content.id} variants={itemVariants}>
            <Card className="group hover:shadow-card-hover transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${content.type === 'pdf' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                    {content.type === 'pdf' ? (
                      <FileText className={`h-6 w-6 ${content.type === 'pdf' ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`} />
                    ) : (
                      <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" /> Görüntüle
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" /> İndir
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4">
                  <h3 className="font-semibold line-clamp-2">{content.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{content.uploadedBy}</p>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Badge variant="outline">{content.subject}</Badge>
                  <Badge variant="outline">{content.class}</Badge>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
                  <span>{content.size}</span>
                  <span>
                    {content.type === 'pdf' ? `${content.downloads} indirme` : `${content.views} görüntüleme`}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredContent.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">İçerik bulunamadı</h3>
            <p className="text-muted-foreground">Farklı filtreler deneyin veya yeni içerik yükleyin.</p>
          </CardContent>
        </Card>
      )}

      <UploadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
