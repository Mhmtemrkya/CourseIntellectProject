class MessageModel {
  String id;
  String text;
  String senderId;
  String type;
  bool isRead;
  DateTime time;

  MessageModel({
    required this.id,
    required this.text,
    required this.senderId,
    required this.type,
    required this.isRead,
    required this.time,
  });
}
