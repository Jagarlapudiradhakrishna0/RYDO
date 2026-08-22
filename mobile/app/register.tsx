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
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API_URL } from '@/constants/network';
import { setCurrentUser } from '@/constants/auth';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function RegisterScreen() {
  /* ===================================================
     FORM STATE
  =================================================== */

  const [fullName, setFullName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [bikeNumber, setBikeNumber] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nativePlace, setNativePlace] = useState('');

  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [bloodModalVisible, setBloodModalVisible] = useState(false);

  /* ===================================================
     BIKE NUMBER FORMATTER
  =================================================== */

  const handleBikeNumberChange = (text: string) => {
    // Keep it clean and uppercase
    setBikeNumber(text.toUpperCase());
  };

  /* ===================================================
     REGISTRATION SUBMIT
  =================================================== */

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedUserPhone = userPhone.trim();
    const trimmedBike = bikeNumber.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPlace = nativePlace.trim();
    const trimmedEmName = emergencyName.trim();
    const trimmedEmPhone = emergencyPhone.trim();

    /* -------------------------------------------------
       CLIENT VALIDATION
    ------------------------------------------------- */

    if (!trimmedName) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    if (!trimmedUserPhone) {
      Alert.alert('Required Field', 'Please enter your phone number.');
      return;
    }

    const cleanUserPhone = trimmedUserPhone.replace(/[^0-9]/g, '');
    if (cleanUserPhone.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number for your account.');
      return;
    }

    if (!trimmedBike) {
      Alert.alert('Required Field', 'Please enter your bike/vehicle registration number.');
      return;
    }

    if (!trimmedEmail) {
      Alert.alert('Required Field', 'Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address format.');
      return;
    }

    if (!bloodGroup) {
      Alert.alert('Required Field', 'Please select your blood group.');
      return;
    }

    if (!trimmedPlace) {
      Alert.alert('Required Field', 'Please enter your native place or city.');
      return;
    }

    if (!trimmedEmName) {
      Alert.alert('Required Field', 'Please enter your emergency contact person name.');
      return;
    }

    if (!trimmedEmPhone) {
      Alert.alert('Required Field', 'Please enter your emergency contact phone number.');
      return;
    }

    const cleanEmPhone = trimmedEmPhone.replace(/[^0-9]/g, '');
    if (cleanEmPhone.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit emergency contact phone number.');
      return;
    }

    if (!password || password.length < 8) {
      Alert.alert('Password Requirement', 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match.');
      return;
    }

    if (!consent) {
      Alert.alert(
        'Consent Required',
        'You must agree to allow RYDO to use your emergency contact for safety and SOS alerts to complete registration.'
      );
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: trimmedName,
        phoneNumber: trimmedUserPhone,
        bikeNumber: trimmedBike,
        email: trimmedEmail,
        bloodGroup,
        nativePlace: trimmedPlace,
        emergencyContactName: trimmedEmName,
        emergencyContactPhone: trimmedEmPhone,
        password,
        confirmPassword,
        emergencyContactConsent: true,
      };

      console.log('RYDO: Registering user:', trimmedEmail);

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { success: false, message: rawText || `Server responded with status ${response.status}` };
      }

      if (!response.ok || !data.success) {
        Alert.alert(
          'Registration Failed',
          data.message || `Endpoint returned status ${response.status}`
        );
        return;
      }

      console.log('RYDO: Registration successful:', data.user?.name);
      setCurrentUser(data.user);

      Alert.alert(
        'Welcome to RYDO!',
        'Your safety profile has been created successfully.',
        [
          {
            text: 'START RIDING',
            onPress: () => {
              router.replace('/ride-choice');
            },
          },
        ]
      );
    } catch (error) {
      console.error('RYDO Registration error:', error);
      Alert.alert(
        'Network Error',
        'Unable to connect to the RYDO server. Please verify your connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ===================================================
     RENDER
  =================================================== */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>

            <Text style={styles.headerBrand}>RYDO</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* TITLE SECTION */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>CREATE YOUR ACCOUNT</Text>
            <Text style={styles.subtitle}>
              Set up your rider profile and safety details for real-time crew navigation.
            </Text>
          </View>

          {/* FORM FIELDS */}
          <View style={styles.form}>
            {/* FULL NAME */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#444444"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* PHONE NUMBER (USER'S OWN) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#444444"
                value={userPhone}
                onChangeText={setUserPhone}
                keyboardType="phone-pad"
              />
              <Text style={styles.hint}>Your personal account phone number</Text>
            </View>

            {/* EMAIL ID */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ID</Text>
              <TextInput
                style={styles.input}
                placeholder="rider@example.com"
                placeholderTextColor="#444444"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* BIKE NUMBER */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BIKE NUMBER / VEHICLE REGISTRATION</Text>
              <TextInput
                style={styles.input}
                placeholder="TS 09 AB 1234"
                placeholderTextColor="#444444"
                value={bikeNumber}
                onChangeText={handleBikeNumberChange}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.hint}>Indian state & registration format</Text>
            </View>

            {/* BLOOD GROUP & NATIVE PLACE (ROW) */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>BLOOD GROUP</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.selectButton}
                  onPress={() => setBloodModalVisible(true)}
                >
                  <Text
                    style={
                      bloodGroup
                        ? styles.selectTextSelected
                        : styles.selectTextPlaceholder
                    }
                  >
                    {bloodGroup || 'Select ▼'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1.3 }]}>
                <Text style={styles.label}>NATIVE PLACE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="City / Hometown"
                  placeholderTextColor="#444444"
                  value={nativePlace}
                  onChangeText={setNativePlace}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* SECTION DIVIDER: EMERGENCY CONTACT */}
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTitle}>EMERGENCY CONTACT</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.sectionSubtitle}>
              This contact will be automatically notified when you trigger an SOS during a ride.
            </Text>

            {/* EMERGENCY CONTACT NAME */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMERGENCY CONTACT NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Parent / Spouse / Friend name"
                placeholderTextColor="#444444"
                value={emergencyName}
                onChangeText={setEmergencyName}
                autoCapitalize="words"
              />
            </View>

            {/* EMERGENCY CONTACT PHONE */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMERGENCY CONTACT NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#444444"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* SECTION DIVIDER: SECURITY */}
            <View style={styles.sectionDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTitle}>SECURITY</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#444444"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* CONFIRM PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#444444"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* EMERGENCY CONSENT CHECKBOX */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.consentRow}
              onPress={() => setConsent(!consent)}
            >
              <View style={[styles.checkbox, consent && styles.checkboxActive]}>
                {consent && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.consentText}>
                I agree to allow RYDO to use my emergency contact information for safety and SOS alerts.
              </Text>
            </TouchableOpacity>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitButtonText}>CREATE ACCOUNT</Text>
              )}
            </TouchableOpacity>

            {/* LOGIN LINK */}
            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BLOOD GROUP MODAL */}
      <Modal
        visible={bloodModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setBloodModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setBloodModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SELECT BLOOD GROUP</Text>
            <View style={styles.bloodGrid}>
              {BLOOD_GROUPS.map((bg) => {
                const isSelected = bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    style={[
                      styles.bloodOption,
                      isSelected && styles.bloodOptionSelected,
                    ]}
                    onPress={() => {
                      setBloodGroup(bg);
                      setBloodModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.bloodOptionText,
                        isSelected && styles.bloodOptionTextSelected,
                      ]}
                    >
                      {bg}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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

  keyboard: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  /* HEADER */
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },

  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },

  backArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
  },

  headerBrand: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 6,
  },

  /* TITLE */
  titleSection: {
    marginTop: 24,
    marginBottom: 20,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  subtitle: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  /* FORM */
  form: {
    marginTop: 8,
  },

  inputGroup: {
    marginBottom: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  label: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  input: {
    height: 50,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  hint: {
    color: '#555555',
    fontSize: 8,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  selectButton: {
    height: 50,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },

  selectTextSelected: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  selectTextPlaceholder: {
    color: '#444444',
    fontSize: 13,
  },

  /* SECTION DIVIDERS */
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#202020',
  },

  dividerTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginHorizontal: 12,
  },

  sectionSubtitle: {
    color: '#666666',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
    marginTop: -8,
  },

  /* CONSENT */
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 18,
    paddingRight: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#444444',
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },

  checkboxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },

  checkmark: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },

  consentText: {
    flex: 1,
    color: '#AAAAAA',
    fontSize: 11,
    lineHeight: 16,
  },

  /* BUTTON */
  submitButton: {
    height: 56,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderRadius: 2,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },

  /* LOGIN ROW */
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },

  loginPrompt: {
    color: '#777777',
    fontSize: 12,
  },

  loginLink: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  modalCard: {
    width: '100%',
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 22,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 18,
    textAlign: 'center',
  },

  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  bloodOption: {
    width: '22%',
    height: 48,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2B2B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bloodOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },

  bloodOptionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  bloodOptionTextSelected: {
    color: '#000000',
  },
});
