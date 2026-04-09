import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Shield,
  GraduationCap,
  Users,
  Wallet,
  Building2,
  Sparkles,
  Zap,
  Star,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { getRoleHomePath } from "../lib/auth";
import { desktopAppEnv } from "../lib/appEnv";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import logo from "../assets/brand/logo.png";

const features = [
  "Öğrenci ve veli yönetimi",
  "Akıllı ders programı",
  "Online yoklama sistemi",
  "Soru-cevap platformu",
  "Sınav oluşturma ve analiz",
  "Detaylı raporlama",
];

const quickUsers = [
  {
    username: "admin.ece",
    password: "Admin2026!",
    role: "admin",
    name: "Kurum Yöneticisi",
    icon: Shield,
    color: "from-blue-600 to-cyan-500",
  },
  {
    username: "muhasebe.selim",
    password: "MHS2026A",
    role: "finance",
    name: "Muhasebeci",
    icon: Wallet,
    color: "from-green-600 to-emerald-500",
  },
  {
    username: "ogrt.hasan",
    password: "HYN2026A",
    role: "teacher",
    name: "Öğretmen",
    icon: GraduationCap,
    color: "from-blue-500 to-indigo-500",
  },
  {
    username: "ali10a241",
    password: "ALI2026A",
    role: "student",
    name: "Öğrenci",
    icon: Users,
    color: "from-orange-500 to-amber-500",
  },
  {
    username: "veli.ayse",
    password: "VLI2026A",
    role: "parent",
    name: "Veli",
    icon: User,
    color: "from-teal-500 to-cyan-500",
  },
  {
    username: "idari.ceren",
    password: "CRN2026B",
    role: "administrative",
    name: "İdari Birimler",
    icon: Building2,
    color: "from-slate-600 to-sky-500",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

// Floating particles component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 10 + 5,
            height: Math.random() * 10 + 5,
            backgroundColor: i % 2 === 0 ? "#D9790B" : "#ffffff",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

// Animated background gradient
function AnimatedGradient() {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        background: [
          "linear-gradient(45deg, #00354F 0%, #004a6e 50%, #00354F 100%)",
          "linear-gradient(90deg, #00354F 0%, #003d5a 50%, #004a6e 100%)",
          "linear-gradient(135deg, #004a6e 0%, #00354F 50%, #003d5a 100%)",
          "linear-gradient(180deg, #003d5a 0%, #004a6e 50%, #00354F 100%)",
          "linear-gradient(45deg, #00354F 0%, #004a6e 50%, #00354F 100%)",
        ],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

// Animated Logo Component
function AnimatedLogo() {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 20px rgba(217, 121, 11, 0.3)",
            "0 0 40px rgba(217, 121, 11, 0.6)",
            "0 0 20px rgba(217, 121, 11, 0.3)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.img
        src={logo}
        alt="CourseIntellect"
        className="h-16 w-16 relative z-10"
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </motion.div>
  );
}

// Animated text reveal
function AnimatedText({ text, className, delay = 0 }) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + index * 0.03, duration: 0.3 }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithBrowser, isAuthenticated, user } = useApp();
  const { refreshBranding } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hoveredUser, setHoveredUser] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedUser = await login({ username, password });
      refreshBranding();
      navigate(getRoleHomePath(loggedUser.role), { replace: true });
    } catch (err) {
      setError(err?.message || "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const loggedUser = await loginWithBrowser();
      refreshBranding();
      navigate(getRoleHomePath(loggedUser.role), { replace: true });
    } catch (err) {
      setError(err?.message || "Tarayıcı ile giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user) => {
    setUsername(user.username);
    setPassword(user.password);
    try {
      setLoading(true);
      const loggedUser = await login({
        username: user.username,
        password: user.password,
      });
      refreshBranding();
      navigate(getRoleHomePath(loggedUser.role), { replace: true });
    } catch (err) {
      setError(err?.message || "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Panel - Brand */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        <AnimatedGradient />
        <FloatingParticles />

        {/* Animated circles */}
        <motion.div
          className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-white/5"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#D9790B]/20"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [360, 270, 180, 90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity }}
        />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex items-center gap-4 mb-12"
          >
            <AnimatedLogo />
            <motion.span
              className="font-heading text-3xl font-bold"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              CourseIntellect
            </motion.span>
          </motion.div>

          {/* Tagline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="font-heading text-4xl xl:text-5xl font-bold leading-tight mb-6"
          >
            Eğitimde Yeni Nesil
            <br />
            <motion.span
              className="text-[#D9790B]"
              animate={{
                textShadow: [
                  "0 0 10px rgba(217, 121, 11, 0.5)",
                  "0 0 20px rgba(217, 121, 11, 0.8)",
                  "0 0 10px rgba(217, 121, 11, 0.5)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Yönetim Sistemi
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-lg text-white/80 mb-10 max-w-md"
          >
            Kurumunuzun tüm eğitim süreçlerini tek bir platformda yönetin.
          </motion.p>

          {/* Features */}
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {features.map((feature, index) => (
              <motion.li
                key={index}
                variants={itemVariants}
                className="flex items-center gap-3 text-white/90"
                whileHover={{ x: 10, color: "#D9790B" }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1, type: "spring" }}
                >
                  <CheckCircle2 className="h-5 w-5 text-[#D9790B] flex-shrink-0" />
                </motion.div>
                <span>{feature}</span>
              </motion.li>
            ))}
          </motion.ul>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex gap-8 mt-12"
          >
            {[
              { value: "50+", label: "Kurum" },
              { value: "10K+", label: "Kullanıcı" },
              { value: "%99", label: "Memnuniyet" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                whileHover={{ scale: 1.1 }}
              >
                <motion.p
                  className="text-3xl font-bold text-[#D9790B]"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.4 + index * 0.2, type: "spring" }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-sm text-white/70">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden flex items-center justify-center gap-3 mb-8"
          >
            <img src={logo} alt="CourseIntellect" className="h-12 w-12" />
            <span className="font-heading text-2xl font-bold text-brand-primary">
              CourseIntellect
            </span>
          </motion.div>

          <Card className="border-0 shadow-2xl overflow-hidden">
            {/* Uygulamayı Kapat Butonu */}
            <button
              onClick={() => import("../lib/tauri").then((m) => m.closeApp())}
              style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}
              className="bg-destructive text-white rounded-full px-3 py-1 text-xs shadow hover:bg-destructive/80 transition-all"
              type="button"
            >
              Uygulamayı Kapat
            </button>
            <motion.div
              className="h-1 bg-gradient-to-r from-brand-primary via-[#D9790B] to-brand-primary"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              style={{ backgroundSize: "200% 100%" }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <CardHeader className="space-y-1 pb-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <CardTitle className="font-heading text-2xl flex items-center gap-2">
                  Hoş Geldiniz
                  <motion.span
                    animate={{ rotate: [0, 20, 0] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  >
                    👋
                  </motion.span>
                </CardTitle>
                <CardDescription>Hesabınıza giriş yapın</CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, scale: 0.8 }}
                      animate={{ opacity: 1, height: "auto", scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.8 }}
                      className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Username */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Label htmlFor="username">Kullanıcı Adı</Label>
                  <div className="relative group">
                    <motion.div
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-brand-primary to-[#D9790B] opacity-0 group-focus-within:opacity-100 -m-0.5"
                      initial={false}
                      animate={{ opacity: username ? 0.2 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="kullaniciadi"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 relative bg-background"
                      data-testid="username-input"
                      required
                    />
                  </div>
                </motion.div>

                {/* Password */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Label htmlFor="password">Şifre</Label>
                  <div className="relative group">
                    <motion.div
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-brand-primary to-[#D9790B] opacity-0 group-focus-within:opacity-100 -m-0.5"
                      initial={false}
                      animate={{ opacity: password ? 0.2 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 relative bg-background"
                      data-testid="password-input"
                      required
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Remember & Forgot */}
                <motion.div
                  className="flex items-center justify-between"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={remember}
                      onCheckedChange={setRemember}
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Beni hatırla
                    </Label>
                  </div>
                  <Button
                    variant="link"
                    className="px-0 text-[#D9790B] hover:text-[#D9790B]/80"
                  >
                    Şifremi unuttum
                  </Button>
                </motion.div>

                {/* Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-brand-primary to-[#00456a] hover:from-[#00456a] hover:to-brand-primary text-white shadow-lg"
                    disabled={loading}
                    data-testid="login-button"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <span className="flex items-center gap-2">
                        Giriş Yap
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </motion.span>
                      </span>
                    )}
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="relative flex items-center gap-3 py-2"
                >
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted-foreground">veya</span>
                  <div className="flex-1 border-t border-border" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={handleBrowserLogin}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Tarayıcı ile Giriş Yap
                  </Button>
                </motion.div>
              </form>

              {desktopAppEnv.allowDemoCredentials ? (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Demo Hesapları
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {quickUsers.map((user, index) => {
                      const Icon = user.icon;
                      return (
                        <motion.button
                          key={user.username}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: 0.9 + index * 0.1,
                            type: "spring",
                          }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onHoverStart={() => setHoveredUser(user.username)}
                          onHoverEnd={() => setHoveredUser(null)}
                          onClick={() => handleQuickLogin(user)}
                          className="relative flex items-center gap-2 p-2 rounded-lg border border-border hover:border-[#D9790B]/50 transition-all text-left overflow-hidden group"
                          data-testid={`demo-${user.role}`}
                        >
                          <motion.div
                            className={`absolute inset-0 bg-gradient-to-r ${user.color} opacity-0 group-hover:opacity-10 transition-opacity`}
                          />
                          <motion.div
                            className={`p-1.5 rounded-md bg-gradient-to-r ${user.color}`}
                            animate={
                              hoveredUser === user.username
                                ? { rotate: [0, -10, 10, 0] }
                                : {}
                            }
                            transition={{ duration: 0.3 }}
                          >
                            <Icon className="h-3.5 w-3.5 text-white" />
                          </motion.div>
                          <div className="flex-1 min-w-0 relative z-10">
                            <p className="text-xs font-medium truncate">
                              {user.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {user.username}
                            </p>
                          </div>
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{
                              opacity: hoveredUser === user.username ? 1 : 0,
                              x: hoveredUser === user.username ? 0 : -10,
                            }}
                          >
                            <Sparkles className="h-3 w-3 text-[#D9790B]" />
                          </motion.div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </CardContent>
          </Card>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            © 2025 CourseIntellect. Tüm hakları saklıdır.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
