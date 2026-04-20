import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/live_room_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherLiveRoomPage extends StatefulWidget {
  final String lessonTitle;
  final String className;
  final String time;

  const TeacherLiveRoomPage({
    super.key,
    required this.lessonTitle,
    required this.className,
    required this.time,
  });

  @override
  State<TeacherLiveRoomPage> createState() => _TeacherLiveRoomPageState();
}

class _TeacherLiveRoomPageState extends State<TeacherLiveRoomPage> {
  List<String> sharedFiles = const [];
  List<String> lessonNotes = const [];
  List<String> participants = const [];
  String _teacherName = '';
  bool micOn = true;
  bool cameraOn = true;
  bool sharingOn = false;
  bool recordingOn = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _roomId;

  @override
  void initState() {
    super.initState();
    _loadContext();
  }

  Future<void> _loadContext() async {
    final session = await AuthSessionStore.instance.load();
    final teacherName = session?.fullName ?? _teacherName;
    try {
      final room = await LiveRoomApiService.instance.openRoom(
        lessonTitle: widget.lessonTitle,
        teacherName: teacherName,
        className: widget.className,
        timeLabel: widget.time,
      );
      if (!mounted) return;
      _applyRoom(room, teacherNameOverride: teacherName);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _teacherName = teacherName;
        _error = error.toString();
        _loading = false;
      });
    }
  }

  void _applyRoom(LiveRoomSessionRecord room, {String? teacherNameOverride}) {
    setState(() {
      _roomId = room.id;
      _teacherName = teacherNameOverride?.isNotEmpty == true
          ? teacherNameOverride!
          : room.teacherName;
      participants = room.participants;
      sharedFiles = room.assets.map((item) => item.fileName).toList();
      lessonNotes = room.notes.map((item) => item.text).toList();
      micOn = room.micOn;
      cameraOn = room.cameraOn;
      sharingOn = room.sharingOn;
      recordingOn = room.recordingOn;
      _loading = false;
      _error = null;
    });
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();

    if (result != null && result.files.single.name.isNotEmpty) {
      final roomId = _roomId;
      if (roomId == null) return;
      try {
        final room = await LiveRoomApiService.instance.addAsset(
          roomId,
          result.files.single.name,
        );
        if (!mounted) return;
        _applyRoom(room);
        _showSnack("${result.files.single.name} eklendi");
      } catch (error) {
        if (!mounted) return;
        _showSnack(error.toString());
      }
    }
  }

  Future<void> _showAddNoteDialog() async {
    final controller = TextEditingController();

    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Ders Notu Ekle"),
          content: TextField(
            controller: controller,
            maxLines: 4,
            decoration: const InputDecoration(hintText: "Notunuzu yazın..."),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Iptal"),
            ),
            ElevatedButton(
              onPressed: () {
                final text = controller.text.trim();
                if (text.isEmpty) return;
                Navigator.pop(context);
                _addNote(text);
              },
              child: const Text("Ekle"),
            ),
          ],
        );
      },
    );

    controller.dispose();
  }

  void _downloadFile(String fileName) {
    _showSnack("$fileName indiriliyor");
  }

  Future<void> _addNote(String text) async {
    final roomId = _roomId;
    if (roomId == null) return;
    try {
      final room = await LiveRoomApiService.instance.addNote(roomId, text);
      if (!mounted) return;
      _applyRoom(room);
      _showSnack("Ders notu eklendi");
    } catch (error) {
      if (!mounted) return;
      _showSnack(error.toString());
    }
  }

  Future<void> _updateState({
    bool? mic,
    bool? camera,
    bool? sharing,
    bool? recording,
  }) async {
    final roomId = _roomId;
    if (roomId == null || _busy) return;
    setState(() => _busy = true);
    try {
      final room = await LiveRoomApiService.instance.updateState(
        roomId,
        micOn: mic,
        cameraOn: camera,
        sharingOn: sharing,
        recordingOn: recording,
      );
      if (!mounted) return;
      _applyRoom(room);
    } catch (error) {
      if (!mounted) return;
      _showSnack(error.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _toggleMic() async {
    await _updateState(mic: !micOn);
    _showSnack(micOn ? "Mikrofon açıldı" : "Mikrofon kapatildi");
  }

  Future<void> _toggleCamera() async {
    await _updateState(camera: !cameraOn);
    _showSnack(cameraOn ? "Kamera açıldı" : "Kamera kapatildi");
  }

  Future<void> _toggleSharing() async {
    await _updateState(sharing: !sharingOn);
    _showSnack(sharingOn ? "Ekran paylaşimi basladi" : "Ekran paylaşimi durdu");
  }

  Future<void> _toggleRecording() async {
    await _updateState(recording: !recordingOn);
    _showSnack(recordingOn ? "Ders kaydı başlatıldı" : "Ders kaydı durduruldu");
  }

  Future<void> _endLesson() async {
    final roomId = _roomId;
    if (roomId == null) {
      Navigator.pop(context);
      return;
    }
    try {
      await LiveRoomApiService.instance.endRoom(roomId);
      if (!mounted) return;
      _showSnack("Canlı ders sonlandırıldı");
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      _showSnack(error.toString());
    }
  }

  void _showSnack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Canlı Ders Odası",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${widget.className} • ${widget.time}',
        showBackButton: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () => _loadContext(),
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _heroRoomCard(theme, isDark),
                  if (sharingOn) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.screen_share_rounded, color: Colors.blue),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              "Ekran paylaşımı aktif. Öğrenciler paylaştığınız içeriği görüyor.",
                              style: TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  _sectionTitle(theme, "Ders Bilgileri"),
                  const SizedBox(height: 12),
                  _infoCard(theme, isDark),
                  const SizedBox(height: 18),
                  _sectionTitle(theme, "Katılımcılar"),
                  const SizedBox(height: 12),
                  _participantsCard(theme, isDark),
                  const SizedBox(height: 18),
                  _sectionTitle(theme, "Ders Araclari"),
                  const SizedBox(height: 12),
                  _toolsGrid(context),
                  const SizedBox(height: 18),
                  _sectionTitle(theme, "Paylaşılan İçerikler"),
                  const SizedBox(height: 12),
                  _contentCard(theme, isDark),
                  const SizedBox(height: 18),
                  _controlBar(context),
                ],
              ),
            ),
    );
  }

  Widget _heroRoomCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFA24A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF7A00).withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.wifi_tethering_rounded, color: Colors.white),
              SizedBox(width: 8),
              Text(
                "Canlı Ders Aktif",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "Öğrenciler bağlandı, ders akışınız hazır. Şimdi paylaşım yapabilir, kamera ve mikrofon kontrollerini yönetebilirsin.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _heroStat("${participants.length}", "Katılımcı"),
              const SizedBox(width: 12),
              _heroStat(
                "${participants.length > 3 ? 3 : participants.length}",
                "Aktif",
              ),
              const SizedBox(width: 12),
              _heroStat(recordingOn ? "REC" : "OFF", "Kayıt"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
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
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.92),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(ThemeData theme, String title) {
    return Text(
      title,
      style: theme.textTheme.titleMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  Widget _infoCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          _infoRow(theme, Icons.menu_book_rounded, "Ders", widget.lessonTitle),
          const SizedBox(height: 12),
          _infoRow(theme, Icons.groups_rounded, "Sınıf", widget.className),
          const SizedBox(height: 12),
          _infoRow(theme, Icons.schedule_rounded, "Saat", widget.time),
          const SizedBox(height: 12),
          _infoRow(
            theme,
            Icons.link_rounded,
            "Baglanti",
            _roomId == null
                ? "meet.courseintellect.live/${widget.className}"
                : "meet.courseintellect.live/${widget.className}".toLowerCase(),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(ThemeData theme, IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: theme.colorScheme.primary),
        const SizedBox(width: 10),
        Text(
          "$label:",
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 6),
        Expanded(child: Text(value)),
      ],
    );
  }

  Widget _participantsCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: participants.isEmpty
          ? const Text('Bu sınıf için katılımcı listesi henüz oluşmadı.')
          : Wrap(
              spacing: 10,
              runSpacing: 10,
              children: participants.map((name) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: theme.scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: theme.colorScheme.primary.withValues(
                          alpha: 0.14,
                        ),
                        child: Text(
                          name[0],
                          style: TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(name),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }

  Widget _toolsGrid(BuildContext context) {
    return Row(
      children: [
        _toggleToolCard(
          context,
          title: "Mikrofon",
          active: micOn,
          activeIcon: Icons.mic_rounded,
          inactiveIcon: Icons.mic_off_rounded,
          color: Colors.green,
          onTap: () => _toggleMic(),
        ),
        const SizedBox(width: 12),
        _toggleToolCard(
          context,
          title: "Kamera",
          active: cameraOn,
          activeIcon: Icons.videocam_rounded,
          inactiveIcon: Icons.videocam_off_rounded,
          color: Colors.redAccent,
          onTap: () => _toggleCamera(),
        ),
        const SizedBox(width: 12),
        _toggleToolCard(
          context,
          title: "Paylas",
          active: sharingOn,
          activeIcon: Icons.screen_share_rounded,
          inactiveIcon: Icons.stop_screen_share_rounded,
          color: Colors.blue,
          onTap: () => _toggleSharing(),
        ),
      ],
    );
  }

  Widget _toggleToolCard(
    BuildContext context, {
    required String title,
    required bool active,
    required IconData activeIcon,
    required IconData inactiveIcon,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);

    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: 0.12) : theme.cardColor,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active
                  ? color.withValues(alpha: 0.40)
                  : Colors.transparent,
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: active
                      ? color.withValues(alpha: 0.18)
                      : theme.scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  active ? activeIcon : inactiveIcon,
                  color: active ? color : theme.iconTheme.color,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: active ? color : theme.textTheme.bodyMedium?.color,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                active ? "Açık" : "Kapali",
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _contentCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "Paylaşılan İçerikler",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _pickFile,
                child: Container(
                  width: 40,
                  height: 40,
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.add, color: theme.colorScheme.primary),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _showAddNoteDialog,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.note_add_rounded,
                    color: Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...sharedFiles.map(
            (item) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.insert_drive_file_rounded,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(item, overflow: TextOverflow.ellipsis)),
                  IconButton(
                    onPressed: () => _downloadFile(item),
                    icon: const Icon(Icons.download_rounded),
                  ),
                ],
              ),
            ),
          ),
          if (lessonNotes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              "Eklenen Notlar",
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            ...lessonNotes.map(
              (note) => Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: theme.scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.sticky_note_2_rounded,
                      color: Colors.orange,
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(note)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _controlBar(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _busy ? null : () => _toggleRecording(),
            icon: Icon(
              recordingOn
                  ? Icons.stop_circle_outlined
                  : Icons.fiber_manual_record_rounded,
            ),
            label: Text(recordingOn ? "Kaydı Durdur" : "Kaydı Başlat"),
            style: OutlinedButton.styleFrom(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _busy ? null : () => _endLesson(),
            icon: const Icon(Icons.call_end_rounded),
            label: const Text("Dersi Bitir"),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
