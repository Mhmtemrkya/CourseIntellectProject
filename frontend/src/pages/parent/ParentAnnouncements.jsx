import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, Calendar, AlertCircle, Info, CheckCircle, 
  ChevronRight, Filter, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
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

const mockAnnouncements = [
  {
    id: 1,
    title: 'Yarıyıl Tatili Duyurusu',
    content: '2024-2025 eğitim öğretim yılı 1. dönem 20 Ocak 2025 tarihinde sona erecektir. 2. dönem 3 Şubat 2025 tarihinde başlayacaktır.',
    type: 'info',
    date: '2025-01-10',
    read: false,
    important: true,
  },
  {
    id: 2,
    title: 'Veli Toplantısı',
    content: 'Değerli velilerimiz, 25 Ocak 2025 Cumartesi günü saat 10:00\'da genel veli toplantımız yapılacaktır. Katılımınızı bekliyoruz.',
    type: 'event',
    date: '2025-01-08',
    read: false,
    important: true,
  },
  {
    id: 3,
    title: 'Karne Töreni',
    content: 'Karne töreni 20 Ocak 2025 Pazartesi günü saat 11:00\'de okulumuz konferans salonunda yapılacaktır.',
    type: 'event',
    date: '2025-01-05',
    read: true,
    important: false,
  },
  {
    id: 4,
    title: 'Ödeme Hatırlatması',
    content: 'Şubat ayı taksit ödemesinin son tarihi 1 Şubat 2025\'tir. Lütfen ödemelerinizi zamanında yapınız.',
    type: 'warning',
    date: '2025-01-03',
    read: true,
    important: false,
  },
  {
    id: 5,
    title: 'Okul Servisi Güzergah Değişikliği',
    content: 'Merkez mahallesi güzergahında yol çalışması nedeniyle servis saatleri geçici olarak değiştirilmiştir.',
    type: 'info',
    date: '2024-12-28',
    read: true,
    important: false,
  },
];

export default function ParentAnnouncements() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const filteredAnnouncements = mockAnnouncements.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
                         a.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const unreadCount = mockAnnouncements.filter(a => !a.read).length;

  const getTypeIcon = (type) => {
    const icons = {
      info: <Info className="h-5 w-5 text-blue-600" />,
      event: <Calendar className="h-5 w-5 text-green-600" />,
      warning: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    };
    return icons[type] || icons.info;
  };

  const getTypeBadge = (type) => {
    const styles = {
      info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      event: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    const labels = { info: 'Bilgi', event: 'Etkinlik', warning: 'Uyarı' };
    return <Badge className={styles[type]}>{labels[type]}</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="parent-announcements-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Duyurular</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} okunmamış duyuru` : 'Tüm duyuruları okudunuz'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-brand-accent">{unreadCount} Yeni</Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Duyuru ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="info">Bilgi</SelectItem>
                <SelectItem value="event">Etkinlik</SelectItem>
                <SelectItem value="warning">Uyarı</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.map((announcement) => (
          <motion.div key={announcement.id} variants={itemVariants}>
            <Card className={`cursor-pointer hover:shadow-card-hover transition-all ${
              !announcement.read ? 'border-l-4 border-l-brand-accent bg-brand-accent/5' : ''
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    announcement.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    announcement.type === 'event' ? 'bg-green-100 dark:bg-green-900/30' :
                    'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {getTypeIcon(announcement.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeBadge(announcement.type)}
                      {announcement.important && (
                        <Badge variant="destructive" className="text-xs">Önemli</Badge>
                      )}
                      {!announcement.read && (
                        <Badge className="bg-brand-accent text-xs">Yeni</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    <p className="text-muted-foreground mt-2 line-clamp-2">{announcement.content}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(announcement.date).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <Button variant="ghost" size="sm" className="text-brand-accent">
                        Devamını Oku <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {filteredAnnouncements.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Duyuru Bulunamadı</h3>
              <p className="text-muted-foreground">Arama kriterlerinize uygun duyuru yok.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
