import 'package:flutter/material.dart';

import 'package:student/pages/service_live_status_page.dart';
import 'service_tracking_test_fixture.dart';

/// Run with `flutter run -d DEVICE_ID -t tool/service_tracking_smoke.dart`.
/// Real map tiles and production screen; explicitly synthetic trip/events.
void main() => runApp(const MaterialApp(home: _ServiceTrackingSmoke()));

class _ServiceTrackingSmoke extends StatefulWidget {
  const _ServiceTrackingSmoke();

  @override
  State<_ServiceTrackingSmoke> createState() => _ServiceTrackingSmokeState();
}

class _ServiceTrackingSmokeState extends State<_ServiceTrackingSmoke> {
  final api = ServiceTrackingTestApi(hasLocation: false);
  final realtime = ServiceTrackingTestRealtime();
  int position = 0;

  void _move() {
    final latitude = position.isEven ? 41.10 : 41.02;
    final longitude = position.isEven ? 29.10 : 28.99;
    api.statuses = [
      testServiceStatus().copyWith(
        vehicleLatitude: latitude,
        vehicleLongitude: longitude,
        distanceMeters: position.isEven ? 14200 : 1393,
        etaMinutes: position.isEven ? 29 : 3,
        lastLocationAt: DateTime.now().toUtc().toIso8601String(),
      ),
    ];
    realtime.move(latitude: latitude, longitude: longitude);
    setState(() => position++);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        SafeArea(
          bottom: false,
          child: Material(
            color: Colors.amber.shade100,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'SERVİS TESTİ • Simüle konum\nGönderilen konum: $position',
                    ),
                  ),
                  FilledButton(
                    onPressed: _move,
                    child: const Text('Konum gönder'),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: ServiceLiveStatusPage(
            parentMode: true,
            api: api,
            realtime: realtime,
          ),
        ),
      ],
    ),
  );
}
