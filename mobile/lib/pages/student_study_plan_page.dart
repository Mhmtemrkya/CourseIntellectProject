import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import '../services/auth_session_store.dart';
import '../services/study_plan_api_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/responsive_overlays.dart';

class StudentStudyPlanPage extends StatefulWidget {
  const StudentStudyPlanPage({super.key});

  @override
  State<StudentStudyPlanPage> createState() => _StudentStudyPlanPageState();
}

class _StudentStudyPlanPageState extends State<StudentStudyPlanPage> {
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  DateTime? _lastCompletedAt;

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();

  List<Map<String, dynamic>> planItems = [];
  bool isLoading = true;
  int streakCount = 0;
  int xpPoints = 0;

  final List<Map<String, dynamic>> _defaultPlans = [
    {
      "id": 1,
      "title": "Haftalık konu tekrari",
      "duration": "35 dk",
      "status": "Bugün",
      "reason":
          "Backendde kayıtlı plan yoksa başlangıç için varsayılan çalışma planı gösterilir.",
      "done": false,
      "scheduledAt": null,
      "createdByStudent": false,
      "notificationEnabled": false,
      "notificationId": 1001,
    },
    {
      "id": 2,
      "title": "Kısa soru taraması",
      "duration": "20 dk",
      "status": "Sıradaki",
      "reason":
          "Planlarını kendin düzenleyebilir veya hatırlatma ekleyebilirsin.",
      "done": false,
      "scheduledAt": null,
      "createdByStudent": false,
      "notificationEnabled": false,
      "notificationId": 1002,
    },
    {
      "id": 3,
      "title": "Eksik kalan çalışmayi tamamla",
      "duration": "25 dk",
      "status": "Tekrar",
      "reason":
          "Bu alan ileride soru ve sınav verilerine göre daha akıllı öneriler uretebilir.",
      "done": false,
      "scheduledAt": null,
      "createdByStudent": false,
      "notificationEnabled": false,
      "notificationId": 1003,
    },
  ];

