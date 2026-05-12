import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/linked_children_service.dart';
import '../services/meeting_request_api_service.dart';
import '../widgets/app_header.dart';

class VeliMeetingRequestPage extends StatefulWidget {
  final String advisor;

  const VeliMeetingRequestPage({super.key, this.advisor = 'Rehberlik Servisi'});

  @override
  State<VeliMeetingRequestPage> createState() => _VeliMeetingRequestPageState();
}

class _VeliMeetingRequestPageState extends State<VeliMeetingRequestPage> {
  final TextEditingController _noteController = TextEditingController(
    text:
        'Öğrencinin akademik durumu ve çalışma planı hakkında kısa bir görüşme talep ediyorum.',
  );

  String _selectedTopic = 'Akademik gelişim';
  String _selectedSlot = '';
  String _selectedStudent = '';
  String _selectedAdvisor = '';
  String _selectedDayKey = '';
  List<LinkedChildRecord> _children = const [];
  List<AdminStaffRecord> _teachers = const [];
  AuthSession? _session;
  bool _onlineMeeting = true;
  bool _loadingSlots = true;
  String? _slotError;

  final List<String> _topics = const [
    'Akademik gelişim',
    'Devamsızlık ve disiplin',
    'Sınav sonuçları',
    'Çalışma planı',
  ];

