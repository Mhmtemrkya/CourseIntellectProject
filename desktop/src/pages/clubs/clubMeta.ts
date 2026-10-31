import {
  Atom, BookOpen, Cpu, Dumbbell, Globe2, HandHeart, Landmark, Music, Palette, Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface ClubCategoryMeta {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

/** Sunucudaki ClubService.Categories ile birebir. */
export const CLUB_CATEGORIES: ClubCategoryMeta[] = [
  { key: 'Science', label: 'Bilim', icon: Atom, color: '#0891B2' },
  { key: 'Technology', label: 'Teknoloji & Robotik', icon: Cpu, color: '#2563EB' },
  { key: 'Sports', label: 'Spor', icon: Dumbbell, color: '#16A34A' },
  { key: 'Arts', label: 'Sanat', icon: Palette, color: '#DB2777' },
  { key: 'Music', label: 'Müzik', icon: Music, color: '#9333EA' },
  { key: 'Literature', label: 'Edebiyat & Münazara', icon: BookOpen, color: '#CA8A04' },
  { key: 'Language', label: 'Yabancı Dil', icon: Globe2, color: '#0D9488' },
  { key: 'SocialResponsibility', label: 'Sosyal Sorumluluk', icon: HandHeart, color: '#DC2626' },
  { key: 'Culture', label: 'Kültür & Tarih', icon: Landmark, color: '#EA580C' },
  { key: 'Other', label: 'Diğer', icon: Sparkles, color: '#64748B' },
];

const FALLBACK: ClubCategoryMeta = { key: 'Other', label: 'Diğer', icon: Sparkles, color: '#64748B' };

export function categoryMeta(key: string | null | undefined): ClubCategoryMeta {
  return CLUB_CATEGORIES.find((item) => item.key === key) ?? FALLBACK;
}

export const CLUB_ROLES: Array<{ key: string; label: string }> = [
  { key: 'President', label: 'Kulüp Başkanı' },
  { key: 'VicePresident', label: 'Başkan Yardımcısı' },
  { key: 'Secretary', label: 'Sekreter' },
  { key: 'Member', label: 'Üye' },
];

export function roleLabel(key: string | null | undefined): string {
  return CLUB_ROLES.find((item) => item.key === key)?.label ?? 'Üye';
}

export const MEMBER_STATUS_LABEL: Record<string, string> = {
  Pending: 'Onay bekliyor',
  Active: 'Üye',
  Rejected: 'Kabul edilmedi',
  Left: 'Ayrıldı',
};

export const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  Planned: 'Planlandı',
  Completed: 'Tamamlandı',
  Cancelled: 'İptal edildi',
};

export function currentAcademicYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function academicYearOptions(): string[] {
  const start = Number(currentAcademicYear().slice(0, 4));
  return [start + 1, start, start - 1].map((year) => `${year}-${year + 1}`);
}

export function formatDateTimeTr(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: 'long', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/** datetime-local girdisi için yerel "YYYY-MM-DDTHH:mm". */
export function toLocalInput(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date(Date.now() + 86400000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
