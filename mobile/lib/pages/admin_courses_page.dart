import 'package:flutter/material.dart';

import '../services/courses_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminCoursesPage extends StatefulWidget {
  const AdminCoursesPage({super.key});

  @override
  State<AdminCoursesPage> createState() => _AdminCoursesPageState();
}

class _AdminCoursesPageState extends State<AdminCoursesPage> {
  List<CourseRecord> _courses = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await CoursesApiService.instance.fetchAll();
      if (!mounted) return;
      setState(() {
        _courses = items;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openForm({CourseRecord? existing}) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => _CourseFormDialog(course: existing),
    );
    if (result == null) return;
    try {
      if (existing != null) {
        await CoursesApiService.instance.update(
          id: existing.id,
          name: result['name'] as String,
          description: result['description'] as String,
          category: result['category'] as String,
          price: result['price'] as String,
          duration: result['duration'] as String,
          level: result['level'] as String,
          isActive: result['isActive'] as bool,
        );
      } else {
        await CoursesApiService.instance.create(
          name: result['name'] as String,
          description: result['description'] as String,
          category: result['category'] as String,
          price: result['price'] as String,
          duration: result['duration'] as String,
          level: result['level'] as String,
          isActive: result['isActive'] as bool,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            existing != null ? 'Kurs güncellendi.' : 'Kurs oluşturuldu.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _delete(CourseRecord course) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Kursu Sil'),
        content: Text(
          '${course.name} kursunu silmek istediginize emin misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB42318),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await CoursesApiService.instance.delete(course.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Kurs silindi.')));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _courses.where((c) => c.isActive).length;
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Kurs Yönetimi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Yeni Kurs'),
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AdminHeroCard(
                  eyebrow: 'Kurs katalogu',
                  title: 'Kurumdaki tüm kurs ve programları yönetin.',
                  description: 'Kurs ekleyin, düzenleyin veya pasife alın.',
                  metrics: [
                    AdminHeroMetric(
                      label: 'Toplam',
                      value: '${_courses.length}',
                    ),
                    AdminHeroMetric(label: 'Aktif', value: '$active'),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFB42318)),
                  ),
                ],
                const SizedBox(height: 16),
                ..._courses.map(
                  (course) => AdminPanel(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                course.name,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            AdminAccentBadge(
                              label: course.isActive ? 'Aktif' : 'Pasif',
                              color: course.isActive
                                  ? const Color(0xFF14532D)
                                  : const Color(0xFFB45309),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${course.category} • ${course.level} • ${course.duration}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        if (course.description.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            course.description,
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(height: 1.4),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          'Ucret: ${course.price}',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            FilledButton.tonalIcon(
                              onPressed: () => _openForm(existing: course),
                              icon: const Icon(Icons.edit_outlined, size: 18),
                              label: const Text('Düzenle'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: () => _delete(course),
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                size: 18,
                                color: Color(0xFFB42318),
                              ),
                              label: const Text(
                                'Sil',
                                style: TextStyle(color: Color(0xFFB42318)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _CourseFormDialog extends StatefulWidget {
  final CourseRecord? course;

  const _CourseFormDialog({this.course});

  @override
  State<_CourseFormDialog> createState() => _CourseFormDialogState();
}

class _CourseFormDialogState extends State<_CourseFormDialog> {
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _category;
  late final TextEditingController _price;
  late final TextEditingController _duration;
  late final TextEditingController _level;
  late bool _isActive;

  @override
  void initState() {
    super.initState();
    final c = widget.course;
    _name = TextEditingController(text: c?.name ?? '');
    _description = TextEditingController(text: c?.description ?? '');
    _category = TextEditingController(text: c?.category ?? '');
    _price = TextEditingController(text: c?.price ?? '');
    _duration = TextEditingController(text: c?.duration ?? '');
    _level = TextEditingController(text: c?.level ?? '');
    _isActive = c?.isActive ?? true;
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _category.dispose();
    _price.dispose();
    _duration.dispose();
    _level.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.course != null ? 'Kursu Düzenle' : 'Yeni Kurs'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Kurs Adi'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _category,
              decoration: const InputDecoration(labelText: 'Kategori'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _price,
              decoration: const InputDecoration(labelText: 'Ucret'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _duration,
              decoration: const InputDecoration(labelText: 'Sure'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _level,
              decoration: const InputDecoration(labelText: 'Seviye'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _description,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Açıklama'),
            ),
            const SizedBox(height: 10),
            SwitchListTile(
              value: _isActive,
              onChanged: (v) => setState(() => _isActive = v),
              title: const Text('Aktif'),
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Vazgeç'),
        ),
        FilledButton(
          onPressed: () {
            if (_name.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'name': _name.text.trim(),
              'description': _description.text.trim(),
              'category': _category.text.trim(),
              'price': _price.text.trim(),
              'duration': _duration.text.trim(),
              'level': _level.text.trim(),
              'isActive': _isActive,
            });
          },
          child: const Text('Kaydet'),
        ),
      ],
    );
  }
}
