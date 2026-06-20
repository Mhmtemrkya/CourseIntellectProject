import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ClipboardCheck, Flame, TrendingUp, Compass, Users, Crown, Trophy, Star, Medal, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchStudyPlan } from '../../lib/api/modules';
import {
  BADGE_CATEGORIES,
  BADGE_TOTAL,
  badgeXpThreshold,
  getAllBadges,
  nextBadge,
  unlockedBadgeCount,
} from '../../lib/badges';
import BadgeShield from '../../components/badges/BadgeShield';

const CATEGORY_ICONS = {
  GraduationCap,
  ClipboardCheck,
  Flame,
  TrendingUp,
  Compass,
  Users,
  Crown,
  Trophy,
  Star,
  Medal,
};

export default function StudentBadges() {
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const state = await fetchStudyPlan();
      setXp(Number(state?.xpPoints) || 0);
    } catch (err) {
      setError(err.message || 'Rozet bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Rozetler hazırlanıyor...</p>
      </div>
    );
  }

  const unlocked = unlockedBadgeCount(xp);
  const next = nextBadge(xp);
  const prevThreshold = unlocked === 0 ? 0 : badgeXpThreshold(unlocked);
  const nextProgress = next
    ? Math.min(100, Math.max(0, ((xp - prevThreshold) / (next.xpThreshold - prevThreshold)) * 100))
    : 100;
  const allBadges = getAllBadges();

  return (
    <div className="space-y-6" data-testid="student-badges-page">
      {error && <ErrorBanner message={error} onRetry={load} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-[#08111F] to-[#FF7A1A] p-6 text-white">
            <h1 className="text-2xl lg:text-3xl font-black">300 BAŞARI ROZETİ</h1>
            <p className="text-foreground/85 mt-1">Her soru, her ödev, her adım seni zirveye taşır.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 max-w-xl">
              <div className="rounded-2xl bg-foreground/15 px-4 py-3">
                <p className="text-xl font-black">{unlocked} / {BADGE_TOTAL}</p>
                <p className="text-xs text-foreground/80 font-semibold">Açılan Rozet</p>
              </div>
              <div className="rounded-2xl bg-foreground/15 px-4 py-3">
                <p className="text-xl font-black">{xp} XP</p>
                <p className="text-xs text-foreground/80 font-semibold">Toplam XP</p>
              </div>
              {next && (
                <div className="rounded-2xl bg-foreground/15 px-4 py-3 col-span-2 sm:col-span-1">
                  <p className="text-sm font-black truncate">{next.name}</p>
                  <p className="text-xs text-foreground/80 font-semibold">Sıradaki • {next.xpThreshold} XP</p>
                </div>
              )}
            </div>
            {next && (
              <div className="mt-4 max-w-xl">
                <Progress value={nextProgress} className="h-3 bg-foreground/20" />
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {BADGE_CATEGORIES.map((category, categoryIndex) => {
        const Icon = CATEGORY_ICONS[category.icon] || Star;
        const badges = allBadges.filter((badge) => badge.category.id === category.id);
        const unlockedInCategory = badges.filter((badge) => xp >= badge.xpThreshold).length;

        return (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(0.4, categoryIndex * 0.05) }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {category.name}
                  </CardTitle>
                  <Badge
                    className="border-0 font-bold"
                    style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                  >
                    {unlockedInCategory} / {badges.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                  {badges.map((badge) => {
                    const isUnlocked = xp >= badge.xpThreshold;
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => setSelected({ badge, isUnlocked })}
                        className="flex flex-col items-center gap-1 group"
                        title={`${badge.name} • ${badge.xpThreshold} XP`}
                      >
                        <div className="transition-transform group-hover:scale-110">
                          <BadgeShield badge={badge} size={48} locked={!isUnlocked} glow={isUnlocked} />
                        </div>
                        <span
                          className={`text-[10px] font-bold text-center leading-tight truncate w-full ${
                            isUnlocked ? '' : 'text-muted-foreground'
                          }`}
                        >
                          {badge.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">{selected.badge.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <BadgeShield
                  badge={selected.badge}
                  size={96}
                  locked={!selected.isUnlocked}
                  glow={selected.isUnlocked}
                />
                <p className="text-sm text-muted-foreground">
                  {selected.badge.category.name} • Rozet {selected.badge.code}
                </p>
                <p className="text-sm inline-flex items-center gap-1 font-semibold">
                  <Zap className="h-4 w-4 text-orange-500" />
                  {selected.isUnlocked
                    ? `${selected.badge.xpThreshold} XP eşiğini geçerek kazandın.`
                    : `Açmak için ${selected.badge.xpThreshold} XP gerekiyor (${Math.max(0, selected.badge.xpThreshold - xp)} XP kaldı).`}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
