
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#050505"
      />

      {/* =====================================================
          PREMIUM BLACK BACKGROUND
         ===================================================== */}

      <LinearGradient
        colors={['#050505', '#0B0B0B', '#050505']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle Swiss-style geometric shapes */}

      <View style={styles.circleLarge} />
      <View style={styles.circleMedium} />
      <View style={styles.diagonalShape} />

      {/* Very subtle light */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.lightGlow}
      />

      {/* =====================================================
          MAIN CONTENT
         ===================================================== */}

      <View style={styles.content}>

        {/* =================================================
            RYDO LOGO — CREATED COMPLETELY WITH REACT NATIVE
           ================================================= */}

        <View style={styles.brandArea}>

          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoR}>R</Text>
            </View>
          </View>

          <Text style={styles.brand}>
            R Y D O
          </Text>

          <View style={styles.brandLine} />

          <Text style={styles.tagline}>
            RIDE TOGETHER. STAY CONNECTED.
          </Text>

        </View>

        {/* =================================================
            HERO SECTION
           ================================================= */}

        <View style={styles.hero}>

          <Text style={styles.eyebrow}>
            WELCOME TO RYDO
          </Text>

          <Text style={styles.heroLine}>
            Your Ride.
          </Text>

          <Text style={styles.heroLine}>
            Your Crew.
          </Text>

          <Text style={styles.heroLineMuted}>
            Your Journey.
          </Text>

          {/* Small Swiss-style vertical line */}

          <View style={styles.descriptionRow}>
            <View style={styles.verticalLine} />

            <Text style={styles.description}>
              Connect with your riders.{'\n'}
              Share your location.{'\n'}
              Experience every journey together.
            </Text>
          </View>

        </View>

        {/* =================================================
            PAGE INDICATORS
           ================================================= */}

        <View style={styles.indicators}>

          <View style={styles.activeIndicator} />

          <View style={styles.indicator} />

          <View style={styles.indicator} />

        </View>

        {/* =================================================
            GET STARTED BUTTON
           ================================================= */}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.button}
          onPress={() => router.push('/ride-choice')}
        >

          <View style={styles.buttonContent}>

            <Text style={styles.buttonText}>
              GET STARTED
            </Text>

            <Text style={styles.arrow}>
              →
            </Text>

          </View>

        </TouchableOpacity>

        {/* =================================================
            FOOTER
           ================================================= */}

        <View style={styles.footer}>

          <Text style={styles.footerText}>
            R Y D O
          </Text>

          <View style={styles.footerDot} />

          <Text style={styles.footerText}>
            RIDE DIFFERENT
          </Text>

        </View>

      </View>
    </View>
  );
}


