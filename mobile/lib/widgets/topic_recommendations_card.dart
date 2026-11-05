import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/module_api_client.dart';

/// Masaüstü TopicRecommendations ile aynı katalog (sunucu teşhis kodunu döndürür).
const topicDiagnoses = {
  'misconception': (
    'Yanlışlar ağırlıkta',
    'Kavram yanılgısı olabilir; temel kuralları tekrar edip çözümlü örneklerle hata analizi yapması önerilir.',
    Color(0xFFE11D48),
  ),
  'skipping': (
    'Boş bırakma eğilimi',
    'Kolaydan zora sıralanmış kısa testlerle soruya başlama alışkanlığı kazanması önerilir.',
    Color(0xFFD97706),
  ),
  'declining': ('Son çalışmalarda düşüş', 'Kısa bir konu tekrarı yapıp son yanlışlarını yeniden çözmesi önerilir.', Color(0xFF7C3AED)),
  'improving': (
    'Toparlanıyor',
    'Toparlanma var; aynı tempoda devam edip haftada bir kısa tekrarla kazanımı pekiştirmesi önerilir.',
    Color(0xFF059669),
  ),
  'class_wide': (
    'Ortak zorluk',
    'Birçok öğrencinin zorlandığı bir konu; temel örneklerden başlayıp adım adım zorlaşan alıştırmalarla ilerlemesi önerilir.',
    Color(0xFF0284C7),
  ),
  'stale': (
    'Uzun süredir çalışılmadı',
    'Bu konu uzun süredir çalışılmamış; kısa bir hatırlatma tekrarı ve birkaç soruyla konuyu tazelemesi önerilir.',
    Color(0xFF475569),
  ),
};

/// Önceki önerinin sonucu (masaüstü FOLLOWUP_STATUS ile aynı; öneriye bağlanmaz).
const followupStatuses = {
  'improved': ('İlerleme var', Color(0xFF059669)),
  'steady': ('Belirgin değişim yok', Color(0xFF475569)),
  'declined': ('Düşüş var', Color(0xFFE11D48)),
  'pending': ('Ölçülüyor', Color(0xFF0284C7)),
  'not_practiced': ('Çalışılmadı', Color(0xFFD97706)),
};

/// Öğretmene sınıf önerisi türleri (masaüstü CLASS_ACTIONS ile aynı metinler).
const classActionKinds = {
  'class_review': (
    'Sınıf tekrarı',
    'Sınıfın önemli bir kısmı zorlanıyor; derste kısa bir konu tekrarı ve birlikte çözülen örnekler önerilir.',
    Color(0xFFE11D48),
  ),
  'study_group': (
    'Etüt grubu',
    'Birkaç öğrenci aynı konuda zorlanıyor; küçük bir etüt grubunda birlikte çalışmaları önerilir.',
    Color(0xFFD97706),
  ),
};

int _int(Object? raw) => (raw as num?)?.toInt() ?? 0;

/// Önerinin dayanağı ("neden"): sunucunun döndürdüğü sayılardan kurulur (masaüstü topicReason ile aynı).
String topicReason(Map<String, dynamic> topic) {
  final parts = ['{n} sorudan {m} yanlış'.tr.replaceFirst('{n}', '${_int(topic['solved'])}').replaceFirst('{m}', '${_int(topic['wrong'])}')];
  if (_int(topic['blank']) > 0) parts.add('{n} boş'.tr.replaceFirst('{n}', '${_int(topic['blank'])}'));
  var text = '${parts.join(', ')} • ${'başarı'.tr} ${topicPct(topic['successRate'])}';
  final trend = '${topic['trend'] ?? ''}';
  if ((trend == 'down' || trend == 'up') && topic['previousSuccessRate'] != null && topic['recentSuccessRate'] != null) {
    text += ' • ${topicPct(topic['previousSuccessRate'])} → ${topicPct(topic['recentSuccessRate'])}';
  }
  return text;
}

/// Haftalık somut adım: önerilen soru sayısı birkaç güne bölünür (masaüstü questionPlan ile aynı).
String? questionPlan(Object? raw) {
  final questions = _int(raw);
  if (questions <= 0) return null;
  final perDay = (questions / 4).ceil();
  return 'Bu hafta: {n} soru, 4 güne bölerek günde ~{m}; hafta sonunda kısa bir mini test.'
      .tr
      .replaceFirst('{n}', '$questions')
      .replaceFirst('{m}', '$perDay');
}

