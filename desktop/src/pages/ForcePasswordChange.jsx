import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { changePassword } from '../lib/api/modules';
import { getUserHomePath } from '../lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';

function evaluateStrength(value) {
  if (!value) return { score: 0, label: 'Çok zayıf', color: 'bg-red-500' };
  let score = 0;
  if (value.length >= 8) score += 25;
  if (value.length >= 12) score += 15;
  if (/[A-Z]/.test(value)) score += 15;
  if (/[a-z]/.test(value)) score += 15;
  if (/[0-9]/.test(value)) score += 15;
  if (/[^A-Za-z0-9]/.test(value)) score += 15;
  score = Math.min(score, 100);
  if (score < 40) return { score, label: 'Zayıf', color: 'bg-red-500' };
  if (score < 70) return { score, label: 'Orta', color: 'bg-yellow-500' };
  if (score < 90) return { score, label: 'Güçlü', color: 'bg-emerald-500' };
  return { score, label: 'Çok güçlü', color: 'bg-emerald-600' };
}

export default function ForcePasswordChange() {
  const { user, markPasswordChanged } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => evaluateStrength(newPassword), [newPassword]);

  const validations = useMemo(() => ({
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    digit: /[0-9]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirm,
  }), [newPassword, confirm]);

  const allValid = Object.values(validations).every(Boolean);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!allValid) {
      toast({ title: 'Şifre kuralları sağlanmadı', description: 'Tüm gereksinimleri karşılayın.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await changePassword({ currentPassword: null, newPassword });
      toast({ title: 'Şifre güncellendi', description: 'Hoş geldiniz.', variant: 'default' });
      if (typeof markPasswordChanged === 'function') {
        markPasswordChanged();
      }
      const target = user ? getUserHomePath({ ...user, mustChangePassword: false }) : '/dashboard';
      navigate(target, { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Şifre güncellenemedi.';
      toast({ title: 'Hata', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <CardTitle className="text-2xl text-white">Yeni Şifre Belirleyin</CardTitle>
          <CardDescription className="text-slate-400">
            Hesabınızı güvende tutmak için ilk girişte şifrenizi yenilemeniz gerekiyor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300">Yeni Şifre</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-800 border-slate-700 pl-9 pr-10 text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Şifre Gücü</span>
                    <span className="text-slate-300 font-medium">{strength.label}</span>
                  </div>
                  <Progress value={strength.score} className="h-1.5" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Şifreyi Doğrula</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="••••••••"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <ul className="text-xs text-slate-400 space-y-1 pt-1">
              <ValidationRow ok={validations.length} text="En az 8 karakter" />
              <ValidationRow ok={validations.upper} text="Büyük harf (A-Z)" />
              <ValidationRow ok={validations.lower} text="Küçük harf (a-z)" />
              <ValidationRow ok={validations.digit} text="Rakam (0-9)" />
              <ValidationRow ok={validations.match} text="Şifreler eşleşiyor" />
            </ul>

            <Button type="submit" disabled={!allValid || saving} className="w-full">
              {saving ? 'Kaydediliyor...' : 'Şifreyi Güncelle ve Devam Et'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationRow({ ok, text }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      {text}
    </li>
  );
}
