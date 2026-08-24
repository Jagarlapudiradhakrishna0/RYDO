import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SosEvent, sosEmergencyManager } from '../services/sosService';

interface SosEmergencyOverlayProps {
  visible: boolean;
  sosEvent: SosEvent | null;
  currentLocation?: { latitude: number; longitude: number } | null;
  onViewLocation: (sos: SosEvent) => void;
  onDismiss: () => void;
}

export const SosEmergencyOverlay: React.FC<SosEmergencyOverlayProps> = ({
  visible,
  sosEvent,
  currentLocation,
  onViewLocation,
  onDismiss,
}) => {
  const [flashActive, setFlashActive] = useState(true);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sosEventId = sosEvent
    ? sosEvent.eventId || sosEvent.sosId || `${sosEvent.userId}_${sosEvent.triggeredAt}`
    : null;

  useEffect(() => {
    if (!visible || !sosEventId) {
      sosEmergencyManager.stopEmergencyAlerts();
      return;
    }

    console.log('[RYDO SOS] Alert started for event:', sosEventId);

    // 1. Start audio and vibration alerts
    sosEmergencyManager.startEmergencyAudio(sosEventId);
    sosEmergencyManager.startEmergencyVibration();

    // 2. Start 10-second Red Screen Flash Animation
    setFlashActive(true);
    const flashLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 0.65,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0.05,
          duration: 400,
          useNativeDriver: false,
        }),
      ])
    );
    flashLoop.start();

    // Pulse animation for the emergency badge
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Stop red screen flash strictly after 10 seconds per specification
    const flashTimer = setTimeout(() => {
      flashLoop.stop();
      setFlashActive(false);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
      console.log('[RYDO SOS] 10-second red flash completed');
    }, 10000);

    return () => {
      clearTimeout(flashTimer);
      flashLoop.stop();
      pulseLoop.stop();
      sosEmergencyManager.stopEmergencyAlerts();
    };
  }, [visible, sosEventId]);

  if (!visible || !sosEvent) return null;

  const senderName = sosEvent.name || sosEvent.riderName || 'Ride Member';
  const roleLabel = (sosEvent.role || 'RIDER').toUpperCase();
  const lat = sosEvent.location?.latitude ?? sosEvent.latitude;
  const lng = sosEvent.location?.longitude ?? sosEvent.longitude;

  // Calculate approximate straight-line distance if current location is available
  let distanceKm: string | null = null;
  if (currentLocation && lat && lng) {
    const dLat = ((lat - currentLocation.latitude) * Math.PI) / 180;
    const dLon = ((lng - currentLocation.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((currentLocation.latitude * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 6371 * c;
    distanceKm = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
  }

  const handleAcknowledge = () => {
    console.log('[RYDO SOS] Alert dismissed');
    sosEmergencyManager.stopEmergencyAlerts();
    onDismiss();
  };

  const handleViewLocation = () => {
    console.log('[RYDO SOS] Map focused on emergency location');
    sosEmergencyManager.stopEmergencyAlerts();
    onViewLocation(sosEvent);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      {/* Red Screen Flashing Overlay */}
      {flashActive && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flashOverlay,
            {
              backgroundColor: flashAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255,0,0,0)', 'rgba(255,0,0,0.7)'],
              }),
            },
          ]}
        />
      )}

      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Top Header Badge */}
          <Animated.View
            style={[
              styles.headerBadge,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.headerIcon}>🚨</Text>
            <Text style={styles.headerTitle}>SOS ALERT</Text>
            <Text style={styles.headerIcon}>🚨</Text>
          </Animated.View>

          {/* Emergency User Info */}
          <Text style={styles.victimName}>
            {senderName.toUpperCase()} NEEDS HELP
          </Text>

          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>

          {/* Location Box */}
          <View style={styles.locationContainer}>
            <Text style={styles.locationLabel}>EMERGENCY LOCATION</Text>
            <Text style={styles.locationCoords}>
              {lat?.toFixed(5)}, {lng?.toFixed(5)}
            </Text>
            {distanceKm && (
              <Text style={styles.distanceText}>
                📍 Distance from you: <Text style={styles.distanceHighlight}>{distanceKm}</Text>
              </Text>
            )}
          </View>

          {/* Extra Emergency Contact Details if available */}
          {(sosEvent.emergencyContact?.name || sosEvent.bikeNumber || sosEvent.bloodGroup) && (
            <View style={styles.detailsBox}>
              {sosEvent.bikeNumber ? (
                <Text style={styles.detailRow}>
                  🏍️ <Text style={styles.detailLabel}>Bike:</Text> {sosEvent.bikeNumber}
                </Text>
              ) : null}
              {sosEvent.bloodGroup ? (
                <Text style={styles.detailRow}>
                  🩸 <Text style={styles.detailLabel}>Blood Group:</Text> {sosEvent.bloodGroup}
                </Text>
              ) : null}
              {sosEvent.emergencyContact?.name ? (
                <Text style={styles.detailRow}>
                  📞 <Text style={styles.detailLabel}>Emergency Contact:</Text>{' '}
                  {sosEvent.emergencyContact.name}{' '}
                  {sosEvent.emergencyContact.phoneNumber ? `(${sosEvent.emergencyContact.phoneNumber})` : ''}
                </Text>
              ) : null}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.viewLocationButton}
              activeOpacity={0.85}
              onPress={handleViewLocation}
            >
              <Text style={styles.viewLocationButtonText}>VIEW LOCATION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissButton}
              activeOpacity={0.8}
              onPress={handleAcknowledge}
            >
              <Text style={styles.dismissButtonText}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalCard: {
    width: Math.min(width - 32, 400),
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#EF4444',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 20,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 30,
    marginBottom: 16,
  },
  headerIcon: {
    fontSize: 20,
    marginHorizontal: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  victimName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  rolePill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 18,
  },
  rolePillText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  locationContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  locationCoords: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  distanceText: {
    color: '#E5E7EB',
    fontSize: 13,
    marginTop: 6,
  },
  distanceHighlight: {
    color: '#34D399',
    fontWeight: '800',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  detailRow: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 4,
  },
  detailLabel: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  buttonRow: {
    width: '100%',
    gap: 10,
  },
  viewLocationButton: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  viewLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dismissButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dismissButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
