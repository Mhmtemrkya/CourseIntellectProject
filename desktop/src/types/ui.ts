import type { ComponentType, CSSProperties } from 'react';

/** İkon bileşeni: lucide-react ikonları ya da className/style alan herhangi bir bileşen. */
export type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;
