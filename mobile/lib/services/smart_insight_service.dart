import 'attendance_service.dart';
import 'accounting_finance_store.dart';

class SmartInsightService {
  SmartInsightService._();

  static final SmartInsightService instance = SmartInsightService._();

  List<Map<String, dynamic>> parentRiskAlerts(String studentName) {
    final attendance = AttendanceService.instance.forStudent(studentName);
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;
    final late = attendance.where((item) => item.status == 'Gec').length;
    final overdue = AccountingFinanceStore.instance.installments.where((item) => item.status == 'Geciken').length;

    return [
      {
        'title': 'Akademik takip gerekli',
        'detail': absent > 0
            ? 'Son donemde $absent devamsizlik kaydi, ders devamini etkileyebilir.'
            : 'Devamsizlik dusuk, ancak ders ritminin korunmasi onerilir.',
      },
      {
        'title': 'Disiplin ve zaman yonetimi',
        'detail': late > 0
            ? '$late kez gec kalma goruldu. Sabah rutininin duzenlenmesi faydali olur.'
            : 'Gec kalma kaydi dusuk seviyede, mevcut rutin korunabilir.',
      },
      {
        'title': 'Finans uyari seviyesi',
        'detail': overdue > 0
            ? '$overdue gecikmis plan bulundu. Finans akisinin aksatilmamasi onerilir.'
            : 'Finans tarafinda kritik gecikme gorunmuyor.',
      },
    ];
  }

  List<Map<String, dynamic>> teacherSuggestions() {
    final overdue = AccountingFinanceStore.instance.installments.where((item) => item.status == 'Geciken').length;
    final attendance = AttendanceService.instance.all();
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;

    return [
      {
        'title': 'Devamsizlik odakli etut plani',
        'subtitle': '$absent kritik devam kaydi sistem tarafindan izlendi. Destege ihtiyaci olan ogrenciler icin plan acilabilir.',
        'action': 'Plani Ac',
      },
      {
        'title': 'Veli bilgilendirme taslagi',
        'subtitle': 'Riskli ogrenciler icin tek tikla veli mesaj taslagi acilabilir.',
        'action': 'Taslagi Goster',
      },
      {
        'title': 'Finans ve akademik uyari eslestirmesi',
        'subtitle': overdue > 0
            ? '$overdue finans gecikmesi bulundu. Veli iletisimi akademik uyariyla birlikte ilerletilebilir.'
            : 'Finans tarafinda kritik eslesme yok, sadece akademik takip oneriliyor.',
        'action': 'Sinavlara Git',
      },
    ];
  }
}
