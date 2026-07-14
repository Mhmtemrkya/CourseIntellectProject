import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingAppointmentRequestPage extends StatefulWidget {
  const DrivingAppointmentRequestPage({super.key, this.sourceAppointment});
  final Map<String, dynamic>? sourceAppointment;
  @override
  State<DrivingAppointmentRequestPage> createState() =>
      _DrivingAppointmentRequestPageState();
}

class _DrivingAppointmentRequestPageState
    extends State<DrivingAppointmentRequestPage> {
  bool _loading = true, _saving = false;
  String? _error, _slotKey, _instructorId, _vehicleId;
  int _duration = 60;
  Map<String, dynamic> _options = const {};
  List<Map<String, dynamic>> _requests = const [];
  final _meeting = TextEditingController(), _note = TextEditingController();

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
      final result = await Future.wait([
        DrivingSchoolApiService.instance.appointmentOptions(
          duration: _duration,
        ),
        DrivingSchoolApiService.instance.myAppointmentRequests(),
      ]);
      if (mounted) {
        setState(() {
          _options = result[0] as Map<String, dynamic>;
          _requests = result[1] as List<Map<String, dynamic>>;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _list(String key) =>
      (_options[key] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  String _date(dynamic raw) {
    final d = DateTime.tryParse('$raw')?.toLocal();
    if (d == null) return '-';
    return '${d.day}.${d.month}.${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    final slot = _list(
      'slots',
    ).where((x) => '${x['startsAtUtc']}' == _slotKey).firstOrNull;
    if (slot == null) return;
    setState(() => _saving = true);
    try {
      await DrivingSchoolApiService.instance.createAppointmentRequest({
        'requestType': widget.sourceAppointment == null
            ? 'NewAppointment'
            : 'Reschedule',
        'sourceAppointmentId': widget.sourceAppointment?['id'],
        'startsAtUtc': slot['startsAtUtc'],
        'endsAtUtc': slot['endsAtUtc'],
        'preferredInstructorProfileId': _instructorId,
        'preferredVehicleId': _vehicleId,
        'meetingPoint': _meeting.text.trim(),
        'note': _note.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Randevu talebiniz kuruma iletildi.'.tr)),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(
      title: Text(
        widget.sourceAppointment == null
            ? 'Randevu Talebi'
            : 'Yeniden Planlama Talebi',
      ),
    ),
    child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton(onPressed: _load, child: Text(_error!)),
          )
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Uygun saat seçin',
                          style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<int>(
                          initialValue: _duration,
                          decoration: const InputDecoration(
                            labelText: 'Ders süresi',
                          ),
                          items: const [60, 90, 120]
                              .map(
                                (x) => DropdownMenuItem(
                                  value: x,
                                  child: Text('$x dakika'),
                                ),
                              )
                              .toList(),
                          onChanged: (v) {
                            if (v != null) {
                              _duration = v;
                              _slotKey = null;
                              _load();
                            }
                          },
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: _slotKey,
                          decoration: const InputDecoration(
                            labelText: 'Uygun saat',
                          ),
                          isExpanded: true,
                          items: _list('slots')
                              .map(
                                (x) => DropdownMenuItem(
                                  value: '${x['startsAtUtc']}',
                                  child: Text(_date(x['startsAtUtc'])),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _slotKey = v),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: _instructorId,
                          decoration: const InputDecoration(
                            labelText: 'Öğretmen tercihi (isteğe bağlı)',
                          ),
                          items: [
                            DropdownMenuItem<String>(
                              value: null,
                              child: Text('Kurum seçsin'.tr),
                            ),
                            ..._list('instructors').map(
                              (x) => DropdownMenuItem(
                                value: '${x['id']}',
                                child: Text(
                                  '${x['fullName']}${x['preferred'] == true ? ' • Tercihim' : ''}',
                                ),
                              ),
                            ),
                          ],
                          onChanged: (v) => setState(() => _instructorId = v),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: _vehicleId,
                          decoration: const InputDecoration(
                            labelText: 'Araç tercihi (isteğe bağlı)',
                          ),
                          items: [
                            DropdownMenuItem<String>(
                              value: null,
                              child: Text('Kurum seçsin'.tr),
                            ),
                            ..._list('vehicles').map(
                              (x) => DropdownMenuItem(
                                value: '${x['id']}',
                                child: Text(
                                  '${x['plateNumber']} • ${x['brand']} ${x['model']}',
                                ),
                              ),
                            ),
                          ],
                          onChanged: (v) => setState(() => _vehicleId = v),
                        ),
                        TextField(
                          controller: _meeting,
                          decoration: const InputDecoration(
                            labelText: 'Buluşma noktası',
                          ),
                        ),
                        TextField(
                          controller: _note,
                          maxLength: 500,
                          decoration: const InputDecoration(
                            labelText: 'Talep notu',
                          ),
                        ),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _saving || _slotKey == null
                                ? null
                                : _submit,
                            icon: const Icon(Icons.send_rounded),
                            label: Text(
                              _saving ? 'Gönderiliyor…' : 'Talebi Gönder',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Taleplerim',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                ),
                ..._requests.map(
                  (x) => Card(
                    child: ListTile(
                      leading: Icon(
                        x['status'] == 'Approved'
                            ? Icons.check_circle
                            : x['status'] == 'Rejected'
                            ? Icons.cancel
                            : Icons.hourglass_top,
                        color: x['status'] == 'Approved'
                            ? Colors.green
                            : x['status'] == 'Rejected'
                            ? Colors.red
                            : Colors.orange,
                      ),
                      title: Text(
                        '${x['requestType'] == 'Reschedule' ? 'Yeniden planlama' : 'Yeni randevu'} • ${_date(x['requestedStartsAtUtc'])}',
                      ),
                      subtitle: Text(
                        '${x['status']}${('${x['decisionNote'] ?? ''}').isEmpty ? '' : '\n${x['decisionNote']}'}',
                      ),
                      trailing: x['status'] == 'Pending'
                          ? IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () async {
                                await DrivingSchoolApiService.instance
                                    .cancelAppointmentRequest('${x['id']}');
                                _load();
                              },
                            )
                          : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
  );
}
