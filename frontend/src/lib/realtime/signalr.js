// CourseIntellect SignalR Real-time Service
import * as signalR from '@microsoft/signalr';

class SignalRService {
  constructor() {
    this.notificationConnection = null;
    this.chatConnection = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  // Get base URL from environment
  getBaseUrl() {
    return process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  }

  // Initialize notification hub connection
  async connectNotifications(token) {
    if (this.notificationConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const hubUrl = `${this.getBaseUrl()}/hubs/notifications`;
    
    this.notificationConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Event handlers
    this.notificationConnection.on('ReceiveNotification', (notification) => {
      this.emit('notification', notification);
    });

    this.notificationConnection.on('QuestionAnswered', (data) => {
      this.emit('questionAnswered', data);
    });

    this.notificationConnection.on('AttendanceUpdated', (data) => {
      this.emit('attendanceUpdated', data);
    });

    this.notificationConnection.onreconnecting(() => {
      console.log('SignalR: Reconnecting...');
      this.emit('connectionStatus', 'reconnecting');
    });

    this.notificationConnection.onreconnected(() => {
      console.log('SignalR: Reconnected');
      this.emit('connectionStatus', 'connected');
    });

    this.notificationConnection.onclose(() => {
      console.log('SignalR: Connection closed');
      this.emit('connectionStatus', 'disconnected');
    });

    try {
      await this.notificationConnection.start();
      this.isConnected = true;
      console.log('SignalR: Notifications connected');
      this.emit('connectionStatus', 'connected');
    } catch (err) {
      console.error('SignalR: Connection failed', err);
      this.emit('connectionStatus', 'error');
    }
  }

  // Initialize chat hub connection
  async connectChat(token) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const hubUrl = `${this.getBaseUrl()}/hubs/chat`;
    
    this.chatConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Chat event handlers
    this.chatConnection.on('ReceiveMessage', (message) => {
      this.emit('newMessage', message);
    });

    this.chatConnection.on('UserTyping', (data) => {
      this.emit('userTyping', data);
    });

    this.chatConnection.on('MessageRead', (data) => {
      this.emit('messageRead', data);
    });

    this.chatConnection.on('UserOnline', (userId) => {
      this.emit('userOnline', userId);
    });

    this.chatConnection.on('UserOffline', (userId) => {
      this.emit('userOffline', userId);
    });

    try {
      await this.chatConnection.start();
      console.log('SignalR: Chat connected');
    } catch (err) {
      console.error('SignalR: Chat connection failed', err);
    }
  }

  // Send chat message
  async sendMessage(conversationId, message) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('SendMessage', conversationId, message);
        return true;
      } catch (err) {
        console.error('SignalR: Send message failed', err);
        return false;
      }
    }
    return false;
  }

  // Send typing indicator
  async sendTypingIndicator(conversationId) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('UserTyping', conversationId);
      } catch (err) {
        console.error('SignalR: Typing indicator failed', err);
      }
    }
  }

  // Mark message as read
  async markAsRead(conversationId, messageId) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('MarkAsRead', conversationId, messageId);
      } catch (err) {
        console.error('SignalR: Mark as read failed', err);
      }
    }
  }

  // Join conversation
  async joinConversation(conversationId) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('JoinConversation', conversationId);
      } catch (err) {
        console.error('SignalR: Join conversation failed', err);
      }
    }
  }

  // Leave conversation
  async leaveConversation(conversationId) {
    if (this.chatConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('LeaveConversation', conversationId);
      } catch (err) {
        console.error('SignalR: Leave conversation failed', err);
      }
    }
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  // Disconnect all
  async disconnect() {
    try {
      if (this.notificationConnection) {
        await this.notificationConnection.stop();
      }
      if (this.chatConnection) {
        await this.chatConnection.stop();
      }
      this.isConnected = false;
    } catch (err) {
      console.error('SignalR: Disconnect error', err);
    }
  }
}

// Singleton instance
export const signalRService = new SignalRService();
export default signalRService;
