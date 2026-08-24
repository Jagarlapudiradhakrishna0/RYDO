import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { getCurrentUser } from '@/constants/auth';
import { Ionicons } from '@expo/vector-icons';

interface ProfileHeaderButtonProps {
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}

export function ProfileHeaderButton({
  style,
  color = '#FFFFFF',
  size = 38,
}: ProfileHeaderButtonProps) {
  const currentUser = getCurrentUser();
  const initial = currentUser?.name?.trim()?.charAt(0)?.toUpperCase() || '';

  const handlePress = () => {
    router.push('/profile');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Profile and Settings"
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        {initial ? (
          <Text style={[styles.initialText, { fontSize: Math.round(size * 0.42) }]}>
            {initial}
          </Text>
        ) : (
          <Ionicons name="person-outline" size={Math.round(size * 0.5)} color={color} />
        )}
      </View>
      <View style={styles.statusIndicator} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#30D158',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
});

export default ProfileHeaderButton;
