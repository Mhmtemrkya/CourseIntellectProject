import 'package:flutter/material.dart';
import '../services/cafeteria_api_service.dart';
import '../services/cafeteria_pdf_service.dart';

class CafeteriaWeeklyMenuPage extends StatefulWidget {
  final bool canEdit;

  const CafeteriaWeeklyMenuPage({super.key, required this.canEdit});

  @override
  State<CafeteriaWeeklyMenuPage> createState() =>
      _CafeteriaWeeklyMenuPageState();
}

class _CafeteriaWeeklyMenuPageState extends State<CafeteriaWeeklyMenuPage> {
  final _api = CafeteriaApiService.instance;
  final _days = const [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];
  final _months = const [
    '',
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ];
  late DateTime _weekStart;
  int _selectedDay = 0;
  CafeteriaWeek? _week;
  bool _loading = true;
  bool _saving = false;
  bool _exporting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _weekStart = _monday(DateTime.now());
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.getWeek(_weekStart);
      if (!mounted) return;
      setState(() => _week = result);
    } on CafeteriaApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeWeek(int dayDelta) async {
    setState(() {
      _weekStart = _weekStart.add(Duration(days: dayDelta));
      _selectedDay = 0;
    });
    await _load();
  }

  Future<void> _save() async {
    final current = _week;
    if (current == null) return;
    setState(() => _saving = true);
    try {
      final result = await _api.saveWeek(current);
      if (!mounted) return;
      setState(() => _week = result);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Haftalık yemek programı kaydedildi.')),
      );
    } on CafeteriaApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _exportPdf() async {
    final current = _week;
    if (current == null) return;
    setState(() => _exporting = true);
    try {
      await CafeteriaPdfService.generateAndShare(current);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('PDF oluşturulamadı.')));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _replaceMeal(CafeteriaMealEntry updated) {
    final current = _week;
    if (current == null) return;
    setState(() {
      _week = current.copyWith(
        meals: current.meals.map((meal) {
          if (meal.date == updated.date && meal.mealType == updated.mealType) {
            return updated;
          }
          return meal;
        }).toList(),
      );
    });
  }

  CafeteriaMealEntry? _meal(String mealType) {
    final current = _week;
    if (current == null) return null;
    final date = _weekStart.add(Duration(days: _selectedDay));
    for (final meal in current.meals) {
      if (_sameDay(meal.date, date) && meal.mealType == mealType) return meal;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? const Color(0xFF0B1423) : Colors.white;
    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF060D18)
          : const Color(0xFFF6F8FC),
      appBar: AppBar(
        title: Text(widget.canEdit ? 'Yemek Programı Düzenle' : 'Yemekhane'),
        actions: [
          IconButton(
            tooltip: 'PDF paylaş',
            onPressed: _exporting || _week == null ? null : _exportPdf,
            icon: _exporting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
          ),
          if (widget.canEdit)
            IconButton(
              tooltip: 'Kaydet',
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _errorState()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _heroCard(surface),
                  const SizedBox(height: 16),
                  _daySelector(),
                  const SizedBox(height: 16),
                  _mealCard(
                    meal: _meal('Breakfast'),
                    title: 'Kahvaltı',
                    icon: Icons.wb_sunny_outlined,
                    color: const Color(0xFFF59E0B),
                  ),
                  const SizedBox(height: 12),
                  _mealCard(
                    meal: _meal('Lunch'),
                    title: 'Öğle Yemeği',
                    icon: Icons.soup_kitchen_outlined,
                    color: const Color(0xFF10B981),
                  ),
                  const SizedBox(height: 16),
                  _summaryCard(surface),
                ],
              ),
            ),
    );
  }

  Widget _heroCard(Color surface) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF111C31), Color(0xFF172538)],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.canEdit ? 'YEMEKHANECİ PANELİ' : 'HAFTALIK MENÜ',
            style: const TextStyle(
              color: Color(0xFFF59E0B),
              letterSpacing: 1.6,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Haftalık Yemek Programı',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${_formatDate(_weekStart)} - ${_formatDate(_weekStart.add(const Duration(days: 6)), withYear: true)}',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.68)),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _weekButton(Icons.chevron_left_rounded, () => _changeWeek(-7)),
              const SizedBox(width: 8),
              _weekButton(Icons.chevron_right_rounded, () => _changeWeek(7)),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _exporting ? null : _exportPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                label: const Text('PDF'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
              ),
              const SizedBox(width: 8),
              if (widget.canEdit)
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: const Text('Kaydet'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF97316),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _weekButton(IconData icon, VoidCallback onTap) {
    return IconButton.filledTonal(
      onPressed: onTap,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: Colors.white.withValues(alpha: 0.08),
      ),
    );
  }

  Widget _daySelector() {
    return SizedBox(
      height: 68,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _days.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final selected = index == _selectedDay;
          final date = _weekStart.add(Duration(days: index));
          return InkWell(
            onTap: () => setState(() => _selectedDay = index),
            borderRadius: BorderRadius.circular(16),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
              decoration: BoxDecoration(
                color: selected
                    ? const Color(0xFFF97316)
                    : Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: selected
                      ? Colors.transparent
                      : Theme.of(context).dividerColor.withValues(alpha: 0.16),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    _days[index].substring(0, 3),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : null,
                    ),
                  ),
                  Text(
                    '${date.day} ${_months[date.month].substring(0, 3)}',
                    style: TextStyle(
                      fontSize: 11,
                      color: selected
                          ? Colors.white70
                          : Theme.of(context).hintColor,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _mealCard({
    required CafeteriaMealEntry? meal,
    required String title,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    '${meal?.startTime ?? '--:--'} - ${meal?.endTime ?? '--:--'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const Spacer(),
              if (widget.canEdit && meal != null)
                IconButton(
                  tooltip: 'Düzenle',
                  onPressed: () => _editMeal(meal, title),
                  icon: const Icon(Icons.edit_outlined),
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (meal == null || meal.items.isEmpty)
            Text(
              widget.canEdit
                  ? 'Menü girmek için düzenleyin.'
                  : 'Menü girilmedi.',
              style: Theme.of(context).textTheme.bodyMedium,
            )
          else
            ...meal.items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  children: [
                    Icon(Icons.circle, color: color, size: 6),
                    const SizedBox(width: 10),
                    Expanded(child: Text(item)),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _pill('${meal?.calories ?? 0} kcal', color),
              _pill(
                'Protein ${meal?.proteinGrams.toStringAsFixed(0) ?? '0'} g',
                color,
              ),
              _pill(
                'Karb. ${meal?.carbohydrateGrams.toStringAsFixed(0) ?? '0'} g',
                color,
              ),
            ],
          ),
          if (meal != null && meal.allergens.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Alerjen: ${meal.allergens.join(', ')}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(40),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _summaryCard(Color surface) {
    final all = _week?.meals ?? const <CafeteriaMealEntry>[];
    final dailyCalories =
        all.fold<int>(0, (sum, meal) => sum + meal.calories) ~/ 7;
    final protein =
        all.fold<double>(0, (sum, meal) => sum + meal.proteinGrams) / 7;
    final carbohydrates =
        all.fold<double>(0, (sum, meal) => sum + meal.carbohydrateGrams) / 7;
    final fiber = all.fold<double>(0, (sum, meal) => sum + meal.fiberGrams) / 7;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: 0.16),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Haftalık Besin Değerleri Ortalaması',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _summaryMetric(
                'Kalori',
                '$dailyCalories kcal',
                Icons.local_fire_department,
                const Color(0xFFF97316),
              ),
              _summaryMetric(
                'Protein',
                '${protein.toStringAsFixed(0)} g',
                Icons.restaurant,
                const Color(0xFF8B5CF6),
              ),
              _summaryMetric(
                'Karbonhidrat',
                '${carbohydrates.toStringAsFixed(0)} g',
                Icons.breakfast_dining,
                const Color(0xFF3B82F6),
              ),
              _summaryMetric(
                'Lif',
                '${fiber.toStringAsFixed(0)} g',
                Icons.eco_outlined,
                const Color(0xFF10B981),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryMetric(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelSmall),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _editMeal(CafeteriaMealEntry meal, String title) async {
    final itemsController = TextEditingController(text: meal.items.join('\n'));
    final calories = TextEditingController(text: meal.calories.toString());
    final protein = TextEditingController(
      text: meal.proteinGrams.toStringAsFixed(0),
    );
    final carbohydrate = TextEditingController(
      text: meal.carbohydrateGrams.toStringAsFixed(0),
    );
    final fat = TextEditingController(text: meal.fatGrams.toStringAsFixed(0));
    final fiber = TextEditingController(
      text: meal.fiberGrams.toStringAsFixed(0),
    );
    final allergens = TextEditingController(text: meal.allergens.join(', '));
    final description = TextEditingController(text: meal.description);
    final updated = await showModalBottomSheet<CafeteriaMealEntry>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$title Menüsünü Düzenle',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: itemsController,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: 'Yemekler (satır satır)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _numberInput(calories, 'Kalori')),
                  const SizedBox(width: 8),
                  Expanded(child: _numberInput(protein, 'Protein')),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _numberInput(carbohydrate, 'Karbonhidrat')),
                  const SizedBox(width: 8),
                  Expanded(child: _numberInput(fat, 'Yağ')),
                  const SizedBox(width: 8),
                  Expanded(child: _numberInput(fiber, 'Lif')),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: allergens,
                decoration: const InputDecoration(
                  labelText: 'Alerjenler (virgülle ayırın)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: description,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Açıklama',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    meal.copyWith(
                      items: itemsController.text
                          .split('\n')
                          .map((item) => item.trim())
                          .where((item) => item.isNotEmpty)
                          .toList(),
                      calories: int.tryParse(calories.text) ?? 0,
                      proteinGrams: double.tryParse(protein.text) ?? 0,
                      carbohydrateGrams:
                          double.tryParse(carbohydrate.text) ?? 0,
                      fatGrams: double.tryParse(fat.text) ?? 0,
                      fiberGrams: double.tryParse(fiber.text) ?? 0,
                      allergens: allergens.text
                          .split(',')
                          .map((item) => item.trim())
                          .where((item) => item.isNotEmpty)
                          .toList(),
                      description: description.text.trim(),
                    ),
                  ),
                  child: const Text('Öğünü Uygula'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    itemsController.dispose();
    calories.dispose();
    protein.dispose();
    carbohydrate.dispose();
    fat.dispose();
    fiber.dispose();
    allergens.dispose();
    description.dispose();
    if (updated != null) _replaceMeal(updated);
  }

  Widget _numberInput(TextEditingController controller, String label) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    );
  }

  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 38),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
          ],
        ),
      ),
    );
  }

  static DateTime _monday(DateTime value) {
    final date = DateTime(value.year, value.month, value.day);
    return date.subtract(Duration(days: date.weekday - 1));
  }

  static bool _sameDay(DateTime first, DateTime second) =>
      first.year == second.year &&
      first.month == second.month &&
      first.day == second.day;

  String _formatDate(DateTime date, {bool withYear = false}) =>
      '${date.day} ${_months[date.month]}${withYear ? ' ${date.year}' : ''}';
}