/* =========================================================
   STYLES
   ========================================================= */

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  /* -------------------------------------------------------
     BACKGROUND GEOMETRY
     ------------------------------------------------------- */

  circleLarge: {
    position: 'absolute',

    width: width * 1.35,
    height: width * 1.35,

    borderRadius: width * 0.7,

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.075)',

    right: -width * 0.72,
    top: height * 0.25,

    transform: [
      {
        rotate: '-18deg',
      },
    ],
  },

  circleMedium: {
    position: 'absolute',

    width: width * 0.9,
    height: width * 0.9,

    borderRadius: width * 0.5,

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.045)',

    left: -width * 0.55,
    bottom: height * 0.18,

    transform: [
      {
        rotate: '20deg',
      },
    ],
  },

  diagonalShape: {
    position: 'absolute',

    width: width * 1.5,
    height: height * 0.001,

    backgroundColor: 'rgba(255,255,255,0.07)',

    top: height * 0.48,
    left: -width * 0.25,

    transform: [
      {
        rotate: '-28deg',
      },
    ],
  },

  lightGlow: {
    position: 'absolute',

    width: width * 1.2,
    height: height * 0.55,

    top: -height * 0.1,
    left: -width * 0.25,

    opacity: 0.6,
  },

  /* -------------------------------------------------------
     CONTENT
     ------------------------------------------------------- */

  content: {
    flex: 1,

    paddingHorizontal: 32,

    paddingTop:
      Platform.OS === 'android'
        ? height * 0.055
        : height * 0.065,

    paddingBottom: 25,

    alignItems: 'center',
  },

  /* -------------------------------------------------------
     BRAND
     ------------------------------------------------------- */

  brandArea: {
    alignItems: 'center',
  },

  logoOuter: {
    width: 82,
    height: 82,

    borderRadius: 41,

    borderWidth: 1.5,

    borderColor: '#FFFFFF',

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 15,
  },

  logoInner: {
    width: 68,
    height: 68,

    borderRadius: 34,

    backgroundColor: '#0A0A0A',

    alignItems: 'center',
    justifyContent: 'center',
  },

  logoR: {
    color: '#FFFFFF',

    fontSize: 48,

    fontWeight: '800',

    fontStyle: 'italic',

    letterSpacing: -5,

    marginLeft: -3,
  },

  brand: {
    color: '#FFFFFF',

    fontSize: 31,

    fontWeight: '400',

    letterSpacing: 12,

    marginLeft: 12,
  },

  brandLine: {
    width: 48,
    height: 1,

    backgroundColor: '#FFFFFF',

    opacity: 0.7,

    marginTop: 17,
    marginBottom: 12,
  },

  tagline: {
    color: 'rgba(255,255,255,0.58)',

    fontSize: 9,

    fontWeight: '500',

    letterSpacing: 3.2,

    textAlign: 'center',
  },

  /* -------------------------------------------------------
     HERO
     ------------------------------------------------------- */

  hero: {
    width: '100%',

    marginTop: height * 0.075,

    alignItems: 'flex-start',
  },

  eyebrow: {
    color: 'rgba(255,255,255,0.52)',

    fontSize: 11,

    fontWeight: '500',

    letterSpacing: 3.2,

    marginBottom: 18,
  },

  heroLine: {
    color: '#FFFFFF',

    fontSize: width < 370 ? 39 : 43,

    fontWeight: '700',

    letterSpacing: -1.5,

    lineHeight: width < 370 ? 47 : 51,
  },

  heroLineMuted: {
    color: 'rgba(255,255,255,0.38)',

    fontSize: width < 370 ? 39 : 43,

    fontWeight: '700',

    letterSpacing: -1.5,

    lineHeight: width < 370 ? 47 : 51,
  },

  descriptionRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 27,

    width: '100%',
  },

  verticalLine: {
    width: 1,

    height: 64,

    backgroundColor: '#FFFFFF',

    opacity: 0.75,

    marginRight: 17,
  },

  description: {
    color: 'rgba(255,255,255,0.62)',

    fontSize: 14,

    lineHeight: 22,

    fontWeight: '400',
  },

  /* -------------------------------------------------------
     INDICATORS
     ------------------------------------------------------- */

  indicators: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    marginTop: 'auto',

    marginBottom: 20,
  },

  activeIndicator: {
    width: 34,
    height: 5,

    borderRadius: 5,

    backgroundColor: '#FFFFFF',
  },

  indicator: {
    width: 7,
    height: 7,

    borderRadius: 4,

    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  /* -------------------------------------------------------
     BUTTON
     ------------------------------------------------------- */

  button: {
    width: '100%',

    height: 62,

    borderRadius: 31,

    backgroundColor: '#FFFFFF',

    justifyContent: 'center',

    shadowColor: '#FFFFFF',

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.08,

    shadowRadius: 15,

    elevation: 4,
  },

  buttonContent: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingHorizontal: 28,
  },

  buttonText: {
    color: '#080808',

    fontSize: 15,

    fontWeight: '700',

    letterSpacing: 2.5,
  },

  arrow: {
    color: '#080808',

    fontSize: 29,

    fontWeight: '300',

    marginTop: -2,
  },

  /* -------------------------------------------------------
     FOOTER
     ------------------------------------------------------- */

  footer: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 19,

    marginBottom: 4,
  },

  footerText: {
    color: 'rgba(255,255,255,0.38)',

    fontSize: 9,

    fontWeight: '500',

    letterSpacing: 3,
  },

  footerDot: {
    width: 3,
    height: 3,

    borderRadius: 2,

    backgroundColor: 'rgba(255,255,255,0.45)',

    marginHorizontal: 10,
  },

});