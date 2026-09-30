import type { ReactNode } from 'react';
import { KpiCard, type KpiTone } from '../ui/kpi-card';
import type { IconComponent } from '@/types/ui';

export interface RoleDashboardCard {
  key: string;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  icon?: IconComponent | null;
  /** Eski çağrılar büyük harfli `Icon` anahtarıyla geçer. */
  Icon?: IconComponent | null;
  tone?: KpiTone;
  path?: string;
  onClick?: () => void;
}

export interface RoleDashboardGroup {
  key: string;
  /** Veri düzeni için; ızgara başlık çizmez. */
  title?: string;
  description?: string;
  cards?: RoleDashboardCard[];
}

/**
 * Okul rollerinin ortak KPI ızgarası.
 * Gruplar veri sırasını korur; görsel başlık çizmez. Böylece her rol yalnız
 * kendisine ait kartları aynı ölçüde, boşluksuz ve tek bir grid içinde görür.
 */
export default function RoleDashboardColumns({ groups = [], navigate, testId = 'role-dashboard-columns' }: {
  groups?: RoleDashboardGroup[];
  navigate?: (path: string) => void;
  testId?: string;
}) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      cards: (group.cards || []).filter((card) => card.value !== null && card.value !== undefined),
    }))
    .filter((group) => group.cards.length > 0);

  return (
    <div
      className="ci-metric-grid grid auto-rows-[minmax(172px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid={testId}
    >
      {visibleGroups.map((group) => (
        <div
          key={group.key}
          className="contents"
          data-testid={`${testId}-${group.key}`}
        >
          {group.cards.map((card, index) => (
            <KpiCard
              key={card.key}
              testId={`${testId}-card-${card.key}`}
              label={card.label}
              value={card.value}
              caption={card.caption}
              icon={card.icon || card.Icon}
              tone={card.tone}
              containerClassName={index === 0 && group.key !== 'collection' ? 'h-full min-w-0 lg:col-span-2' : 'h-full min-w-0'}
              className="min-h-[172px] justify-between"
              onClick={card.onClick || (card.path && navigate ? () => navigate(card.path ?? '') : undefined)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
