import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Timer,
  BarChart3,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { getUserHomePath } from "../lib/auth";
import { requestPasswordReset } from "../lib/api/modules";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import emblem from "../assets/brand/emblem.png";
import loginBackground from "../assets/brand/loginbackground.jpeg";

// SchoolAsist marka renkleri — giriş ekranı kurum temasından bağımsız,
// sabit marka paletiyle çizilir (mockup: lacivert + turuncu).
const NAVY = "#15294B";
const NAVY_SOFT = "#1E3A66";
const ORANGE = "#F7941D";
const LIGHT_BG = "#F4F6FA";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Güvenli",
    text: "Verileriniz en üst düzey güvenlik ile korunur.",
  },
  {
    icon: Timer,
    title: "Zaman Tasarrufu",
    text: "Tüm süreçleri otomatikleştirin, verimliliği artırın.",
  },
  {
    icon: BarChart3,
    title: "Analitik Raporlar",
    text: "Gerçek zamanlı verilerle doğru kararlar alın.",
  },
  {
    icon: Users,
    title: "Kolay Kullanım",
    text: "Basit ve anlaşılır arayüz ile hızla adapte olun.",
  },
];

// Amblem + iki renkli yazı: School (lacivert) + Asist (turuncu)
function BrandMark({ size = "md", light = false }) {
  const imgClass = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const textClass = size === "lg" ? "text-3xl" : "text-2xl";
  return (
    <div className="flex items-center gap-3">
      <img src={emblem} alt="SchoolAsist" className={`${imgClass} object-contain`} />
      <span className={`font-heading font-extrabold tracking-tight ${textClass}`}>
        <span style={{ color: light ? "#FFFFFF" : NAVY }}>School</span>
        <span style={{ color: ORANGE }}>Asist</span>
      </span>
    </div>
  );
}

