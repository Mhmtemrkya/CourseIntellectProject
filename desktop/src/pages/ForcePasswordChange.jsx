import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { changePassword } from '../lib/api/modules';
import { clearDesktopSession } from '../lib/auth';
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
  const { setUser, setSession } = useApp();
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

  const handleBackToLogin = () => {
    clearDesktopSession();
    setUser(null);
    setSession(null);
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!allValid) {
      toast({ title: 'Şifre kuralları sağlanmadı', description: 'Tüm gereksinimleri karşılayın.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await changePassword({ currentPassword: null, newPassword });
      clearDesktopSession();
      setUser(null);
      setSession(null);
      toast({ title: 'Şifre güncellendi', description: 'Yeni şifrenizle tekrar giriş yapın.', variant: 'default' });
      navigate('/login', { replace: true });
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

            {!allValid && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
                Butonun açılması için aşağıdaki tüm maddeler yeşil olmalı. Örnek güçlü şifre:
                <span className="font-semibold text-amber-50"> Course2026</span>
              </div>
            )}

            <ul className="text-xs space-y-1 pt-1">
              <ValidationRow ok={validations.length} text="En az 8 karakter" />
              <ValidationRow ok={validations.upper} text="Büyük harf (A-Z)" />
              <ValidationRow ok={validations.lower} text="Küçük harf (a-z)" />
              <ValidationRow ok={validations.digit} text="Rakam (0-9)" />
              <ValidationRow ok={validations.match} text="Şifreler eşleşiyor" />
            </ul>

            <Button
              type="submit"
              disabled={!allValid || saving}
              className="w-full disabled:bg-slate-700 disabled:text-slate-300"
            >
              {saving ? 'Kaydediliyor...' : 'Şifreyi Güncelle ve Devam Et'}
            </Button>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Giriş ekranına dön
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationRow({ ok, text }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-amber-400/80'}`} />
      {text}
    </li>
  );
}
