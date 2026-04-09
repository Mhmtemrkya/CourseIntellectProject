import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, Video, FileText, Play, Clock, CheckCircle, 
  Search, Filter, Download, Eye, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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

const mockContent = [
  { 
    id: 1, 
    title: 'Türev ve Uygulamaları', 
    type: 'video', 
    subject: 'Matematik', 
    teacher: 'Dr. Hasan Yıldız',
    duration: '45 dk',
    progress: 65,
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop',
    date: '2025-01-05'
  },
  { 
    id: 2, 
    title: 'Newton Hareket Yasaları', 
    type: 'video', 
    subject: 'Fizik', 
    teacher: 'Aylin Güneş',
    duration: '52 dk',
    progress: 100,
    thumbnail: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&h=225&fit=crop',
    date: '2025-01-04'
  },
  { 
    id: 3, 
    title: 'Periyodik Tablo Ders Notu', 
    type: 'pdf', 
    subject: 'Kimya', 
    teacher: 'Osman Akça',
    pages: 24,
    progress: 40,
    thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=225&fit=crop',
    date: '2025-01-03'
  },
  { 
    id: 4, 
    title: 'Hücre Bölünmesi Animasyon', 
    type: 'video', 
    subject: 'Biyoloji', 
    teacher: 'Serpil Aydın',
    duration: '28 dk',
    progress: 0,
    thumbnail: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&h=225&fit=crop',
    date: '2025-01-02'
  },
  { 
    id: 5, 
    title: 'Edebiyat Akımları', 
    type: 'pdf', 
    subject: 'Türkçe', 
    teacher: 'Kemal Eren',
    pages: 32,
    progress: 80,
    thumbnail: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=225&fit=crop',
    date: '2025-01-01'
  },
  { 
    id: 6, 
    title: 'İntegral Çözümlü Sorular', 
    type: 'pdf', 
    subject: 'Matematik', 
    teacher: 'Dr. Hasan Yıldız',
    pages: 48,
    progress: 15,
    thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=225&fit=crop',
    date: '2024-12-28'
  },
];

const subjects = ['Tümü', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe'];

export default function StudentContent() {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tümü');
  const [activeTab, setActiveTab] = useState('all');

  const filteredContent = mockContent.filter(content => {
    const matchesSearch = content.title.toLowerCase().includes(search.toLowerCase()) ||
                         content.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'Tümü' || content.subject === selectedSubject;
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'video' && content.type === 'video') ||
                      (activeTab === 'pdf' && content.type === 'pdf') ||
                      (activeTab === 'inprogress' && content.progress > 0 && content.progress < 100) ||
                      (activeTab === 'completed' && content.progress === 100);
    return matchesSearch && matchesSubject && matchesTab;
  });

  const stats = {
    total: mockContent.length,
    completed: mockContent.filter(c => c.progress === 100).length,
    inProgress: mockContent.filter(c => c.progress > 0 && c.progress < 100).length,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="student-content-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">İçerikler</h1>
          <p className="text-muted-foreground mt-1">Video dersler ve ders notları</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <BookOpen className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Toplam İçerik</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">Devam Eden</p>
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
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Tamamlanan</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Button
                  key={subject}
                  variant={selectedSubject === subject ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSubject(subject)}
                  className={selectedSubject === subject ? 'bg-brand-primary' : ''}
                >
                  {subject}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="video">Videolar</TabsTrigger>
          <TabsTrigger value="pdf">Ders Notları</TabsTrigger>
          <TabsTrigger value="inprogress">Devam Eden</TabsTrigger>
          <TabsTrigger value="completed">Tamamlanan</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((content) => (
              <motion.div key={content.id} variants={itemVariants}>
                <Card className="overflow-hidden hover:shadow-card-hover transition-all cursor-pointer group">
                  <div className="relative">
                    <img 
                      src={content.thumbnail} 
                      alt={content.title}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {content.type === 'video' ? (
                        <Button size="lg" className="bg-brand-accent hover:bg-brand-accent/90 rounded-full">
                          <Play className="h-6 w-6" />
                        </Button>
                      ) : (
                        <Button size="lg" className="bg-brand-primary hover:bg-brand-primary/90 rounded-full">
                          <Eye className="h-6 w-6" />
                        </Button>
                      )}
                    </div>
                    <Badge 
                      className={`absolute top-2 left-2 ${content.type === 'video' ? 'bg-brand-accent' : 'bg-brand-primary'}`}
                    >
                      {content.type === 'video' ? (
                        <><Video className="h-3 w-3 mr-1" /> Video</>
                      ) : (
                        <><FileText className="h-3 w-3 mr-1" /> PDF</>
                      )}
                    </Badge>
                    {content.progress === 100 && (
                      <Badge className="absolute top-2 right-2 bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Tamamlandı
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <Badge variant="outline" className="mb-2">{content.subject}</Badge>
                    <h3 className="font-semibold line-clamp-1">{content.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{content.teacher}</p>
                    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                      {content.type === 'video' ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {content.duration}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {content.pages} sayfa
                        </span>
                      )}
                      <span>{new Date(content.date).toLocaleDateString('tr-TR')}</span>
                    </div>
                    {content.progress > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>İlerleme</span>
                          <span>{content.progress}%</span>
                        </div>
                        <Progress value={content.progress} className="h-1.5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {filteredContent.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">İçerik Bulunamadı</h3>
              <p className="text-muted-foreground">Arama kriterlerinize uygun içerik bulunamadı.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
