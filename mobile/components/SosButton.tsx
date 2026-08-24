import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Socket } from 'socket.io-client';
import { getCurrentUser } from '../constants/auth';
import { API_URL } from '../constants/network';

interface SosButtonProps {
  rideCode: string;
  role: 'captain' | 'rider';
  userName: string;
  userId?: string;
  socket?: Socket | null;
  onSosSent?: (sosEvent: any) => void;
  style?: any;
}

export const SosButton: React.FC<SosButtonProps> = ({
  rideCode,
  role,
  userName,
  userId,
  socket,
  onSosSent,
  style,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePress = () => {
    Alert.alert(
      'Send SOS Alert?',
      'This will immediately alert everyone in your ride and share your current location.',
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'SEND SOS',
          style: 'destructive',
          onPress: triggerSosAlert,
        },
      ],
      { cancelable: true }
    );
  };

  const triggerSosAlert = async () => {
    if (!rideCode) return;

    try {
      setLoading(true);
      console.log('[RYDO SOS] Triggered by:', userName, `(${role})`);

      // 1. Obtain real fresh current GPS location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to send your SOS location.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const currentUser = getCurrentUser();
      const finalUserId = userId || currentUser?._id || `user-${Date.now()}`;
      const code = String(rideCode).toUpperCase().trim();

      console.log('[RYDO SOS] Location obtained:', { lat, lng });

      // 2. Send SOS via HTTP endpoint
      const response = await fetch(`${API_URL}/api/rides/${encodeURIComponent(code)}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideCode: code,
          userId: finalUserId,
          role,
          name: userName,
          riderName: userName,
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      // 3. Emit via Socket.IO for instantaneous broadcast
      if (socket && socket.connected) {
        socket.emit('triggerSos', {
          rideCode: code,
          userId: finalUserId,
          role,
          name: userName,
          riderName: userName,
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
        });
      }

      if (data.success) {
        console.log('[RYDO SOS] Saved on backend');
        if (onSosSent) {
          onSosSent(data.sos);
        }
        Alert.alert(
          '🚨 SOS ALERT SENT',
          'Your emergency location has been shared with all members of this ride.'
        );
      } else {
        throw new Error(data.message || 'Failed to trigger SOS');
      }
    } catch (error) {
      console.error('RYDO: SOS trigger error:', error);
      Alert.alert('SOS Error', 'Could not broadcast SOS alert. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.icon}>🚨</Text>
          <View style={styles.textContainer}>
            <Text style={styles.buttonText}>SOS EMERGENCY</Text>
            <Text style={styles.subText}>Tap to alert ride crew</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
  },
});
