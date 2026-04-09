import 'auth_session_store.dart';
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

  static Future<int> addXp(int amount) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      return amount;
    }
    final state = await StudyPlanApiService.instance.fetch();
    final updated = state.xpPoints + amount;
    await StudyPlanApiService.instance.save(
      studentName: session.fullName,
      planItems: state.planItems,
      streakCount: state.streakCount,
      xpPoints: updated,
      lastCompletedAt: state.lastCompletedAt,
    );
    return updated;
  }

  static Future<(int xp, int streak)> getProgress() async {
    final state = await StudyPlanApiService.instance.fetch();
    return (state.xpPoints, state.streakCount);
  }

  static StudentXpReward buildTopicTestReward({
    required int correctCount,
    required int totalQuestions,
  }) {
    var amount = 10 + (correctCount * 8);
    final bonuses = <String>[];

    if (correctCount == totalQuestions) {
      amount += 20;
      bonuses.add('Tum sorular dogru bonusu +20 XP');
    } else if (correctCount >= totalQuestions - 1) {
      amount += 10;
      bonuses.add('Yuksek isabet bonusu +10 XP');
    }

    return StudentXpReward(
      amount: amount,
      summary: 'Konu testi tamamlandi',
      bonuses: bonuses,
    );
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
      bonuses.add('Aciklama notu bonusu +5 XP');
    }

    return StudentXpReward(
      amount: amount,
      summary: 'Odev teslim edildi',
      bonuses: bonuses,
    );
  }

  static StudentXpReward buildExamReward({
    required int correctCount,
    required int totalQuestions,
    required int remainingSeconds,
  }) {
    var amount = 20 + (correctCount * 10);
    final bonuses = <String>[];

    if (correctCount == totalQuestions) {
      amount += 30;
      bonuses.add('Tam dogru bonusu +30 XP');
    }

    if (remainingSeconds > 15 * 60) {
      amount += 10;
      bonuses.add('Sure bonusu +10 XP');
    }

    return StudentXpReward(
      amount: amount,
      summary: 'Sinav tamamlandi',
      bonuses: bonuses,
    );
  }

  static StudentXpReward buildQuestionBankSolveReward({
    required bool isCorrect,
    required bool hasImage,
    required bool hasSolutionAsset,
  }) {
    var amount = isCorrect ? 18 : 6;
    final bonuses = <String>[];

    if (isCorrect) {
      bonuses.add('Dogru cevap bonusu +18 XP');
    } else {
      bonuses.add('Deneme katilimi +6 XP');
    }

    if (hasImage) {
      amount += 4;
      bonuses.add('Resimli soru bonusu +4 XP');
    }

    if (hasSolutionAsset) {
      amount += 3;
      bonuses.add('Cozum eki bonusu +3 XP');
    }

    return StudentXpReward(
      amount: amount,
      summary: 'Soru bankasi sorusu cozuldu',
      bonuses: bonuses,
    );
  }
}
