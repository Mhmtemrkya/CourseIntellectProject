import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';

import 'admin_ui.dart';

/// Masaüstündeki `DirectoryPage` bileşeninin mobil karşılığı.
///
/// Dizin ekranları (öğrenci, öğretmen/personel, veli) yalnız kendi
/// istatistiklerini, filtrelerini ve satır çizimini verir; arama, filtre
/// çubuğu, boş durum ve toplam satırı burada yaşar.
class DirectoryStat {
  final String label;
  final String value;
  final String caption;
  final IconData icon;
  final Color color;

  const DirectoryStat({
    required this.label,
    required this.value,
    required this.caption,
    required this.icon,
    required this.color,
  });
}

class DirectoryFilter {
  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  const DirectoryFilter({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });
}

const directoryAll = 'all';

/// Boş listede gösterilen birincil eylem (ör. "İlk öğrenciyi kaydet").
class DirectoryBlankAction {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  const DirectoryBlankAction({
    required this.label,
    required this.icon,
    required this.onPressed,
  });
}

class DirectoryList<T> extends StatefulWidget {
  final String title;
  final String subtitle;
  final List<DirectoryStat> stats;
  final String searchHint;
  final ValueChanged<String> onSearchChanged;
  final List<DirectoryFilter> filters;
  final List<T> rows;
  final Widget Function(BuildContext context, T row) rowBuilder;
  final String Function(int total) totalLabel;
  // Boş listenin İKİ hâli ayrıdır (masaüstü DirectoryPage ile aynı kural):
  //  • filtre/arama daraltmış → arama metnini değiştir,
  //  • kurumda hiç kayıt yok  → ilk kaydı oluştur.
  final String emptyTitle;
  final String emptyDescription;
  final String? blankTitle;
  final String? blankDescription;
  final DirectoryBlankAction? blankAction;
  final bool loading;
  final String? error;
  final Future<void> Function() onRefresh;
  final Widget? banner;

  const DirectoryList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.stats,
    required this.searchHint,
    required this.onSearchChanged,
    required this.filters,
    required this.rows,
    required this.rowBuilder,
    required this.totalLabel,
    required this.onRefresh,
    this.emptyTitle = 'Kayıt bulunamadı',
    this.emptyDescription = 'Filtreleri değiştirin veya yeni kayıt ekleyin.',
    this.blankTitle,
    this.blankDescription,
    this.blankAction,
    this.loading = false,
    this.error,
    this.banner,
  });

  @override
  State<DirectoryList<T>> createState() => _DirectoryListState<T>();
}

class _DirectoryListState<T> extends State<DirectoryList<T>> {
  // Arama metni sayfada tutuluyor; boş durumun hangi hâl olduğunu bilebilmek
  // için kopyası burada da izlenir (sayfaların imzasını değiştirmeden).
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool get _isFiltering =>
      _searchController.text.trim().isNotEmpty ||
      widget.filters.any((filter) => filter.value != directoryAll);