  @override
  void initState() {
    super.initState();
    _initializeNotifications();
    _loadPlans();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _reasonController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  Future<void> _initializeNotifications() async {
    tz.initializeTimeZones();
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(settings);
    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
  }

  Future<void> _loadPlans() async {
    try {
      final record = await StudyPlanApiService.instance.fetch();
      final storedPlans = record.planItems.isEmpty
          ? List<Map<String, dynamic>>.from(_defaultPlans)
          : record.planItems;

      setState(() {
        planItems = storedPlans;
        streakCount = record.streakCount;
        xpPoints = record.xpPoints;
        _lastCompletedAt = record.lastCompletedAt;
        isLoading = false;
      });

      await _savePlans();
    } catch (_) {
      setState(() {
        planItems = List<Map<String, dynamic>>.from(_defaultPlans);
        isLoading = false;
      });
    }
  }

  Future<void> _savePlans() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) return;
    await StudyPlanApiService.instance.save(
      studentName: session.fullName,
      planItems: planItems,
      streakCount: streakCount,
      xpPoints: xpPoints,
      lastCompletedAt: _lastCompletedAt,
    );
  }

  int _nextPlanId() {
    if (planItems.isEmpty) return 1;
    return planItems
            .map((item) => item["id"] as int? ?? 0)
            .reduce((a, b) => a > b ? a : b) +
        1;
  }

  List<Map<String, dynamic>> get _priorityTopics {
    final colors = [
      const Color(0xFFFF7A00),
      const Color(0xFFEF4444),
      const Color(0xFF2563EB),
    ];
    final grouped = <String, int>{};
    for (final item in planItems) {
      final title = (item["title"] as String? ?? '').trim();
      if (title.isEmpty) continue;
      grouped[title] = (grouped[title] ?? 0) + 1;
    }
    final entries = grouped.entries.take(3).toList();
    if (entries.isEmpty) {
      return [
        {"topic": "Plan ekle", "count": 1, "color": colors[0]},
      ];
    }
    return entries.asMap().entries.map((entry) {
      return {
        "topic": entry.value.key,
        "count": entry.value.value,
        "color": colors[entry.key % colors.length],
      };
    }).toList();
  }

  Future<void> _toggleDone(int index) async {
    final wasDone = planItems[index]["done"] as bool? ?? false;
    setState(() {
      planItems[index]["done"] = !wasDone;
    });

    if (!wasDone) {
      await _applyCompletionRewards();
    } else {
      setState(() {
        xpPoints = (xpPoints - 25).clamp(0, 1 << 31);
      });
    }

    await _savePlans();
  }

  Future<void> _applyCompletionRewards() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    DateTime? lastDate = _lastCompletedAt;
    if (lastDate != null) {
      lastDate = DateTime(lastDate.year, lastDate.month, lastDate.day);
    }

    setState(() {
      xpPoints += 25;
      if (lastDate == null) {
        streakCount = 1;
      } else {
        final diff = today.difference(lastDate).inDays;
        if (diff == 0) {
          streakCount = streakCount == 0 ? 1 : streakCount;
        } else if (diff == 1) {
          streakCount += 1;
        } else {
          streakCount = 1;
        }
      }
    });

    _lastCompletedAt = today;
  }

  Future<void> _deletePlan(int index) async {
    final deleted = planItems[index]["title"] as String;
    final notificationId = planItems[index]["notificationId"] as int?;
    if (notificationId != null) {
      await _notifications.cancel(notificationId);
    }

    setState(() {
      planItems.removeAt(index);
    });

    await _savePlans();
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text("$deleted silindi.")));
  }

  Future<void> _toggleReminder(int index) async {
    final item = planItems[index];
    final enabled = item["notificationEnabled"] as bool? ?? false;
    final scheduledAtRaw = item["scheduledAt"] as String?;

    if (!enabled && (scheduledAtRaw == null || scheduledAtRaw.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Hatırlatma için önce tarih ve saat seçmelisin."),
        ),
      );
      return;
    }

    setState(() {
      planItems[index]["notificationEnabled"] = !enabled;
    });

    if (!enabled) {
      await _schedulePlanReminder(planItems[index]);
    } else {
      await _notifications.cancel(item["notificationId"] as int);
    }

    await _savePlans();
  }

  Future<void> _schedulePlanReminder(Map<String, dynamic> item) async {
    final scheduledAtRaw = item["scheduledAt"] as String?;
    if (scheduledAtRaw == null || scheduledAtRaw.isEmpty) return;

    final scheduledAt = DateTime.tryParse(scheduledAtRaw);
    if (scheduledAt == null) return;

    final scheduleDate = tz.TZDateTime.from(scheduledAt, tz.local);
    if (scheduleDate.isBefore(tz.TZDateTime.now(tz.local))) return;

    await _notifications.zonedSchedule(
      item["notificationId"] as int,
      'Çalışma Plani Hatırlatması',
      item["title"] as String,
      scheduleDate,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'study_plan_channel',
          'Study Plan Reminders',
          channelDescription: 'Çalışma planı hatırlatmalari',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
    );
  }

  Future<void> _openPlanDialog({int? editIndex}) async {
    final editing = editIndex != null;
    DateTime? selectedDateTime;
    String selectedStatus = "Bugün";
    bool notificationEnabled = false;

    if (editing) {
      final item = planItems[editIndex];
      _titleController.text = item["title"] as String? ?? "";
      _reasonController.text = item["reason"] as String? ?? "";
      _durationController.text = item["duration"] as String? ?? "";
      selectedStatus = item["status"] as String? ?? "Bugün";
      notificationEnabled = item["notificationEnabled"] as bool? ?? false;
      final scheduledAt = item["scheduledAt"] as String?;
      if (scheduledAt != null && scheduledAt.isNotEmpty) {
        selectedDateTime = DateTime.tryParse(scheduledAt);
      }
    } else {
      _titleController.clear();
      _reasonController.clear();
      _durationController.clear();
    }

    const statuses = ["Bugün", "Sıradaki", "Tekrar", "Hafta Sonu"];

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> pickDateTime() async {
              final now = DateTime.now();
              final pickedDate = await showDatePicker(
                context: context,
                initialDate: selectedDateTime ?? now,
                firstDate: now.subtract(const Duration(days: 1)),
                lastDate: now.add(const Duration(days: 365)),
              );
              if (pickedDate == null || !context.mounted) return;

              final pickedTime = await showTimePicker(
                context: context,
                initialTime: TimeOfDay.fromDateTime(selectedDateTime ?? now),
              );
              if (pickedTime == null) return;

              setDialogState(() {
                selectedDateTime = DateTime(
                  pickedDate.year,
                  pickedDate.month,
                  pickedDate.day,
                  pickedTime.hour,
                  pickedTime.minute,
                );
              });
            }

            return AlertDialog(
              content: ResponsiveDialogContainer(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          editing ? "Plani Düzenle" : "Plan Ekle",
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _titleController,
                        decoration: const InputDecoration(
                          labelText: "Plan Başlığı",
                          hintText: "Örnek: Turev tekrar testi",
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _reasonController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: "Açıklama",
                          hintText: "Neden bu planı eklendiğini yaz",
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _durationController,
                        decoration: const InputDecoration(
                          labelText: "Sure",
                          hintText: "Örnek: 30 dk",
                        ),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: selectedStatus,
                        decoration: const InputDecoration(
                          labelText: "Plan Zamani",
                        ),
                        items: statuses
                            .map(
                              (item) => DropdownMenuItem(
                                value: item,
                                child: Text(item),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          setDialogState(() {
                            selectedStatus = value;
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: pickDateTime,
                          icon: const Icon(Icons.schedule_rounded),
                          label: Text(
                            selectedDateTime == null
                                ? "Tarih / Saat Seç"
                                : _formatDateTime(selectedDateTime!),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        value: notificationEnabled,
                        contentPadding: EdgeInsets.zero,
                        title: const Text("Hatırlatma Açık"),
                        subtitle: const Text(
                          "Plan zamanı geldiğinde cihaz bildirimi oluştur.",
                        ),
                        onChanged: (value) {
                          setDialogState(() {
                            notificationEnabled = value;
                          });
                        },
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                if (editing)
                  TextButton(
                    onPressed: () async {
                      Navigator.pop(dialogContext);
                      await _deletePlan(editIndex);
                    },
                    child: const Text("Sil"),
                  ),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text("Vazgeç"),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final title = _titleController.text.trim();
                    final reason = _reasonController.text.trim();
                    final duration = _durationController.text.trim();

                    if (title.isEmpty || reason.isEmpty || duration.isEmpty) {
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        const SnackBar(
                          content: Text("Tüm alanları doldurmalısın."),
                        ),
                      );
                      return;
                    }

                    final currentNotificationId = editing
                        ? planItems[editIndex]["notificationId"] as int? ??
                              (_nextPlanId() + 1000)
                        : _nextPlanId() + 1000;

                    final plan = {
                      "id": editing
                          ? planItems[editIndex]["id"] as int? ?? _nextPlanId()
                          : _nextPlanId(),
                      "title": title,
                      "duration": duration,
                      "status": selectedStatus,
                      "reason": reason,
                      "done": editing
                          ? planItems[editIndex]["done"] as bool? ?? false
                          : false,
                      "scheduledAt": selectedDateTime?.toIso8601String(),
                      "createdByStudent": true,
                      "notificationEnabled": notificationEnabled,
                      "notificationId": currentNotificationId,
                    };

                    setState(() {
                      if (editing) {
                        planItems[editIndex] = plan;
                      } else {
                        planItems.insert(0, plan);
                      }
                    });

                    if (notificationEnabled) {
                      await _schedulePlanReminder(plan);
                    } else if (editing) {
                      await _notifications.cancel(currentNotificationId);
                    }

                    await _savePlans();
                    if (!mounted) return;
                    Navigator.of(this.context).pop();
                    ScaffoldMessenger.of(this.context).showSnackBar(
                      SnackBar(
                        content: Text(
                          editing ? "Plan güncellendi." : "Yeni plan eklendi.",
                        ),
                      ),
                    );
                  },
                  child: Text(editing ? "Güncelle" : "Ekle"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _reorderPlans(int oldIndex, int newIndex) {
    setState(() {
      if (newIndex > oldIndex) {
        newIndex -= 1;
      }
      final item = planItems.removeAt(oldIndex);
      planItems.insert(newIndex, item);
    });
    _savePlans();
  }

  String _formatDateTime(DateTime dateTime) {
    final day = dateTime.day.toString().padLeft(2, '0');
    final month = dateTime.month.toString().padLeft(2, '0');
    final year = dateTime.year;
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return "$day.$month.$year $hour:$minute";
  }

  List<Map<String, dynamic>> get upcomingReminders =>
      planItems.where((item) => item["notificationEnabled"] == true).toList()
        ..sort((a, b) {
          final aDate = DateTime.tryParse(a["scheduledAt"] as String? ?? '');
          final bDate = DateTime.tryParse(b["scheduledAt"] as String? ?? '');
          if (aDate == null && bDate == null) return 0;
          if (aDate == null) return 1;
          if (bDate == null) return -1;
          return aDate.compareTo(bDate);
        });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final completed = planItems.where((item) => item["done"] == true).length;

    return Scaffold(
      appBar: AppBar(title: const Text("Çalışma Planım")),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: ResponsiveContent(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0EA5A4), Color(0xFF22C55E)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFF0EA5A4,
                            ).withValues(alpha: 0.24),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Kişisel çalışma akışı",
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "Yanlışlar, öğretmen geri bildirimleri ve test performansına göre otomatik planlandı.",
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.92),
                            ),
                          ),
                          const SizedBox(height: 18),
                          Row(
                            children: [
                              _metricPill("Plan", "${planItems.length}"),
                              const SizedBox(width: 10),
                              _metricPill("Tamam", "$completed"),
                              const SizedBox(width: 10),
                              _metricPill("XP", "$xpPoints"),
                              const SizedBox(width: 10),
                              _metricPill("Seri", "$streakCount"),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    if (upcomingReminders.isNotEmpty) ...[
                      Text(
                        "Yaklasan Hatırlatmalar",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...upcomingReminders
                          .take(3)
                          .map(
                            (item) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: theme.cardColor,
                                borderRadius: BorderRadius.circular(18),
                                boxShadow: [
                                  BoxShadow(
                                    color: isDark
                                        ? Colors.black.withValues(alpha: 0.18)
                                        : Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.alarm_rounded,
                                    color: Color(0xFFFF7A00),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item["title"] as String,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _formatDateTime(
                                            DateTime.parse(
                                              item["scheduledAt"] as String,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      "Öncelikli Konular",
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: _priorityTopics.map((item) {
                        final color = item["color"] as Color;
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            "${item["topic"]} • ${item["count"]} soru",
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            "Bugünkü Plan",
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () => _openPlanDialog(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text("Plan Ekle"),
                        ),
                      ],
                    ),
                    Text(
                      "Sıralamayı değiştirmek için kartları sürükle.",
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.72,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ReorderableListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: planItems.length,
                      onReorder: _reorderPlans,
                      buildDefaultDragHandles: false,
                      itemBuilder: (context, index) {
                        final item = planItems[index];
                        final done = item["done"] as bool? ?? false;
                        final scheduledAt = item["scheduledAt"] as String?;
                        final hasDate =
                            scheduledAt != null && scheduledAt.isNotEmpty;
                        final reminderEnabled =
                            item["notificationEnabled"] as bool? ?? false;

                        return Container(
                          key: ValueKey(item["id"]),
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: theme.cardColor,
                            borderRadius: BorderRadius.circular(22),
                            boxShadow: [
                              BoxShadow(
                                color: isDark
                                    ? Colors.black.withValues(alpha: 0.18)
                                    : Colors.black.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  ReorderableDragStartListener(
                                    index: index,
                                    child: const Padding(
                                      padding: EdgeInsets.only(right: 10),
                                      child: Icon(Icons.drag_indicator_rounded),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      item["title"] as String,
                                      style: theme.textTheme.titleSmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            decoration: done
                                                ? TextDecoration.lineThrough
                                                : null,
                                          ),
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () =>
                                        _openPlanDialog(editIndex: index),
                                    icon: const Icon(Icons.edit_outlined),
                                  ),
                                  Checkbox(
                                    value: done,
                                    onChanged: (_) => _toggleDone(index),
                                  ),
                                ],
                              ),
                              Text(
                                item["reason"] as String,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.textTheme.bodyMedium?.color
                                      ?.withValues(alpha: 0.72),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  _infoChip(theme, item["duration"] as String),
                                  _infoChip(theme, item["status"] as String),
                                  if (hasDate)
                                    _infoChip(
                                      theme,
                                      _formatDateTime(
                                        DateTime.parse(scheduledAt),
                                      ),
                                    ),
                                  if (item["createdByStudent"] == true)
                                    _infoChip(theme, "Ben Ekledim"),
                                  if (reminderEnabled)
                                    _infoChip(theme, "Alarm Açık"),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  OutlinedButton(
                                    onPressed: () =>
                                        _openPlanDialog(editIndex: index),
                                    child: const Text("Düzenle"),
                                  ),
                                  const SizedBox(width: 10),
                                  ElevatedButton(
                                    onPressed: () => _toggleDone(index),
                                    child: Text(done ? "Geri Al" : "Tamamla"),
                                  ),
                                  const SizedBox(width: 10),
                                  IconButton(
                                    onPressed: () => _toggleReminder(index),
                                    icon: Icon(
                                      reminderEnabled
                                          ? Icons.alarm_on_rounded
                                          : Icons.alarm_add_rounded,
                                      color: reminderEnabled
                                          ? const Color(0xFFFF7A00)
                                          : null,
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () => _deletePlan(index),
                                    icon: const Icon(
                                      Icons.delete_outline_rounded,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _metricPill(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.88)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoChip(ThemeData theme, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}
