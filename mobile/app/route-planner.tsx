import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { API_URL } from '@/constants/network';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';

export default function RoutePlanner() {
  const {
    rideName,
    captainName,
    rideCode,
  } = useLocalSearchParams<{
    rideName?: string;
    captainName?: string;
    rideCode?: string;
  }>();

  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [newStop, setNewStop] = useState('');
  const [saving, setSaving] = useState(false);

  /* =========================
     ADD STOP
  ========================= */

  const addStop = () => {
    const stop = newStop.trim();

    if (!stop) {
      return;
    }

    setStops((currentStops) => [
      ...currentStops,
      stop,
    ]);

    setNewStop('');
  };

  /* =========================
     REMOVE STOP
  ========================= */

  const removeStop = (index: number) => {
    setStops((currentStops) =>
      currentStops.filter((_, i) => i !== index)
    );
  };

  /* =========================
     CONFIRM + SAVE ROUTE
  ========================= */

  const confirmRoute = async () => {
    const start = startLocation.trim();
    const end = destination.trim();

    if (!start || !end) {
      Alert.alert(
        'Route Required',
        'Please enter both the start location and destination.'
      );
      return;
    }

    if (!rideCode) {
      Alert.alert(
        'Ride Error',
        'Ride code is missing. Please return to the Captain Dashboard and try again.'
      );
      return;
    }

    if (saving) {
      return;
    }

    try {
      setSaving(true);

      const code = String(rideCode).trim().toUpperCase();

      console.log('=================================');
      console.log('RYDO: Saving route...');
      console.log('Ride Code:', code);
      console.log('Start:', start);
      console.log('Destination:', end);
      console.log('Stops:', stops);
      console.log('API:', `${API_URL}/api/rides/${code}/route`);
      console.log('=================================');

      const response = await fetch(
        `${API_URL}/api/rides/${encodeURIComponent(code)}/route`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            start: start,
            destination: end,
            stops: stops,
          }),
        }
      );

      const responseText = await response.text();

      console.log(
        'RYDO: Backend status:',
        response.status
      );

      console.log(
        'RYDO: Backend response:',
        responseText
      );

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        console.log(
          'RYDO: Backend did not return JSON'
        );

        Alert.alert(
          'Server Error',
          'The backend returned an invalid response.'
        );

        return;
      }

      if (!response.ok || !data.success) {
        console.log(
          'RYDO: Route save failed:',
          data.message
        );

        Alert.alert(
          'Route Not Saved',
          data.message ||
            'The route could not be saved to the backend.'
        );

        return;
      }

      console.log(
        '================================='
      );
      console.log(
        'RYDO: ROUTE SAVED SUCCESSFULLY'
      );
      console.log(
        'Ride Code:',
        data.ride?.rideCode
      );
      console.log(
        'Start:',
        data.ride?.route?.start
      );
      console.log(
        'Destination:',
        data.ride?.route?.destination
      );
      console.log(
        'Stops:',
        data.ride?.route?.stops
      );
      console.log(
        '================================='
      );

      Alert.alert(
        'Route Confirmed',
        `${start} → ${end}`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.log(
        'RYDO: Failed to save route:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Could not connect to the RYDO backend. Make sure the backend is running and the IP address is correct.'
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     RETURN UI
  ========================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <View style={styles.container}>

        {/* HEADER */}

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backArrow}>
              ←
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            RYDO
          </Text>

          <ProfileHeaderButton size={34} />

        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.scrollContent
          }
        >

          {/* TITLE */}

          <View style={styles.titleSection}>

            <Text style={styles.smallLabel}>
              CAPTAIN CONTROL
            </Text>

            <Text style={styles.title}>
              PLAN THE
            </Text>

            <Text style={styles.title}>
              JOURNEY.
            </Text>

            <View style={styles.line} />

            {rideCode && (
              <Text style={styles.rideCodeText}>
                RIDE CODE •{' '}
                {String(rideCode).toUpperCase()}
              </Text>
            )}

          </View>

          {/* START */}

          <View style={styles.section}>

            <Text style={styles.label}>
              START LOCATION
            </Text>

            <View style={styles.inputRow}>

              <Text style={styles.locationNumber}>
                A
              </Text>

              <TextInput
                value={startLocation}
                onChangeText={setStartLocation}
                style={styles.input}
                placeholder="Your starting point"
                placeholderTextColor="#555555"
                autoCapitalize="words"
                returnKeyType="next"
              />

            </View>

          </View>

          {/* DESTINATION */}

          <View style={styles.section}>

            <Text style={styles.label}>
              DESTINATION
            </Text>

            <View style={styles.inputRow}>

              <Text style={styles.destinationNumber}>
                B
              </Text>

              <TextInput
                value={destination}
                onChangeText={setDestination}
                style={styles.input}
                placeholder="Where are you going?"
                placeholderTextColor="#555555"
                autoCapitalize="words"
                returnKeyType="done"
              />

            </View>

          </View>

          {/* STOPS */}

          <View style={styles.section}>

            <View style={styles.stopHeader}>

              <Text style={styles.label}>
                STOPS / WAYPOINTS
              </Text>

              <Text style={styles.optional}>
                OPTIONAL
              </Text>

            </View>

            {/* EXISTING STOPS */}

            {stops.map((stop, index) => (

              <View
                key={`${stop}-${index}`}
                style={styles.stopItem}
              >

                <View style={styles.stopLeft}>

                  <Text style={styles.stopNumber}>
                    {index + 1}
                  </Text>

                  <Text style={styles.stopName}>
                    {stop}
                  </Text>

                </View>

                <TouchableOpacity
                  onPress={() =>
                    removeStop(index)
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.remove}>
                    ×
                  </Text>
                </TouchableOpacity>

              </View>

            ))}

            {/* ADD STOP */}

            <View style={styles.addStopRow}>

              <TextInput
                value={newStop}
                onChangeText={setNewStop}
                style={styles.stopInput}
                placeholder="Add a stop..."
                placeholderTextColor="#555555"
                autoCapitalize="words"
                onSubmitEditing={addStop}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={styles.addButton}
                onPress={addStop}
                activeOpacity={0.7}
              >

                <Text style={styles.addText}>
                  +
                </Text>

              </TouchableOpacity>

            </View>

          </View>

          {/* ROUTE PREVIEW */}

          <View style={styles.preview}>

            <Text style={styles.previewLabel}>
              ROUTE PREVIEW
            </Text>

            <View style={styles.previewLine} />

            {/* START */}

            <View style={styles.previewPoint}>

              <View style={styles.point} />

              <Text
                style={[
                  styles.previewText,
                  !startLocation.trim() &&
                    styles.previewPlaceholder,
                ]}
              >
                {startLocation.trim() ||
                  'START LOCATION'}
              </Text>

            </View>

            {/* STOPS */}

            {stops.map((stop, index) => (

              <View
                key={`preview-${index}`}
                style={styles.previewPoint}
              >

                <View
                  style={[
                    styles.point,
                    styles.stopPoint,
                  ]}
                />

                <Text style={styles.previewText}>
                  {stop}
                </Text>

              </View>

            ))}

            {/* DESTINATION */}

            <View style={styles.previewPoint}>

              <View
                style={[
                  styles.point,
                  styles.destinationPoint,
                ]}
              />

              <Text
                style={[
                  styles.previewText,
                  !destination.trim() &&
                    styles.previewPlaceholder,
                ]}
              >
                {destination.trim() ||
                  'DESTINATION'}
              </Text>

            </View>

          </View>

          {/* INFORMATION */}

          <View style={styles.infoBox}>

            <Text style={styles.infoNumber}>
              01
            </Text>

            <View style={styles.infoContent}>

              <Text style={styles.infoTitle}>
                CAPTAIN CONTROLS THE ROUTE
              </Text>

              <Text style={styles.infoDescription}>
                The captain selects the complete
                journey. All riders will receive the
                same route automatically and will not
                need to select a destination.
              </Text>

            </View>

          </View>

          {/* CONFIRM */}

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.confirmButton,
              (
                !startLocation.trim() ||
                !destination.trim() ||
                saving
              ) &&
                styles.disabledButton,
            ]}
            onPress={confirmRoute}
            disabled={
              !startLocation.trim() ||
              !destination.trim() ||
              saving
            }
          >

            <Text
              style={[
                styles.confirmText,
                (
                  !startLocation.trim() ||
                  !destination.trim() ||
                  saving
                ) &&
                  styles.disabledText,
              ]}
            >
              {saving
                ? 'SAVING ROUTE...'
                : 'CONFIRM ROUTE'}
            </Text>

            {!saving && (
              <Text
                style={[
                  styles.confirmArrow,
                  (
                    !startLocation.trim() ||
                    !destination.trim()
                  ) &&
                    styles.disabledText,
                ]}
              >
                →
              </Text>
            )}

          </TouchableOpacity>

          {/* FOOTER */}

          <View style={styles.footer}>

            <View style={styles.footerLine} />

            <Text style={styles.footerText}>
              RYDO • RIDE DIFFERENT
            </Text>

          </View>

        </ScrollView>

      </View>
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
    paddingHorizontal: 25,
  },

  scrollContent: {
    paddingBottom: 40,
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
    marginTop: 38,
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

  rideCodeText: {
    color: '#555555',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 14,
  },


  /* SECTION */

  section: {
    marginTop: 30,
  },

  label: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 9,
  },

  inputRow: {
    height: 58,
    borderWidth: 1,
    borderColor: '#303030',
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    width: 45,
    textAlign: 'center',
  },

  destinationNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    width: 45,
    textAlign: 'center',
  },

  input: {
    flex: 1,
    height: 58,
    color: '#FFFFFF',
    fontSize: 15,
    paddingRight: 15,
  },


  /* STOPS */

  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  optional: {
    color: '#444444',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },

  addStopRow: {
    height: 52,
    borderWidth: 1,
    borderColor: '#292929',
    flexDirection: 'row',
    alignItems: 'center',
  },

  stopInput: {
    flex: 1,
    height: 50,
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 15,
  },

  addButton: {
    width: 52,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#292929',
  },

  addText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '300',
  },

  stopItem: {
    minHeight: 50,
    borderTopWidth: 1,
    borderColor: '#242424',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  stopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  stopNumber: {
    color: '#555555',
    width: 35,
    fontSize: 9,
    fontWeight: '700',
  },

  stopName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  remove: {
    color: '#777777',
    fontSize: 22,
    paddingHorizontal: 10,
  },


  /* PREVIEW */

  preview: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#292929',
    padding: 18,
  },

  previewLabel: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  previewLine: {
    position: 'absolute',
    left: 28,
    top: 58,
    bottom: 38,
    width: 1,
    backgroundColor: '#333333',
  },

  previewPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },

  point: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 15,
  },

  stopPoint: {
    width: 7,
    height: 7,
    backgroundColor: '#777777',
  },

  destinationPoint: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },

  previewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  previewPlaceholder: {
    color: '#555555',
  },


  /* INFO */

  infoBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#292929',
    padding: 18,
    marginTop: 25,
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  infoDescription: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },


  /* BUTTON */

  confirmButton: {
    height: 60,
    backgroundColor: '#FFFFFF',
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#292929',
  },

  confirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  confirmArrow: {
    color: '#000000',
    fontSize: 24,
    marginLeft: 17,
  },

  disabledText: {
    color: '#444444',
  },


  /* FOOTER */

  footer: {
    alignItems: 'center',
    paddingTop: 30,
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