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
  private activeSounds: Set<Audio.Sound> = new Set();
  private isSoundPlaying = false;
  private isVibrating = false;
  private hapticInterval: any = null;
  private autoStopTimer: any = null;
  private isAlertActive = false;
  private alertStartTime = 0;
  private currentEventKey: string | null = null;
  private isLoadingAudio = false;

  /* ===================================================
     TRIGGER EMERGENCY AUDIO ALERT (STRICT 10-SECOND MAX)
  =================================================== */
  public async startEmergencyAudio(eventKey?: string) {
    try {
      const now = Date.now();
      const key = eventKey || 'active_sos';

      // If an alert session is already active for this or another key
      if (this.isAlertActive) {
        const elapsed = now - this.alertStartTime;
        // If 10 seconds already elapsed for this alert session, do not play audio again
        if (elapsed >= 10000) {
          console.log('[RYDO SOS] 10s limit already reached for this emergency session. Audio suppressed.');
          return;
        }
        // If sound is already playing or loading, do not restart audio or reset the 10s timer
        if (this.isSoundPlaying || this.isLoadingAudio) {
          console.log('[RYDO SOS] Audio alert already actively playing with timer. Skipping duplicate start.');
          return;
        }
      }

      this.isAlertActive = true;
      this.alertStartTime = now;
      this.currentEventKey = key;

      // Clear any prior timer to prevent duplicate triggers
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }

      // Schedule strict non-resettable 10-second auto-stop
      this.autoStopTimer = setTimeout(() => {
        console.log('[RYDO SOS] 10 seconds elapsed: Auto-stopping emergency audio and vibration');
        this.stopEmergencyAlerts();
      }, 10000);

      this.isLoadingAudio = true;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => {});

      // Stop & unload any existing sound instances
      await this.unloadAllSounds();

      // Check if user dismissed alert or 10s elapsed while setting audio mode
      if (!this.isAlertActive || Date.now() - this.alertStartTime >= 10000) {
        this.isLoadingAudio = false;
        return;
      }

      // Public emergency alarm siren tone
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );

      this.isLoadingAudio = false;

      // If alert was dismissed or 10s ended during async loading, stop & unload immediately
      if (!this.isAlertActive || Date.now() - this.alertStartTime >= 10000) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (_) {}
        return;
      }

      this.activeSounds.add(sound);
      this.isSoundPlaying = true;

      // Register status listener to catch unexpected playing states
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!this.isAlertActive && status.isLoaded && (status as any).isPlaying) {
          sound.stopAsync().catch(() => {});
          sound.unloadAsync().catch(() => {});
          this.activeSounds.delete(sound);
        }
      });

      console.log('[RYDO SOS] Emergency alarm audio started (Hard 10-second timer active)');
    } catch (error) {
      this.isLoadingAudio = false;
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

    // Also ensure vibration auto-cancels after 10 seconds if not already scheduled
    if (!this.autoStopTimer) {
      this.autoStopTimer = setTimeout(() => {
        this.stopEmergencyAlerts();
      }, 10000);
    }
  }

  private startHapticPulseLoop() {
    if (this.hapticInterval) return;
    this.hapticInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 1000);
  }

  private async unloadAllSounds() {
    const sounds = Array.from(this.activeSounds);
    this.activeSounds.clear();
    this.isSoundPlaying = false;

    for (const s of sounds) {
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch (_) {}
    }
  }

  /* ===================================================
     STOP ALL ALERTS (ACKNOWLEDGE / DISMISS / TIMEOUT)
  =================================================== */
  public async stopEmergencyAlerts() {
    try {
      this.isAlertActive = false;
      this.isLoadingAudio = false;
      this.currentEventKey = null;

      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }

      this.isVibrating = false;
      Vibration.cancel();

      if (this.hapticInterval) {
        clearInterval(this.hapticInterval);
        this.hapticInterval = null;
      }

      await this.unloadAllSounds();
      console.log('[RYDO SOS] Alert ended: All audio and vibration strictly stopped');
    } catch (e) {
      console.log('RYDO SOS: Error stopping alert:', e);
    }
  }
}

export const sosEmergencyManager = new SosEmergencyManager();
