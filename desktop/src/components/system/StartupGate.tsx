import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandSplash } from './BrandSplash';

/** Boot artwork remains visible while the local session is restored. */
export function StartupGate({ children }: { children: ReactNode }) {
  const { isAuthLoading } = useApp();
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    document.getElementById('sa-boot')?.remove();
    // A single brief entrance, never replayed on route changes.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setRevealed(true), reduced ? 0 : 850);
    return () => window.clearTimeout(timer);
  }, []);
  if (!revealed || isAuthLoading) return <BrandSplash />;
  return <div className="sa-app-enter">{children}</div>;
}
