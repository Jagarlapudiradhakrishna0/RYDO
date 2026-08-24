import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export interface SosEvent {
  eventId?: string;
  sosId?: string;
  rideCode: string;
  name: string;
  riderName?: string;
  role: 'captain' | 'rider';
  userId?: string;
  bikeNumber?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: {
    name?: string | null;
    phoneNumber?: string | null;
  } | null;
  location: {
    latitude: number;
    longitude: number;
  };
  latitude?: number;
  longitude?: number;
  triggeredAt?: string;
  createdAt?: string;
  status: 'active' | 'resolved';
}

class SosEmergencyManager {
  private soundObject: Audio.Sound | null = null;
  private isSoundPlaying = false;
  private isVibrating = false;
  private hapticInterval: any = null;
  private autoStopTimer: any = null;
  private currentEventKey: string | null = null;

  /* ===================================================
     TRIGGER EMERGENCY AUDIO ALERT (STRICT 10-SECOND MAX)
  =================================================== */
  public async startEmergencyAudio(eventKey?: string) {
    try {
      const key = eventKey || 'active_sos';
      // If already playing for the exact same event, do NOT restart audio or reset the timer
      if (this.isSoundPlaying && this.currentEventKey === key) {
        return;
      }
      this.currentEventKey = key;

      // Clear any prior timer to prevent overlapping loops
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Stop & unload existing sound instance
      if (this.soundObject) {
        try {
          await this.soundObject.stopAsync();
          await this.soundObject.unloadAsync();
        } catch (_) {}
        this.soundObject = null;
      }
      this.isSoundPlaying = false;

      // Public emergency alarm siren tone
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );

      this.soundObject = sound;
      this.isSoundPlaying = true;
      console.log('[RYDO SOS] Emergency alarm audio started (Hard 10-second timer active)');

      // Strict 10-second auto-cutoff
      this.autoStopTimer = setTimeout(() => {
        console.log('[RYDO SOS] 10 seconds elapsed: Auto-stopping emergency audio and vibration');
        this.stopEmergencyAlerts();
      }, 10000);
    } catch (error) {
      console.log('RYDO SOS: Sound playback fallback to haptic siren:', error);
      this.startHapticPulseLoop();
      if (!this.autoStopTimer) {
        this.autoStopTimer = setTimeout(() => {
          this.stopEmergencyAlerts();
        }, 10000);
      }
    }
  }

  /* ===================================================
     TRIGGER STRONG VIBRATION
  =================================================== */
  public startEmergencyVibration() {
    if (this.isVibrating) return;
    this.isVibrating = true;

    // Pattern: wait 0ms, vibrate 500ms, wait 200ms, vibrate 500ms, repeat
    Vibration.vibrate([0, 500, 200, 500], true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    console.log('[RYDO SOS] Emergency vibration started');
  }

  private startHapticPulseLoop() {
    if (this.hapticInterval) return;
    this.hapticInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 1000);
  }

  /* ===================================================
     STOP ALL ALERTS (ACKNOWLEDGE / DISMISS / TIMEOUT)
  =================================================== */
  public async stopEmergencyAlerts() {
    try {
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }
      this.currentEventKey = null;

      this.isVibrating = false;
      Vibration.cancel();

      if (this.hapticInterval) {
        clearInterval(this.hapticInterval);
        this.hapticInterval = null;
      }

      if (this.soundObject) {
        try {
          await this.soundObject.stopAsync();
          await this.soundObject.unloadAsync();
        } catch (_) {}
        this.soundObject = null;
      }
      this.isSoundPlaying = false;
      console.log('[RYDO SOS] Alert ended: Audio and vibration stopped');
    } catch (e) {
      console.log('RYDO SOS: Error stopping alert:', e);
    }
  }
}

export const sosEmergencyManager = new SosEmergencyManager();
