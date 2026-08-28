import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { API_URL } from '@/constants/network';
import {
  CommunicationSettings,
  VoiceGender,
  getCommunicationSettings,
  updateCommunicationSettings,
  subscribeToCommunicationSettings,
} from '@/services/communicationSettings';
import { ttsService } from '@/services/ttsService';
import {
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
  subscribeToAuth,
  UserProfile,
} from '@/constants/auth';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileScreen() {
  const [user, setUser] = useState<UserProfile | null>(getCurrentUser());
  const [refreshing, setRefreshing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Edit Profile Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBikeNumber, setEditBikeNumber] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editNativePlace, setEditNativePlace] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editConsent, setEditConsent] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Communication & Voice Notification Settings
  const [commSettings, setCommSettings] = useState<CommunicationSettings>({
    voiceEnabled: true,
    voiceGender: 'default',
    soundEnabled: true,
    importantAlertsOnly: false,
  });

  useEffect(() => {
    const unsub = subscribeToCommunicationSettings((settings) => {
      setCommSettings(settings);
    });
    return unsub;
  }, []);

  const handleToggleVoice = async (val: boolean) => {
    await updateCommunicationSettings({ voiceEnabled: val });
  };

  const handleSetVoiceGender = async (gender: VoiceGender) => {
    await updateCommunicationSettings({ voiceGender: gender });
  };

  const handleToggleSound = async (val: boolean) => {
    await updateCommunicationSettings({ soundEnabled: val });
  };

  const handleToggleImportantOnly = async (val: boolean) => {
    await updateCommunicationSettings({ importantAlertsOnly: val });
  };

  const handleTestVoice = async () => {
    try {
      await ttsService.speakMessage('RYDO', 'Let\'s take a break. Voice notifications are active.', {
        ...commSettings,
        voiceEnabled: true, // Force enable for test button
      });
    } catch (e) {
      console.log('Voice test error:', e);
    }
  };

  /* =====================================================
     AUTH SUBSCRIPTION & FETCH LATEST PROFILE
  ===================================================== */

  useEffect(() => {
    const unsubscribe = subscribeToAuth((updatedUser) => {
      setUser(updatedUser);
    });
    return unsubscribe;
  }, []);

  const fetchLatestProfile = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?._id) return;

    try {
      setLoadingProfile(true);
      const res = await fetch(`${API_URL}/api/auth/profile/${currentUser._id}`);
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        setUser(data.user);
      }
    } catch (e) {
      console.log('RYDO: Profile refresh error:', e);
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestProfile();
  }, [fetchLatestProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLatestProfile();
  };

  /* =====================================================
     EDIT PROFILE HANDLERS
  ===================================================== */

  const openEditModal = () => {
    if (!user) {
      Alert.alert('Error', 'No authenticated user profile found.');
      return;
    }
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditBikeNumber(user.bikeNumber || '');
    setEditBloodGroup(user.bloodGroup || 'O+');
    setEditNativePlace(user.nativePlace || '');
    setEditEmergencyName(user.emergencyContact?.name || '');
    setEditEmergencyPhone(
      user.emergencyContact?.phoneNumber?.replace('+91', '') || ''
    );
    setEditConsent(user.emergencyContactConsent !== false);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user?._id) return;

    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    const trimmedBike = editBikeNumber.trim();
    const trimmedNative = editNativePlace.trim();
    const trimmedEmName = editEmergencyName.trim();
    const trimmedEmPhone = editEmergencyPhone.trim();

    if (!trimmedName || trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter your full name (at least 2 characters).');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!trimmedBike || trimmedBike.length < 6) {
      Alert.alert('Invalid Bike Number', 'Please enter a valid bike registration number.');
      return;
    }

    if (!trimmedNative) {
      Alert.alert('Required Field', 'Please enter your native place.');
      return;
    }

    if (!trimmedEmName) {
      Alert.alert('Required Field', 'Please enter your emergency contact name.');
      return;
    }

    const cleanEmDigits = trimmedEmPhone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanEmDigits.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit emergency contact phone number.');
      return;
    }

    try {
      setSavingProfile(true);

      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        bikeNumber: trimmedBike,
        bloodGroup: editBloodGroup,
        nativePlace: trimmedNative,
        emergencyContactName: trimmedEmName,
        emergencyContactPhone: cleanEmDigits,
        emergencyContactConsent: editConsent,
      };

      const res = await fetch(`${API_URL}/api/auth/profile/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        Alert.alert('Update Failed', data.message || 'Unable to update profile.');
        return;
      }

      setCurrentUser(data.user);
      setUser(data.user);
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      console.error('RYDO: Profile save error:', e);
      Alert.alert('Network Error', 'Unable to save changes. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  /* =====================================================
     CHANGE PASSWORD HANDLERS
  ===================================================== */

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalVisible(true);
  };

  const handleSavePassword = async () => {
    if (!user?._id) return;

    if (!currentPassword) {
      Alert.alert('Required Field', 'Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Invalid Password', 'New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match. Please re-enter.');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Invalid Password', 'New password must be different from current password.');
      return;
    }

    try {
      setSavingPassword(true);

      const res = await fetch(`${API_URL}/api/auth/change-password/${user._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        Alert.alert('Error', data.message || 'Failed to change password.');
        return;
      }

      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully.');
    } catch (e) {
      console.error('RYDO: Password change error:', e);
      Alert.alert('Network Error', 'Unable to change password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  /* =====================================================
     LOGOUT HANDLER
  ===================================================== */

  const handleLogout = () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            console.log('RYDO: Logging out user...');
            clearCurrentUser();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  /* =====================================================
     RENDER
  ===================================================== */

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'R';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.container}>
        {/* =================================================
            HEADER
        ================================================= */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>PROFILE & SETTINGS</Text>
            <Text style={styles.headerSub}>ACCOUNT PREFERENCES</Text>
          </View>

          <View style={styles.headerRightPlaceholder}>
            {loadingProfile && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </View>
        </View>

        {/* =================================================
            SCROLLABLE CONTENT
        ================================================= */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
              colors={['#FFFFFF']}
            />
          }
        >
          {/* USER HERO CARD */}
          <View style={styles.heroCard}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{user?.name || 'Rider'}</Text>
              <Text style={styles.heroPhone}>{user?.phoneNumber || '+91 ----------'}</Text>
              <Text style={styles.heroEmail}>{user?.email || 'rider@rydo.app'}</Text>

              <View style={styles.heroBadges}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>CAPTAIN & RIDER</Text>
                </View>
                <View style={styles.bloodGroupBadge}>
                  <Text style={styles.bloodGroupBadgeText}>
                    BLOOD {user?.bloodGroup || 'O+'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 1: PERSONAL INFORMATION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={16} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>FULL NAME</Text>
                <Text style={styles.infoValue}>{user?.name || '—'}</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PHONE NUMBER</Text>
                <Text style={styles.infoValue}>{user?.phoneNumber || '—'}</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>EMAIL ADDRESS</Text>
                <Text style={styles.infoValue}>{user?.email || '—'}</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>NATIVE PLACE</Text>
                <Text style={styles.infoValue}>{user?.nativePlace || '—'}</Text>
              </View>
            </View>
          </View>

          {/* SECTION 2: BIKE INFORMATION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="two-wheeler" size={18} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>BIKE INFORMATION</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>REGISTRATION NUMBER</Text>
                <View style={styles.bikeNumberBadge}>
                  <Text style={styles.bikeNumberText}>
                    {user?.bikeNumber || 'NOT CONFIGURED'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 3: SAFETY & EMERGENCY (SOS) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#30D158" />
              <Text style={styles.sectionTitle}>SAFETY & SOS SETTINGS</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>BLOOD GROUP</Text>
                <Text style={[styles.infoValue, { color: '#FF453A', fontWeight: '800' }]}>
                  {user?.bloodGroup || '—'}
                </Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>EMERGENCY CONTACT NAME</Text>
                <Text style={styles.infoValue}>
                  {user?.emergencyContact?.name || '—'}
                </Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>EMERGENCY CONTACT PHONE</Text>
                <Text style={styles.infoValue}>
                  {user?.emergencyContact?.phoneNumber || '—'}
                </Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SOS CONSENT STATUS</Text>
                <View style={styles.consentBadge}>
                  <View style={styles.consentDot} />
                  <Text style={styles.consentText}>
                    {user?.emergencyContactConsent ? 'AUTHORIZED' : 'PENDING'}
                  </Text>
                </View>
              </View>

              <View style={styles.sosNoticeBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#FF9F0A" />
                <Text style={styles.sosNoticeText}>
                  Your emergency contact is automatically alerted when you trigger an SOS during any active group ride.
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 4: ACTIONS (EDIT PROFILE & CHANGE PASSWORD) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={16} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>ACCOUNT ACTIONS</Text>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionButton}
                onPress={openEditModal}
              >
                <View style={styles.actionButtonLeft}>
                  <Feather name="edit-3" size={18} color="#000000" />
                  <Text style={styles.actionButtonText}>EDIT PROFILE</Text>
                </View>
                <Text style={styles.actionButtonArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.secondaryActionButton}
                onPress={openPasswordModal}
              >
                <View style={styles.actionButtonLeft}>
                  <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.secondaryActionButtonText}>CHANGE PASSWORD</Text>
                </View>
                <Text style={styles.secondaryActionButtonArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 5: COMMUNICATION & VOICE NOTIFICATION SETTINGS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="volume-high-outline" size={16} color="#FFFFFF" />
              <Text style={[styles.sectionTitleMuted, { color: '#FFFFFF' }]}>COMMUNICATION & VOICE</Text>
            </View>

            <View style={styles.card}>
              {/* VOICE NOTIFICATIONS TOGGLE */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.infoLabel}>VOICE ANNOUNCEMENTS</Text>
                  <Text style={styles.toggleSubLabel}>Speak incoming ride messages aloud</Text>
                </View>
                <Switch
                  value={commSettings.voiceEnabled}
                  onValueChange={handleToggleVoice}
                  trackColor={{ false: '#2C2C2E', true: '#FFFFFF' }}
                  thumbColor={commSettings.voiceEnabled ? '#000000' : '#8E8E93'}
                />
              </View>

              {/* VOICE GENDER / ACCENT SELECTOR */}
              {commSettings.voiceEnabled && (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.voiceGenderSection}>
                    <Text style={styles.voiceGenderTitle}>VOICE GENDER / TYPE</Text>
                    <View style={styles.voicePillsRow}>
                      {(['male', 'female', 'default'] as VoiceGender[]).map((gender) => {
                        const isSelected = commSettings.voiceGender === gender;
                        return (
                          <TouchableOpacity
                            key={gender}
                            activeOpacity={0.8}
                            style={[
                              styles.voicePill,
                              isSelected && styles.voicePillSelected,
                            ]}
                            onPress={() => handleSetVoiceGender(gender)}
                          >
                            <Ionicons
                              name={gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'hardware-chip-outline'}
                              size={14}
                              color={isSelected ? '#000000' : '#8E8E93'}
                            />
                            <Text
                              style={[
                                styles.voicePillText,
                                isSelected && styles.voicePillTextSelected,
                              ]}
                            >
                              {gender === 'default' ? 'DEVICE' : gender.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* TEST VOICE BUTTON */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.testVoiceBtn}
                      onPress={handleTestVoice}
                    >
                      <Ionicons name="play" size={14} color="#FFFFFF" />
                      <Text style={styles.testVoiceBtnText}>TEST VOICE ANNOUNCEMENT</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.cardDivider} />

              {/* NOTIFICATION SOUND TOGGLE */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.infoLabel}>NOTIFICATION CHIME</Text>
                  <Text style={styles.toggleSubLabel}>Play audio alert on incoming message</Text>
                </View>
                <Switch
                  value={commSettings.soundEnabled}
                  onValueChange={handleToggleSound}
                  trackColor={{ false: '#2C2C2E', true: '#FFFFFF' }}
                  thumbColor={commSettings.soundEnabled ? '#000000' : '#8E8E93'}
                />
              </View>

              <View style={styles.cardDivider} />

              {/* IMPORTANT ALERTS ONLY TOGGLE */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.infoLabel}>URGENT ALERTS ONLY</Text>
                  <Text style={styles.toggleSubLabel}>Filter only emergency and route changes</Text>
                </View>
                <Switch
                  value={commSettings.importantAlertsOnly}
                  onValueChange={handleToggleImportantOnly}
                  trackColor={{ false: '#2C2C2E', true: '#FFFFFF' }}
                  thumbColor={commSettings.importantAlertsOnly ? '#000000' : '#8E8E93'}
                />
              </View>
            </View>
          </View>

          {/* SECTION 6: APP & SYSTEM SETTINGS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="phone-portrait-outline" size={16} color="#888888" />
              <Text style={styles.sectionTitleMuted}>APP & SYSTEM</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>LOCATION TRACKING</Text>
                <Text style={styles.systemStatusText}>HIGH ACCURACY GPS</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>LIVE TELEMETRY</Text>
                <Text style={styles.systemStatusText}>SOCKET.IO REALTIME</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>VERSION</Text>
                <Text style={styles.infoValue}>1.0.0 (BUILD 2026)</Text>
              </View>
            </View>
          </View>

          {/* LOGOUT BUTTON */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF453A" />
            <Text style={styles.logoutButtonText}>LOGOUT OF RYDO</Text>
          </TouchableOpacity>

          {/* FOOTER BRAND */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>R Y D O</Text>
            <Text style={styles.footerTagline}>RIDE TOGETHER. STAY CONNECTED.</Text>
          </View>
        </ScrollView>
      </View>

      {/* =====================================================
          EDIT PROFILE MODAL
      ===================================================== */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContainer}>
              {/* MODAL HEADER */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>EDIT PROFILE</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setEditModalVisible(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* NAME */}
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#555555"
                  autoCapitalize="words"
                />

                {/* EMAIL */}
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#555555"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {/* BIKE NUMBER */}
                <Text style={styles.inputLabel}>BIKE REGISTRATION NUMBER</Text>
                <TextInput
                  value={editBikeNumber}
                  onChangeText={setEditBikeNumber}
                  style={styles.input}
                  placeholder="TS 09 AB 1234"
                  placeholderTextColor="#555555"
                  autoCapitalize="characters"
                />

                {/* BLOOD GROUP PICKER */}
                <Text style={styles.inputLabel}>BLOOD GROUP</Text>
                <View style={styles.bloodGroupSelector}>
                  {BLOOD_GROUPS.map((bg) => {
                    const isSelected = editBloodGroup === bg;
                    return (
                      <TouchableOpacity
                        key={bg}
                        activeOpacity={0.8}
                        onPress={() => setEditBloodGroup(bg)}
                        style={[
                          styles.bloodGroupChip,
                          isSelected && styles.bloodGroupChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bloodGroupChipText,
                            isSelected && styles.bloodGroupChipTextSelected,
                          ]}
                        >
                          {bg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* NATIVE PLACE */}
                <Text style={styles.inputLabel}>NATIVE PLACE / CITY</Text>
                <TextInput
                  value={editNativePlace}
                  onChangeText={setEditNativePlace}
                  style={styles.input}
                  placeholder="City, State"
                  placeholderTextColor="#555555"
                  autoCapitalize="words"
                />

                {/* EMERGENCY CONTACT NAME */}
                <Text style={styles.inputLabel}>EMERGENCY CONTACT NAME</Text>
                <TextInput
                  value={editEmergencyName}
                  onChangeText={setEditEmergencyName}
                  style={styles.input}
                  placeholder="Parent, Spouse, Friend"
                  placeholderTextColor="#555555"
                  autoCapitalize="words"
                />

                {/* EMERGENCY CONTACT PHONE */}
                <Text style={styles.inputLabel}>EMERGENCY CONTACT PHONE (10 DIGITS)</Text>
                <TextInput
                  value={editEmergencyPhone}
                  onChangeText={setEditEmergencyPhone}
                  style={styles.input}
                  placeholder="9876543210"
                  placeholderTextColor="#555555"
                  keyboardType="phone-pad"
                  maxLength={13}
                />

                {/* CONSENT CHECKBOX */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.consentToggleRow}
                  onPress={() => setEditConsent(!editConsent)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      editConsent && styles.checkboxChecked,
                    ]}
                  >
                    {editConsent && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.consentToggleLabel}>
                    I consent to RYDO using this contact for SOS emergency alerts.
                  </Text>
                </TouchableOpacity>

                {/* SAVE BUTTON */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalSaveButton}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>SAVE CHANGES</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* =====================================================
          CHANGE PASSWORD MODAL
      ===================================================== */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContainer}>
              {/* MODAL HEADER */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>CHANGE PASSWORD</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setPasswordModalVisible(false)}
                  disabled={savingPassword}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* CURRENT PASSWORD */}
                <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    style={styles.passwordTextInput}
                    placeholder="Enter current password"
                    placeholderTextColor="#555555"
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons
                      name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#888888"
                    />
                  </TouchableOpacity>
                </View>

                {/* NEW PASSWORD */}
                <Text style={styles.inputLabel}>NEW PASSWORD (MIN 8 CHARACTERS)</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={styles.passwordTextInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#555555"
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#888888"
                    />
                  </TouchableOpacity>
                </View>

                {/* CONFIRM NEW PASSWORD */}
                <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#555555"
                  secureTextEntry={!showNewPassword}
                />

                {/* SAVE BUTTON */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.modalSaveButton}
                  onPress={handleSavePassword}
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>UPDATE PASSWORD</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },
  headerSub: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 60,
  },

  /* HERO CARD */
  heroCard: {
    backgroundColor: '#0C0C0C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroPhone: {
    color: '#999999',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  heroEmail: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  roleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bloodGroupBadge: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bloodGroupBadgeText: {
    color: '#FF453A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* SECTION */
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sectionTitleMuted: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  card: {
    backgroundColor: '#0C0C0C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 4,
  },
  bikeNumberBadge: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bikeNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  consentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  consentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
  },
  consentText: {
    color: '#30D158',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sosNoticeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 10, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  sosNoticeText: {
    color: '#FF9F0A',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  systemStatusText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* ACTIONS */
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  actionButtonArrow: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '400',
  },
  secondaryActionButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  secondaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  secondaryActionButtonArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
  },

  /* LOGOUT */
  logoutButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 30,
  },
  logoutButtonText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  /* FOOTER */
  footer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerLine: {
    width: 30,
    height: 1,
    backgroundColor: '#333333',
    marginBottom: 10,
  },
  footerBrand: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
  },
  footerTagline: {
    color: '#444444',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },

  /* MODAL STYLES */
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalKeyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#888888',
    fontSize: 18,
    fontWeight: '600',
  },
  modalScroll: {
    paddingHorizontal: 24,
  },
  modalScrollContent: {
    paddingTop: 18,
    paddingBottom: 30,
  },
  inputLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    color: '#FFFFFF',
    fontSize: 14,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  passwordTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  bloodGroupSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  bloodGroupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bloodGroupChipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  bloodGroupChipText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '800',
  },
  bloodGroupChipTextSelected: {
    color: '#000000',
  },
  consentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkMark: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  consentToggleLabel: {
    color: '#AAAAAA',
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  modalSaveButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  modalSaveButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleSubLabel: {
    fontSize: 12,
    color: '#717E91',
    marginTop: 2,
  },
  voiceGenderSection: {
    paddingVertical: 10,
  },
  voiceGenderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E9BAE',
    letterSpacing: 1,
    marginBottom: 8,
  },
  voicePillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  voicePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E242F',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    gap: 6,
  },
  voicePillSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  voicePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  voicePillTextSelected: {
    color: '#000000',
  },
  testVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  testVoiceBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
