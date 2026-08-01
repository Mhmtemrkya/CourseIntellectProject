import { motion } from 'framer-motion';
import { KpiCard } from '../ui/kpi-card';

const groupVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Okul rollerinin ortak, sade dashboard özeti.
 * Her sütun yalnız o rolün karar vermesi gereken KPI'ları içerir.
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
      className={`grid items-start gap-5 ${visibleGroups.length >= 4 ? 'md:grid-cols-2 2xl:grid-cols-4' : visibleGroups.length === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}
      data-testid={testId}
    >
      {visibleGroups.map((group) => (
        <motion.section
          key={group.key}
          variants={groupVariants}
          className="min-w-0"
          data-testid={`${testId}-${group.key}`}
        >
          <div className="mb-3 min-h-[68px] border-b-2 border-[hsl(var(--brand-accent)/0.18)] pb-3">
            <h2 className="text-sm font-black tracking-tight text-foreground">{group.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid auto-rows-[126px] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
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
                className="min-h-[126px] justify-between"
                onClick={card.onClick || (card.path && navigate ? () => navigate(card.path) : undefined)}
              />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
