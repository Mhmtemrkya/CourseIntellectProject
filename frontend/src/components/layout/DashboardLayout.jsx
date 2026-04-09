import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { ModernSidebar } from './ModernSidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { Sheet, SheetContent } from '../ui/sheet';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const pageTransition = {
  duration: 0.25,
  ease: 'easeInOut',
};

export function DashboardLayout() {
  const { isAuthenticated, drawerOpen, drawerContent, closeDrawer, sidebarCollapsed } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <ModernSidebar />

      {/* Main Content - adjusts based on sidebar state */}
      <motion.div 
        className="flex-1 flex flex-col overflow-hidden"
        initial={false}
        animate={{
          marginLeft: sidebarCollapsed ? 0 : 0,
          width: sidebarCollapsed ? '100%' : 'calc(100% - 280px)',
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          position: 'relative',
        }}
      >
        {/* Topbar */}
        <Topbar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="h-full"
            >
              <div className="p-6 lg:p-8">
                <Outlet />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Right Drawer */}
      <Sheet open={drawerOpen} onOpenChange={closeDrawer}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {drawerContent}
        </SheetContent>
      </Sheet>

      {/* Command Palette */}
      <CommandPalette />
    </div>
  );
}
