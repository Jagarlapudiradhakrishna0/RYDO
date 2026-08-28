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
import { communicationService, RideMessage } from '@/services/communicationService';

interface CommunicationButtonProps {
  rideCode: string;
  role?: 'captain' | 'rider';
  userName?: string;
  size?: number;
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function CommunicationButton({
  rideCode,
  role = 'rider',
  userName,
  size = 36,
  showLabel = false,
  style,
}: CommunicationButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    communicationService.setActiveRideCode(rideCode);

    const unsubscribe = communicationService.subscribeToMessages(() => {
      // Small unread dot indicator increment
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [rideCode]);

  const handlePress = () => {
    setUnreadCount(0);
    router.push({
      pathname: '/communication' as any,
      params: {
        rideCode: rideCode.toUpperCase().trim(),
        role,
        userName,
      },
    });
  };

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
    >
      <View style={[styles.iconContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={size * 0.55} color="#FFFFFF" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>

      {showLabel && (
        <Text style={styles.label}>MESSAGE</Text>
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
