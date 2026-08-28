import { io, Socket } from 'socket.io-client';
import { API_URL, SOCKET_URL } from '@/constants/network';

export interface MessagePayload {
  messageId: string;
  rideCode: string;
  senderId?: string | null;
  senderName: string;
  senderRole: 'captain' | 'rider' | 'system';
  messageText: string;
  messageType: 'quick' | 'custom' | 'system';
  timestamp: string;
  createdAt?: string;
}

export interface LocationPayload {
  rideCode: string;
  userId: string;
  memberId?: string;
  userName: string;
  role: 'captain' | 'rider';
  latitude: number;
  longitude: number;
  updatedAt: string;
}

type MessageCallback = (msg: MessagePayload) => void;
type LocationCallback = (loc: LocationPayload) => void;
type SnapshotCallback = (snapshot: any) => void;
type SosCallback = (sos: any) => void;
type StatusCallback = (connected: boolean) => void;

class SocketService {
  private socket: Socket | null = null;
  private currentRideCode: string | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private currentRole: 'captain' | 'rider' = 'rider';

  private messageListeners = new Set<MessageCallback>();
  private locationListeners = new Set<LocationCallback>();
  private snapshotListeners = new Set<SnapshotCallback>();
  private sosListeners = new Set<SosCallback>();
  private statusListeners = new Set<StatusCallback>();
  private rideStartedListeners = new Set<(data: any) => void>();
  private rideEndedListeners = new Set<(data: any) => void>();
  private userLeftListeners = new Set<(data: any) => void>();

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }

  public getRideCode(): string | null {
    return this.currentRideCode;
  }

  /**
   * Connect and join ride room with unified singleton socket.
   */
  public connect(params: {
    rideCode: string;
    userId?: string | null;
    userName?: string | null;
    role?: 'captain' | 'rider';
  }): Socket {
    const rideCode = String(params.rideCode || '').toUpperCase().trim();
    const userName = String(params.userName || 'Rider').trim();
    const role = params.role === 'captain' ? 'captain' : 'rider';
    const userId = params.userId || `${role}-${userName.toLowerCase().replace(/\s+/g, '-')}`;

    this.currentRideCode = rideCode;
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.currentRole = role;

    const targetUrl = SOCKET_URL || API_URL;

    if (!this.socket) {
      console.log('[SOCKET SERVICE] Initializing singleton Socket.IO connection to:', targetUrl);
      this.socket = io(targetUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.setupGlobalListeners(this.socket);
    }

    if (this.socket.connected) {
      console.log(`[SOCKET SERVICE] Already connected. Emitting joinRide for ${rideCode} as ${userName} (${role})`);
      this.socket.emit('joinRide', {
        rideCode,
        userId,
        memberId: userId,
        userName,
        role,
      });
    }

    return this.socket;
  }

  private setupGlobalListeners(socket: Socket) {
    socket.on('connect', () => {
      console.log('[SOCKET SERVICE] Connected! Socket ID:', socket.id);
      this.statusListeners.forEach((l) => l(true));

      // Auto join active ride upon connect / reconnect
      if (this.currentRideCode && this.currentUserName) {
        console.log(`[SOCKET SERVICE] Emitting joinRide to room ${this.currentRideCode} for ${this.currentUserName}`);
        socket.emit('joinRide', {
          rideCode: this.currentRideCode,
          userId: this.currentUserId,
          memberId: this.currentUserId,
          userName: this.currentUserName,
          role: this.currentRole,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET SERVICE] Disconnected:', reason);
      this.statusListeners.forEach((l) => l(false));
    });

    socket.on('connect_error', (error) => {
      console.log('[SOCKET SERVICE] Connection error:', error.message);
      this.statusListeners.forEach((l) => l(false));
    });

    socket.on('rideJoined', (data) => {
      console.log('[SOCKET SERVICE] Successfully joined ride room:', data);
    });

    // Incoming Messages
    const handleIncoming = (payload: any) => {
      console.log('[SOCKET SERVICE] Received message event:', payload);
      this.messageListeners.forEach((l) => {
        try {
          l(payload);
        } catch (err) {
          console.log('[SOCKET SERVICE] Error in message listener:', err);
        }
      });
    };

    socket.on('ride:message:new', handleIncoming);
    socket.on('messageReceived', handleIncoming);

    // Locations Snapshot
    socket.on('locationsSnapshot', (snapshot) => {
      this.snapshotListeners.forEach((l) => l(snapshot));
    });

    // Live Location Update
    socket.on('locationUpdated', (loc) => {
      this.locationListeners.forEach((l) => l(loc));
    });

    // SOS Alerts
    const handleSos = (sos: any) => {
      this.sosListeners.forEach((l) => l(sos));
    };
    socket.on('sosAlert', handleSos);
    socket.on('sosTriggered', handleSos);
    socket.on('sosResolved', (data) => {
      this.sosListeners.forEach((l) => l({ ...data, status: 'resolved' }));
    });

    // Ride Start / End
    socket.on('ride:started', (data) => this.rideStartedListeners.forEach((l) => l(data)));
    socket.on('rideStarted', (data) => this.rideStartedListeners.forEach((l) => l(data)));
    socket.on('ride:ended', (data) => this.rideEndedListeners.forEach((l) => l(data)));
    socket.on('rideEnded', (data) => this.rideEndedListeners.forEach((l) => l(data)));

    // User Left
    socket.on('userLeft', (data) => this.userLeftListeners.forEach((l) => l(data)));
  }

  /**
   * Send a ride message through the persistent socket.
   */
  public sendMessage(
    message: MessagePayload,
    callback?: (response: { success: boolean; message?: any; error?: string }) => void
  ) {
    if (!this.socket || !this.socket.connected) {
      console.warn('[SOCKET SERVICE] Socket not connected when sending message. Attempting reconnect...');
      if (this.currentRideCode) {
        this.connect({
          rideCode: this.currentRideCode,
          userId: this.currentUserId,
          userName: this.currentUserName,
          role: this.currentRole,
        });
      }
    }

    if (this.socket) {
      console.log(`[SOCKET SERVICE] Emitting 'ride:message:send' for ${message.rideCode}: "${message.messageText}"`);
      this.socket.emit('ride:message:send', message, callback);
    }
  }

  /**
   * Send live GPS location.
   */
  public emitLocation(payload: LocationPayload) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('updateLocation', payload);
    }
  }

  /**
   * Trigger SOS alert.
   */
  public emitSos(payload: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('triggerSos', payload);
    }
  }

  /**
   * Start / End ride.
   */
  public startRide(rideCode: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('startRide', { rideCode });
    }
  }

  public endRide(rideCode: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('endRide', { rideCode });
    }
  }

  /**
   * Explicitly leave ride room (e.g. on exit ride action).
   */
  public leaveRide() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leaveRide');
    }
    this.currentRideCode = null;
  }

  // --- Subscriptions ---

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onLocation(callback: LocationCallback): () => void {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }

  public onSnapshot(callback: SnapshotCallback): () => void {
    this.snapshotListeners.add(callback);
    return () => this.snapshotListeners.delete(callback);
  }

  public onSos(callback: SosCallback): () => void {
    this.sosListeners.add(callback);
    return () => this.sosListeners.delete(callback);
  }

  public onStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnected());
    return () => this.statusListeners.delete(callback);
  }

  public onRideStarted(callback: (data: any) => void): () => void {
    this.rideStartedListeners.add(callback);
    return () => this.rideStartedListeners.delete(callback);
  }

  public onRideEnded(callback: (data: any) => void): () => void {
    this.rideEndedListeners.add(callback);
    return () => this.rideEndedListeners.delete(callback);
  }

  public onUserLeft(callback: (data: any) => void): () => void {
    this.userLeftListeners.add(callback);
    return () => this.userLeftListeners.delete(callback);
  }
}

export const socketService = new SocketService();
