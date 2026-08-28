import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import MessagePopup from '@/components/MessagePopup';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <MessagePopup />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1013',
  },
});