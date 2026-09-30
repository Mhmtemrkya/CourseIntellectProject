import 'study_plan_api_service.dart';

class StudentXpReward {
  final int amount;
  final String summary;
  final List<String> bonuses;

  const StudentXpReward({
    required this.amount,
    required this.summary,
    this.bonuses = const [],
  });
}

class StudentXpService {
  static Future<int> getXp() async {
    final state = await StudyPlanApiService.instance.fetch();
    return state.xpPoints;
  }

  static Future<(int xp, int streak)> getProgress() async {
    final state = await StudyPlanApiService.instance.fetch();
    return (state.xpPoints, state.streakCount);
  }

  static StudentXpReward buildHomeworkReward({
    required int fileCount,
    required bool hasNote,
  }) {
    var amount = 25;
    final bonuses = <String>[];

    if (fileCount > 1) {
      final extra = ((fileCount - 1) * 5).clamp(0, 15);
      amount += extra;
      bonuses.add('Ek dosya bonusu +$extra XP');
    }

    if (hasNote) {
      amount += 5;
      bonuses.add('Açıklama notu bonusu +5 XP');
    }

    return StudentXpReward(
      amount: amount,
      summary: 'Ödev teslim edildi',
      bonuses: bonuses,
    );
  }
}
