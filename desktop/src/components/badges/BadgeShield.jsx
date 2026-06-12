import { GraduationCap, ClipboardCheck, Flame, TrendingUp, Compass, Users, Crown, Trophy, Star, Medal, Lock } from 'lucide-react';

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

function darken(hex, amount = 0.28) {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

const SHIELD_CLIP =
  'polygon(50% 0%, 96% 12%, 96% 58%, 78% 84%, 50% 100%, 22% 84%, 4% 58%, 4% 12%)';

export default function BadgeShield({ badge, size = 64, locked = false, glow = false }) {
  const Icon = CATEGORY_ICONS[badge.category.icon] || Star;
  const height = size * 1.12;

  if (locked) {
    return (
      <div
        className="flex items-center justify-center bg-slate-300/70 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600"
        style={{ width: size, height, clipPath: SHIELD_CLIP }}
      >
        <Lock className="text-slate-500 dark:text-slate-400" style={{ width: size * 0.32, height: size * 0.32 }} />
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={glow ? { filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.22}px ${badge.category.color}88)` } : undefined}
    >
      <div
        className="flex flex-col items-center justify-center text-white"
        style={{
          width: size,
          height,
          clipPath: SHIELD_CLIP,
          background: `linear-gradient(135deg, ${badge.category.color}, ${darken(badge.category.color)})`,
        }}
      >
        <Icon style={{ width: size * 0.38, height: size * 0.38 }} />
        <span
          className="font-black tracking-widest"
          style={{ fontSize: Math.max(9, size * 0.15), marginTop: size * 0.03 }}
        >
          {badge.code}
        </span>
      </div>
    </div>
  );
}
