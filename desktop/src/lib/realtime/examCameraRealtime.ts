import * as signalR from '@microsoft/signalr';
import { desktopApiBaseUrl, loadDesktopSession } from '../auth';

// Sınav canlı kamera izleme: öğrenci sınav ekranından periyodik kamera karesi
// (küçük JPEG data URL) gönderir; aynı planlı sınavı izleyen öğretmen(ler)
// "cameraFrame" olayıyla anında alır. Kareler sunucuda saklanmaz, yalnızca
// /hubs/exam-solving üzerinden gerçek zamanlı iletilir.
class ExamCameraRealtimeClient {
  constructor() {
    this.connection = null;
    this.handlers = new Set();
    this.starting = null;
  }

  async ensureConnected() {
    const session = loadDesktopSession();
    if (!session?.accessToken) return null;

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${desktopApiBaseUrl}/hubs/exam-solving`, {
          accessTokenFactory: () => loadDesktopSession()?.accessToken || '',
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.connection.on('cameraFrame', (payload) => {
        this.handlers.forEach((handler) => {
          try {
            handler(payload);
          } catch {
            // Tek bir dinleyici hatası diğerlerini etkilemesin.
          }
        });
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      if (!this.starting) {
        this.starting = this.connection.start().catch(() => null).finally(() => { this.starting = null; });
      }
      await this.starting;
      if (this.connection.state !== signalR.HubConnectionState.Connected) return null;
    } else if (this.connection.state === signalR.HubConnectionState.Connecting && this.starting) {
      await this.starting;
    }
    return this.connection;
  }

  // Öğretmen: bir planlı sınavın canlı kamera akışına abone olur.
  async joinMonitor(examId, handler) {
    if (handler) this.handlers.add(handler);
    const connection = await this.ensureConnected();
    if (!connection || !examId) return () => this.leaveMonitor(examId, handler);
    try {
      await connection.invoke('JoinExamMonitor', String(examId));
    } catch {
      // bağlantı kurulamazsa abonelik yerelde kalır
    }
    return () => this.leaveMonitor(examId, handler);
  }

  async leaveMonitor(examId, handler) {
    if (handler) this.handlers.delete(handler);
    if (this.connection?.state === signalR.HubConnectionState.Connected && examId) {
      try {
        await this.connection.invoke('LeaveExamMonitor', String(examId));
      } catch {
        // yoksay
      }
    }
  }

  // Öğrenci: tek bir kamera karesini yayınlar.
  async publishFrame(examId, studentUsername, studentName, frame) {
    if (!examId || !frame) return;
    const connection = await this.ensureConnected();
    if (!connection) return;
    try {
      await connection.invoke('PublishCameraFrame', String(examId), studentUsername || '', studentName || '', frame);
    } catch {
      // kare gönderilemezse sessizce atla (bir sonraki denemede tekrar gönderilir)
    }
  }
}

export const examCameraRealtime = new ExamCameraRealtimeClient();
export default examCameraRealtime;
