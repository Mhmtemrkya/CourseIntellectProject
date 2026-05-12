import 'package:flutter/material.dart';

import '../services/school_feed_api_service.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';

class VeliDuyurularPage extends StatefulWidget {
  const VeliDuyurularPage({super.key});

  @override
  State<VeliDuyurularPage> createState() => _VeliDuyurularPageState();
}

class _VeliDuyurularPageState extends State<VeliDuyurularPage> {
  final Color primaryColor = const Color(0xFFFF7A00);
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  String _selectedFilter = 'Tümu';
  List<AnnouncementFeedItem> _announcements = const [];

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
    _searchController.addListener(_refresh);
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_refresh)
      ..dispose();
    super.dispose();
  }

  Future<void> _loadAnnouncements() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await SchoolFeedApiService.instance.fetchAnnouncements(
        audience: 'Veli',
      );
      if (!mounted) return;
      setState(() {
        _announcements = items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filteredAnnouncements();

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: hasSidebar ? null : const AppHeader(title: 'Duyurular'),
      body: ResponsiveContent(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: _buildBody(context, filtered),
      ),
    );
  }

  Widget _buildBody(BuildContext context, List<AnnouncementFeedItem> filtered) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadAnnouncements,
              child: const Text('Tekrar Dene'),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _searchBar(context),
          const SizedBox(height: 8),
          Text(
            '${filtered.length} duyuru görüntüleniyor',
            style: TextStyle(color: theme.textTheme.bodyMedium?.color),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(child: Text('Filtreye uygun duyuru bulunmuyor.')),
            )
          else
            ...filtered.asMap().entries.map(
              (entry) => _announcementCard(
                context: context,
                icon: entry.value.icon,
                title: entry.value.title,
                description: entry.value.summaryDetail,
                date: entry.value.date,
                tags: _tagsForAnnouncement(entry.value, entry.key),
              ),
            ),
        ],
      ),
    );
  }

  List<AnnouncementFeedItem> _filteredAnnouncements() {
    final query = _searchController.text.trim().toLowerCase();
    return _announcements.where((item) {
      final matchesFilter = switch (_selectedFilter) {
        'Yeni' => _announcements.indexOf(item) < 2,
        'Veli' => item.audience.contains('Veli'),
        _ => true,
      };
      final matchesQuery =
          query.isEmpty ||
          item.title.toLowerCase().contains(query) ||
          item.detail.toLowerCase().contains(query);
      return matchesFilter && matchesQuery;
    }).toList();
  }

  List<String> _tagsForAnnouncement(AnnouncementFeedItem item, int index) {
    final tags = <String>[];
    if (index < 2) {
      tags.add('Yeni');
    }
    if (item.audience.contains('Veli')) {
      tags.add('Veli');
    }
    if (item.audience.contains('Tüm')) {
      tags.add('Genel');
    }
    return tags.isEmpty ? ['Bilgi'] : tags;
  }

  Widget _searchBar(BuildContext context) {
    final theme = Theme.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 420;

        final searchField = TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Duyuru ara...',
            prefixIcon: const Icon(Icons.search),
            isDense: true,
            filled: true,
            fillColor: theme.cardColor,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        );

        final filter = DropdownButtonFormField<String>(
          initialValue: _selectedFilter,
          isExpanded: true,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: theme.cardColor,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
          items: const [
            DropdownMenuItem(value: 'Tümu', child: Text('Tümü')),
            DropdownMenuItem(value: 'Yeni', child: Text('Yeni')),
            DropdownMenuItem(value: 'Veli', child: Text('Veli')),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() {
              _selectedFilter = value;
            });
          },
        );

        if (compact) {
          return Column(
            children: [searchField, const SizedBox(height: 10), filter],
          );
        }

        return Row(
          children: [
            Expanded(child: searchField),
            const SizedBox(width: 8),
            SizedBox(width: 132, child: filter),
          ],
        );
      },
    );
  }

  Widget _announcementCard({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String description,
    required String date,
    required List<String> tags,
  }) {
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: primaryColor.withValues(alpha: 0.2),
                child: Icon(icon, color: primaryColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: theme.textTheme.bodyLarge?.color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 6, children: tags.map(_tagChip).toList()),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(color: theme.textTheme.bodyMedium?.color),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                date,
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => _showAnnouncementDetail(
                  context,
                  title: title,
                  description: description,
                  date: date,
                  tags: tags,
                ),
                child: const Text('Detayları Gör →'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _tagChip(String text) {
    Color color;

    if (text == 'Yeni') {
      color = Colors.orange;
    } else if (text == 'Veli') {
      color = Colors.red;
    } else if (text == 'Genel') {
      color = Colors.purple;
    } else {
      color = Colors.blueGrey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  void _showAnnouncementDetail(
    BuildContext context, {
    required String title,
    required String description,
    required String date,
    required List<String> tags,
  }) {
    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: tags.map(_tagChip).toList(),
              ),
              const SizedBox(height: 12),
              Text(description),
              const SizedBox(height: 12),
              Text(date, style: const TextStyle(color: Colors.grey)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Kapat'),
            ),
          ],
        );
      },
    );
  }
}
