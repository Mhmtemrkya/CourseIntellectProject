// CourseIntellect Empty State Component
import { motion } from 'framer-motion';
import { Button } from './button';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {Icon && (
        <div className="p-4 rounded-full bg-muted mb-4">
          <Icon className="h-12 w-12 text-muted-foreground/50" />
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-semibold font-heading mb-2">{title}</h3>
      )}
      
      {description && (
        <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      
      {action && actionLabel && (
        <Button 
          onClick={action}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

// Illustration variants
export function EmptyStateSearch({ onAction }) {
  return (
    <EmptyState
      icon={({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      )}
      title="Sonuç bulunamadı"
      description="Arama kriterlerinize uygun sonuç bulunamadı. Farklı filtreler deneyin."
      action={onAction}
      actionLabel="Filtreleri Temizle"
    />
  );
}

export function EmptyStateNoData({ title, description, onAction, actionLabel }) {
  return (
    <EmptyState
      icon={({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )}
      title={title || "Henüz veri yok"}
      description={description || "Bu bölümde henüz kayıt bulunmuyor."}
      action={onAction}
      actionLabel={actionLabel || "İlk Kaydı Ekle"}
    />
  );
}

export function EmptyStateError({ onRetry }) {
  return (
    <EmptyState
      icon={({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      )}
      title="Bir hata oluştu"
      description="Veriler yüklenirken bir sorun oluştu. Lütfen tekrar deneyin."
      action={onRetry}
      actionLabel="Tekrar Dene"
    />
  );
}

export default EmptyState;
