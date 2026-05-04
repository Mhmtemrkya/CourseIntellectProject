import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, BookOpen, Award, Calendar, Edit, Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { LegalDocumentsPanel } from '../../components/legal/LegalDocumentsPanel';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchStaff, fetchExamResults, fetchHomework } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function TeacherProfile() {
  const { user } = useApp();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ exams: 0, homework: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffList, exams, homework] = await Promise.all([
        fetchStaff('Teacher').catch(() => []),
        fetchExamResults().catch(() => []),
        fetchHomework().catch(() => []),
      ]);
      const me = Array.isArray(staffList) ? staffList.find(
        (s) => s.fullName === user?.name || s.username === user?.username,
      ) : null;
      setProfile(me || { fullName: user?.name, username: user?.username });
      setStats({
        exams: Array.isArray(exams) ? exams.length : 0,
        homework: Array.isArray(homework) ? homework.length : 0,
        students: 0,
      });
    } catch (err) {
      setError(err.message || 'Profil yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.username]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadProfile} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header Card */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700" />
          <CardContent className="relative pt-0">
            <div className="flex items-end gap-4 -mt-12">
              <div className="h-24 w-24 rounded-full bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 flex items-center justify-center shadow-lg">
                <User className="h-12 w-12 text-blue-600" />
              </div>
              <div className="pb-2">
                <h1 className="text-2xl font-bold">{profile?.fullName || user?.name || 'Ogretmen'}</h1>
                <p className="text-sm text-muted-foreground">
                  {profile?.departmentOrBranch || user?.department || 'Ogretmen'} - {user?.branch || 'Merkez Kampus'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.exams}</p>
              <p className="text-xs text-muted-foreground">Sinav</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Award className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.homework}</p>
              <p className="text-xs text-muted-foreground">Odev</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{new Date().toLocaleDateString('tr-TR')}</p>
              <p className="text-xs text-muted-foreground">Bugun</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Profile Details */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Kisisel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Ad Soyad</p>
                  <p className="font-medium">{profile?.fullName || user?.name || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">E-posta</p>
                  <p className="font-medium">{user?.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Kampus</p>
                  <p className="font-medium">{profile?.campus || user?.branch || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Brans</p>
                  <p className="font-medium">{profile?.departmentOrBranch || user?.department || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Award className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Rol</p>
                  <p className="font-medium capitalize">{user?.backendRole || user?.role || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Kullanici Adi</p>
                  <p className="font-medium">{profile?.username || user?.username || '-'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <LegalDocumentsPanel compact />
      </motion.div>
    </motion.div>
  );
}
