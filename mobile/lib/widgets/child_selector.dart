import 'package:flutter/material.dart';
import 'package:student/services/linked_children_service.dart';

class ChildSelector extends StatefulWidget {
  final Function(String) onChanged;

  const ChildSelector({super.key, required this.onChanged});

  @override
  State<ChildSelector> createState() => _ChildSelectorState();
}

class _ChildSelectorState extends State<ChildSelector> {
  String? selectedChild;
  bool _loading = true;
  List<LinkedChildRecord> _children = const [];

  @override
  void initState() {
    super.initState();
    _loadChildren();
  }

  Future<void> _loadChildren() async {
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    if (!mounted) return;
    setState(() {
      _children = children;
      selectedChild = children.isNotEmpty ? children.first.fullName : null;
      _loading = false;
    });
    if (children.isNotEmpty) {
      widget.onChanged(children.first.fullName);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final children = _children.map((item) => item.fullName).toList();

    if (_loading) {
      return const SizedBox(
        width: 150,
        child: LinearProgressIndicator(minHeight: 2),
      );
    }

    if (children.isEmpty) {
      return ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 150),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            'Cocuk yok',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: theme.textTheme.bodyLarge?.color),
          ),
        ),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 150),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
        isExpanded: true,
        value: selectedChild,

        /// DARK MODE DROPDOWN RENK
        dropdownColor: theme.cardColor,

        icon: Icon(
          Icons.keyboard_arrow_down,
          color: theme.textTheme.bodyLarge!.color,
        ),

        style: TextStyle(
          color: theme.textTheme.bodyLarge!.color,
          fontWeight: FontWeight.w500,
        ),

        items: children.map((child) {
          return DropdownMenuItem(
            value: child,
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 10,
                  backgroundImage:
                      NetworkImage("https://i.pravatar.cc/150?img=3"),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    child,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: theme.textTheme.bodyLarge!.color,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),

        onChanged: (value) {
          if (value == null) return;

          setState(() {
            selectedChild = value;
          });

          widget.onChanged(value);

        },
      ),
      ),
    );
  }
}
