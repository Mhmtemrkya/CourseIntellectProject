import 'attendance_service.dart';
import 'accounting_finance_store.dart';

class SmartInsightService {
  SmartInsightService._();

  static final SmartInsightService instance = SmartInsightService._();

  List<Map<String, dynamic>> parentRiskAlerts(String studentName) {
    final attendance = AttendanceService.instance.forStudent(studentName);
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;
    final late = attendance.where((item) => item.status == 'Gec').length;
    final overdue = AccountingFinanceStore.instance.installments
        .where((item) => item.status == 'Geciken')
        .length;

    return [
      {
        'title': 'Akademik takip gerekli',
        'detail': absent > 0
            ? 'Son dönemde $absent devamsızlık kaydı, ders devamını etkileyebilir.'
            : 'Devamsızlık dusuk, ancak ders ritminin korunmasi önerilir.',
      },
      {
        'title': 'Disiplin ve zaman yönetimi',
        'detail': late > 0
            ? '$late kez geç kalma görüldü. Sabah rutininin düzenlenmesi faydalı olur.'
            : 'Gec kalma kaydı dusuk seviyede, mevcut rutin korunabilir.',
      },
      {
        'title': 'Finans uyarı seviyesi',
        'detail': overdue > 0
            ? '$overdue gecikmiş plan bulundu. Finans akışının aksatilmamasi önerilir.'
            : 'Finans tarafında kritik gecikme görünmüyor.',
      },
    ];
  }

  List<Map<String, dynamic>> teacherSuggestions() {
    final overdue = AccountingFinanceStore.instance.installments
        .where((item) => item.status == 'Geciken')
        .length;
    final attendance = AttendanceService.instance.all();
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;

    return [
      {
        'title': 'Devamsızlık odakli etut planı',
        'subtitle':
            '$absent devamsızlık kaydı sistem tarafından izlendi. Desteğe ihtiyacı olan öğrenciler için plan açılabilir.',
        'action': 'Plani Ac',
      },
      {
        'title': 'Veli bilgilendirme taslağı',
        'subtitle':
            'Riskli öğrenciler için tek tıkla veli mesaj taslağı açılabilir.',
        'action': 'Taslağı Göster',
      },
      {
        'title': 'Finans ve akademik uyarı eşleştirmesi',
        'subtitle': overdue > 0
            ? '$overdue finans gecikmesi bulundu. Veli iletişimi akademik uyarıyla birlikte ilerletilebilir.'
            : 'Finans tarafında kritik eşleşme yok, sadece akademik takip öneriliyor.',
        'action': 'Sınavlara Git',
      },
    ];
  }
}
