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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { API_URL } from '@/constants/network';
import { setCurrentUser } from '@/constants/auth';

export default function LoginScreen() {
  /* ===================================================
     STATE
  =================================================== */

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  /* ===================================================
     SUBMIT LOGIN
  =================================================== */

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert('Required Field', 'Please enter your email address.');
      return;
    }

    if (!password) {
      Alert.alert('Required Field', 'Please enter your password.');
      return;
    }

    try {
      setLoading(true);

      console.log('RYDO: Logging in user:', trimmedEmail);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
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
          'Login Failed',
          data.message || `Invalid email or password (Status ${response.status}).`
        );
        return;
      }

      console.log('RYDO: Login successful for:', data.user?.name);
      setCurrentUser(data.user);

      router.replace('/ride-choice');
    } catch (error) {
      console.error('RYDO Login error:', error);
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

          {/* BRAND HERO */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoLetter}>R</Text>
            </View>

            <Text style={styles.welcomeTitle}>WELCOME BACK</Text>
            <Text style={styles.welcomeSubtitle}>
              Log in to join your ride, access your crew, and stay connected.
            </Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>
            {/* EMAIL */}
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

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#444444"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* REMEMBER ME & FORGOT PASSWORD */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxActive,
                  ]}
                >
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Password Reset',
                    'Please contact your RYDO administrator or register a new account.'
                  )
                }
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.loginButtonText}>LOGIN</Text>
              )}
            </TouchableOpacity>

            {/* REGISTER LINK */}
            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.registerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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

  keyboard: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 26,
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

  /* HERO */
  heroSection: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 32,
  },

  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logoLetter: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    fontStyle: 'italic',
    marginLeft: -2,
  },

  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* FORM */
  form: {
    marginTop: 10,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  input: {
    height: 52,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  /* OPTIONS ROW */
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#444444',
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },

  checkmark: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },

  rememberText: {
    color: '#888888',
    fontSize: 11,
  },

  forgotText: {
    color: '#888888',
    fontSize: 11,
  },

  /* LOGIN BUTTON */
  loginButton: {
    height: 56,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 2,
  },

  loginButtonDisabled: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },

  /* REGISTER ROW */
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },

  registerPrompt: {
    color: '#777777',
    fontSize: 12,
  },

  registerLink: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
