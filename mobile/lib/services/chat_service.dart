import '../models/message_model.dart';

class ChatService {
  static final ChatService instance = ChatService._internal();

  factory ChatService() {
    return instance;
  }

  ChatService._internal();

  List<MessageModel> messages = [
    MessageModel(
      id: "1",
      text: "Merhaba, türev konusunda yardım istiyorum.",
      senderId: "student",
      type: "text",
      isRead: true,
      time: DateTime.now(),
    ),

    MessageModel(
      id: "2",
      text: "Tabii, hangi konuda takıldın?",
      senderId: "teacher",
      type: "text",
      isRead: true,
      time: DateTime.now(),
    ),
  ];

  /// SEND MESSAGE
  void sendMessage(MessageModel message) {
    messages.add(message);
  }

  /// DELETE MESSAGE
  void deleteMessage(String id) {
    messages.removeWhere((m) => m.id == id);
  }

  /// EDIT MESSAGE
  void editMessage(String id, String newText) {
    final index = messages.indexWhere((m) => m.id == id);

    if (index != -1) {
      messages[index].text = newText;
    }
  }
}