  void _clearFilters() {
    _searchController.clear();
    widget.onSearchChanged('');
    for (final filter in widget.filters) {
      filter.onChanged(directoryAll);
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          Text(
            widget.title.tr,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(widget.subtitle, style: theme.textTheme.bodySmall),
          const SizedBox(height: 14),
          if (widget.loading) const LinearProgressIndicator(),
          if (widget.error != null)
            AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.error!),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: widget.onRefresh,
                    child: Text('Tekrar Dene'.tr),
                  ),
                ],
              ),
            ),
          ?widget.banner,
          if (widget.stats.isNotEmpty) ...[
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              childAspectRatio: 2.5,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              children: widget.stats
                  .map((stat) => _statTile(theme, stat))
                  .toList(),
            ),
            const SizedBox(height: 14),
          ],
          TextField(
            controller: _searchController,
            onChanged: (value) {
              widget.onSearchChanged(value);
              setState(() {}); // boş durum hâli aramaya göre değişir
            },
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: widget.searchHint.tr,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
          ),
          if (widget.filters.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.filters
                  .map((filter) => _filterChip(context, filter))
                  .toList(),
            ),
          ],
          const SizedBox(height: 14),
          if (!widget.loading && widget.rows.isEmpty)
            AdminPanel(
              child: Column(
                children: [
                  Icon(
                    _isFiltering
                        ? Icons.search_off_rounded
                        : Icons.inbox_outlined,
                    size: 36,
                    color: theme.hintColor,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    (_isFiltering
                            ? widget.emptyTitle
                            : (widget.blankTitle ?? widget.emptyTitle))
                        .tr,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (_isFiltering
                            ? widget.emptyDescription
                            : (widget.blankDescription ??
                                  widget.emptyDescription))
                        .tr,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 14),
                  if (_isFiltering)
                    OutlinedButton.icon(
                      onPressed: _clearFilters,
                      icon: const Icon(Icons.filter_alt_off_rounded, size: 18),
                      label: Text('Filtreleri temizle'.tr),
                    )
                  else if (widget.blankAction != null)
                    FilledButton.icon(
                      onPressed: widget.blankAction!.onPressed,
                      icon: Icon(widget.blankAction!.icon, size: 18),
                      label: Text(widget.blankAction!.label.tr),
                    ),
                ],
              ),
            )
          else
            ...widget.rows.map((row) => widget.rowBuilder(context, row)),
          if (widget.rows.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              widget.totalLabel(widget.rows.length),
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  Widget _statTile(ThemeData theme, DirectoryStat stat) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: stat.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(stat.icon, color: stat.color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  stat.label.tr,
                  style: theme.textTheme.labelSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  stat.value,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  stat.caption.tr,
                  style: theme.textTheme.labelSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(BuildContext context, DirectoryFilter filter) {
    final selected = filter.value != directoryAll;
    return PopupMenuButton<String>(
      onSelected: filter.onChanged,
      itemBuilder: (_) => [
        PopupMenuItem(value: directoryAll, child: Text(filter.label.tr)),
        ...filter.options
            .where((option) => option.trim().isNotEmpty)
            .map((option) => PopupMenuItem(value: option, child: Text(option))),
      ],
      child: Chip(
        label: Text(selected ? filter.value : filter.label.tr),
        avatar: const Icon(Icons.filter_list_rounded, size: 16),
        backgroundColor: selected
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
            : null,
      ),
    );
  }
}

/// Dizin satırı: avatar + ad + alt bilgi + rozet + işlem butonları.
class DirectoryRowCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? trailingBadge;
  final Color? badgeColor;
  final List<({IconData icon, String label, String value})> metrics;
  final List<Widget> actions;
  final VoidCallback? onTap;
  final String? photoUrl;

  const DirectoryRowCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailingBadge,
    this.badgeColor,
    this.metrics = const [],
    this.actions = const [],
    this.onTap,
    this.photoUrl,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = title
        .split(' ')
        .where((part) => part.trim().isNotEmpty)
        .take(2)
        .map((part) => part[0])
        .join();
    final color = badgeColor ?? theme.colorScheme.primary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: theme.colorScheme.primary.withValues(
                    alpha: 0.12,
                  ),
                  backgroundImage: (photoUrl ?? '').isEmpty
                      ? null
                      : NetworkImage(photoUrl!),
                  child: (photoUrl ?? '').isEmpty
                      ? Text(
                          initials.toUpperCase(),
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: theme.colorScheme.primary,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (trailingBadge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      trailingBadge!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                  ),
              ],
            ),
            if (metrics.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: metrics
                    .map(
                      (metric) => Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  metric.icon,
                                  size: 13,
                                  color: theme.textTheme.bodySmall?.color,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    metric.label.tr,
                                    style: theme.textTheme.labelSmall,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              metric.value.isEmpty ? '—' : metric.value,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: actions),
            ],
          ],
        ),
      ),
    );
  }
}
