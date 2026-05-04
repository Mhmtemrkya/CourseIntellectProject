import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Shield, Bell, GraduationCap, Award,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { useApp } from '../../context/AppContext';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { LegalDocumentsPanel } from '../../components/legal/LegalDocumentsPanel';
import { fetchAttendance, fetchExamResults, fetchStudents } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

export default function StudentProfile() {
  const { user } = useApp();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    exams: true,
    content: true,
  });
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, attendanceList, examList] = await Promise.all([
        fetchStudents(),
        fetchAttendance().catch(() => []),
        fetchExamResults().catch(() => []),
      ]);
      const current = students.find((item) => normalizeText(item.username) === normalizeText(user?.username))
        || students.find((item) => normalizeText(item.fullName) === normalizeText(user?.name))
        || null;
      setStudent(current);
      setAttendance(current ? attendanceList.filter((item) => normalizeText(item.studentName) === normalizeText(current.fullName)) : []);
      setExams(current ? examList.filter((item) => normalizeText(item.studentName) === normalizeText(current.fullName)) : []);
    } catch (err) {
      setError(err.message || 'Öğrenci profili alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const stats = useMemo(() => {
    const present = new Set(
      attendance
        .filter((item) => String(item.status || '').toLowerCase().includes('katildi'))
        .map((item) => item.lessonDate),
    ).size;
    const totalAttendance = new Set(attendance.map((item) => item.lessonDate)).size;
    const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;
    const avgScore = exams.length ? Math.round(exams.reduce((sum, item) => sum + Number(item.score || 0), 0) / exams.length) : 0;
    return { attendanceRate, avgScore, examCount: exams.length };
  }, [attendance, exams]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="student-profile-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Profilim</h1>
        <p className="text-muted-foreground mt-1">Kişisel bilgilerinizi görüntüleyin</p>
      </div>

      {error ? <ErrorBanner title="Profil alınamadı" message={error} onRetry={loadProfile} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div>
          <Card>
            <CardContent className="p-6 text-center">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarFallback className="bg-brand-primary text-white text-2xl">
                  {(student?.fullName || user?.name || 'Öğrenci').split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold mt-4">{student?.fullName || user?.name}</h2>
              <p className="text-muted-foreground">{student?.username || user?.username}</p>
              <Badge className="mt-2 bg-brand-accent">{student?.className || 'Sınıf yok'}</Badge>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-2xl font-bold text-brand-primary">%{stats.attendanceRate}</p><p className="text-xs text-muted-foreground">Devam</p></div>
                <div><p className="text-2xl font-bold text-brand-accent">{stats.avgScore}</p><p className="text-xs text-muted-foreground">Ortalama</p></div>
                <div><p className="text-2xl font-bold text-green-600">{stats.examCount}</p><p className="text-xs text-muted-foreground">Sınav</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-brand-accent" />Başarılarım</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><span>Devam Disiplini</span><Badge variant="outline">%{stats.attendanceRate}</Badge></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><span>Sınav Performansı</span><Badge variant="outline">{stats.avgScore}</Badge></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><span>Toplam Sonuç</span><Badge variant="outline">{stats.examCount}</Badge></div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kişisel Bilgiler</CardTitle>
              <CardDescription>Bu bilgiler yalnızca görüntüleme amaçlıdır</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Ad Soyad</p><p className="font-medium">{student?.fullName || user?.name}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Kullanıcı Adı</p><p className="font-medium">{student?.username || user?.username}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Sınıf</p><p className="font-medium">{student?.className || 'Yok'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Program</p><p className="font-medium">{student?.programType || 'Yok'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Veli</p><p className="font-medium">{student?.parentName || 'Yok'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">İletişim</p><p className="font-medium">{student?.parentPhone || student?.parentEmail || 'Yok'}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Akademik İlerleme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><div className="flex justify-between text-sm mb-2"><span>Devam Oranı</span><span className="font-bold">%{stats.attendanceRate}</span></div><Progress value={stats.attendanceRate} className="h-2" /></div>
              <div><div className="flex justify-between text-sm mb-2"><span>Sınav Performansı</span><span className="font-bold">%{stats.avgScore}</span></div><Progress value={stats.avgScore} className="h-2" /></div>
              <div><div className="flex justify-between text-sm mb-2"><span>Profil Tamlığı</span><span className="font-bold">%85</span></div><Progress value={85} className="h-2" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Bildirim Ayarları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ['email', 'E-posta Bildirimleri'],
                ['push', 'Masaüstü Bildirimleri'],
                ['exams', 'Sınav Bildirimleri'],
                ['content', 'İçerik Bildirimleri'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="font-medium">{label}</p></div>
                  <Switch checked={notifications[key]} onCheckedChange={(value) => setNotifications((prev) => ({ ...prev, [key]: value }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Hesap Yetkisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span>Profil güncelleme yalnızca yönetim tarafından yapılır.</span></div>
              <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>İletişim alanları veritabanından okunur.</span></div>
              <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>Destek için idari birimle iletişime geçin.</span></div>
            </CardContent>
          </Card>

          <LegalDocumentsPanel compact />
        </div>
      </div>
    </motion.div>
  );
}
