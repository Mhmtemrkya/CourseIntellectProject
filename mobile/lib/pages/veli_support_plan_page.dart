import 'package:flutter/material.dart';

import '../widgets/app_header.dart';

class VeliSupportPlanPage extends StatelessWidget {
  final String title;
  final String detail;

  const VeliSupportPlanPage({
    super.key,
    required this.title,
    required this.detail,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Destek Planı'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _heroCard(context),
            const SizedBox(height: 16),
            _priorityCard(context),
            const SizedBox(height: 16),
            _timelineCard(context),
            const SizedBox(height: 16),
            _homeSupportCard(context),
            const SizedBox(height: 16),
            _actionCard(context),
          ],
        ),
      ),
    );
  }

  Widget _heroCard(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Veli destek akışı',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            detail,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: const [
              Expanded(child: _HeroMetric(label: 'Süre', value: '7 gün')),
              SizedBox(width: 10),
              Expanded(child: _HeroMetric(label: 'Öncelik', value: 'Yüksek')),
              SizedBox(width: 10),
              Expanded(child: _HeroMetric(label: 'Takip', value: 'Aile + öğretmen')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _priorityCard(BuildContext context) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bu plan neden önerildi?',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 12),
          const _InfoRow(
            icon: Icons.analytics_outlined,
            color: Color(0xFF2563EB),
            text: 'Son değerlendirmelerde bu alanda düzenli ama kısa destek daha verimli sonuç üretiyor.',
          ),
          const SizedBox(height: 10),
          const _InfoRow(
            icon: Icons.family_restroom_outlined,
            color: Color(0xFF0F766E),
            text: 'Aile tarafındaki küçük yönlendirmeler öğrencinin planı sürdürmesini kolaylaştırıyor.',
          ),
          const SizedBox(height: 10),
          const _InfoRow(
            icon: Icons.flag_outlined,
            color: Color(0xFFB54708),
            text: 'Bu plan, performans düşüşünü büyümeden dengelemek için erken müdahale olarak hazırlandı.',
          ),
        ],
      ),
    );
  }

  Widget _timelineCard(BuildContext context) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '7 günlük uygulama akışı',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 14),
          const _TimelineTile(
            day: '1. Gün',
            title: 'Kısa başlangıç konuşması',
            detail: 'Öğrenciyle 5 dakikalık sakin hedef konuşması yapın, baskı dili kullanmayın.',
          ),
          const SizedBox(height: 12),
          const _TimelineTile(
            day: '3. Gün',
            title: 'Akşam mini tekrar rutini',
            detail: '20 dakikalık kısa çalışma sonrasında sadece tamamlandı takibi yapın.',
          ),
          const SizedBox(height: 12),
          const _TimelineTile(
            day: '5. Gün',
            title: 'Öğretmenden kısa geri bildirim isteyin',
            detail: 'Gerekirse mesajlar bölümünden hızlı not talep edin.',
          ),
          const SizedBox(height: 12),
          const _TimelineTile(
            day: '7. Gün',
            title: 'Sonuç değerlendirmesi',
            detail: 'Plana uyum ve öğrencinin motivasyonu birlikte gözden geçirilsin.',
          ),
        ],
      ),
    );
  }

  Widget _homeSupportCard(BuildContext context) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Evde uygulanacak destek dili',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF3),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Text(
              'Bugün sadece kısa bir bölüm yapman yeterli. Bitince birlikte kontrol ederiz.',
              style: TextStyle(
                color: Color(0xFF065F46),
                fontWeight: FontWeight.w700,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Text(
              'Kaç soru çözdün, neden eksik kaldın? yerine kısa hedefi tamamlayıp tamamlamadığını sorun.',
              style: TextStyle(
                color: Color(0xFF9A3412),
                fontWeight: FontWeight.w700,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionCard(BuildContext context) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Planı başlat',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 12),
          Text(
            'Plan başlatıldığında veli takvimine eklenir ve öğretmen tarafına bilgilendirme notu düşer.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Destek planı takvime eklendi.'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.calendar_month_rounded),
                  label: const Text('Takvime Ekle'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Öğretmene plan bilgilendirmesi gönderildi.'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.send_outlined),
                  label: const Text('Öğretmene Bildir'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _surface(BuildContext context, {required Widget child}) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: theme.brightness == Brightness.dark ? 0.22 : 0.06),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _HeroMetric extends StatelessWidget {
  final String label;
  final String value;

  const _HeroMetric({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;

  const _InfoRow({
    required this.icon,
    required this.color,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
        ),
      ],
    );
  }
}

class _TimelineTile extends StatelessWidget {
  final String day;
  final String title;
  final String detail;

  const _TimelineTile({
    required this.day,
    required this.title,
    required this.detail,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 84,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFDBEAFE),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            day,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF1D4ED8),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                detail,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.45),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
