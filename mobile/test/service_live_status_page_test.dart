import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';
import 'package:student/pages/service_live_status_page.dart';

import '../tool/service_tracking_test_fixture.dart';

void main() {
  late ServiceTrackingTestApi api;
  late ServiceTrackingTestRealtime realtime;
  setUp(() {
    api = ServiceTrackingTestApi();
    realtime = ServiceTrackingTestRealtime();
  });

  Future<void> open(WidgetTester tester, {bool parentMode = true}) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await http.runWithClient(
      () async {
        await tester.pumpWidget(
          MaterialApp(
            home: ServiceLiveStatusPage(
              parentMode: parentMode,
              api: api,
              realtime: realtime,
            ),
          ),
        );
        await tester.pumpAndSettle();
      },
      () => MockClient(
        (_) async => http.Response.bytes(
          base64Decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          ),
          200,
          headers: {'content-type': 'image/png'},
        ),
      ),
    );
  }

  Future<void> close(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  }

  testWidgets('parent sees actual map with stop, bus, distance and ETA', (
    tester,
  ) async {
    await open(tester);
    expect(find.byType(FlutterMap), findsOneWidget);
    final markers = tester
        .widget<MarkerLayer>(find.byType(MarkerLayer))
        .markers;
    expect(
      markers.map((m) => m.point),
      containsAll([const LatLng(41.01, 28.98), const LatLng(41.02, 28.99)]),
    );
    expect(find.text('3 dk'), findsOneWidget);
    expect(find.text('1.4 km'), findsOneWidget);
    expect(realtime.tripIds, ['test-trip']);
    expect(realtime.vehicleIds, ['test-vehicle']);
    expect(tester.takeException(), isNull);
    await close(tester);
  });

  testWidgets(
    'location event moves bus and refreshes distance without reload',
    (tester) async {
      await open(tester);
      realtime.move();
      await tester.pumpAndSettle();
      final markers = tester
          .widget<MarkerLayer>(find.byType(MarkerLayer))
          .markers;
      expect(markers.last.point, const LatLng(41.015, 28.985));
      expect(api.parentReads, 1);
      expect(find.text('2 dk'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await close(tester);
    },
  );

  testWidgets('first incoming location stays visible in map camera', (
    tester,
  ) async {
    api = ServiceTrackingTestApi(hasLocation: false);
    await open(tester);
    expect(
      tester.widget<MarkerLayer>(find.byType(MarkerLayer)).markers,
      hasLength(1),
    );
    expect(find.text('Servis konumu henüz gelmedi.'), findsOneWidget);
    realtime.move(latitude: 41.10, longitude: 29.10);
    await tester.pumpAndSettle();
    final camera = MapCamera.of(tester.element(find.byType(MarkerLayer)));
    expect(camera.visibleBounds.contains(const LatLng(41.10, 29.10)), isTrue);
    expect(camera.visibleBounds.contains(const LatLng(41.01, 28.98)), isTrue);
    expect(tester.takeException(), isNull);
    await close(tester);
  });

  testWidgets('unrelated trip and vehicle event is ignored', (tester) async {
    await open(tester);
    realtime.move(
      tripId: 'other-trip',
      vehicleId: 'other-vehicle',
      latitude: 42,
    );
    await tester.pumpAndSettle();
    expect(
      tester.widget<MarkerLayer>(find.byType(MarkerLayer)).markers.last.point,
      const LatLng(41.02, 28.99),
    );
    await close(tester);
  });

  testWidgets('student uses student endpoint and sees live map', (
    tester,
  ) async {
    await open(tester, parentMode: false);
    expect(api.studentReads, 1);
    expect(api.parentReads, 0);
    expect(find.byType(FlutterMap), findsOneWidget);
    expect(find.text('Servis Kullanmayacak Talebi'), findsNothing);
    await close(tester);
  });

  testWidgets('no assignment shows clear empty state without map', (
    tester,
  ) async {
    api.statuses = [];
    await open(tester);
    expect(find.text('Servis ataması bulunamadı'), findsOneWidget);
    expect(find.byType(FlutterMap), findsNothing);
    await close(tester);
  });

  testWidgets('attendance event and 20 second fallback refresh status', (
    tester,
  ) async {
    await open(tester);
    api.statuses = [
      api.statuses.single.copyWith(attendanceStatus: 'ArrivedSchool'),
    ];
    realtime.onDataChanged!();
    await tester.pumpAndSettle();
    expect(find.text('Okula ulaştı'), findsOneWidget);
    expect(api.parentReads, 2);
    await tester.pump(const Duration(seconds: 20));
    await tester.pumpAndSettle();
    expect(api.parentReads, 3);
    await close(tester);
  });
}
