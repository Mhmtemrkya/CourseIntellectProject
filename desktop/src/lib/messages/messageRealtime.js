import * as signalR from '@microsoft/signalr';
import { desktopApiBaseUrl, loadDesktopSession } from '../auth';

class MessageRealtimeClient {
  constructor() {
    this.connection = null;
    this.threadHandlers = new Set();
    this.messageHandlers = new Set();
    this.messageStatusHandlers = new Set();
    this.presenceHandlers = new Set();
    this.typingHandlers = new Set();
    this.joinedThreads = new Set();
    this.presenceKeys = new Set();
  }

  async ensureConnected() {
    const session = loadDesktopSession();
    if (!session?.accessToken) return null;

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${desktopApiBaseUrl}/hubs/messages`, {
          accessTokenFactory: () => loadDesktopSession()?.accessToken || '',
        })
        .withAutomaticReconnect()
        .build();

      this.connection.onreconnected(async () => {
        await Promise.allSettled(
          Array.from(this.joinedThreads).map((threadId) => this.connection.invoke('JoinThread', threadId).catch(() => {})),
        );
        await Promise.allSettled(
          Array.from(this.presenceKeys).map((actorKey) => this.connection.invoke('SubscribePresence', actorKey).catch(() => {})),
        );
      });

      this.connection.on('threadUpdated', (payload) => {
        this.threadHandlers.forEach((handler) => handler(payload));
      });

      this.connection.on('messageReceived', (payload) => {
        this.messageHandlers.forEach((handler) => handler(payload));
      });

      this.connection.on('messageStatusChanged', (payload) => {
        this.messageStatusHandlers.forEach((handler) => handler(payload));
      });

      this.connection.on('presenceChanged', (payload) => {
        this.presenceHandlers.forEach((handler) => handler(payload));
      });

      this.connection.on('typingChanged', (payload) => {
        this.typingHandlers.forEach((handler) => handler(payload));
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      await this.connection.start();
    }

    return this.connection;
  }

  async joinThread(threadId) {
    const connection = await this.ensureConnected();
    if (!connection || !threadId) return;
    this.joinedThreads.add(threadId);
    try {
      await connection.invoke('JoinThread', threadId);
    } catch (_) {}
  }

  async leaveThread(threadId) {
    const connection = this.connection;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !threadId) return;
    this.joinedThreads.delete(threadId);
    try {
      await connection.invoke('LeaveThread', threadId);
    } catch (_) {}
  }

  async subscribePresence(actorKey) {
    const connection = await this.ensureConnected();
    if (!connection || !actorKey) return;
    const normalized = String(actorKey).trim().toLowerCase();
    this.presenceKeys.add(normalized);
    try {
      await connection.invoke('SubscribePresence', normalized);
    } catch (_) {}
  }

  async unsubscribePresence(actorKey) {
    const connection = this.connection;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !actorKey) return;
    const normalized = String(actorKey).trim().toLowerCase();
    this.presenceKeys.delete(normalized);
    try {
      await connection.invoke('UnsubscribePresence', normalized);
    } catch (_) {}
  }

  async setTyping(threadId, actorName, isTyping) {
    const connection = await this.ensureConnected();
    if (!connection || !threadId || !actorName) return;
    try {
      await connection.invoke(isTyping ? 'TypingStart' : 'TypingStop', threadId, actorName);
    } catch (_) {}
  }

  isConnected() {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  onThreadUpdated(handler) {
    this.threadHandlers.add(handler);
    return () => this.threadHandlers.delete(handler);
  }

  onMessageReceived(handler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onMessageStatusChanged(handler) {
    this.messageStatusHandlers.add(handler);
    return () => this.messageStatusHandlers.delete(handler);
  }

  onPresenceChanged(handler) {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onTypingChanged(handler) {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }
}

export const messageRealtimeClient = new MessageRealtimeClient();
