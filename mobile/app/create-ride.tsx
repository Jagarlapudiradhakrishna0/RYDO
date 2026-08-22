import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API_URL } from '@/constants/network';
import { getCurrentUser } from '@/constants/auth';

export default function CreateRideScreen() {
  const currentUser = getCurrentUser();
  const [rideName, setRideName] = useState('');
  const [captainName, setCaptainName] = useState(currentUser?.name || '');
  const [isCreating, setIsCreating] = useState(false);

  const createRide = async () => {
    if (
      isCreating ||
      !rideName.trim() ||
      !captainName.trim()
    ) {
      return;
    }

    const requestUrl =
      `${API_URL}/api/rides`;

    if (!API_URL) {
      console.log(
        'RYDO: Backend connection failed'
      );
      console.log(
        'RYDO: API URL:',
        API_URL
      );
      console.log(
        'RYDO: Request:',
        requestUrl
      );
      return;
    }

    setIsCreating(true);

    try {
      console.log('RYDO: Creating ride...');
      console.log('RYDO: API URL:', API_URL);

      const payload = {
        rideName: rideName.trim(),
        captainName: captainName.trim(),
      };

      console.log('RYDO: Creating ride:', payload);
      console.log('RYDO: Request:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('RYDO: Response status:', response.status);

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.log('RYDO: Create ride failed:', data.message);
        return;
      }

      console.log('RYDO: Ride created');
      console.log('Ride Code:', data.ride.rideCode);
      console.log('Ride Name:', data.ride.rideName);
      console.log('Captain:', data.ride.captainName);

      router.push({
        pathname: '/ride-created',
        params: {
          rideName: data.ride.rideName,
          captainName: data.ride.captainName,
          rideCode: data.ride.rideCode,
        },
      });
    } catch (error) {
      console.log('RYDO: Backend connection failed');
      console.log('RYDO: API URL:', API_URL);
      console.log('RYDO: Request:', requestUrl);
      console.log(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* HEADER */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              RYDO
            </Text>

            <Text style={styles.headerNumber}>
              03
            </Text>
          </View>


          {/* TITLE */}

          <View style={styles.titleSection}>
            <Text style={styles.smallLabel}>
              CREATE YOUR RIDE
            </Text>

            <Text style={styles.title}>
              LEAD THE
            </Text>

            <Text style={styles.title}>
              JOURNEY.
            </Text>

            <View style={styles.line} />
          </View>


          {/* FORM */}

          <View style={styles.form}>

            <Text style={styles.label}>
              RIDE NAME
            </Text>

            <TextInput
              value={rideName}
              onChangeText={setRideName}
              style={styles.input}
              placeholder="Weekend Ride"
              placeholderTextColor="#555555"
              autoCapitalize="words"
              selectionColor="#FFFFFF"
            />


            <Text style={styles.label}>
              YOUR NAME
            </Text>

            <TextInput
              value={captainName}
              onChangeText={setCaptainName}
              style={styles.input}
              placeholder="Captain name"
              placeholderTextColor="#555555"
              autoCapitalize="words"
              selectionColor="#FFFFFF"
            />

          </View>


          {/* CAPTAIN INFORMATION */}

          <View style={styles.infoBox}>

            <Text style={styles.infoNumber}>
              01
            </Text>

            <View style={styles.infoContent}>

              <Text style={styles.infoTitle}>
                YOU ARE THE CAPTAIN
              </Text>

              <Text style={styles.infoDescription}>
                The person who creates the ride
                automatically becomes the Captain.
              </Text>

            </View>

          </View>


          {/* CREATE BUTTON */}

          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.createButton,
              (isCreating ||
                !rideName.trim() ||
                !captainName.trim()) &&
                styles.createButtonDisabled,
            ]}
            onPress={createRide}
            disabled={
              isCreating ||
              !rideName.trim() ||
              !captainName.trim()
            }
          >
            <Text
              style={[
                styles.createButtonText,
                (isCreating ||
                  !rideName.trim() ||
                  !captainName.trim()) &&
                  styles.disabledText,
              ]}
            >
              {isCreating ? 'CREATING...' : 'CREATE RIDE'}
            </Text>

            <Text
              style={[
                styles.createButtonArrow,
                (isCreating ||
                  !rideName.trim() ||
                  !captainName.trim()) &&
                  styles.disabledText,
              ]}
            >
              →
            </Text>
          </TouchableOpacity>


          {/* FOOTER */}

          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Text style={styles.footerText}>
              RYDO • RIDE DIFFERENT
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 30,
  },


  /* HEADER */

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },

  backArrow: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 5,
  },

  headerNumber: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },


  /* TITLE */

  titleSection: {
    marginTop: 42,
  },

  smallLabel: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 18,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 45,
  },

  line: {
    width: 42,
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 18,
  },


  /* FORM */

  form: {
    marginTop: 34,
  },

  label: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 0,
  },


  /* CAPTAIN INFORMATION */

  infoBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    padding: 18,
    marginTop: 30,
  },

  infoNumber: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    marginRight: 18,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },

  infoDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },


  /* BUTTON */

  createButton: {
    height: 60,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  createButtonDisabled: {
    borderColor: '#333333',
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  disabledText: {
    color: '#444444',
  },

  createButtonArrow: {
    color: '#FFFFFF',
    fontSize: 25,
    marginLeft: 18,
  },


  /* FOOTER */

  footer: {
    marginTop: 'auto',
    paddingTop: 30,
    alignItems: 'center',
  },

  footerLine: {
    width: 30,
    height: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },

  footerText: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },

});