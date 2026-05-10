import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, MapPin, BookOpen, Award, Calendar, Eye, EyeOff, Lock, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { Progress } from '../../components/ui/progress';
import { LegalDocumentsPanel } from '../../components/legal/LegalDocumentsPanel';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchStaff, fetchExamResults, fetchHomework, changePassword } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function evaluateStrength(value) {
  if (!value) return { score: 0, label: 'Çok zayıf' };
  let score = 0;
  if (value.length >= 8) score += 25;
  if (value.length >= 12) score += 15;
  if (/[A-Z]/.test(value)) score += 15;
  if (/[a-z]/.test(value)) score += 15;
  if (/[0-9]/.test(value)) score += 15;
  if (/[^A-Za-z0-9]/.test(value)) score += 15;
  score = Math.min(score, 100);
  if (score < 40) return { score, label: 'Zayıf' };
  if (score < 70) return { score, label: 'Orta' };
  if (score < 90) return { score, label: 'Güçlü' };
  return { score, label: 'Çok güçlü' };
}

export default function TeacherProfile() {
  const { user } = useApp();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ exams: 0, homework: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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


  const strength = useMemo(() => evaluateStrength(passwordForm.newPassword), [passwordForm.newPassword]);

  const passwordValidations = useMemo(() => ({
    current: passwordForm.currentPassword.length > 0,
    length: passwordForm.newPassword.length >= 8,
    upper: /[A-Z]/.test(passwordForm.newPassword),
    lower: /[a-z]/.test(passwordForm.newPassword),
    digit: /[0-9]/.test(passwordForm.newPassword),
    match: passwordForm.newPassword.length > 0 && passwordForm.newPassword === passwordForm.confirm,
  }), [passwordForm]);

  const passwordFormValid = Object.values(passwordValidations).every(Boolean);

  const handlePasswordField = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!passwordFormValid) {
      toast({ title: 'Şifre kuralları sağlanmadı', description: 'Mevcut şifre ve yeni şifre gereksinimlerini kontrol edin.', variant: 'destructive' });
      return;
    }
    try {
      setChangingPassword(true);
      await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast({ title: 'Şifre güncellendi', description: 'Yeni şifreniz sonraki girişlerde geçerli olacak.' });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Şifre güncellenemedi.';
      toast({ title: 'Şifre güncellenemedi', description: message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadProfile} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header Card */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-brand-primary to-brand-accent" />
          <CardContent className="relative pt-0">
            <div className="flex items-end gap-4 -mt-12">
              <div className="h-24 w-24 rounded-full bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 flex items-center justify-center shadow-lg">
                <User className="h-12 w-12 text-brand-primary" />
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
            <BookOpen className="h-8 w-8 text-brand-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.exams}</p>
              <p className="text-xs text-muted-foreground">Sinav</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Award className="h-8 w-8 text-brand-accent" />
            <div>
              <p className="text-2xl font-bold">{stats.homework}</p>
              <p className="text-xs text-muted-foreground">Odev</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-8 w-8 text-brand-accent" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-primary" />
              Güvenlik ve Şifre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-brand-primary/15 bg-brand-primary/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-brand-primary/10 p-3 text-brand-primary">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Şifre Değiştir</p>
                    <p className="text-sm text-muted-foreground">Hesap güvenliğiniz için mevcut şifrenizi doğrulayın.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Mevcut Şifre</Label>
                    <Input
                      id="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordField('currentPassword')}
                      placeholder="Mevcut şifreniz"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Yeni Şifre</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={handlePasswordField('newPassword')}
                        placeholder="En az 8 karakter"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-brand-primary"
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Yeni Şifre Tekrar</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordForm.confirm}
                      onChange={handlePasswordField('confirm')}
                      placeholder="Yeni şifreyi tekrar girin"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-2xl border border-brand-primary/10 bg-brand-primary/5 p-5">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Şifre Gücü</span>
                      <span className="font-semibold text-brand-primary">{strength.label}</span>
                    </div>
                    <Progress value={strength.score} className="h-2" />
                  </div>
                  <ul className="space-y-2 text-sm">
                    <ValidationRow ok={passwordValidations.current} text="Mevcut şifre girildi" />
                    <ValidationRow ok={passwordValidations.length} text="En az 8 karakter" />
                    <ValidationRow ok={passwordValidations.upper} text="Büyük harf içerir" />
                    <ValidationRow ok={passwordValidations.lower} text="Küçük harf içerir" />
                    <ValidationRow ok={passwordValidations.digit} text="Rakam içerir" />
                    <ValidationRow ok={passwordValidations.match} text="Yeni şifreler eşleşiyor" />
                  </ul>
                </div>
                <Button type="submit" disabled={!passwordFormValid || changingPassword} className="mt-6 bg-brand-primary hover:bg-brand-primary/90">
                  {changingPassword ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <LegalDocumentsPanel compact />
      </motion.div>
    </motion.div>
  );
}


function ValidationRow({ ok, text }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {text}
    </li>
  );
}
