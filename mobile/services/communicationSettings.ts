import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceGender = 'male' | 'female' | 'default';

export interface CommunicationSettings {
  voiceEnabled: boolean;
  voiceGender: VoiceGender;
  soundEnabled: boolean;
  importantAlertsOnly: boolean;
}

const SETTINGS_STORAGE_KEY = '@rydo_communication_settings';

const DEFAULT_SETTINGS: CommunicationSettings = {
  voiceEnabled: true,
  voiceGender: 'default',
  soundEnabled: true,
  importantAlertsOnly: false,
};

let cachedSettings: CommunicationSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: CommunicationSettings) => void>();

export async function getCommunicationSettings(): Promise<CommunicationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = {
        voiceEnabled: typeof parsed.voiceEnabled === 'boolean' ? parsed.voiceEnabled : DEFAULT_SETTINGS.voiceEnabled,
        voiceGender: ['male', 'female', 'default'].includes(parsed.voiceGender) ? parsed.voiceGender : DEFAULT_SETTINGS.voiceGender,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
        importantAlertsOnly: typeof parsed.importantAlertsOnly === 'boolean' ? parsed.importantAlertsOnly : DEFAULT_SETTINGS.importantAlertsOnly,
      };
    }
  } catch (error) {
    console.log('[RYDO COMM SETTINGS] Error reading settings from storage:', error);
  }
  return cachedSettings;
}

export function getCachedSettings(): CommunicationSettings {
  return cachedSettings;
}

export async function updateCommunicationSettings(
  partial: Partial<CommunicationSettings>
): Promise<CommunicationSettings> {
  try {
    cachedSettings = {
      ...cachedSettings,
      ...partial,
    };
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachedSettings));
    listeners.forEach((listener) => {
      try {
        listener(cachedSettings);
      } catch (e) {
        console.log('[RYDO COMM SETTINGS] Listener error:', e);
      }
    });
  } catch (error) {
    console.log('[RYDO COMM SETTINGS] Error writing settings to storage:', error);
  }
  return cachedSettings;
}

export function subscribeToCommunicationSettings(
  callback: (settings: CommunicationSettings) => void
): () => void {
  listeners.add(callback);
  callback(cachedSettings);
  return () => {
    listeners.delete(callback);
  };
}

// Initial load into memory
getCommunicationSettings().catch(() => {});
