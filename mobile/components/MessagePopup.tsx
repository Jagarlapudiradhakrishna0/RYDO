import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { communicationService, RideMessage } from '@/services/communicationService';

export default function MessagePopup() {
  const [currentMessage, setCurrentMessage] = useState<RideMessage | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = communicationService.subscribeToPopups((msg) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setCurrentMessage(msg);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 90,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        dismissPopup();
      }, 6000);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [translateY, opacity]);

  const dismissPopup = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentMessage(null);
    });
  };

  const handleOpen = () => {
    if (!currentMessage) return;
    const { rideCode } = currentMessage;
    dismissPopup();
    router.push({
      pathname: '/communication' as any,
      params: { rideCode },
    });
  };

  if (!currentMessage) return null;

  const isCaptain = currentMessage.senderRole === 'captain';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleOpen}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MESSAGE</Text>
          </View>
          <TouchableOpacity
            onPress={dismissPopup}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={14} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sender}>
          {currentMessage.senderName} {isCaptain ? '(Captain)' : ''} sent a message
        </Text>

        <Text style={styles.body} numberOfLines={2}>
          "{currentMessage.messageText}"
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    zIndex: 999999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 2,
  },
  sender: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
    fontWeight: '500',
  },
  body: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 18,
  },
});
