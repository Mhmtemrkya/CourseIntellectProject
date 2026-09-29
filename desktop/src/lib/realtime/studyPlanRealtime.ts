import * as signalR from '@microsoft/signalr';
import { desktopApiBaseUrl, loadDesktopSession } from '../auth';

// Çalışma planı canlı senkronizasyonu: backend her plan mutasyonunda
// "studyPlanUpdated" olayını öğrencinin grubuna yayınlar; mobil ve desktop
// aynı anda açıkken değişiklikler anında yansır.
class StudyPlanRealtimeClient {
  constructor() {
    this.connection = null;
    this.handlers = new Set();
  }

  async ensureConnected() {
    const session = loadDesktopSession();
    if (!session?.accessToken) return null;

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${desktopApiBaseUrl}/hubs/study-plan`, {
          accessTokenFactory: () => loadDesktopSession()?.accessToken || '',
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.connection.on('studyPlanUpdated', (state) => {
        this.handlers.forEach((handler) => {
          try {
            handler(state);
          } catch {
            // Tek bir dinleyici hatası diğerlerini etkilemesin.
          }
        });
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      try {
        await this.connection.start();
      } catch {
        return null;
      }
    }
    return this.connection;
  }

  // Plan güncellemelerine abone olur; geri dönen fonksiyon aboneliği iptal eder.
  subscribe(handler) {
    this.handlers.add(handler);
    this.ensureConnected();
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export const studyPlanRealtime = new StudyPlanRealtimeClient();
