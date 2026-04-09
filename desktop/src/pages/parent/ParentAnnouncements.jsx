import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Calendar, AlertCircle, Info, ChevronRight, Search,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements, fetchStudents } from '../../lib/api/modules';
import { useApp } from '../../context/AppContext';

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ParentAnnouncements() {
  const { user } = useApp();
  const [announcements, setAnnouncements] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const students = await fetchStudents().catch(() => []);
      const linkedChildren = students.filter((student) => {
        const parentName = normalizeText(student.parentName);
        const parentEmail = normalizeText(student.parentEmail);
        const username = normalizeText(user?.username);
        const name = normalizeText(user?.name);
        const email = normalizeText(user?.email);
        return (
          parentName === name ||
          (name && parentName.includes(name)) ||
          (username && parentEmail.includes(username)) ||
          (email && parentEmail === email)
        );
      });

      const payload = await fetchAnnouncements({
        audience: 'Veli',
        viewerRole: 'Veli',
        viewerUsername: user?.username || '',
        viewerName: user?.name || '',
        viewerEmail: user?.email || '',
        viewerLinkedStudentUsernames: linkedChildren.map((child) => child.username).filter(Boolean).join(','),
        viewerClassName: linkedChildren[0]?.className || '',
      });
      setAnnouncements(payload);
    } catch (err) {
      setError(err.message || 'Duyurular alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.name, user?.username]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const filteredAnnouncements = useMemo(() => announcements.filter((item) => {
    const haystack = `${item.title} ${item.detail || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    if (typeFilter === 'all') return matchesSearch;
    if (typeFilter === 'important') return matchesSearch && /sinav|toplanti|odeme|acil|onem/i.test(haystack);
    return matchesSearch;
  }), [announcements, search, typeFilter]);

  const unreadCount = announcements.filter((item) => /sinav|toplanti|acil|odeme/i.test(`${item.title} ${item.detail || ''}`)).length;

  const renderTypeIcon = (item) => {
    const text = `${item.title} ${item.detail || ''}`.toLowerCase();
    if (text.includes('toplanti') || text.includes('tarih')) return <Calendar className="h-5 w-5 text-green-600" />;
    if (text.includes('odeme') || text.includes('acil')) return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    return <Info className="h-5 w-5 text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Duyurular yükleniyor...</p>
      </div>
    );
  }

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
            {unreadCount > 0 ? `${unreadCount} kritik duyuru var` : 'Yeni veli duyurusu yok'}
          </p>
        </div>
        {unreadCount > 0 ? <Badge className="bg-brand-accent">{unreadCount} Önemli</Badge> : null}
      </div>

      {error ? <ErrorBanner title="Duyurular alınamadı" message={error} onRetry={loadAnnouncements} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Duyuru ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="important">Kritik Duyurular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredAnnouncements.map((announcement, index) => (
          <motion.div key={`${announcement.title}-${index}`} variants={itemVariants}>
            <Card className="cursor-pointer hover:shadow-card-hover transition-all">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-muted">{renderTypeIcon(announcement)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{announcement.audience || 'Veli'}</Badge>
                      {/sinav|toplanti|odeme|acil|onem/i.test(`${announcement.title} ${announcement.detail || ''}`) ? (
                        <Badge variant="destructive" className="text-xs">Önemli</Badge>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    <p className="text-muted-foreground mt-2 line-clamp-2">{announcement.detail}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">{announcement.dateLabel || announcement.date || 'Bugün'}</span>
                      <Button variant="ghost" size="sm" className="text-brand-accent" onClick={() => setSelectedAnnouncement(announcement)}>
                        Detayı Gör <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAnnouncement?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Badge variant="outline">{selectedAnnouncement?.dateLabel || selectedAnnouncement?.date}</Badge>
            <p className="leading-6">{selectedAnnouncement?.detail}</p>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
