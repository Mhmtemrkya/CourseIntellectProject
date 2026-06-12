import 'package:flutter/material.dart';

import '../services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';

class AnnouncementsPage extends StatefulWidget {
  const AnnouncementsPage({super.key});

  @override
  State<AnnouncementsPage> createState() => _AnnouncementsPageState();
}

class _AnnouncementsPageState extends State<AnnouncementsPage> {
  final _service = SchoolFeedApiService.instance;
  bool _loading = true;
  bool _searching = false;
  String _query = '';
  String? _error;
  List<AnnouncementFeedItem> _announcements = const [];

  List<AnnouncementFeedItem> get _visibleAnnouncements {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _announcements;
    return _announcements
        .where(
          (item) =>
              item.title.toLowerCase().contains(query) ||
              item.summaryDetail.toLowerCase().contains(query),
        )
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
  }

  Future<void> _loadAnnouncements() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final announcements = await _service.fetchAnnouncements(
        audience: 'Öğrenci',
      );
      if (!mounted) return;
      setState(() {
        _announcements = announcements;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Duyurularda ara...',
                  border: InputBorder.none,
                ),
                onChanged: (value) => setState(() => _query = value),
              )
            : const Text('Duyurular'),
        centerTitle: !_searching,
        actions: [
          IconButton(
            tooltip: _searching ? 'Aramayı kapat' : 'Duyurularda ara',
            icon: Icon(_searching ? Icons.close_rounded : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _query = '';
            }),
          ),
          IconButton(
            tooltip: 'Yenile',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadAnnouncements,
          ),
        ],
      ),
      body: ResponsiveContent(
        padding: const EdgeInsets.all(16),
        child: _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
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

    if (_visibleAnnouncements.isEmpty) {
      return Center(
        child: Text(
          _query.trim().isEmpty
              ? 'Gösterilecek duyuru bulunmuyor.'
              : 'Aramana uyan duyuru bulunamadı.',
        ),
      );
    }

    return ListView(
      children: _visibleAnnouncements
          .map(
            (item) => _announcementCard(
              context,
              icon: item.icon,
              color: item.color,
              title: item.title,
              desc: item.summaryDetail,
              date: item.date,
            ),
          )
          .toList(),
    );
  }

  Widget _announcementCard(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required String desc,
    required String date,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Theme.of(context).cardColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  desc,
                  style: TextStyle(
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.72),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  date,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.72),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