// Köşelere serpiştirilen nokta ızgarası (mockup dekoru)
function DotGrid({ className, color = NAVY, opacity = 0.35 }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        width: 110,
        height: 90,
        opacity,
        backgroundImage: `radial-gradient(${color} 2.2px, transparent 2.2px)`,
        backgroundSize: "22px 22px",
      }}
    />
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useApp();
  const { refreshBranding } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(getUserHomePath(user), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedUser = await login({ username, password });
      refreshBranding();
      navigate(getUserHomePath(loggedUser), { replace: true });
    } catch (err) {
      setError(err?.message || "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  const openForgotDialog = () => {
    setForgotEmail(username.includes("@") ? username : "");
    setForgotSuccess("");
    setForgotOpen(true);
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = forgotEmail.trim();
    if (!email || !email.includes("@")) {
      toast({
        title: "E-posta gerekli",
        description: "Kayıtlı e-posta adresinizi girin.",
        variant: "destructive",
      });
      return;
    }

    try {
      setForgotLoading(true);
      const result = await requestPasswordReset(email);
      setForgotSuccess(
        result?.message ||
          "E-posta sistemde kayıtlıysa talep kurum yetkililerine iletildi."
      );
      toast({
        title: "Talep alındı",
        description: "Yetkili onayladığında size geçici şifre verilecek.",
      });
    } catch (err) {
      toast({
        title: "Talep gönderilemedi",
        description: err?.message || "Lütfen daha sonra tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: LIGHT_BG }}
      data-testid="login-page"
    >
      {/* Sağdaki büyük lacivert daire + arkasındaki turuncu kontur yayı */}
      <div
        aria-hidden
        className="pointer-events-none absolute hidden lg:block"
        style={{
          top: "50%",
          right: "-46vw",
          width: "100vw",
          height: "175vh",
          transform: "translateY(-50%)",
          borderRadius: "50%",
          border: `4px solid ${ORANGE}`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute hidden lg:block"
        style={{
          top: "50%",
          right: "-48vw",
          width: "100vw",
          height: "175vh",
          transform: "translateY(-50%)",
          borderRadius: "50%",
          background: `linear-gradient(rgba(21, 41, 75, 0.88), rgba(14, 29, 56, 0.93)), url(${loginBackground}) center / cover no-repeat`,
        }}
      />

      {/* Sol altta turuncu kıvrımlı şerit */}
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 hidden lg:block"
        width="520"
        height="190"
        viewBox="0 0 520 190"
        fill="none"
      >
        <path
          d="M0 190 L0 120 C90 60 220 40 340 92 C420 126 480 170 520 190 Z"
          fill={NAVY}
        />
        <path
          d="M0 132 C90 66 220 44 340 96"
          stroke={ORANGE}
          strokeWidth="14"
          strokeLinecap="round"
        />
      </svg>

      <DotGrid className="left-[38%] top-10 hidden lg:block" />
      <DotGrid className="right-8 top-24 hidden lg:block" color={ORANGE} opacity={0.8} />
      <DotGrid className="right-24 bottom-16 hidden xl:block" color={ORANGE} opacity={0.5} />

      {/* Dil değiştirici */}
      <button
        onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
        className="absolute right-40 top-4 z-30 rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-white shadow backdrop-blur hover:bg-black/40 transition-all"
        type="button"
      >
        {language === "tr" ? "EN" : "TR"}
      </button>

      {/* Uygulamayı Kapat */}
      <button
        onClick={() => import("../lib/tauri").then((m) => m.closeApp())}
        className="absolute right-4 top-4 z-30 rounded-full bg-black/25 px-3 py-1 text-xs text-white shadow backdrop-blur hover:bg-black/40 transition-all"
        type="button"
      >
        Uygulamayı Kapat
      </button>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1400px] items-center gap-10 px-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:px-16">
        {/* Sol panel — tanıtım */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="hidden max-w-xl lg:block"
        >
          <BrandMark />

          <h1
            className="font-heading mt-12 text-5xl font-extrabold leading-[1.12] xl:text-6xl"
            style={{ color: NAVY }}
          >
            Eğitimi
            <br />
            <span style={{ color: ORANGE }}>Kolaylaştıran</span>
            <br />
            Akıllı Çözümler
          </h1>

          <p className="mt-6 max-w-md text-lg" style={{ color: "#4B5B75" }}>
            Okulunuzun tüm süreçlerini tek platformda yönetin, zamandan
            tasarruf edin.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((feature, index) => (
              <motion.li
                key={feature.title}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.12, duration: 0.45 }}
                className="flex items-start gap-4"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md"
                  style={{ color: NAVY, backgroundColor: "#FFFFFF" }}
                >
                  <feature.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-bold" style={{ color: NAVY }}>
                    {feature.title}
                  </span>
                  <span className="block text-sm" style={{ color: "#5B6B84" }}>
                    {feature.text}
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Sağ panel — giriş kartı */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          className="mx-auto w-full max-w-md"
        >
          {/* Login kurumsal temadan bağımsız — koyu temadaki .bg-white ezmesine
              takılmamak için kart ve alanlar inline stille beyaz sabitlenir. */}
          <div
            className="rounded-3xl p-8 shadow-2xl sm:p-10"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <div className="flex flex-col items-center text-center">
              <BrandMark />
              <h2
                className="font-heading mt-6 text-2xl font-extrabold"
                style={{ color: NAVY }}
              >
                Giriş Yapın
              </h2>
              <p className="mt-2 text-sm" style={{ color: "#6B7A93" }}>
                Hesabınıza giriş yapmak için bilgilerinizi girin.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
                  style={{ color: "#8A97AC" }}
                />
                <Input
                  id="username"
                  type="text"
                  placeholder="E-posta adresiniz"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 rounded-xl pl-11 placeholder:text-slate-400"
                  style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#E2E8F0" }}
                  data-testid="username-input"
                  required
                />
              </div>

              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
                  style={{ color: "#8A97AC" }}
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl pl-11 pr-11 placeholder:text-slate-400"
                  style={{ backgroundColor: "#FFFFFF", color: "#0F172A", borderColor: "#E2E8F0" }}
                  data-testid="password-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={setRemember}
                    className="border-slate-300"
                  />
                  <Label
                    htmlFor="remember"
                    className="cursor-pointer text-sm font-semibold"
                    style={{ color: NAVY }}
                  >
                    Beni hatırla
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold hover:underline"
                  style={{ color: ORANGE }}
                  onClick={openForgotDialog}
                >
                  Şifremi unuttum?
                </button>
              </div>

              <Button
                type="submit"
                className="relative h-12 w-full rounded-xl text-base font-bold normal-case tracking-normal text-white shadow-lg transition-all hover:brightness-105"
                style={{ backgroundColor: ORANGE }}
                disabled={loading}
                data-testid="login-button"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white"
                  />
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm" style={{ color: "#6B7A93" }}>
              Hesabınız yok mu?{" "}
              <a
                href="mailto:destek@schoolasist.com"
                className="font-semibold hover:underline"
                style={{ color: ORANGE }}
              >
                İletişime geçin
              </a>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 lg:text-slate-300">
            © 2026 SchoolAsist. Tüm hakları saklıdır.
          </p>
        </motion.div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(247, 148, 29, 0.15)", color: ORANGE }}
              >
                <Mail className="h-4 w-4" />
              </span>
              Şifremi Unuttum
            </DialogTitle>
            <DialogDescription>
              Kayıtlı e-postanızı girin. Talep kurum yöneticisi ve idari
              yetkili ekranına düşer; onaylanınca size tek kullanımlık
              geçici şifre verilir.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Kayıtlı E-posta</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="ornek@kurum.com"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                autoFocus
              />
            </div>
            {forgotSuccess ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                {forgotSuccess}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
                disabled={forgotLoading}
              >
                Kapat
              </Button>
              <Button type="submit" disabled={forgotLoading}>
                {forgotLoading ? "Gönderiliyor..." : "Talebi Gönder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