  List<_SlotInfo> _slots = const [];

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    final availableAdvisors = await MeetingRequestApiService.instance
        .fetchAvailableAdvisors()
        .catchError((_) => <String>[]);
    final teachers = availableAdvisors.isNotEmpty
        ? availableAdvisors
              .asMap()
              .entries
              .map(
                (entry) => AdminStaffRecord(
                  id: '',
                  fullName: entry.value,
                  username: 'advisor-${entry.key}',
                  role: 'Teacher',
                  departmentOrBranch: '',
                  campus: '',
                  status: 'Active',
                ),
              )
              .toList()
        : await AdminDirectoryApiService.instance
              .fetchStaff(role: 'Teacher')
              .catchError((_) => <AdminStaffRecord>[]);
    final preferredAdvisor = widget.advisor.trim();
    final matchingTeacher = teachers
        .where((teacher) => teacher.fullName.trim() == preferredAdvisor)
        .firstOrNull;
    final initialAdvisor =
        matchingTeacher?.fullName ??
        (teachers.isNotEmpty
            ? teachers.first.fullName
            : (preferredAdvisor.isEmpty
                  ? 'Rehberlik Servisi'
                  : preferredAdvisor));
    if (!mounted) return;
    setState(() {
      _session = session;
      _children = children;
      _teachers = teachers;
      _selectedStudent = children.isNotEmpty ? children.first.fullName : '';
      _selectedAdvisor = initialAdvisor;
    });
    await _loadSlots();
  }

  _SlotInfo _parseSlot(String raw) {
    final candidate = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
    if (candidate != null) {
      return _SlotInfo(
        raw: raw,
        dateKey:
            '${candidate.year.toString().padLeft(4, '0')}-${candidate.month.toString().padLeft(2, '0')}-${candidate.day.toString().padLeft(2, '0')}',
        dayLabel: MaterialLocalizations.of(context).formatFullDate(candidate),
        compactDay: MaterialLocalizations.of(
          context,
        ).formatMediumDate(candidate),
        timeLabel: MaterialLocalizations.of(context).formatTimeOfDay(
          TimeOfDay.fromDateTime(candidate),
          alwaysUse24HourFormat: true,
        ),
        sortable: candidate.millisecondsSinceEpoch,
      );
    }
    return _SlotInfo(
      raw: raw,
      dateKey: raw,
      dayLabel: raw,
      compactDay: raw,
      timeLabel: raw,
      sortable: 0,
    );
  }

  Future<void> _loadSlots() async {
    setState(() {
      _loadingSlots = true;
      _slotError = null;
    });
    try {
      final slots = await MeetingRequestApiService.instance.fetchAvailableSlots(
        advisor: _selectedAdvisor.trim().isEmpty
            ? widget.advisor
            : _selectedAdvisor,
        onlineMeeting: _onlineMeeting,
      );
      if (!mounted) return;
      final parsed = slots.map((item) => _parseSlot(item.slot)).toList()
        ..sort((a, b) => a.sortable.compareTo(b.sortable));
      setState(() {
        _slots = parsed;
        _selectedDayKey = parsed.isNotEmpty ? parsed.first.dateKey : '';
        _selectedSlot = parsed.isNotEmpty ? parsed.first.raw : '';
        _loadingSlots = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _slotError = error.toString();
        _slots = const [];
        _selectedDayKey = '';
        _selectedSlot = '';
        _loadingSlots = false;
      });
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Map<String, List<_SlotInfo>> _groupedSlots() {
    final map = <String, List<_SlotInfo>>{};
    for (final slot in _slots) {
      map.putIfAbsent(slot.dateKey, () => []);
      map[slot.dateKey]!.add(slot);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final groupedSlots = _groupedSlots();
    final visibleSlots = groupedSlots[_selectedDayKey] ?? const <_SlotInfo>[];

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Görüşme Talebi'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _heroCard(context),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Öğrenci seçimi',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedStudent.isEmpty
                        ? null
                        : _selectedStudent,
                    decoration: const InputDecoration(
                      labelText: 'Çocuk',
                      border: OutlineInputBorder(),
                    ),
                    items: _children
                        .map(
                          (child) => DropdownMenuItem(
                            value: child.fullName,
                            child: Text(child.displayLabel),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _selectedStudent = value);
                    },
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedAdvisor.isEmpty
                        ? null
                        : _selectedAdvisor,
                    decoration: const InputDecoration(
                      labelText: 'Öğretmen',
                      border: OutlineInputBorder(),
                    ),
                    items: _teachers
                        .map(
                          (teacher) => DropdownMenuItem(
                            value: teacher.fullName,
                            child: Text(teacher.fullName),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedAdvisor = value;
                        _selectedDayKey = '';
                        _selectedSlot = '';
                      });
                      _loadSlots();
                    },
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Görüşme konusu',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _topics
                        .map(
                          (topic) => ChoiceChip(
                            label: Text(topic),
                            selected: _selectedTopic == topic,
                            onSelected: (_) =>
                                setState(() => _selectedTopic = topic),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Görüşme tipi',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment<bool>(
                        value: true,
                        icon: Icon(Icons.video_call_outlined),
                        label: Text('Online'),
                      ),
                      ButtonSegment<bool>(
                        value: false,
                        icon: Icon(Icons.meeting_room_outlined),
                        label: Text('Yüz yüze'),
                      ),
                    ],
                    selected: {_onlineMeeting},
                    onSelectionChanged: (selection) {
                      setState(() => _onlineMeeting = selection.first);
                      _loadSlots();
                    },
                  ),
                  const SizedBox(height: 16),
                  if (_loadingSlots)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_slotError != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_slotError!),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _loadSlots,
                          child: const Text('Saatleri Yenile'),
                        ),
                      ],
                    )
                  else if (_slots.isEmpty)
                    const Text(
                      'Bu öğretmen için uygun görüşme saati bulunamadı.',
                    )
                  else ...[
                    Text(
                      'Uygün günler',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: groupedSlots.entries.map((entry) {
                        final first = entry.value.first;
                        return ChoiceChip(
                          label: Text(first.compactDay),
                          selected: _selectedDayKey == entry.key,
                          onSelected: (_) => setState(() {
                            _selectedDayKey = entry.key;
                            _selectedSlot = entry.value.first.raw;
                          }),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Saatler',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: visibleSlots.map((slot) {
                        final selected = _selectedSlot == slot.raw;
                        return InkWell(
                          onTap: () => setState(() => _selectedSlot = slot.raw),
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: selected
                                  ? const Color(
                                      0xFF0F766E,
                                    ).withValues(alpha: 0.12)
                                  : theme.cardColor,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: selected
                                    ? const Color(0xFF0F766E)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  slot.timeLabel,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: selected
                                        ? const Color(0xFF0F766E)
                                        : null,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _onlineMeeting ? 'Online' : 'Yüz yüze',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Not',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _noteController,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Görüşme notu',
                      hintText:
                          'Görüşme öncesi paylaşmak istediğiniz notu yazın',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _surface(
              context,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Talep özeti',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _summaryLine(
                    'Yetkili',
                    _selectedAdvisor.trim().isEmpty
                        ? (widget.advisor.trim().isEmpty
                              ? 'Danışman'
                              : widget.advisor)
                        : _selectedAdvisor,
                  ),
                  _summaryLine('Konu', _selectedTopic),
                  _summaryLine(
                    'Gün',
                    groupedSlots[_selectedDayKey]?.first.dayLabel ??
                        'Seçilmedi',
                  ),
                  _summaryLine(
                    'Saat',
                    _selectedSlot.isEmpty
                        ? 'Seçilmedi'
                        : _parseSlot(_selectedSlot).timeLabel,
                  ),
                  _summaryLine(
                    'Format',
                    _onlineMeeting ? 'Online görüşme' : 'Yüz yüze görüşme',
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _submitRequest,
                      icon: const Icon(Icons.send_rounded),
                      label: const Text('Talebi Oluştur'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroCard(BuildContext context) {
    final theme = Theme.of(context);
    final advisor = _selectedAdvisor.trim().isEmpty
        ? (widget.advisor.trim().isEmpty ? 'Danışman' : widget.advisor)
        : _selectedAdvisor;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF1F2937), Color(0xFF0F766E), Color(0xFF22C55E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'Görüşme planı • $advisor',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Öğretmenin açtığı uygun gün ve saatlerden birini seçerek talep oluştur.',
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Liste dışındaki saatler seçilemez. Böylece hem veli tarafı net kalır hem öğretmenin takvimi düzenli çalışır.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.88),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _surface(BuildContext context, {required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: child,
    );
  }

  Widget _summaryLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Future<void> _submitRequest() async {
    if (_selectedStudent.isEmpty || _selectedSlot.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lütfen öğrenci ve saat seçin.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    try {
      await MeetingRequestApiService.instance.createRequest(
        parentName: _session?.fullName ?? 'Veli',
        studentName: _selectedStudent,
        advisor: _selectedAdvisor.trim().isEmpty
            ? (widget.advisor.trim().isEmpty ? 'Danışman' : widget.advisor)
            : _selectedAdvisor,
        topic: _selectedTopic,
        slot: _selectedSlot,
        onlineMeeting: _onlineMeeting,
        note: _noteController.text.trim(),
      );

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Talep Gönderildi'),
          content: const Text(
            'Görüşme talebiniz öğretmene başarıyla iletildi. Onay durumunu veli panelinden takip edebilirsiniz.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Tamam'),
            ),
          ],
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _SlotInfo {
  final String raw;
  final String dateKey;
  final String dayLabel;
  final String compactDay;
  final String timeLabel;
  final int sortable;

  const _SlotInfo({
    required this.raw,
    required this.dateKey,
    required this.dayLabel,
    required this.compactDay,
    required this.timeLabel,
    required this.sortable,
  });
}
