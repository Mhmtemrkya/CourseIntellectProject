import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'child_selector.dart';

class VeliHeader extends StatefulWidget {
  const VeliHeader({super.key});

  @override
  State<VeliHeader> createState() => _VeliHeaderState();
}

class _VeliHeaderState extends State<VeliHeader> {
  String _parentName = 'Veli';

  String _greetingByHour() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) {
      return 'Gunaydin';
    }
    if (hour >= 12 && hour < 18) {
      return 'Iyi Gunler';
    }
    if (hour >= 18 && hour < 22) {
      return 'Iyi Aksamlar';
    }
    return 'Iyi Geceler';
  }

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    final firstName = session.fullName.trim().split(RegExp(r'\s+')).first;
    setState(() {
      _parentName = firstName.isEmpty ? 'Veli' : firstName;
    });
  }

  @override
  Widget build(BuildContext context) {

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final greeting = _greetingByHour();

    return Container(

      width: double.infinity,

      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),

      child: SafeArea(

        bottom: false,

        child: Padding(

          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),

          child: Row(
            children: [
              Expanded(
                child: Column(

                  crossAxisAlignment: CrossAxisAlignment.start,

                  children: [

                    Text(
                      "$greeting $_parentName 👋",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 4),

                    Text(
                      "Veli Paneline Hoş Geldiniz",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white70 : Colors.black54,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              ChildSelector(
                onChanged: (child) {},
              ),
            ],
          ),

        ),

      ),

    );
  }
}
