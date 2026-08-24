import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ProfileHeaderButton from '@/components/ProfileHeaderButton';

export default function RideChoiceScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
      />

      <View style={styles.container}>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >

          {/* HEADER */}

          <View style={styles.header}>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
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


          {/* TITLE */}

          <View style={styles.titleSection}>

            <Text style={styles.smallLabel}>
              START YOUR RIDE
            </Text>

            <Text style={styles.title}>
              HOW DO
            </Text>

            <Text style={styles.title}>
              YOU WANT
            </Text>

            <Text style={styles.titleBox}>
              TO RIDE?
            </Text>

          </View>


          {/* OPTIONS */}

          <View style={styles.options}>

            {/* CREATE RIDE */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.option}
              onPress={() => router.push('/create-ride')}
            >

              <View style={styles.optionTop}>

                <Text style={styles.number}>
                  01
                </Text>

                <Text style={styles.arrow}>
                  ↗
                </Text>

              </View>


              <Text style={styles.optionTitle}>
                CREATE A RIDE
              </Text>


              <Text style={styles.optionDescription}>
                Start a new group,
                {'\n'}
                invite your crew,
                {'\n'}
                and lead the journey.
              </Text>


              <View style={styles.role}>

                <Text style={styles.roleText}>
                  YOU BECOME CAPTAIN
                </Text>

              </View>

            </TouchableOpacity>


            {/* JOIN RIDE */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.option,
                styles.joinOption,
              ]}
              onPress={() => router.push('/join-ride')}
            >

              <View style={styles.optionTop}>

                <Text style={styles.number}>
                  02
                </Text>

                <Text style={styles.arrow}>
                  ↗
                </Text>

              </View>


              <Text style={styles.optionTitle}>
                JOIN A RIDE
              </Text>


              <Text style={styles.optionDescription}>
                Enter your ride code
                {'\n'}
                and connect with
                {'\n'}
                your crew.
              </Text>


              <View style={styles.role}>

                <Text style={styles.roleText}>
                  JOIN AS RIDER
                </Text>

              </View>

            </TouchableOpacity>

          </View>


          {/* FOOTER */}

          <View style={styles.footer}>

            <View style={styles.footerLine} />

            <Text style={styles.footerText}>
              ONE APP. ONE CREW. ONE JOURNEY.
            </Text>

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
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 100,
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
    fontSize: 25,
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
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },

  titleBox: {
    alignSelf: 'flex-start',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
    paddingHorizontal: 6,
    marginTop: 3,
  },


  /* OPTIONS */

  options: {
    marginTop: 42,
  },

  option: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 22,
    minHeight: 190,
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  joinOption: {
    borderColor: '#333333',
  },

  optionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  number: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },

  optionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 15,
  },

  optionDescription: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  role: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 14,
  },

  roleText: {
    color: '#AAAAAA',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },


  /* FOOTER */

  footer: {
    alignItems: 'center',
    paddingTop: 35,
    paddingBottom: 20,
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