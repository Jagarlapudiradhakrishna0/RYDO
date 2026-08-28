import * as Speech from 'expo-speech';
import { CommunicationSettings, getCachedSettings } from './communicationSettings';

class TtsService {
  private isSpeaking = false;
  private availableVoices: Speech.Voice[] = [];
  private voicesLoaded = false;

  constructor() {
    this.loadVoices().catch(() => {});
  }

  private async loadVoices() {
    try {
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      this.voicesLoaded = true;
    } catch (e) {
      console.log('[RYDO TTS] Unable to get available voices:', e);
    }
  }

  /**
   * Determine the best voice identifier matching the selected gender preference.
   */
  private async getBestVoice(gender: 'male' | 'female' | 'default'): Promise<string | undefined> {
    if (gender === 'default') return undefined;

    try {
      if (!this.voicesLoaded || this.availableVoices.length === 0) {
        await this.loadVoices();
      }

      if (this.availableVoices.length === 0) return undefined;

      const targetGender = gender.toLowerCase();

      // Check quality / name / identifier hints for gender
      const matchingVoice = this.availableVoices.find((v) => {
        const name = (v.name || '').toLowerCase();
        const id = (v.identifier || '').toLowerCase();
        const quality = ((v as any).quality || '').toLowerCase();

        // Check if voice name or id specifically tags male/female
        if (targetGender === 'female') {
          return (
            name.includes('female') ||
            name.includes('woman') ||
            name.includes('samantha') ||
            name.includes('zira') ||
            name.includes('kavya') ||
            id.includes('female') ||
            id.includes('f0')
          );
        } else if (targetGender === 'male') {
          return (
            name.includes('male') ||
            name.includes('man') ||
            name.includes('david') ||
            name.includes('george') ||
            name.includes('rishi') ||
            id.includes('male') ||
            id.includes('m0')
          );
        }
        return false;
      });

      if (matchingVoice) {
        return matchingVoice.identifier;
      }
    } catch (e) {
      console.log('[RYDO TTS] Voice selection fallback error:', e);
    }

    return undefined;
  }

  /**
   * Speak incoming ride message announcement.
   * Format: "${senderName} sent a message. ${messageText}."
   */
  public async speakMessage(
    senderName: string,
    messageText: string,
    overrideSettings?: CommunicationSettings
  ): Promise<void> {
    try {
      const settings = overrideSettings || getCachedSettings();

      if (!settings.voiceEnabled) {
        return;
      }

      const cleanSender = String(senderName || 'A rider').trim();
      const cleanMessage = String(messageText || '').trim();

      if (!cleanMessage) return;

      const textToSpeak = `${cleanSender} sent a message. ${cleanMessage}.`;

      // Cancel any ongoing speech so new high-priority message plays immediately
      try {
        await Speech.stop();
      } catch (_) {}

      const voiceId = await this.getBestVoice(settings.voiceGender);

      // Pitch adjustment for male/female voice nuance when specific voice ID is not hardware-present
      let pitch = 1.0;
      if (settings.voiceGender === 'female') {
        pitch = 1.15;
      } else if (settings.voiceGender === 'male') {
        pitch = 0.88;
      }

      const options: Speech.SpeechOptions = {
        language: 'en-US',
        pitch,
        rate: 0.95, // Clear, intelligible riding announcement speed
        voice: voiceId,
        onStart: () => {
          this.isSpeaking = true;
          console.log('[RYDO TTS] Started voice announcement for:', cleanSender);
        },
        onDone: () => {
          this.isSpeaking = false;
        },
        onStopped: () => {
          this.isSpeaking = false;
        },
        onError: (err) => {
          this.isSpeaking = false;
          console.log('[RYDO TTS] Speech playback error:', err);
        },
      };

      Speech.speak(textToSpeak, options);
    } catch (error) {
      console.log('[RYDO TTS] Voice announcement failed safely:', error);
    }
  }

  public async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.isSpeaking = false;
    } catch (_) {}
  }
}

export const ttsService = new TtsService();
