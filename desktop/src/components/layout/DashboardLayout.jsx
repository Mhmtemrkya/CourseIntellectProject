import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { checkIsServiceDriver } from '../../lib/driverGuard';
import { EntitlementGuard } from '../EntitlementGuard';
import { PremiumSidebar } from './PremiumSidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { PageErrorBoundary } from '../system/PageErrorBoundary';
import { Sheet, SheetContent } from '../ui/sheet';
import { gsap } from 'gsap';

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
  const { isAuthenticated, isAuthLoading, user, drawerOpen, drawerContent, closeDrawer, sidebarCollapsed } = useApp();
  const location = useLocation();
  const pageRef = useRef(null);
  const [isServiceDriver, setIsServiceDriver] = useState(false);

  // Aktif şoför kaydı olan kullanıcı panellere giremez; yalnızca
  // kendi şoför ekranını (/driver) görür.
  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      checkIsServiceDriver(user).then((value) => {
        if (active) setIsServiceDriver(value);
      });
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  useLayoutEffect(() => {
    if (!pageRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        pageRef.current,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
      );
      gsap.fromTo(
        pageRef.current.querySelectorAll('.ci-card, [data-ci-reveal]'),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.035, ease: 'power2.out', delay: 0.05, clearProps: 'transform,opacity,visibility' },
      );
    }, pageRef);
    return () => context.revert();
  }, [location.pathname]);

  // Oturum deposu async açılır; yüklenme bitmeden login'e atmak derin
  // bağlantıyı (örn. /g/student/...) kaybettirir — bekle.
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isServiceDriver) {
    return <Navigate to="/driver" replace />;
  }

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <PremiumSidebar />

      {/* Main Content - adjusts based on sidebar state */}
      <motion.div 
        className="flex-1 flex flex-col overflow-hidden"
        initial={false}
        animate={{
          marginLeft: sidebarCollapsed ? 0 : 0,
          width: '100%',
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
              <div ref={pageRef} className="ci-page p-4 lg:p-5 xl:p-6">
                <PageErrorBoundary key={location.pathname}>
                  <EntitlementGuard>
                    <Outlet />
                  </EntitlementGuard>
                </PageErrorBoundary>
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
