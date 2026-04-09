// CourseIntellect Alert Banner Component
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle,
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

const variants = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-400',
    iconColor: 'text-green-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-400',
    iconColor: 'text-yellow-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    iconColor: 'text-red-500',
  },
};

export function AlertBanner({
  variant = 'info',
  title,
  message,
  show = true,
  onClose,
  onRetry,
  className,
}) {
  const styles = variants[variant];
  const Icon = styles.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            styles.bg,
            styles.border,
            className
          )}
        >
          <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.iconColor)} />
          
          <div className="flex-1 min-w-0">
            {title && (
              <p className={cn('font-semibold', styles.text)}>{title}</p>
            )}
            {message && (
              <p className={cn('text-sm mt-0.5', styles.text)}>{message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className={cn('h-7 px-2', styles.text)}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Tekrar Dene
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className={cn('h-7 w-7', styles.text)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Pre-configured variants
export function InfoBanner(props) {
  return <AlertBanner variant="info" {...props} />;
}

export function SuccessBanner(props) {
  return <AlertBanner variant="success" {...props} />;
}

export function WarningBanner(props) {
  return <AlertBanner variant="warning" {...props} />;
}

export function ErrorBanner(props) {
  return <AlertBanner variant="error" {...props} />;
}

export default AlertBanner;
