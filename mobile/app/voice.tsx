import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Alert,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { socketService } from '@/services/socketService';
import { getCurrentUser } from '@/constants/auth';

import { voiceService, isWebRTCSupported, VoiceMember, VoiceRoomState } from '@/services/voiceService';

const isWebRTCAvailable = isWebRTCSupported();

/* =====================================================
   VOICE SCREEN
===================================================== */

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export default function VoiceScreen() {
  const params = useLocalSearchParams<{
    rideCode?: string;
    role?: string;
    userName?: string;
    memberId?: string;
  }>();

  const currentUser = getCurrentUser();
  const rideCode = String(params.rideCode || socketService.getRideCode() || '').toUpperCase().trim();
  const role = (params.role || 'rider') as 'captain' | 'rider';
  const userName = params.userName || currentUser?.name || 'Rider';
  const memberId = params.memberId || currentUser?._id || `${role}-${userName.toLowerCase()}`;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [members, setMembers] = useState<VoiceMember[]>([]);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGrantPending, setIsGrantPending] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  const pttScaleAnim = useRef(new Animated.Value(1)).current;
  const statusDotAnim = useRef(new Animated.Value(0)).current;

  /* ===================================================
     PTT PAN RESPONDER (hold to talk)
  =================================================== */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isJoined && isWebRTCAvailable,
      onPanResponderGrant: () => {
        // Button pressed down
        handlePttPress();
        Animated.spring(pttScaleAnim, {
          toValue: 0.93,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }).start();
      },
      onPanResponderRelease: () => {
        // Button released
        handlePttRelease();
        Animated.spring(pttScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }).start();
      },
      onPanResponderTerminate: () => {
        handlePttRelease();
        Animated.spring(pttScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 10,
        }).start();
      },
    })
  ).current;

  /* ===================================================
     JOIN VOICE ON MOUNT
  =================================================== */
  useEffect(() => {
    if (!isWebRTCAvailable) return;

    let mounted = true;

    const unsubStatus = voiceService.onStatus((s: string) => {
      if (!mounted) return;
      setStatus(s as VoiceStatus);
      setIsJoined(s === 'connected');
    });

    const unsubState = voiceService.onState((state: VoiceRoomState) => {
      if (!mounted) return;
      setMembers(state.members || []);
      setActiveSpeakerName(state.activeSpeakerName);
    });

    const unsubSpeaker = voiceService.onSpeaker((speakerName: string | null) => {
      if (!mounted) return;
      setActiveSpeakerName(speakerName);
    });

    const unsubGrant = voiceService.onGrant((granted: boolean, reason?: string, blockerName?: string) => {
      if (!mounted) return;
      setIsGrantPending(false);
      if (granted) {
        setIsSpeaking(true);
        setDeniedMessage(null);
      } else {
        setIsSpeaking(false);
        const msg = reason || (blockerName ? `${blockerName} is speaking` : 'Mic unavailable');
        setDeniedMessage(msg);
        // Auto-clear deny message after 3s
        setTimeout(() => {
          if (mounted) setDeniedMessage(null);
        }, 3000);
      }
    });

    // Join voice room
    voiceService.join({
      rideCode,
      userName,
      role,
      memberId,
    }).catch((err: any) => {
      if (!mounted) return;
      const errorMsg = String(err?.message || err || 'Unknown error');
      if (
        errorMsg.toLowerCase().includes('permission') ||
        errorMsg.toLowerCase().includes('denied') ||
        errorMsg.toLowerCase().includes('notallowed')
      ) {
        Alert.alert(
          'Microphone Permission Required',
          'RYDO needs microphone access for Group Voice. Please enable it in your device Settings → Apps → RYDO → Permissions.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Voice Error', `Could not start voice: ${errorMsg}`);
      }
      setStatus('error');
    });

    // Pulse animation for status dot
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(statusDotAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(statusDotAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      mounted = false;
      pulse.stop();
      unsubStatus();
      unsubState();
      unsubSpeaker();
      unsubGrant();
    };
  }, [rideCode]);

  /* ===================================================
     CLEANUP ON UNMOUNT — leave voice room
  =================================================== */
  useEffect(() => {
    return () => {
      if (isWebRTCAvailable && voiceService) {
        voiceService.leave().catch(() => {});
      }
    };
  }, []);

  /* ===================================================
     PTT HANDLERS
  =================================================== */
  const handlePttPress = useCallback(() => {
    if (!isJoined || !voiceService) return;
    setIsGrantPending(true);
    setDeniedMessage(null);
    voiceService.requestToSpeak();
  }, [isJoined]);

  const handlePttRelease = useCallback(() => {
    if (!voiceService) return;
    voiceService.releaseSpeak();
    setIsSpeaking(false);
    setIsGrantPending(false);
  }, []);

  /* ===================================================
     LEAVE HANDLER
  =================================================== */
  const handleLeave = async () => {
    if (isWebRTCAvailable && voiceService) {
      await voiceService.leave().catch(() => {});
    }
    router.back();
  };

  /* ===================================================
     STATUS LABEL
  =================================================== */
  const getStatusLabel = () => {
    if (!isWebRTCAvailable) return 'BUILD REQUIRED';
    if (status === 'connecting') return 'CONNECTING...';
    if (status === 'connected') return 'VOICE LIVE';
    if (status === 'disconnected') return 'DISCONNECTED';
    if (status === 'error') return 'CONNECTION ERROR';
    return 'VOICE READY';
  };

  const getPttLabel = () => {
    if (!isWebRTCAvailable) return 'DEV BUILD REQUIRED';
    if (!isJoined) return 'CONNECTING...';
    if (isGrantPending) return 'REQUESTING MIC...';
    if (isSpeaking) return 'RELEASE TO STOP';
    return 'HOLD TO TALK';
  };

  /* ===================================================
     RENDER
  =================================================== */
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleLeave}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>GROUP VOICE</Text>
          <Text style={styles.headerSub}>
            {rideCode}
          </Text>
        </View>

        {/* Status indicator */}
        <View style={styles.statusPill}>
          <Animated.View style={[
            styles.statusDot,
            status === 'connected' ? styles.statusDotLive : styles.statusDotIdle,
            status === 'connected' && { opacity: statusDotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          ]} />
          <Text style={styles.statusText}>{getStatusLabel()}</Text>
        </View>
      </View>

      {/* === WEBRTC NOT AVAILABLE — BUILD REQUIRED NOTICE === */}
      {!isWebRTCAvailable && (
        <View style={styles.buildRequiredCard}>
          <Ionicons name="construct-outline" size={32} color="#FFFFFF" />
          <Text style={styles.buildRequiredTitle}>DEVELOPMENT BUILD REQUIRED</Text>
          <Text style={styles.buildRequiredBody}>
            Real-time voice requires a native development build.{'\n'}
            Expo Go cannot run WebRTC.
          </Text>
          <View style={styles.buildCodeBlock}>
            <Text style={styles.buildCode}>cd mobile</Text>
            <Text style={styles.buildCode}>npx expo prebuild --clean</Text>
            <Text style={styles.buildCode}>npx expo run:android</Text>
          </View>
          <Text style={styles.buildNote}>
            Your backend voice signaling is already deployed and ready.{'\n'}
            Run the build command once, then voice will work.
          </Text>
        </View>
      )}

      {/* === MAIN VOICE UI (when WebRTC available) === */}
      {isWebRTCAvailable && (
        <View style={styles.content}>

          {/* CURRENT SPEAKER */}
          <View style={styles.speakerBlock}>
            {activeSpeakerName ? (
              <>
                <View style={styles.speakerActiveRow}>
                  <View style={styles.speakerDot} />
                  <Text style={styles.speakerLabel}>SPEAKING NOW</Text>
                </View>
                <Text style={styles.speakerName}>{activeSpeakerName}</Text>
              </>
            ) : (
              <Text style={styles.speakerIdle}>VOICE READY</Text>
            )}
          </View>

          {/* DENIED MESSAGE */}
          {deniedMessage && (
            <View style={styles.deniedBanner}>
              <Ionicons name="mic-off-outline" size={14} color="#8E8E93" />
              <Text style={styles.deniedText}>{deniedMessage}</Text>
            </View>
          )}

          {/* MEMBER LIST */}
          <View style={styles.membersSection}>
            <Text style={styles.membersSectionTitle}>
              {members.length} {members.length === 1 ? 'MEMBER' : 'MEMBERS'} IN VOICE
            </Text>

            <View style={styles.membersDivider} />

            {members.length === 0 ? (
              <Text style={styles.membersEmpty}>
                Waiting for others to join voice...
              </Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => item.socketId}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const isSpeakingNow = activeSpeakerName === item.userName;
                  const isMe = item.userName.toLowerCase() === userName.toLowerCase();
                  const isCaptain = item.role === 'captain';

                  return (
                    <View style={styles.memberRow}>
                      <View style={[
                        styles.memberDot,
                        isSpeakingNow ? styles.memberDotSpeaking : styles.memberDotIdle,
                      ]} />
                      <Text style={[
                        styles.memberName,
                        isSpeakingNow && styles.memberNameSpeaking,
                      ]}>
                        {item.userName}
                        {isMe ? ' (You)' : ''}
                      </Text>
                      {isCaptain && (
                        <View style={styles.captainBadge}>
                          <Text style={styles.captainBadgeText}>CAPTAIN</Text>
                        </View>
                      )}
                      {isSpeakingNow && (
                        <View style={styles.speakingBadge}>
                          <Ionicons name="mic" size={10} color="#000000" />
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>

          {/* PUSH TO TALK BUTTON */}
          <View style={styles.pttContainer}>
            <Animated.View style={{ transform: [{ scale: pttScaleAnim }] }}>
              <View
                {...panResponder.panHandlers}
                style={[
                  styles.pttButton,
                  isSpeaking && styles.pttButtonActive,
                  isGrantPending && styles.pttButtonPending,
                  (!isJoined) && styles.pttButtonDisabled,
                ]}
                accessible
                accessibilityLabel="Hold to talk"
                accessibilityRole="button"
                accessibilityState={{ disabled: !isJoined }}
              >
                <Ionicons
                  name={isSpeaking ? 'mic' : 'mic-outline'}
                  size={48}
                  color={isSpeaking ? '#000000' : '#FFFFFF'}
                />
              </View>
            </Animated.View>

            <Text style={[
              styles.pttLabel,
              isSpeaking && styles.pttLabelActive,
            ]}>
              {getPttLabel()}
            </Text>

            {isSpeaking && (
              <Text style={styles.pttSpeakingHint}>YOU ARE SPEAKING</Text>
            )}
          </View>

        </View>
      )}

      {/* FOOTER — exit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.leaveBtn}
          onPress={handleLeave}
        >
          <Ionicons name="exit-outline" size={16} color="#000000" />
          <Text style={styles.leaveBtnText}>LEAVE VOICE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES — Swiss / Apple Monochrome
===================================================== */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },

  /* HEADER */
  header: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLive: {
    backgroundColor: '#FFFFFF',
  },
  statusDotIdle: {
    backgroundColor: '#3A3A3C',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  /* BUILD REQUIRED NOTICE */
  buildRequiredCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  buildRequiredTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  buildRequiredBody: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 19,
  },
  buildCodeBlock: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    width: '100%',
    gap: 4,
  },
  buildCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    color: '#FFFFFF',
  },
  buildNote: {
    fontSize: 12,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* MAIN CONTENT */
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  /* SPEAKER DISPLAY */
  speakerBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    marginBottom: 20,
    minHeight: 80,
    justifyContent: 'center',
  },
  speakerActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  speakerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
  },
  speakerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  speakerIdle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A3A3C',
    letterSpacing: 1.5,
  },

  /* DENIED BANNER */
  deniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  deniedText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },

  /* MEMBER LIST */
  membersSection: {
    flex: 1,
  },
  membersSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#636366',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  membersDivider: {
    height: 1,
    backgroundColor: '#1C1C1E',
    marginBottom: 10,
  },
  membersEmpty: {
    fontSize: 13,
    color: '#3A3A3C',
    fontStyle: 'italic',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    gap: 10,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberDotSpeaking: {
    backgroundColor: '#FFFFFF',
  },
  memberDotIdle: {
    backgroundColor: '#3A3A3C',
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberNameSpeaking: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  captainBadge: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  captainBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  speakingBadge: {
    backgroundColor: '#FFFFFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* PUSH-TO-TALK */
  pttContainer: {
    alignItems: 'center',
    paddingBottom: 16,
    gap: 12,
  },
  pttButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pttButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  pttButtonPending: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  pttButtonDisabled: {
    opacity: 0.35,
  },
  pttLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#636366',
    letterSpacing: 1.5,
  },
  pttLabelActive: {
    color: '#FFFFFF',
  },
  pttSpeakingHint: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  /* FOOTER */
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
  },
  leaveBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  leaveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
  },
});
