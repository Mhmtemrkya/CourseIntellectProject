import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { cn } from '../../lib/utils';
import { filterTopics, isUnlisted, matchTopic, type TopicOption } from '../../lib/topicCatalog';

const RENDER_LIMIT = 80;

type Row =
  | { kind: 'option'; option: TopicOption }
  | { kind: 'free'; text: string }
  | { kind: 'add'; text: string };

/**
 * Ders konusu seçimi (optik cevap anahtarı hücresi, soru stüdyosu): yazdıkça dersin konuları süzülür (Türkçe harf duyarsız). Ok tuşları ve Enter ile
 * seçilir, Enter sonraki sorunun konusuna geçer. Listede olmayan metin için iki seçenek: yalnız bu soruya
 * yaz ya da kurum listesine ekle. Listede olmayan konu hücrede "listede yok" ile işaretlenir.
 */
export function TopicPicker({ inputId, value, options, label, onChange, onAdd, onRemove, onNext, className }: {
  inputId: string;
  value: string;
  options: readonly TopicOption[];
  label: string;
  onChange: (value: string) => void;
  /** Kurum listesine ekler; kaydedilen (ya da listede zaten olan) yazımı döner, başarısızsa null. */
  onAdd: (name: string) => Promise<string | null>;
  onRemove: (option: TopicOption) => void;
  /** Enter ile seçimden sonra (tablo: sonraki satıra geç). */
  onNext?: () => void;
  /** Alanın yüksekliği/kenarı için ek sınıf. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTermState] = useState<string | null>(null);
  // Odak başka hücreye geçerken kapanma olayı eski render'dan gelebilir; yazılan metin ref'ten okunur ki
  // seçilmiş konu, bekleyen yazıyla ezilmesin.
  const pending = useRef<string | null>(null);
  const setTerm = (next: string | null) => { pending.current = next; setTermState(next); };
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  // Hücreye tıklayıp hemen Enter'a basmak ilk konuyu seçmesin; ok tuşuyla gezildiyse seçer.
  const [navigated, setNavigated] = useState(false);

  const typed = (term ?? '').trim();
  const filtered = useMemo(() => filterTopics(options, term ?? ''), [options, term]);
  const rows: Row[] = useMemo(() => {
    const list: Row[] = filtered.slice(0, RENDER_LIMIT).map((option) => ({ kind: 'option', option }));
    if (typed && !matchTopic(options, typed)) list.push({ kind: 'free', text: typed }, { kind: 'add', text: typed });
    return list;
  }, [filtered, options, typed]);
  const listId = `${inputId}-list`;
  const rowId = (index: number) => `${inputId}-row-${index}`;

  useEffect(() => { setActive(0); }, [term]);
  useEffect(() => {
    if (!open) return;
    document.getElementById(rowId(active))?.scrollIntoView?.({ block: 'nearest' });
    // rowId yalnız inputId'ye bağlı; active değişince kaydırmak yeterli.
  }, [active, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setOpen(false); setTerm(null); setNavigated(false); };
  const commit = (next: string) => { onChange(next); close(); };

  const choose = async (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === 'option') commit(row.option.name);
    else if (row.kind === 'free') commit(row.text);
    else {
      setAdding(true);
      const saved = await onAdd(row.text);
      setAdding(false);
      if (saved) commit(saved);
    }
  };

  /** Yazılan metin seçim yapılmadan bırakılırsa: listedeki bir konuyla aynıysa o yazım, değilse serbest metin. */
  const settle = () => {
    if (pending.current === null) return;
    const text = pending.current.trim();
    commit(text ? matchTopic(options, text)?.name ?? text : '');
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      setNavigated(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.max(0, Math.min(rows.length - 1, current + step)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && (term !== null || navigated) && rows[active]) await choose(rows[active]);
      else settle();
      onNext?.();
    } else if (event.key === 'Escape' && open) {
      // Diyaloğun kendisi kapanmasın; yalnız liste kapanır ve yazılan bırakılır.
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const unlisted = term === null && isUnlisted(options, value);
  const showGroups = !typed;

  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) settle(); setOpen(next); }}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={inputId}
            className={cn('h-8', className, unlisted && 'pr-20')}
            value={term ?? value}
            maxLength={150}
            placeholder={options.length > 0 ? 'Konu ara ya da yaz' : 'İsteğe bağlı'}
            aria-label={label}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && rows[active] ? rowId(active) : undefined}
            autoComplete="off"
            onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
            onClick={() => setOpen(true)}
            onBlur={() => { if (!open) settle(); }}
            onKeyDown={(event) => void onKeyDown(event)}
          />
          {unlisted ? (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
              title="Bu konu hazır listede ya da kurum listesinde yok; yalnız bu soruya yazıldı.">
              listede yok
            </span>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[min(26rem,calc(100vw-2rem))] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // Escape aramayı iptal eder: hücre önceki değerinde kalır.
        onEscapeKeyDown={() => setTerm(null)}
        onInteractOutside={(event) => {
          // Hücrenin kendisine tıklamak listeyi kapatmaz.
          if (event.target instanceof Node && document.getElementById(inputId)?.contains(event.target)) event.preventDefault();
        }}
      >
        <div id={listId} role="listbox" aria-label={`${label} seçenekleri`} className="max-h-72 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Bu ders için hazır konu yok. Konuyu yazıp listeye ekleyebilirsiniz.</p>
          ) : null}
          {rows.map((row, index) => {
            const previous = rows[index - 1];
            const header = showGroups && row.kind === 'option' && (previous?.kind !== 'option' || previous.option.group !== row.option.group)
              ? row.option.group : null;
            return (
              <div key={row.kind === 'option' ? `o-${row.option.name}` : row.kind}>
                {header ? <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{header}</p> : null}
                <div
                  id={rowId(index)}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => void choose(row)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    index === active ? 'bg-accent text-accent-foreground' : '',
                    row.kind !== 'option' && 'border-t',
                  )}
                >
                  {row.kind === 'option' ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{row.option.name}</span>
                      {!showGroups ? <span className="max-w-[40%] shrink-0 truncate text-[11px] text-muted-foreground">{row.option.group}</span> : null}
                      {row.option.source === 'custom' ? (
                        <button type="button" aria-label={`${row.option.name} konusunu kurum listesinden kaldır`} title="Kurum listesinden kaldır (denemeler değişmez)"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                          onClick={(event) => { event.stopPropagation(); onRemove(row.option); }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </>
                  ) : row.kind === 'free' ? (
                    <span className="min-w-0 flex-1 truncate">{`“${row.text}” — yalnız bu soruya yaz`}</span>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-sky-700 dark:text-sky-300">
                      {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      <span className="truncate">{`“${row.text}” konusunu listeye ekle`}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length > RENDER_LIMIT ? (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{`+${filtered.length - RENDER_LIMIT} konu daha — yazarak daraltın`}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
