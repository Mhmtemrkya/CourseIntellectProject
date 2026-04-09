// CourseIntellect Drawer Panel Component
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const drawerVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: { 
    x: '100%', 
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

export function DrawerPanel({ 
  open, 
  onClose, 
  children, 
  title, 
  description,
  className,
  width = 'max-w-lg',
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed right-0 top-0 z-50 h-full bg-background border-l shadow-xl',
              'w-full sm:w-auto',
              width,
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                {title && (
                  <h2 className="text-lg font-semibold font-heading">{title}</h2>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Drawer Header Component
export function DrawerHeader({ children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {children}
    </div>
  );
}

// Drawer Title
export function DrawerTitle({ children, className }) {
  return (
    <h3 className={cn('text-xl font-semibold font-heading', className)}>
      {children}
    </h3>
  );
}

// Drawer Description
export function DrawerDescription({ children, className }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

// Drawer Footer
export function DrawerFooter({ children, className }) {
  return (
    <div className={cn('flex gap-3 pt-6 border-t mt-6', className)}>
      {children}
    </div>
  );
}

// Drawer Section
export function DrawerSection({ title, children, className }) {
  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      )}
      {children}
    </div>
  );
}

export default DrawerPanel;
