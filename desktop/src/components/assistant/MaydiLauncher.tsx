import { useEffect, useRef, useState } from 'react';
import MaydiMascot from './MaydiMascot';

interface MaydiLauncherProps {
  routeKey: string;
  visible: boolean;
  label: string;
  onOpen: () => void;
}

/** Keep mounted while chat is open so closing it does not replay the welcome. */
export default function MaydiLauncher({ routeKey, visible, label, onOpen }: MaydiLauncherProps) {
  const [entranceSignal, setEntranceSignal] = useState(0);
  const [spinSignal, setSpinSignal] = useState(0);
  const lastRoute = useRef<string | null>(null);
  const lastEntranceAt = useRef<number | null>(null);

  useEffect(() => {
    const changed = lastRoute.current !== routeKey;
    lastRoute.current = routeKey;
    if (!changed || !visible || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = Date.now();
    if (lastEntranceAt.current !== null && now - lastEntranceAt.current < 15_000) return;
    lastEntranceAt.current = now;
    setEntranceSignal((current) => current + 1);
  }, [routeKey, visible]);

  if (!visible) return null;
  const spin = () => setSpinSignal((current) => current + 1);

  return (
    <button type="button" onClick={onOpen} onPointerEnter={spin} onFocus={spin}
      data-testid="assistant-launcher" aria-label={label}
      className="maydi-launcher pointer-events-auto fixed bottom-5 right-4 z-[60] grid place-items-center rounded-2xl border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2">
      <MaydiMascot size={116} platform entranceSignal={entranceSignal} spinSignal={spinSignal} />
    </button>
  );
}
