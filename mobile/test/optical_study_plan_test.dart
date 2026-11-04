import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student/pages/optical_study_plan_page.dart';

class _FakeApi extends OpticalStudyPlanApi {
  final applied = <List<Map<String, Object?>>>[];

  @override
  Future<Map<String, dynamic>> preview(String examId) async => {
        'examId': examId,
        'hasTopics': true,
        'studyPlanEnabled': true,
        'message': null,
        'students': [
          {
            'studentUserId': 's1', 'studentName': 'Ayşe DOĞAN', 'className': '8-A', 'net': 3.67, 'hasParent': true,
            'skipReason': null, 'alreadyApplied': false, 'parentSummary': 'Ayşe özet',
            'weakTopics': [{'subject': 'Matematik', 'topic': 'Üslü İfadeler', 'correct': 0, 'wrong': 2, 'blank': 1, 'total': 3}],
            'tasks': [
              {'title': 'Üslü İfadeler konu tekrarı', 'subject': 'Matematik', 'topic': 'Üslü İfadeler', 'date': '2026-11-03', 'durationMinutes': 30},
              {'title': 'Üslü İfadeler: 25 soru çöz', 'subject': 'Matematik', 'topic': 'Üslü İfadeler', 'date': '2026-11-04', 'durationMinutes': 40},
            ],
          },
          {
            'studentUserId': 's2', 'studentName': 'Ali KAYA', 'className': '8-A', 'net': 2, 'hasParent': false,
            'skipReason': 'Kurumda aynı adlı başka öğrenci var; çalışma programı adla tutulduğu için plan yazılamaz.',
            'alreadyApplied': false, 'parentSummary': '',
            'weakTopics': [{'subject': 'Matematik', 'topic': 'Olasılık', 'correct': 0, 'wrong': 1, 'blank': 0, 'total': 1}],
            'tasks': [{'title': 'Olasılık konu tekrarı', 'subject': 'Matematik', 'topic': 'Olasılık', 'date': '2026-11-03', 'durationMinutes': 30}],
          },
        ],
      };

  @override
  Future<Map<String, dynamic>> apply(String examId, List<Map<String, Object?>> students) async {
    applied.add(students);
    return {'applied': students.length, 'tasksWritten': 1, 'parentsNotified': 1, 'skipped': <String>[]};
  }
}

void main() {
  testWidgets('öneri listelenir; aynı adlı öğrenci seçilemez; görev kaldırılıp onayla gönderilir', (tester) async {
    tester.view.physicalSize = const Size(900, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _FakeApi();
    await tester.pumpWidget(MaterialApp(home: Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OpticalStudyPlanPage(examId: 'e1', examTitle: '2. LGS', api: api))),
          child: const Text('aç'),
        ),
      ),
    )));
    await tester.tap(find.text('aç'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Üslü İfadeler (2 Y, 1 B / 3)'), findsOneWidget);
    expect(find.textContaining('Kurumda aynı adlı'), findsWidgets);
    expect(find.text('1 öğrenciye planı ekle'), findsOneWidget);
    final blocked = tester.widget<CheckboxListTile>(find.descendant(of: find.byKey(const ValueKey('study-plan-s2')), matching: find.byType(CheckboxListTile)));
    expect(blocked.onChanged, isNull);

    await tester.tap(find.descendant(of: find.byKey(const ValueKey('plan-task-s1-1')), matching: find.byIcon(Icons.delete_outline_rounded)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('study-plan-apply')));
    await tester.pumpAndSettle();

    final sent = api.applied.single.single;
    expect(sent['studentUserId'], 's1');
    expect((sent['tasks'] as List).length, 1);
    expect(sent['sendParentSummary'], true);
    expect(sent['parentSummary'], 'Ayşe özet');
    expect(find.text('aç'), findsOneWidget);
  });
}
