import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { cn } from '../../lib/utils';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Sağda küçük bilgi (ör. "12 program"). */
  hint?: string;
  /** Altta ikinci satır (ör. il • kurum türü). */
  detail?: string;
}

const RENDER_LIMIT = 200;

/** Türkçe harfleri katlar: "İSTANBUL" ile "istanbul", "Ğ" ile "g" eşleşir. */
export const foldTr = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0307/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u');

/**
 * Aranabilir tek seçim listesi (il, üniversite, bölüm). Boş değer "Tümü" demektir.
 * cmdk'nin kendi filtresi Türkçe büyük İ'yi eşleştiremediği için filtre burada yapılır.
 */
export function SearchSelect({
  id, value, options, onChange, allLabel, placeholder, searchPlaceholder, emptyText, disabled,
}: {
  id: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  allLabel: string;
  placeholder?: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const words = foldTr(term).split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((option) => {
      const haystack = foldTr(`${option.label} ${option.detail ?? ''}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [options, term]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setTerm('');
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTerm(''); }}>
      <div className="relative mt-1">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('h-10 w-full justify-between px-3 font-normal normal-case tracking-normal', selected && !disabled && 'pr-14')}
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.label ?? placeholder ?? allLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {selected && !disabled ? (
          <button
            type="button"
            aria-label="Seçimi temizle"
            onClick={() => onChange('')}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-[min(30rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {term.trim().length === 0 ? (
                <CommandItem value="__all__" onSelect={() => pick('')}>
                  <Check className={cn('mr-2 h-4 w-4', value === '' ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-medium">{allLabel}</span>
                </CommandItem>
              ) : null}
              {filtered.slice(0, RENDER_LIMIT).map((option) => (
                <CommandItem key={option.value} value={option.value} onSelect={() => pick(option.value)}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 leading-snug">{option.label}</p>
                    {option.detail ? <p className="truncate text-xs text-muted-foreground">{option.detail}</p> : null}
                  </div>
                  {option.hint ? <span className="ml-2 shrink-0 text-xs text-muted-foreground">{option.hint}</span> : null}
                </CommandItem>
              ))}
              {filtered.length > RENDER_LIMIT ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">{`+${filtered.length - RENDER_LIMIT} sonuç daha — aramayı daraltın`}</p>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
