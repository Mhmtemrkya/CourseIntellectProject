import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, ExternalLink, Users, BellRing, BriefcaseBusiness,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements, fetchStaff, fetchStudents } from '../../lib/api/modules';

export default function AdminGlobalSearch() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentItems, staffItems, announcementItems] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff().catch(() => []),
        fetchAnnouncements().catch(() => []),
      ]);
      setStudents(studentItems);
      setStaff(staffItems);
      setAnnouncements(announcementItems);
    } catch (err) {
      setError(err.message || 'Global arama verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSearch(); }, [loadSearch]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const source = [
      ...students.map((item) => ({ id: `student-${item.id}`, title: item.fullName, detail: item.className, type: 'Öğrenci', route: '/students', payload: item })),
      ...staff.map((item) => ({ id: `staff-${item.id}`, title: item.fullName, detail: item.role, type: 'Personel', route: item.role === 'Teacher' ? '/teachers' : '/admin/records', payload: item })),
      ...announcements.map((item) => ({ id: `ann-${item.id}`, title: item.title, detail: item.detail, type: 'Duyuru', route: '/admin/announcements', payload: item })),
    ];
    if (!q) return source.slice(0, 12);
    return source.filter((item) => `${item.title} ${item.detail || ''}`.toLowerCase().includes(q)).slice(0, 20);
  }, [announcements, query, staff, students]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-global-search-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Global Arama</h1>
        <p className="text-muted-foreground mt-1">Öğrenci, personel ve duyuru kayıtlarında arama</p>
      </div>
      {error ? <ErrorBanner title="Global arama verisi alınamadı" message={error} onRetry={loadSearch} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          [students.length, 'Öğrenci Havuzu', Users],
          [staff.length, 'Personel Havuzu', BriefcaseBusiness],
          [announcements.length, 'Duyuru Havuzu', BellRing],
        ].map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-brand-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Ad, sınıf, rol veya duyuru ara..." />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sonuçlar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {results.map((item) => (
            <div key={item.id} className="rounded-xl border p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail || 'Detay yok'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <Button variant="outline" size="sm" onClick={() => setSelectedResult(item)}>Detay</Button>
                <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate(item.route)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Aç
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedResult?.title || 'Kayıt detayı'}</DialogTitle>
            <DialogDescription>Global arama sonucu için detay görünümü.</DialogDescription>
          </DialogHeader>
          {selectedResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedResult.type}</Badge>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedResult.detail || 'Bu kayıt için ek açıklama bulunmuyor.'}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedResult(null)}>Kapat</Button>
            {selectedResult ? (
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate(selectedResult.route)}>
                İlgili Modülü Aç
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
