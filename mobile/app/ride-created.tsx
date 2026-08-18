import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Share,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

export default function RideCreatedScreen() {
  const { rideName, captainName, rideCode } = useLocalSearchParams<{
    rideName?: string;
    captainName?: string;
    rideCode?: string;
  }>();

  const displayRideName = rideName || 'RYDO RIDE';
  const displayCaptain = captainName || 'Captain';
  const displayRideCode = rideCode || '------';

  const shareRide = async () => {
    try {
      await Share.share({
        message:
          `Join my RYDO ride!\n\n` +
          `Ride: ${displayRideName}\n` +
          `Ride Code: ${displayRideCode}\n\n` +
          `Open RYDO and enter this code to join.`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

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

          <Text style={styles.headerNumber}>
            04
          </Text>

        </View>


        {/* SCROLLABLE CONTENT */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >

          {/* MAIN */}

          <View style={styles.main}>

            <Text style={styles.smallLabel}>
              RIDE CREATED
            </Text>

            <Text style={styles.title}>
              YOUR CREW
            </Text>

            <Text style={styles.title}>
              STARTS HERE.
            </Text>

            <View style={styles.line} />


            {/* RIDE NAME */}

            <View style={styles.rideSection}>

              <Text style={styles.rideLabel}>
                RIDE
              </Text>

              <Text style={styles.rideName}>
                {displayRideName}
              </Text>

            </View>


            {/* RIDE CODE */}

            <View style={styles.codeSection}>

              <Text style={styles.codeLabel}>
                YOUR RIDE CODE
              </Text>

              <View style={styles.codeBox}>

                <Text style={styles.code}>
                  {displayRideCode}
                </Text>

              </View>

              <Text style={styles.codeDescription}>
                Share this code with your crew
                {'\n'}
                so they can join your ride.
              </Text>

            </View>


            {/* CAPTAIN */}

            <View style={styles.captainSection}>

              <View style={styles.captainNumber}>

                <Text style={styles.numberText}>
                  01
                </Text>

              </View>

              <View style={styles.captainContent}>

                <Text style={styles.captainLabel}>
                  CAPTAIN
                </Text>

                <Text style={styles.captainName}>
                  {displayCaptain}
                </Text>

              </View>

              <View style={styles.captainBadge}>

                <Text style={styles.badgeText}>
                  YOU
                </Text>

              </View>

            </View>


            {/* SHARE BUTTON */}

            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.shareButton}
              onPress={shareRide}
            >

              <Text style={styles.shareButtonText}>
                SHARE RIDE CODE
              </Text>

              <Text style={styles.shareArrow}>
                ↗
              </Text>

            </TouchableOpacity>


            {/* CONTINUE BUTTON */}

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.continueButton}
              onPress={() => {
                router.push({
                  pathname: '/captain-dashboard',
                  params: {
                    rideName: displayRideName,
                    captainName: displayCaptain,
                    rideCode: displayRideCode,
                  },
                });
              }}
            >

              <Text style={styles.continueText}>
                CONTINUE TO RIDE
              </Text>

              <Text style={styles.continueArrow}>
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

          </View>

        </ScrollView>

      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  /* SCREEN */

  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },

  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 25,
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


  /* SCROLL */

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },


  /* MAIN */

  main: {
    paddingTop: 35,
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
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 42,
  },

  line: {
    width: 42,
    height: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 18,
  },


  /* RIDE */

  rideSection: {
    marginTop: 28,
  },

  rideLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 7,
  },

  rideName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
  },


  /* CODE */

  codeSection: {
    marginTop: 25,
  },

  codeLabel: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 9,
  },

  codeBox: {
    height: 72,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  code: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 7,
    marginLeft: 7,
  },

  codeDescription: {
    color: '#666666',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },


  /* CAPTAIN */

  captainSection: {
    flexDirection: 'row',
    alignItems: 'center',

    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#292929',

    marginTop: 23,
    paddingVertical: 15,
  },

  captainNumber: {
    width: 32,
  },

  numberText: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '700',
  },

  captainContent: {
    flex: 1,
  },

  captainLabel: {
    color: '#666666',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },

  captainName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },

  captainBadge: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },


  /* SHARE */

  shareButton: {
    height: 52,
    borderWidth: 1,
    borderColor: '#333333',

    marginTop: 20,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareButtonText: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  shareArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 15,
  },


  /* CONTINUE */

  continueButton: {
    height: 58,
    backgroundColor: '#FFFFFF',

    marginTop: 10,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  continueArrow: {
    color: '#000000',
    fontSize: 23,
    marginLeft: 17,
  },


  /* FOOTER */

  footer: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 10,
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