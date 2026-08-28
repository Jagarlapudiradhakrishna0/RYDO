import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/network';
import { socketService, MessagePayload } from './socketService';
import { ttsService } from './ttsService';
import { getCachedSettings } from './communicationSettings';

export interface RideMessage {
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

type MessageListener = (message: RideMessage) => void;
type PopupListener = (message: RideMessage) => void;
type HistoryListener = (messages: RideMessage[]) => void;

class CommunicationManager {
  private activeRideCode: string | null = null;
  private messageHistory: Map<string, RideMessage[]> = new Map();
  private processedMessageIds: Set<string> = new Set();
  private messageListeners = new Set<MessageListener>();
  private popupListeners = new Set<PopupListener>();
  private historyListeners = new Set<HistoryListener>();
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private notificationSound: Audio.Sound | null = null;
  private isSoundLoaded = false;

  constructor() {
    this.preloadNotificationSound().catch(() => {});

    // Automatically bind to the centralized socket service
    socketService.onMessage((msg) => {
      this.handleIncomingMessage(msg);
    });
  }

  private async preloadNotificationSound() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/communication/notification_high_intensity.ogg' },
        { shouldPlay: false, volume: 0.85 }
      );
      this.notificationSound = sound;
      this.isSoundLoaded = true;
    } catch (_) {
      this.isSoundLoaded = false;
    }
  }

  public setActiveUser(userId: string | null, userName: string | null) {
    this.currentUserId = userId;
    this.currentUserName = userName;
  }

  public setActiveRideCode(rideCode: string | null) {
    this.activeRideCode = rideCode ? rideCode.toUpperCase().trim() : null;
  }

  public getActiveRideCode(): string | null {
    return this.activeRideCode;
  }

  /**
   * Process incoming message: deduplicate, persist in memory history,
   * trigger popup, play sound, and trigger voice announcement if not own message.
   */
  public async handleIncomingMessage(raw: any) {
    try {
      if (!raw || !raw.messageText) return;

      const rideCode = String(raw.rideCode || this.activeRideCode || '').toUpperCase().trim();
      const messageId = String(raw.messageId || `${rideCode}_${Date.now()}_${Math.random()}`);

      // Strict Deduplication check
      if (this.processedMessageIds.has(messageId)) {
        return;
      }
      this.processedMessageIds.add(messageId);

      // Keep cache bounded
      if (this.processedMessageIds.size > 500) {
        const first = this.processedMessageIds.values().next().value;
        if (first) this.processedMessageIds.delete(first);
      }

      const message: RideMessage = {
        messageId,
        rideCode,
        senderId: raw.senderId || null,
        senderName: String(raw.senderName || 'Rider').trim(),
        senderRole: ['captain', 'rider', 'system'].includes(raw.senderRole) ? raw.senderRole : 'rider',
        messageText: String(raw.messageText).trim(),
        messageType: ['quick', 'custom', 'system'].includes(raw.messageType) ? raw.messageType : 'quick',
        timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
        createdAt: raw.createdAt || raw.timestamp || new Date().toISOString(),
      };

      console.log(`[COMMUNICATION RECEIVER] Incoming message in ${rideCode} from ${message.senderName}: "${message.messageText}"`);

      // Add to in-memory message history
      const list = this.messageHistory.get(rideCode) || [];
      if (!list.some((m) => m.messageId === message.messageId)) {
        list.push(message);
        // Sort chronologically
        list.sort((a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime());
        this.messageHistory.set(rideCode, list);
      }

      // Notify message stream listeners (chat screen)
      this.messageListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (e) {
          console.log('[COMMUNICATION] Message listener error:', e);
        }
      });

      this.historyListeners.forEach((listener) => {
        try {
          listener([...list]);
        } catch (e) {
          console.log('[COMMUNICATION] History listener error:', e);
        }
      });

      // Check if message is from SELF
      const isOwnMessage =
        (this.currentUserId && message.senderId && String(message.senderId) === String(this.currentUserId)) ||
        (this.currentUserName && message.senderName && message.senderName.trim().toLowerCase() === this.currentUserName.trim().toLowerCase());

      // If own message: DO NOT trigger popup or voice announcement
      if (isOwnMessage) {
        console.log('[COMMUNICATION] Suppressing announcement for own sent message');
        return;
      }

      const settings = getCachedSettings();

      const isEmergencyOrUrgent =
        message.messageText.toLowerCase().includes('emergency') ||
        message.messageText.toLowerCase().includes('help') ||
        message.messageText.toLowerCase().includes('stop immediately') ||
        message.messageText.toLowerCase().includes('route changed');

      if (settings.importantAlertsOnly && !isEmergencyOrUrgent) {
        return;
      }

      // Trigger Global In-App Popup
      this.popupListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (e) {
          console.log('[COMMUNICATION] Popup listener error:', e);
        }
      });

      // Play Notification Sound / Haptic
      if (settings.soundEnabled) {
        if (isEmergencyOrUrgent) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }

        if (this.notificationSound && this.isSoundLoaded) {
          try {
            await this.notificationSound.replayAsync();
          } catch (_) {}
        }
      }

      // Speak Voice Announcement via TTS
      if (settings.voiceEnabled) {
        await ttsService.speakMessage(message.senderName, message.messageText, settings);
      }
    } catch (error) {
      console.log('[COMMUNICATION] Error processing message:', error);
    }
  }

  /**
   * Fetch recent message history from backend REST API and merge with memory.
   */
  public async fetchMessages(rideCode: string): Promise<RideMessage[]> {
    const code = String(rideCode || '').toUpperCase().trim();
    if (!code) return [];

    try {
      const res = await fetch(`${API_URL}/api/rides/${code}/messages?limit=100`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.messages)) {
        const fetched: RideMessage[] = data.messages;
        const currentList = this.messageHistory.get(code) || [];

        // Stable merge strategy: combine fetched + existing without duplicates
        const map = new Map<string, RideMessage>();
        fetched.forEach((m) => {
          map.set(m.messageId, m);
          this.processedMessageIds.add(m.messageId);
        });
        currentList.forEach((m) => {
          map.set(m.messageId, m);
          this.processedMessageIds.add(m.messageId);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime()
        );

        this.messageHistory.set(code, merged);
        this.historyListeners.forEach((l) => l([...merged]));
        return merged;
      }
    } catch (e) {
      console.log('[COMMUNICATION] Error fetching message history:', e);
    }

    return this.messageHistory.get(code) || [];
  }

  public getMessages(rideCode: string): RideMessage[] {
    return this.messageHistory.get(String(rideCode || '').toUpperCase().trim()) || [];
  }

  /**
   * Send a new message through SocketService and REST fallback.
   */
  public async sendMessage(payload: {
    rideCode: string;
    senderId?: string | null;
    senderName: string;
    senderRole: 'captain' | 'rider' | 'system';
    messageText: string;
    messageType?: 'quick' | 'custom' | 'system';
  }): Promise<RideMessage> {
    const rideCode = String(payload.rideCode).toUpperCase().trim();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const fullMessage: RideMessage = {
      messageId,
      rideCode,
      senderId: payload.senderId || this.currentUserId || null,
      senderName: payload.senderName || this.currentUserName || 'Anonymous',
      senderRole: payload.senderRole || 'rider',
      messageText: payload.messageText.trim(),
      messageType: payload.messageType || 'quick',
      timestamp,
      createdAt: timestamp,
    };

    console.log(`[COMMUNICATION SENDER] Sending message in ${rideCode}: "${fullMessage.messageText}"`);

    // Mark as processed locally immediately
    this.processedMessageIds.add(messageId);

    // Optimistically add to local history
    const list = this.messageHistory.get(rideCode) || [];
    list.push(fullMessage);
    this.messageHistory.set(rideCode, list);
    this.historyListeners.forEach((l) => l([...list]));

    // Emit via Socket.IO
    socketService.sendMessage(fullMessage as MessagePayload);

    // Also send via REST API for persistence guarantee
    try {
      await fetch(`${API_URL}/api/rides/${rideCode}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullMessage),
      });
    } catch (e) {
      console.log('[COMMUNICATION] REST backup message send error:', e);
    }

    return fullMessage;
  }

  // --- Subscriptions ---
  public subscribeToMessages(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public subscribeToPopups(listener: PopupListener): () => void {
    this.popupListeners.add(listener);
    return () => this.popupListeners.delete(listener);
  }

  public subscribeToHistory(listener: HistoryListener): () => void {
    this.historyListeners.add(listener);
    return () => this.historyListeners.delete(listener);
  }
}

export const communicationService = new CommunicationManager();
