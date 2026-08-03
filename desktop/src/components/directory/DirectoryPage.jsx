import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  LayoutGrid,
  List,
  Rows3,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  DEFAULT_DENSITY,
  readPreferences,
  toggleHiddenColumn,
  visibleColumns,
  writePreferences,
} from '../../lib/directoryPreferences';

// Yoğunluk modunun satır/başlık ölçüleri. "Sık" mod ekrana ~%40 daha fazla satır
// sığdırır; uzun listelerde kaydırmayı azaltmak için istendi.
const DENSITY_STYLES = {
  comfortable: { row: 'px-5 py-3.5 text-sm', head: 'px-5 py-3', card: 'gap-4' },
  compact: { row: 'px-4 py-2 text-[13px]', head: 'px-4 py-2', card: 'gap-3' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export const DIRECTORY_ALL = 'all';

/**
 * Kurum dizin ekranlarının (öğrenci, öğretmen, veli, personel) ORTAK iskeleti.
 *
 * Sayfalar yalnız kendi sütunlarını, istatistiklerini ve satır işlemlerini verir;
 * arama/filtre/sıralama/sayfalama/seçim ve liste–kart görünümü burada yaşar.
 * Böylece dört ekran birebir aynı davranır ve tasarım tek yerden değişir.
 */
export default function DirectoryPage({
  testId,
  title,
  subtitle,
  actions,
  stats = [],
  search,
  filters = [],
  columns = [],
  rows = [],
  getRowId = (row) => row.id,
  onRowClick,
  rowActions,
  selection,
  bulkActions,
  cardRender,
  // İki ayrı boşluk vardır ve aynı şey DEĞİLDİR:
  //  • filtre/arama sonucu boş → kullanıcı aramasını değiştirmeli,
  //  • kurumda hiç kayıt yok → kullanıcı İLK kaydı oluşturmalı.
  // Aynı metni ikisine de göstermek yeni kurumu çıkmaza sokuyordu.
  emptyTitle = 'Kayıt bulunamadı',
  emptyDescription = 'Filtreleri değiştirin veya yeni kayıt ekleyin.',
  emptyIcon: EmptyIcon = Users,
  // Hiç kayıt yokken gösterilecek ilk-kurulum metni ve birincil eylemi.
  blankTitle,
  blankDescription,
  blankAction,
  // Türkçe ek düşmesi sayfadan gelir: "6 öğrenciden 1-6 arası gösteriliyor".
  rangeLabel = (from, to, total) => `${total} kayıttan ${from}-${to} arası gösteriliyor`,
  banner,
  defaultPageSize = 10,
}) {
  const [view, setView] = useState('list');
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(1);

  // Görünüm tercihleri kullanıcının son bıraktığı hâlden başlar (tablo bazında).
  const [preferences, setPreferences] = useState(() => readPreferences(testId));
  const pageSize = preferences.pageSize || defaultPageSize;
  const density = preferences.density || DEFAULT_DENSITY;
  const densityStyle = DENSITY_STYLES[density] || DENSITY_STYLES[DEFAULT_DENSITY];

  const updatePreferences = useCallback((patch) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      writePreferences(testId, next);
      return next;
    });
  }, [testId]);

  const setPageSize = useCallback((value) => updatePreferences({ pageSize: value }), [updatePreferences]);

  // Gizlenebilir sütunlar: ilki kimlik sütunudur, listede yer almaz.
  const shownColumns = useMemo(
    () => visibleColumns(columns, preferences.hiddenColumns),
    [columns, preferences.hiddenColumns],
  );
  const hideableColumns = columns.slice(1);

  const filterSignature = filters.map((filter) => filter.value).join('|');
  useEffect(() => { setPage(1); }, [search?.value, filterSignature, pageSize]);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    const value = column.sortValue || ((row) => row[sort.key]);
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left == null && right == null) return 0;
      if (typeof left === 'number' && typeof right === 'number') {
        return sort.direction === 'asc' ? left - right : right - left;
      }
      const compare = String(left ?? '').localeCompare(String(right ?? ''), 'tr');
      return sort.direction === 'asc' ? compare : -compare;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const selectedIds = selection?.selected || [];
  const pageIds = paged.map(getRowId);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleAllOnPage = () => {
    if (!selection) return;
    selection.onChange(
      allOnPageSelected
        ? selectedIds.filter((id) => !pageIds.includes(id))
        : [...new Set([...selectedIds, ...pageIds])],
    );
  };

  const toggleRow = (id) => {
    if (!selection) return;
    selection.onChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' }));
  };

  // Arama kutusu doluysa ya da bir filtre "tümü"nden başka bir değerdeyse liste
  // daraltılmış demektir; boş sonuç "kurumda kayıt yok" anlamına GELMEZ.
  const isFiltering = Boolean(search?.value?.trim())
    || filters.some((filter) => filter.value && filter.value !== DIRECTORY_ALL);

  const clearFilters = () => {
    search?.onChange('');
    filters.forEach((filter) => filter.onChange(DIRECTORY_ALL));
  };

  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length);
  const gridTemplate = shownColumns.map((column) => column.width || 'minmax(0,1fr)').join(' ');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {banner}

      {stats.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3"
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${stat.tint || 'bg-sky-500/12 text-sky-600'}`}>
                {stat.icon ? <stat.icon className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-black leading-tight tabular-nums">{stat.value}</p>
                {stat.caption ? <p className="truncate text-[11px] text-muted-foreground">{stat.caption}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {search ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder || 'Ara...'}
                className="h-10 pl-9"
              />
            </div>
          ) : null}
          {filters.map((filter) => (
            <Select key={filter.placeholder} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger className="h-10 w-full sm:w-[10.5rem]">
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DIRECTORY_ALL}>{filter.placeholder}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value ?? option} value={option.value ?? option}>
                    {option.label ?? option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {hideableColumns.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1.5" data-testid={testId ? `${testId}-columns` : undefined}>
                  <Columns3 className="h-4 w-4" />
                  Sütunlar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Görünecek sütunlar</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={!preferences.hiddenColumns.includes(column.key)}
                    // Radix menüyü kapatmasın: kullanıcı arka arkaya sütun açıp kapatır.
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() => updatePreferences({
                      hiddenColumns: toggleHiddenColumn(columns, preferences.hiddenColumns, column.key),
                    })}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {/* Yoğunluk: rahat ↔ sık. Tercih tabloya özel saklanır. */}
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5"
            aria-pressed={density === 'compact'}
            data-testid={testId ? `${testId}-density` : undefined}
            data-density={density}
            onClick={() => updatePreferences({ density: density === 'compact' ? 'comfortable' : 'compact' })}
          >
            <Rows3 className="h-4 w-4" />
            {density === 'compact' ? 'Sık' : 'Rahat'}
          </Button>

          {cardRender ? (
            <div className="flex overflow-hidden rounded-xl border border-foreground/10">
              <button
                type="button"
                aria-label="Liste görünümü"
                onClick={() => setView('list')}
                className={`grid h-10 w-10 place-items-center transition ${view === 'list' ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Kart görünümü"
                onClick={() => setView('grid')}
                className={`grid h-10 w-10 place-items-center transition ${view === 'grid' ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-foreground/15 px-6 py-16 text-center"
          data-testid={testId ? `${testId}-empty` : undefined}
          data-empty-kind={isFiltering ? 'filtered' : 'blank'}
        >
          {isFiltering ? (
            <>
              <Search className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-bold">{emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
              <Button variant="outline" size="sm" className="mt-5" onClick={clearFilters}>
                Filtreleri temizle
              </Button>
            </>
          ) : (
            <>
              <EmptyIcon className="mx-auto h-9 w-9 text-[hsl(var(--brand-accent)/0.7)]" />
              <p className="mt-3 font-bold">{blankTitle || emptyTitle}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {blankDescription || emptyDescription}
              </p>
              {blankAction ? (
                <Button size="sm" className="mt-5" onClick={blankAction.onClick}>
                  {blankAction.icon ? <blankAction.icon className="mr-1.5 h-4 w-4" /> : null}
                  {blankAction.label}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : view === 'grid' && cardRender ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((row) => (
            <div key={getRowId(row)}>{cardRender(row)}</div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-foreground/10">
          <div
            className={`hidden items-center ${densityStyle.card} border-b border-foreground/10 bg-foreground/[0.035] ${densityStyle.head} text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:grid`}
            style={{ gridTemplateColumns: `${selection ? '1.75rem ' : ''}${gridTemplate}${rowActions ? ' 10.5rem' : ''}` }}
          >
            {selection ? (
              <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Tümünü seç" />
            ) : null}
            {shownColumns.map((column) => (
              column.sortable ? (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => toggleSort(column.key)}
                  className="flex items-center gap-1 text-left uppercase tracking-wide transition hover:text-foreground"
                >
                  {column.label}
                  {sort.key === column.key
                    ? (sort.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : null}
                </button>
              ) : (
                <span key={column.key}>{column.label}</span>
              )
            ))}
            {rowActions ? <span className="text-right">İşlemler</span> : null}
          </div>

          <div className="divide-y divide-foreground/[0.07]">
            {paged.map((row) => {
              const id = getRowId(row);
              return (
                <div
                  key={id}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === 'Enter') onRowClick(row);
                  } : undefined}
                  className={`grid grid-cols-1 items-center ${densityStyle.card} ${densityStyle.row} transition lg:grid ${onRowClick ? 'cursor-pointer hover:bg-foreground/[0.025]' : ''}`}
                  style={{ gridTemplateColumns: `${selection ? '1.75rem ' : ''}${gridTemplate}${rowActions ? ' 10.5rem' : ''}` }}
                >
                  {selection ? (
                    <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(id)}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label="Satırı seç"
                      />
                    </span>
                  ) : null}
                  {shownColumns.map((column) => (
                    <div key={column.key} className={`min-w-0 ${column.className || ''}`}>
                      {column.render(row)}
                    </div>
                  ))}
                  {rowActions ? (
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {rowActions(row)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rangeLabel(rangeStart, rangeEnd, sorted.length)}
          </p>
          <div className="flex items-center gap-2">
            {pageCount > 1 ? (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: pageCount }, (_, index) => index + 1)
                  .filter((number) => number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1)
                  .map((number, index, list) => (
                    <span key={number} className="flex items-center gap-1">
                      {index > 0 && number - list[index - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
                      <Button
                        variant={number === currentPage ? 'default' : 'outline'}
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setPage(number)}
                      >
                        {number}
                      </Button>
                    </span>
                  ))}
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="h-9 w-[7.5rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>{size} / sayfa</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {/* Toplu işlem çubuğu ekranın altına sabitlenir: seçim yaparken listeyi
          kaydırınca eylemler gözden kaybolmasın. `.app-shell > *` kuralı
          Tailwind'in `fixed`ini ezebildiği için PORTAL ile body'ye basılır. */}
      {selection && selectedIds.length > 0 && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
            data-testid={testId ? `${testId}-bulkbar` : undefined}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--brand-accent)/0.4)] bg-[hsl(var(--ci-surface-1,var(--card)))] px-4 py-3 shadow-2xl backdrop-blur">
              <span className="rounded-full bg-[hsl(var(--brand-accent)/0.15)] px-3 py-1 text-sm font-bold text-[hsl(var(--brand-accent))]">
                {selectedIds.length} seçili
              </span>
              {bulkActions}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => selection.onChange([])}
              >
                <X className="h-3.5 w-3.5" /> Seçimi bırak
              </Button>
            </div>
          </div>,
          document.body,
        )
        : null}
    </motion.div>
  );
}
