import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { voiceService } from '@/services/voiceService';

interface VoiceButtonProps {
  rideCode: string;
  role?: 'captain' | 'rider';
  userName?: string;
  memberId?: string;
  size?: number;
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function VoiceButton({
  rideCode,
  role = 'rider',
  userName,
  memberId,
  size = 36,
  showLabel = false,
  style,
}: VoiceButtonProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);

  useEffect(() => {
    const unsubSpeaker = voiceService.onSpeaker((speakerName) => {
      setActiveSpeakerName(speakerName);
    });

    const unsubStatus = voiceService.onStatus((status) => {
      setIsJoined(status === 'connected');
    });

    const unsubGrant = voiceService.onGrant((granted) => {
      setIsSpeaking(granted);
    });

    return () => {
      unsubSpeaker();
      unsubStatus();
      unsubGrant();
    };
  }, []);

  const handlePress = () => {
    router.push({
      pathname: '/voice' as any,
      params: {
        rideCode: rideCode.toUpperCase().trim(),
        role,
        userName,
        memberId,
      },
    });
  };

  // Determine visual state
  const isActive = isSpeaking;
  const hasActivity = isJoined || activeSpeakerName !== null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.button,
        showLabel && styles.buttonWithLabel,
        style,
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="Open Group Voice"
      accessibilityRole="button"
    >
      <View style={[
        styles.iconContainer,
        { width: size, height: size, borderRadius: size / 2 },
        isActive && styles.iconContainerActive,
      ]}>
        <Ionicons
          name={isActive ? 'mic' : 'mic-outline'}
          size={size * 0.55}
          color="#FFFFFF"
        />
        {hasActivity && !isActive && (
          <View style={styles.activityDot} />
        )}
      </View>

      {showLabel && (
        <Text style={styles.label}>VOICE</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    gap: 6,
  },
  iconContainer: {
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  activityDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
