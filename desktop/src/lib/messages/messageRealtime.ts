import * as signalR from '@microsoft/signalr';
import { desktopApiBaseUrl, loadDesktopSession } from '../auth';

import type {
  MessageItem,
  MessageStatusChanged,
  MessageThread,
  PresenceChanged,
  TypingChanged,
} from '../../types/api/messages';

type Handler<T> = (payload: T) => void;

class MessageRealtimeClient {
  private connection: signalR.HubConnection | null = null;

  private readonly threadHandlers = new Set<Handler<MessageThread>>();

  private readonly messageHandlers = new Set<Handler<MessageItem>>();

  private readonly messageStatusHandlers = new Set<Handler<MessageStatusChanged>>();

  private readonly presenceHandlers = new Set<Handler<PresenceChanged>>();

  private readonly typingHandlers = new Set<Handler<TypingChanged>>();

  private readonly joinedThreads = new Set<string>();

  private readonly presenceKeys = new Set<string>();

  async ensureConnected(): Promise<signalR.HubConnection | null> {
    const session = loadDesktopSession();
    if (!session?.accessToken) return null;

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (!this.connection) {
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${desktopApiBaseUrl}/hubs/messages`, {
          accessTokenFactory: () => loadDesktopSession()?.accessToken || '',
        })
        .withAutomaticReconnect()
        .build();
      this.connection = connection;

      connection.onreconnected(async () => {
        await Promise.allSettled(
          Array.from(this.joinedThreads).map((threadId) => connection.invoke('JoinThread', threadId).catch(() => {})),
        );
        await Promise.allSettled(
          Array.from(this.presenceKeys).map((actorKey) => connection.invoke('SubscribePresence', actorKey).catch(() => {})),
        );
      });

      connection.on('threadUpdated', (payload: MessageThread) => {
        this.threadHandlers.forEach((handler) => handler(payload));
      });

      connection.on('messageReceived', (payload: MessageItem) => {
        this.messageHandlers.forEach((handler) => handler(payload));
      });

      connection.on('messageStatusChanged', (payload: MessageStatusChanged) => {
        this.messageStatusHandlers.forEach((handler) => handler(payload));
      });

      connection.on('presenceChanged', (payload: PresenceChanged) => {
        this.presenceHandlers.forEach((handler) => handler(payload));
      });

      connection.on('typingChanged', (payload: TypingChanged) => {
        this.typingHandlers.forEach((handler) => handler(payload));
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      await this.connection.start();
    }

    return this.connection;
  }

  async joinThread(threadId: string | null | undefined): Promise<void> {
    const connection = await this.ensureConnected();
    if (!connection || !threadId) return;
    this.joinedThreads.add(threadId);
    try {
      await connection.invoke('JoinThread', threadId);
    } catch {
      // Katılım bir sonraki yeniden bağlanmada tekrarlanır.
    }
  }

  async leaveThread(threadId: string | null | undefined): Promise<void> {
    const connection = this.connection;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !threadId) return;
    this.joinedThreads.delete(threadId);
    try {
      await connection.invoke('LeaveThread', threadId);
    } catch {
      // Sunucu grubu bağlantı kapanınca zaten temizlenir.
    }
  }

  async subscribePresence(actorKey: string | null | undefined): Promise<void> {
    const connection = await this.ensureConnected();
    if (!connection || !actorKey) return;
    const normalized = String(actorKey).trim().toLowerCase();
    this.presenceKeys.add(normalized);
    try {
      await connection.invoke('SubscribePresence', normalized);
    } catch {
      // Abonelik yeniden bağlanmada tekrarlanır.
    }
  }

  async unsubscribePresence(actorKey: string | null | undefined): Promise<void> {
    const connection = this.connection;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !actorKey) return;
    const normalized = String(actorKey).trim().toLowerCase();
    this.presenceKeys.delete(normalized);
    try {
      await connection.invoke('UnsubscribePresence', normalized);
    } catch {
      // Sunucu grubu bağlantı kapanınca zaten temizlenir.
    }
  }

  async setTyping(threadId: string | null | undefined, actorName: string | null | undefined, isTyping: boolean): Promise<void> {
    const connection = await this.ensureConnected();
    if (!connection || !threadId || !actorName) return;
    try {
      await connection.invoke(isTyping ? 'TypingStart' : 'TypingStop', threadId, actorName);
    } catch {
      // "Yazıyor" göstergesi kritik değil; hata yutulur.
    }
  }

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  onThreadUpdated(handler: Handler<MessageThread>): () => boolean {
    this.threadHandlers.add(handler);
    return () => this.threadHandlers.delete(handler);
  }

  onMessageReceived(handler: Handler<MessageItem>): () => boolean {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onMessageStatusChanged(handler: Handler<MessageStatusChanged>): () => boolean {
    this.messageStatusHandlers.add(handler);
    return () => this.messageStatusHandlers.delete(handler);
  }

  onPresenceChanged(handler: Handler<PresenceChanged>): () => boolean {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onTypingChanged(handler: Handler<TypingChanged>): () => boolean {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }
}

export const messageRealtimeClient = new MessageRealtimeClient();
