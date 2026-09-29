import { KpiCard } from '../ui/kpi-card';

/**
 * Okul rollerinin ortak KPI ızgarası.
 * Gruplar veri sırasını korur; görsel başlık çizmez. Böylece her rol yalnız
 * kendisine ait kartları aynı ölçüde, boşluksuz ve tek bir grid içinde görür.
 */
export default function RoleDashboardColumns({ groups = [], navigate, testId = 'role-dashboard-columns' }) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      cards: (group.cards || []).filter((card) => card.value !== null && card.value !== undefined),
    }))
    .filter((group) => group.cards.length > 0);

  return (
    <div
      className="grid auto-rows-[150px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      data-testid={testId}
    >
      {visibleGroups.map((group) => (
        <div
          key={group.key}
          className="contents"
          data-testid={`${testId}-${group.key}`}
        >
          {group.cards.map((card) => (
            <KpiCard
              key={card.key}
              testId={`${testId}-card-${card.key}`}
              label={card.label}
              value={card.value}
              caption={card.caption}
              icon={card.icon || card.Icon}
              tone={card.tone}
              containerClassName="h-full min-w-0"
              className="min-h-[150px] justify-between"
              onClick={card.onClick || (card.path && navigate ? () => navigate(card.path) : undefined)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
