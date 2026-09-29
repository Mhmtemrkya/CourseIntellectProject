import { useState } from 'react';
import { Loader2, UserCheck, UserX } from 'lucide-react';
import { Button } from './ui/button';

export function UserStatusButton({
  isPassive,
  onToggle,
  size = 'sm',
  className = '',
  disabled = false,
  // Dizin tablolarında satır daralmasın diye yalnız ikon gösterilir; etiket
  // title/aria-label olarak korunur (erişilebilirlik kaybı yok).
  iconOnly = false,
}) {
  const [updating, setUpdating] = useState(false);
  const label = isPassive ? 'Aktifleştir' : 'Pasifleştir';
  const Icon = isPassive ? UserCheck : UserX;

  const handleClick = async (event) => {
    event.stopPropagation();
    if (disabled || updating) return;

    try {
      setUpdating(true);
      await onToggle?.();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? 'icon' : size}
      disabled={disabled || updating}
      aria-label={label}
      title={label}
      className={`${isPassive
        ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
        : 'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40'} ${className}`}
      onClick={handleClick}
    >
      {updating
        ? <Loader2 className={`h-4 w-4 animate-spin ${iconOnly ? '' : 'mr-1.5'}`} />
        : <Icon className={`h-4 w-4 ${iconOnly ? '' : 'mr-1.5'}`} />}
      {iconOnly ? null : (updating ? 'İşleniyor...' : label)}
    </Button>
  );
}
