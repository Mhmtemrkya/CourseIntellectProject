import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  FileText,
  Megaphone,
  UserPlus,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements, fetchStaff, fetchStudents } from '../../lib/api/modules';

function latestByDate(items, dateFields = ['createdAtUtc', 'createdAt', 'date']) {
  return [...items].sort((a, b) => {
    const left = dateFields.map((field) => a?.[field]).find(Boolean) || '';
    const right = dateFields.map((field) => b?.[field]).find(Boolean) || '';
    return String(right).localeCompare(String(left), 'tr');
  });
}

export default function AdminAdministrativeUnits() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentPayload, staffPayload, announcementPayload] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff().catch(() => []),
        fetchAnnouncements({ includeAll: true }).catch(() => []),
      ]);
      setStudents(Array.isArray(studentPayload) ? studentPayload : []);
      setStaff(Array.isArray(staffPayload) ? staffPayload : []);
      setAnnouncements(Array.isArray(announcementPayload) ? announcementPayload : []);
    } catch (err) {
      setError(err.message || 'İdari birim verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const latestStudents = useMemo(() => latestByDate(students).slice(0, 4), [students]);
  const latestStaff = useMemo(() => latestByDate(staff).slice(0, 4), [staff]);
  const activeAnnouncements = useMemo(
    () => announcements.filter((item) => !String(item.detail || '').startsWith('LIVE_LESSON')).slice(0, 4),
    [announcements],
  );

  const actionCards = [
    {
      title: 'Yeni Öğrenci Kaydı',
      detail: 'Öğrenci, veli ve program bilgilerini tek akışla kaydet.',
      icon: UserPlus,
      path: '/admin/student-registration',
      color: 'text-blue-600',
    },
    {
      title: 'Öğretmen / Personel',
      detail: 'Kadro profili, rol ve branş bilgilerini oluştur.',
      icon: Users,
      path: '/admin/staff-registration',
      color: 'text-violet-600',
    },
    {
      title: 'Duyuru Oluştur',
      detail: 'Öğrenci, veli, öğretmen ve idari birimlere yayın yap.',
      icon: Megaphone,
      path: '/admin/announcements',
      color: 'text-amber-600',
    },
    {
      title: 'Belge Merkezi',
      detail: 'Kayıt evrakı ve kurumsal doküman akışlarını izle.',
      icon: FileText,
      path: '/admin/documents',
      color: 'text-emerald-600',
    },
  ];

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-administrative-units-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline">İdari operasyon</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">İdari Birimler</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Kayıt, duyuru, personel ve belge akışlarını kurum yöneticisi için tek merkezde topla.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Öğrenci', students.length],
              ['Kadro', staff.length],
              ['Duyuru', activeAnnouncements.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-muted/30 px-5 py-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="İdari birimler yüklenemedi" message={error} onRetry={loadData} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((item) => (
          <Card key={item.title} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => navigate(item.path)}>
            <CardContent className="p-5">
              <item.icon className={`h-7 w-7 ${item.color}`} />
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              <Button variant="outline" size="sm" className="mt-4">Aç</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Son Öğrenci Kayıtları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestStudents.map((student) => (
              <div key={student.id || student.username || student.fullName} className="rounded-xl border bg-muted/20 p-4">
                <p className="font-semibold">{student.fullName}</p>
                <p className="text-sm text-muted-foreground">{student.className || 'Sınıf yok'} - {student.currentSchool || student.programType || 'Kayıt'}</p>
              </div>
            ))}
            {latestStudents.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı öğrenci bulunamadı.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Son Kadro Kayıtları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestStaff.map((person) => (
              <div key={person.id || person.username || person.fullName} className="rounded-xl border bg-muted/20 p-4">
                <p className="font-semibold">{person.fullName}</p>
                <p className="text-sm text-muted-foreground">{person.primaryRole || person.role || 'Personel'} - {person.departmentOrBranch || 'Bölüm yok'}</p>
              </div>
            ))}
            {latestStaff.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı personel bulunamadı.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İdari Kontrol Noktaları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              'Kayıt evrakı, veli iletişim ve program bilgileri tamamlandı mı?',
              'Personel rol, branş ve kampüs bilgileri doğru mu?',
              'Yeni kayıt sonrası öğrenci ve veli duyurusu yayınlandı mı?',
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-xl border bg-muted/20 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
            <Button variant="outline" onClick={() => navigate('/admin/announcements')}>
              <Bell className="mr-2 h-4 w-4" />
              Duyurulara Git
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
