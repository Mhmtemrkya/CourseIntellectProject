import * as signalR from '@microsoft/signalr';
import { desktopApiBaseUrl, loadDesktopSession } from '../auth';

// Servis takibi canlı olayları. Hub bağlanan yöneticiyi otomatik olarak
// kurum grubuna ekler; araç konumu, sefer durumu ve biniş güncellemeleri
// "VehicleLocationUpdated" / "TripStatusUpdated" / "StudentAttendanceUpdated"
// olaylarıyla gelir.
class ServiceTrackingRealtimeClient {
  constructor() {
    this.connection = null;
    this.handlers = new Set();
  }

  emit(type, payload) {
    this.handlers.forEach((handler) => {
      try {
        handler(type, payload);
      } catch {
        // Tek bir dinleyici hatası diğerlerini etkilemesin.
      }
    });
  }

  async ensureConnected() {
    const session = loadDesktopSession();
    if (!session?.accessToken) return null;

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${desktopApiBaseUrl}/hubs/service-tracking`, {
          accessTokenFactory: () => loadDesktopSession()?.accessToken || '',
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.connection.on('VehicleLocationUpdated', (payload) => this.emit('location', payload));
      this.connection.on('TripStatusUpdated', (payload) => this.emit('trip', payload));
      this.connection.on('StudentAttendanceUpdated', (payload) => this.emit('attendance', payload));
      this.connection.on('AbsenceRequestCreated', (payload) => this.emit('absence', payload));
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

  // Servis olaylarına abone olur; geri dönen fonksiyon aboneliği iptal eder.
  subscribe(handler) {
    this.handlers.add(handler);
    this.ensureConnected();
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export const serviceTrackingRealtime = new ServiceTrackingRealtimeClient();
