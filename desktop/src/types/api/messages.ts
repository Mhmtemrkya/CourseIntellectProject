/** Backend `DTOs/Messages` sözleşmesi (camelCase JSON). Guid/DateTime → string. */

export interface MessageAttachment {
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
}

export interface MessageItem {
  id: string;
  threadId: string;
  senderName: string;
  senderRole: string;
  text: string;
  isRead: boolean;
  sentAtUtc: string;
  isFromCurrentActor: boolean;
  status: string;
  readAtUtc: string | null;
  attachments: MessageAttachment[];
}

export interface MessageThread {
  id: string;
  contactName: string;
  contactRole: string;
  lastMessagePreview: string;
  lastMessageAtUtc: string;
  unreadCount: number;
  lastMessageFromMe: boolean;
  lastMessageStatus: string;
}

export interface MessageStatusChanged {
  threadId: string;
  messageId: string;
  status: string;
  readAtUtc: string | null;
}

export interface CreateThreadRequest {
  contactName: string;
  contactRole: string;
  initialMessage?: string | null;
}

export interface SendMessageRequest {
  text: string;
  attachments?: MessageAttachment[] | null;
}

/** MessagesHub `presenceChanged`. */
export interface PresenceChanged {
  actorKey: string;
  isOnline: boolean;
}

/** MessagesHub `typingChanged`. */
export interface TypingChanged {
  threadId: string;
  actorKey: string;
  actorName: string;
  isTyping: boolean;
}
