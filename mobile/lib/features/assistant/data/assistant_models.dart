class AssistantMessageModel {
  final String id;
  final String? conversationId;
  final String sender;
  final String type;
  final String text;
  final Map<String, dynamic>? data;
  final List<AssistantActionModel> actions;

  const AssistantMessageModel({
    required this.id,
    this.conversationId,
    required this.sender,
    required this.type,
    required this.text,
    this.data,
    this.actions = const [],
  });

  factory AssistantMessageModel.fromJson(
    Map<String, dynamic> json,
  ) => AssistantMessageModel(
    id: '${json['messageId'] ?? json['id'] ?? DateTime.now().microsecondsSinceEpoch}',
    conversationId: json['conversationId']?.toString(),
    sender: '${json['sender'] ?? 'assistant'}',
    type: '${json['type'] ?? 'text'}',
    text: '${json['text'] ?? ''}',
    data: json['data'] is Map
        ? Map<String, dynamic>.from(json['data'] as Map)
        : null,
    actions: (json['actions'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((x) => AssistantActionModel.fromJson(Map<String, dynamic>.from(x)))
        .toList(),
  );
}

class AssistantActionModel {
  final String label;
  final String? command;
  final String? route;
  final String? studentId;

  const AssistantActionModel({
    required this.label,
    this.command,
    this.route,
    this.studentId,
  });

  factory AssistantActionModel.fromJson(Map<String, dynamic> json) {
    final parameters = json['parameters'] is Map
        ? Map<String, dynamic>.from(json['parameters'] as Map)
        : const <String, dynamic>{};
    return AssistantActionModel(
      label: '${json['label'] ?? ''}',
      command: json['command'] as String?,
      route: json['route'] as String?,
      studentId: parameters['studentId']?.toString(),
    );
  }
}

class AssistantSuggestionModel {
  final String label;
  final String category;
  const AssistantSuggestionModel(this.label, this.category);

  factory AssistantSuggestionModel.fromJson(Map<String, dynamic> json) =>
      AssistantSuggestionModel(
        '${json['label'] ?? ''}',
        '${json['category'] ?? ''}',
      );
}
