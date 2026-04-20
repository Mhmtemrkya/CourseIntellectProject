import 'package:flutter/material.dart';
import 'package:student/services/linked_children_service.dart';

class VeliStudentCard extends StatefulWidget {
  const VeliStudentCard({super.key});

  @override
  State<VeliStudentCard> createState() => _VeliStudentCardState();
}

class _VeliStudentCardState extends State<VeliStudentCard> {
  LinkedChildRecord? _child;

  @override
  void initState() {
    super.initState();
    _loadChild();
  }

  Future<void> _loadChild() async {
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    if (!mounted || children.isEmpty) return;
    setState(() {
      _child = children.first;
    });
  }

  @override
  Widget build(BuildContext context) {
    final childName = _child?.fullName ?? 'Bağlı Öğrenci';
    final className = _child?.className ?? 'Sınıf bilgisi bekleniyor';

    return Container(
      padding: const EdgeInsets.all(16),

      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),

        gradient: const LinearGradient(
          colors: [Color(0xFF1E3A8A), Color(0xFFFF7A00)],
        ),
      ),

      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundImage: NetworkImage(
                  "https://i.pravatar.cc/150?img=12",
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      childName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      className,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
