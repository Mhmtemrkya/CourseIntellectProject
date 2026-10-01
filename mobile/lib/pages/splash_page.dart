import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:student/i18n/app_locale.dart';
import '../services/session_launcher.dart';
import '../services/start_route.dart';
import 'login_page.dart';

/// Lightweight vector artwork and the official logo; no video or remote assets.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});
  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;
  Timer? _timer;
  bool _started = false;
  late final Future<StartRoute> _route;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced) {
      _motion.value = 1;
    } else {
      _motion.forward();
    }
    // Karar animasyonla paralel verilir; oturum yenileme açılışı uzatmasın.
    _route = decideStartRoute().catchError((_) => const StartRoute.login());
    _timer = Timer(Duration(milliseconds: reduced ? 150 : 1200), _proceed);
  }

  Future<void> _proceed() async {
    final route = await _route;
    if (!mounted) return;
    final session = route.session;
    if (session != null) {
      await enterSession(context, session);
      return;
    }
    _openLogin();
  }

  void _openLogin() {
    if (!mounted) return;
    final reduced = MediaQuery.disableAnimationsOf(context);
    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: Duration(milliseconds: reduced ? 0 : 280),
        pageBuilder: (_, animation, secondaryAnimation) => const LoginPage(),
        transitionsBuilder: (_, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.light.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: const Color(0xFF08111F),
    ),
    child: Scaffold(
      backgroundColor: const Color(0xFF08111F),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxHeight < 480;
          final logoSize = compact
              ? 92.0
              : (constraints.maxWidth * .43).clamp(150.0, 210.0);
          return AnimatedBuilder(
            animation: _motion,
            builder: (context, _) {
              final entrance = Curves.easeOutCubic.transform(
                (_motion.value / .65).clamp(0.0, 1.0),
              );
              final caption = Curves.easeOut.transform(
                ((_motion.value - .18) / .5).clamp(0.0, 1.0),
              );
              return Stack(
                fit: StackFit.expand,
                children: [
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment(0, -.2),
                        radius: .85,
                        colors: [
                          Color(0xFF174E72),
                          Color(0xFF0A213B),
                          Color(0xFF061323),
                        ],
                        stops: [0, .4, 1],
                      ),
                    ),
                  ),
                  RepaintBoundary(
                    child: CustomPaint(painter: _SplashArtwork()),
                  ),
                  SafeArea(
                    child: Align(
                      alignment: const Alignment(0, -.15),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Opacity(
                              opacity: entrance,
                              child: Transform.translate(
                                offset: Offset(0, 12 * (1 - entrance)),
                                child: Transform.scale(
                                  scale: .95 + .05 * entrance,
                                  child: SizedBox(
                                    width: logoSize * 1.45,
                                    height: logoSize * 1.26,
                                    child: Stack(
                                      alignment: Alignment.topCenter,
                                      children: [
                                        Positioned.fill(
                                          child: CustomPaint(
                                            painter: _LogoArc(entrance),
                                          ),
                                        ),
                                        Image.asset(
                                          'assets/logo/course_intellect2.png',
                                          width: logoSize,
                                          height: logoSize,
                                          fit: BoxFit.contain,
                                          excludeFromSemantics: true,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            SizedBox(height: compact ? 8 : 20),
                            Opacity(
                              opacity: caption,
                              child: Column(
                                children: [
                                  Text(
                                    'SchoolAsist',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: compact ? 27 : 36,
                                      height: 1.15,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -1.1,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Eğitimin her adımında.'.tr,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      color: Color(0xFFABCDE6),
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: compact ? 18 : constraints.maxHeight * .10,
                    child: SafeArea(
                      top: false,
                      child: Semantics(
                        liveRegion: true,
                        label: 'Hazırlanıyor…'.tr,
                        child: ExcludeSemantics(
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(3, (i) {
                                  final opacity =
                                      MediaQuery.disableAnimationsOf(context)
                                      ? .7
                                      : .3 +
                                            .7 *
                                                (math.sin(
                                                      _motion.value *
                                                              math.pi *
                                                              4 -
                                                          i * .8,
                                                    ) +
                                                    1) /
                                                2;
                                  return Opacity(
                                    opacity: opacity,
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      margin: const EdgeInsets.symmetric(
                                        horizontal: 5,
                                      ),
                                      decoration: const BoxDecoration(
                                        color: Color(0xFFFFA51F),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  );
                                }),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                'Hazırlanıyor…'.tr,
                                style: const TextStyle(
                                  fontSize: 12,
                                  letterSpacing: .3,
                                  color: Color(0xFF94B4CD),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    ),
  );
}

class _LogoArc extends CustomPainter {
  final double progress;
  _LogoArc(this.progress);
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(
      4,
      size.height * .14,
      size.width - 8,
      size.height * .82,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..shader = const LinearGradient(
        colors: [Color(0x00FFAB25), Color(0xFFFFB33D), Color(0x00FFAB25)],
      ).createShader(rect);
    canvas.drawArc(rect, .05, math.pi * progress, false, paint);
  }

  @override
  bool shouldRepaint(_LogoArc oldDelegate) => progress != oldDelegate.progress;
}

class _SplashArtwork extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .8
      ..color = const Color(0x66206190);
    canvas.drawOval(Rect.fromLTWH(w * .58, -h * .35, w * 1.05, h * .62), line);
    canvas.drawArc(
      Rect.fromLTWH(w * .62, -h * .34, w * 1.08, h * .64),
      .3,
      2.4,
      false,
      line..color = const Color(0x99EF9C2B),
    );
    for (final origin in [Offset(w * .79, h * .12), Offset(w * .08, h * .72)]) {
      for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
          canvas.drawCircle(
            origin + Offset(x * 13.0, y * 13.0),
            1.3,
            Paint()..color = const Color(0x66407FAD),
          );
        }
      }
    }
    final wave = Path()
      ..moveTo(0, h * .82)
      ..cubicTo(w * .30, h * .83, w * .45, h * 1.01, w, h * .91);
    final fill = Path.from(wave)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(fill, Paint()..color = const Color(0xAA0C2745));
    canvas.drawPath(
      wave,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = const LinearGradient(
          colors: [Color(0xFFFFB33D), Color(0x88EF9C2B), Color(0x0021527E)],
        ).createShader(Offset.zero & size),
    );
    final lower = Path()
      ..moveTo(0, h * .87)
      ..cubicTo(w * .4, h * .86, w * .65, h * 1.03, w, h * .96);
    canvas.drawPath(lower, line..color = const Color(0x6621527E));
  }

  @override
  bool shouldRepaint(_SplashArtwork oldDelegate) => false;
}
