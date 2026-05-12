import 'package:flutter/material.dart';
import 'package:student/services/linked_children_service.dart';
import 'package:student/widgets/app_header.dart';

class VeliOdemeMakbuzPage extends StatefulWidget {
  const VeliOdemeMakbuzPage({super.key});

  @override
  State<VeliOdemeMakbuzPage> createState() => _VeliOdemeMakbuzPageState();
}

class _VeliOdemeMakbuzPageState extends State<VeliOdemeMakbuzPage> {
  String _studentName = 'Bağlı Öğrenci';

  @override
  void initState() {
    super.initState();
    _loadChild();
  }

  Future<void> _loadChild() async {
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    if (!mounted || children.isEmpty) return;
    setState(() {
      _studentName = children.first.fullName;
    });
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Scaffold(
      appBar: const AppHeader(title: "Makbuz"),

      body: Padding(
        padding: const EdgeInsets.all(20),

        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,

          children: [
            const SizedBox(height: 20),

            const Icon(Icons.check_circle, color: Colors.green, size: 80),

            const SizedBox(height: 20),

            const Text(
              "Ödeme Başarılı",
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            const Text(
              "Ödemeniz başarıyla alınmıştır.",
              style: TextStyle(color: Colors.grey),
            ),

            const SizedBox(height: 30),

            Container(
              padding: const EdgeInsets.all(16),

              decoration: BoxDecoration(
                color: Colors.white,

                borderRadius: BorderRadius.circular(16),

                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 6),
                ],
              ),

              child: Column(
                children: [
                  const _ReceiptRow(title: "Makbuz No", value: "ONLINE-ODEME"),
                  const Divider(),
                  _ReceiptRow(title: "Öğrenci", value: _studentName),
                  const Divider(),
                  const _ReceiptRow(
                    title: "Tutar",
                    value: "Online ödeme işlemi",
                  ),
                  const Divider(),
                  _ReceiptRow(
                    title: "Tarih",
                    value:
                        '${now.day.toString().padLeft(2, '0')}.${now.month.toString().padLeft(2, '0')}.${now.year}',
                  ),
                ],
              ),
            ),

            const SizedBox(height: 40),

            SizedBox(
              width: double.infinity,

              height: 50,

              child: ElevatedButton(
                onPressed: () {
                  Navigator.popUntil(context, (route) => route.isFirst);
                },

                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF7A00),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),

                child: const Text("Ana Sayfaya Dön"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  final String title;
  final String value;

  const _ReceiptRow({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),

      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,

        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),

          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
