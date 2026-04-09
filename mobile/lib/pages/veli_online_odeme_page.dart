import 'package:flutter/material.dart';
import 'package:student/widgets/app_header.dart';
import 'veli_odeme_makbuz_page.dart';

class VeliOnlineOdemePage extends StatefulWidget {
  const VeliOnlineOdemePage({super.key});

  @override
  State<VeliOnlineOdemePage> createState() => _VeliOnlineOdemePageState();
}

class _VeliOnlineOdemePageState extends State<VeliOnlineOdemePage> {

  final formKey = GlobalKey<FormState>();

  final kartSahibiController = TextEditingController();
  final kartNoController = TextEditingController();
  final sktController = TextEditingController();
  final cvvController = TextEditingController();

  @override
  Widget build(BuildContext context) {

    final theme = Theme.of(context);

    return Scaffold(

      backgroundColor: theme.scaffoldBackgroundColor,

      appBar: const AppHeader(title: "Online Ödeme"),

      body: SingleChildScrollView(

        padding: const EdgeInsets.all(16),

        child: Form(

          key: formKey,

          child: Column(

            children: [

              const SizedBox(height: 20),

              Text(
                "Ödenecek Tutar",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: theme.textTheme.bodyLarge!.color,
                ),
              ),

              const SizedBox(height: 8),

              const Text(
                "₺4.000",
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.orange,
                ),
              ),

              const SizedBox(height: 30),

              /// Kart Sahibi
              TextFormField(

                controller: kartSahibiController,

                decoration: InputDecoration(
                  labelText: "Kart Sahibi",
                  filled: true,
                  fillColor: theme.cardColor,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),

                validator: (value) {
                  if (value!.isEmpty) {
                    return "Kart sahibi giriniz";
                  }
                  return null;
                },

              ),

              const SizedBox(height: 16),

              /// Kart Numarası
              TextFormField(

                controller: kartNoController,
                keyboardType: TextInputType.number,

                decoration: InputDecoration(
                  labelText: "Kart Numarası",
                  filled: true,
                  fillColor: theme.cardColor,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),

                validator: (value) {
                  if (value!.length < 16) {
                    return "Geçerli kart numarası girin";
                  }
                  return null;
                },

              ),

              const SizedBox(height: 16),

              Row(
                children: [

                  /// SKT
                  Expanded(
                    child: TextFormField(

                      controller: sktController,

                      decoration: InputDecoration(
                        labelText: "SKT (MM/YY)",
                        filled: true,
                        fillColor: theme.cardColor,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),

                      validator: (value) {
                        if (value!.isEmpty) {
                          return "SKT girin";
                        }
                        return null;
                      },

                    ),
                  ),

                  const SizedBox(width: 10),

                  /// CVV
                  Expanded(
                    child: TextFormField(

                      controller: cvvController,
                      keyboardType: TextInputType.number,
                      obscureText: true,

                      decoration: InputDecoration(
                        labelText: "CVV",
                        filled: true,
                        fillColor: theme.cardColor,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),

                      validator: (value) {
                        if (value!.length < 3) {
                          return "CVV girin";
                        }
                        return null;
                      },

                    ),
                  ),

                ],
              ),

              const SizedBox(height: 30),

              SizedBox(
                width: double.infinity,
                height: 50,

                child: ElevatedButton(

                  onPressed: () {

                    if (formKey.currentState!.validate()) {

                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const VeliOdemeMakbuzPage(),
                        ),
                      );

                    }

                  },

                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF7A00),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),

                  child: const Text(
                    "Ödemeyi Tamamla",
                    style: TextStyle(fontSize: 16),
                  ),

                ),
              )

            ],

          ),
        ),
      ),
    );
  }
}