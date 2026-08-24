import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API_URL } from '@/constants/network';
import { getCurrentUser } from '@/constants/auth';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';

/* =====================================================
   BACKEND
===================================================== */

/* =====================================================
   JOIN RIDE
===================================================== */

export default function JoinRide() {
  const currentUser = getCurrentUser();
  const [riderName, setRiderName] = useState(currentUser?.name || '');
  const [rideCode, setRideCode] = useState('');
  const [loading, setLoading] = useState(false);

  /* ===================================================
     JOIN RIDE
  =================================================== */

  const handleJoinRide = async () => {

    const name = riderName.trim();
    const code = rideCode.trim().toUpperCase();

    /* -----------------------------------------------
       VALIDATION
    ----------------------------------------------- */

    if (!name) {
      Alert.alert(
        'Rider Name Required',
        'Please enter your name.'
      );
      return;
    }

    if (!code) {
      Alert.alert(
        'Ride Code Required',
        'Please enter the ride code.'
      );
      return;
    }

    if (code.length !== 6) {
      Alert.alert(
        'Invalid Ride Code',
        'Ride code must contain 6 characters.'
      );
      return;
    }

    try {

      setLoading(true);

      console.log(
        'RYDO: Joining ride'
      );

      console.log(
        'RYDO: Rider:',
        name
      );

      console.log(
        'RYDO: Ride code:',
        code
      );

      /* ---------------------------------------------
         BACKEND REQUEST
      --------------------------------------------- */

      const currentUserId = currentUser?._id || null;

      const response = await fetch(
        `${API_URL}/api/rides/join`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            rideCode: code,
            riderName: name,
            userId: currentUserId,
          }),
        }
      );

      console.log(
        'RYDO: Join status:',
        response.status
      );

      const data =
        await response.json();

      console.log(
        'RYDO: Join response:',
        data
      );

      /* ---------------------------------------------
         ERROR
      --------------------------------------------- */

      if (
        !response.ok ||
        !data.success
      ) {

        Alert.alert(
          'Unable to Join',
          data.message ||
            'Ride not found. Please check the ride code.'
        );

        return;
      }

      /* ---------------------------------------------
         SUCCESS
      --------------------------------------------- */

      console.log(
        'RYDO: Successfully joined ride'
      );

      console.log(
        'RYDO: Ride:',
        data.ride
      );

      /* ---------------------------------------------
         OPEN RIDER DASHBOARD
      --------------------------------------------- */

      const joinedRider = (data.ride?.riders || []).find(
        (r: any) =>
          (currentUserId && (r.userId === currentUserId || r._id === currentUserId)) ||
          r.name?.toLowerCase() === name.toLowerCase()
      );
      const finalRiderId = joinedRider?._id || joinedRider?.userId || currentUserId || '';

      router.replace({
        pathname: '/rider-dashboard',
        params: {
          rideCode: code,
          riderName: name,
          userId: finalRiderId,

          rideName:
            data.ride?.rideName || '',

          captainName:
            data.ride?.captainName || '',
        },
      });

    } catch (error) {

      console.log(
        'RYDO: Join ride error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Could not connect to the RYDO server. Make sure the backend is running.'
      );

    } finally {

      setLoading(false);

    }
  };

  /* ===================================================
     RENDER
  =================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >

      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View style={styles.header}>

          <View style={styles.headerLeft}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backArrow}>
                ←
              </Text>
            </TouchableOpacity>

            <View>
              <Text style={styles.brand}>
                RYDO
              </Text>

              <Text style={styles.mode}>
                RIDER MODE
              </Text>
            </View>
          </View>

          <ProfileHeaderButton size={34} />

        </View>

        {/* =================================================
            CONTENT
        ================================================= */}

        <View style={styles.content}>

          <Text style={styles.eyebrow}>
            JOIN A RIDE
          </Text>

          <Text style={styles.title}>
            Enter your ride details
          </Text>

          <Text style={styles.description}>
            Enter your name and the
            6-character ride code shared
            by your captain.
          </Text>

          {/* =================================================
              RIDER NAME
          ================================================= */}

          <View style={styles.field}>

            <Text style={styles.fieldLabel}>
              YOUR NAME
            </Text>

            <TextInput
              value={riderName}
              onChangeText={setRiderName}
              placeholder="Enter your name"
              placeholderTextColor="#555555"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />

          </View>

          {/* =================================================
              RIDE CODE
          ================================================= */}

          <View style={styles.field}>

            <Text style={styles.fieldLabel}>
              RIDE CODE
            </Text>

            <TextInput
              value={rideCode}
              onChangeText={(text) =>
                setRideCode(
                  text
                    .replace(
                      /[^a-zA-Z0-9]/g,
                      ''
                    )
                    .toUpperCase()
                    .slice(0, 6)
                )
              }
              placeholder="ABC123"
              placeholderTextColor="#555555"
              style={[
                styles.input,
                styles.codeInput,
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              editable={!loading}
            />

            <Text style={styles.codeHint}>
              6 CHARACTERS
            </Text>

          </View>

          {/* =================================================
              JOIN BUTTON
          ================================================= */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.joinButton,
              loading &&
                styles.joinButtonDisabled,
            ]}
            onPress={handleJoinRide}
            disabled={loading}
          >

            {loading ? (

              <ActivityIndicator
                size="small"
                color="#000000"
              />

            ) : (

              <>
                <Text style={styles.joinButtonText}>
                  JOIN RIDE
                </Text>

                <Text style={styles.joinArrow}>
                  →
                </Text>
              </>

            )}

          </TouchableOpacity>

          {/* =================================================
              INFO
          ================================================= */}

          <View style={styles.infoBox}>

            <View style={styles.infoNumber}>
              <Text style={styles.infoNumberText}>
                01
              </Text>
            </View>

            <View style={styles.infoContent}>

              <Text style={styles.infoTitle}>
                GET THE CODE
              </Text>

              <Text style={styles.infoText}>
                Ask your group captain for
                the ride code.
              </Text>

            </View>

          </View>

          <View style={styles.infoBox}>

            <View style={styles.infoNumber}>
              <Text style={styles.infoNumberText}>
                02
              </Text>
            </View>

            <View style={styles.infoContent}>

              <Text style={styles.infoTitle}>
                JOIN THE CREW
              </Text>

              <Text style={styles.infoText}>
                Once connected, you can
                follow the captain and
                view the journey.
              </Text>

            </View>

          </View>

        </View>

        {/* =================================================
            FOOTER
        ================================================= */}

        <View style={styles.footer}>

          <View style={styles.footerLine} />

          <Text style={styles.footerText}>
            RYDO • RIDE DIFFERENT
          </Text>

        </View>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },

  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* HEADER */

  header: {
    height: 76,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#171717',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },

  backArrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },

  brand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 5,
  },

  mode: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 3,
  },

  /* CONTENT */

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 35,
  },

  eyebrow: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 10,
    letterSpacing: -0.5,
  },

  description: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 300,
  },

  /* FIELD */

  field: {
    marginTop: 28,
  },

  fieldLabel: {
    color: '#777777',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 9,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#292929',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 15,
    backgroundColor: '#050505',
  },

  codeInput: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
  },

  codeHint: {
    color: '#444444',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 7,
  },

  /* JOIN BUTTON */

  joinButton: {
    height: 56,
    backgroundColor: '#FFFFFF',
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  joinButtonDisabled: {
    opacity: 0.6,
  },

  joinButtonText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },

  joinArrow: {
    color: '#000000',
    fontSize: 20,
    marginLeft: 14,
  },

  /* INFO */

  infoBox: {
    borderTopWidth: 1,
    borderTopColor: '#202020',
    marginTop: 30,
    paddingTop: 18,
    flexDirection: 'row',
  },

  infoNumber: {
    width: 42,
  },

  infoNumberText: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  infoText: {
    color: '#555555',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  /* FOOTER */

  footer: {
    alignItems: 'center',
    paddingBottom: 25,
  },

  footerLine: {
    width: 30,
    height: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },

  footerText: {
    color: '#444444',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 2,
  },

});