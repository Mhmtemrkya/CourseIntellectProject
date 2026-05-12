import 'package:flutter/material.dart';
import '../pages/veli_duyurular_page.dart';

class VeliAnnouncements extends StatelessWidget {
  const VeliAnnouncements({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).cardColor,

      elevation: 2,

      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),

      child: Padding(
        padding: const EdgeInsets.all(16),

        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,

          children: [
            /// BAŞLIK
            InkWell(
              borderRadius: BorderRadius.circular(8),

              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const VeliDuyurularPage()),
                );
              },

              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,

                children: const [
                  Text(
                    "Duyurular",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFFF7A00),
                    ),
                  ),

                  Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: Color(0xFFFF7A00),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            const ListTile(
              leading: Icon(Icons.campaign, color: Colors.orange),
              title: Text("Yarıyıl Tatili Duyurusu"),
              trailing: Text("06.01.2025"),
            ),

            const ListTile(
              leading: Icon(Icons.people, color: Colors.orange),
              title: Text("Veli Toplantısı"),
              trailing: Text("10.01.2025"),
            ),

            const ListTile(
              leading: Icon(Icons.calendar_month, color: Colors.orange),
              title: Text("Ara Sınav Takvimi"),
              trailing: Text("08.01.2025"),
            ),
          ],
        ),
      ),
    );
  }
}