/// Zayıf konu kartının alt satırları: öneri, haftalık adım ve "neden".
List<Widget> topicAdviceLines(Map<String, dynamic> topic, String advice, TextStyle hint) {
  final plan = questionPlan(topic['suggestedQuestions']);
  return [
    Text(advice.tr, style: const TextStyle(fontSize: 13)),
    if (plan != null) ...[
      const SizedBox(height: 2),
      Text(plan, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
    ],
    if (_int(topic['solved']) > 0) ...[
      const SizedBox(height: 2),
      Text('${'Neden:'.tr} ${topicReason(topic)}', style: hint),
    ],
  ];
}

/// Öncelik sırası rozeti (1 = önce çalışılacak).
Widget? topicPriorityBadge(BuildContext context, Object? raw) {
  final priority = _int(raw);
  if (priority <= 0) return null;
  return Container(
    margin: const EdgeInsets.only(right: 8),
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(999)),
    child: Text(
      '$priority',
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.onPrimary),
    ),
  );
}

String topicPct(Object? raw) {
  final value = (raw as num?)?.toDouble();
  if (value == null) return '—';
  final text = value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(1).replaceAll('.', ',');
  return '%$text';
}

String _fold(String value) => value
    .replaceAll('İ', 'i')
    .replaceAll('I', 'ı')
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .trim();

/// Rapor sayfalarındaki "konu analizi ve öneriler" kartı. Kaynak role göre seçilir:
/// öğrenci kendi analizini, veli adı verilen çocuğunu, personel verilen öğrenci kimliğini görür.
/// Yalnız sabit teşhis ve öneriler gösterilir (öğretmen notu personele özel). Veri/yetki yoksa gizlenir.
class TopicRecommendationsCard extends StatefulWidget {
  /// Personel görünümü için öğrenci kullanıcı kimliği.
  final String? studentUserId;

  /// Veli görünümünde hangi çocuğun gösterileceği (ad ile).
  final String? studentName;
  final String? title;

  const TopicRecommendationsCard({super.key, this.studentUserId, this.studentName, this.title});

  @override
  State<TopicRecommendationsCard> createState() => _TopicRecommendationsCardState();
}

class _TopicRecommendationsCardState extends State<TopicRecommendationsCard> {
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ModuleApiClient.instance;
      Map<String, dynamic>? data;
      if (widget.studentUserId != null && widget.studentUserId!.isNotEmpty) {
        data = asMap(await client.get('/api/insights/students/${widget.studentUserId}'));
      } else {
        final session = await AuthSessionStore.instance.load();
        final roles = {session?.primaryRole ?? '', ...?session?.extraRoles}.map((role) => role.toLowerCase()).toSet();
        if (roles.contains('student')) {
          data = asMap(await client.get('/api/insights/me'));
        } else if (roles.contains('parent')) {
          final children = asMapList(await client.get('/api/insights/children'));
          final wanted = _fold(widget.studentName ?? '');
          data =
              children.where((item) => _fold('${item['fullName']}') == wanted).firstOrNull ??
              (children.length == 1 ? children.first : null);
        }
      }
      if (mounted && data != null && data.isNotEmpty) setState(() => _data = data);
    } catch (_) {
      // Modül kapalı ya da yetki yok: kart gizli kalır.
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (data == null) return const SizedBox.shrink();
    final hint = TextStyle(color: Theme.of(context).hintColor, fontSize: 12);
    final weak = asMapList(data['weakTopics']);
    final strong = asMapList(data['strongTopics']);
    final solved = ((data['solved'] as num?) ?? 0).toInt();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.insights_rounded, size: 18, color: Color(0xFF0891B2)),
              const SizedBox(width: 6),
              Expanded(
                child: Text((widget.title ?? 'Konu analizi ve öneriler').tr, style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (solved == 0)
            Text(
              'Henüz konu bilgisi taşıyan soru çözülmedi. Online sınav, soru bankası ya da optik deneme sonuçları geldikçe öneriler burada görünür.'
                  .tr,
              style: hint,
            )
          else ...[
            Text('{n} soru • başarı %{n}'.tr.replaceFirst('{n}', '$solved').replaceFirst('%{n}', topicPct(data['successRate'])), style: hint),
            const SizedBox(height: 8),
            if (weak.isEmpty) Text('Belirgin bir zayıf konu yok.'.tr),
            ...weak.take(4).map((topic) {
              final diagnosis = topicDiagnoses['${topic['diagnosis']}'] ?? topicDiagnoses['misconception']!;
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.35)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        ?topicPriorityBadge(context, topic['priority']),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${topic['topic']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text('${topic['subject']} • ${topicPct(topic['successRate'])}', style: hint),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: diagnosis.$3.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: diagnosis.$3.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            diagnosis.$1.tr,
                            style: TextStyle(fontSize: 11, color: diagnosis.$3, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ...topicAdviceLines(topic, diagnosis.$2, hint),
                  ],
                ),
              );
            }),
            if (weak.length > 4) Text('+{n} konu daha'.tr.replaceFirst('{n}', '${weak.length - 4}'), style: hint),
            if (strong.isNotEmpty) ...[
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('Güçlü konular:'.tr, style: hint),
                  ...strong
                      .take(5)
                      .map(
                        (topic) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('${topic['topic']}', style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A))),
                        ),
                      ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}
