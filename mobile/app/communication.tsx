import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { communicationService, RideMessage } from '@/services/communicationService';
import { socketService } from '@/services/socketService';
import { getCurrentUser } from '@/constants/auth';
import { API_URL } from '@/constants/network';

const QUICK_MESSAGES_LIST = [
  "Let's take a break",
  'Stop at next petrol station',
  "Let's stop for food",
  'I need fuel',
  'Please wait for me',
  'Slow down',
  'Stay together',
  'I have stopped',
  "Let's continue",
  'Route changed',
  'Meet at this location',
  'I need help',
  'Emergency',
];

const CAPTAIN_EXTRA_COMMANDS = [
  'Ride starting',
  'Wait for riders',
  'Stop immediately',
];

export default function CommunicationScreen() {
  const params = useLocalSearchParams<{
    rideCode?: string;
    role?: string;
    userName?: string;
  }>();

  const currentUser = getCurrentUser();
  const rideCode = String(params.rideCode || socketService.getRideCode() || communicationService.getActiveRideCode() || '').toUpperCase().trim();
  const userRole = (params.role || 'rider').toLowerCase() as 'captain' | 'rider';
  const userName = params.userName || currentUser?.name || 'Rider';

  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [rideDetails, setRideDetails] = useState<{
    rideName: string;
    captainName: string;
    memberCount: number;
    status: string;
  }>({
    rideName: 'RIDE',
    captainName: 'Captain',
    memberCount: 1,
    status: 'READY',
  });

  const [selectedQuickMessage, setSelectedQuickMessage] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'quick'>('chat');

  const scrollViewRef = useRef<ScrollView>(null);

  // Connect socket and sync state
  useEffect(() => {
    if (!rideCode) {
      setLoading(false);
      return;
    }

    // Connect singleton socket
    socketService.connect({
      rideCode,
      userId: currentUser?._id || null,
      userName,
      role: userRole,
    });

    communicationService.setActiveUser(currentUser?._id || null, userName);
    communicationService.setActiveRideCode(rideCode);

    let isMounted = true;

    // Fetch ride details for header
    fetch(`${API_URL}/api/rides/${rideCode}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.ride) {
          const r = data.ride;
          setRideDetails({
            rideName: r.rideName || 'RIDE',
            captainName: r.captainName || 'Captain',
            memberCount: (Array.isArray(r.riders) ? r.riders.length : 0) + 1,
            status: r.isStarted ? 'LIVE' : 'READY',
          });
        }
      })
      .catch((e) => console.log('[COMMUNICATION] Fetch ride error:', e));

    // Fetch message history
    communicationService.fetchMessages(rideCode).then((msgs) => {
      if (isMounted) {
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 150);
      }
    });

    // Subscribe to incoming messages
    const unsubscribeHistory = communicationService.subscribeToHistory((updatedList) => {
      if (isMounted) {
        setMessages(updatedList);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeHistory();
    };
  }, [rideCode, userName, userRole, currentUser]);

  const allQuickMessages = useMemo(() => {
    if (userRole === 'captain') {
      return [...CAPTAIN_EXTRA_COMMANDS, ...QUICK_MESSAGES_LIST];
    }
    return QUICK_MESSAGES_LIST;
  }, [userRole]);

  const handleSelectQuick = (msg: string) => {
    setSelectedQuickMessage(msg);
    setCustomText('');
  };

  const handleSend = async () => {
    const text = selectedQuickMessage || customText.trim();
    if (!text) {
      Alert.alert('Empty Message', 'Please select or type a message.');
      return;
    }

    if (!rideCode) {
      Alert.alert('Error', 'No active ride found.');
      return;
    }

    try {
      setSending(true);
      const isQuick = Boolean(selectedQuickMessage);

      await communicationService.sendMessage({
        rideCode,
        senderId: currentUser?._id || null,
        senderName: userName,
        senderRole: userRole,
        messageText: text,
        messageType: isQuick ? 'quick' : 'custom',
      });

      setSelectedQuickMessage(null);
      setCustomText('');

      if (activeTab === 'quick') {
        setActiveTab('chat');
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      Alert.alert('Send Error', e?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* =====================================================
            HEADER (SWISS / APPLE MINIMALIST)
        ===================================================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>COMMUNICATION</Text>
              <Text style={styles.headerSub}>
                {rideDetails.rideName} · <Text style={styles.codeText}>{rideCode}</Text>
              </Text>
            </View>

            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, rideDetails.status === 'LIVE' ? styles.statusDotLive : styles.statusDotReady]} />
              <Text style={styles.statusText}>{rideDetails.status}</Text>
            </View>
          </View>

          {/* MEMBER META BAR */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>
              {rideDetails.memberCount} {rideDetails.memberCount === 1 ? 'MEMBER' : 'MEMBERS'} ACTIVE
            </Text>
            <Text style={styles.metaSeparator}>/</Text>
            <Text style={styles.metaLabel}>
              CAPTAIN: {rideDetails.captainName.toUpperCase()}
            </Text>
          </View>

          {/* SEGMENTED TABS (MONOCHROME) */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.segmentBtn, activeTab === 'chat' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.segmentText, activeTab === 'chat' && styles.segmentTextActive]}>
                CHAT ({messages.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.segmentBtn, activeTab === 'quick' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('quick')}
            >
              <Text style={[styles.segmentText, activeTab === 'quick' && styles.segmentTextActive]}>
                QUICK
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =====================================================
            TAB 1: CHAT HISTORY
        ===================================================== */}
        {activeTab === 'chat' && (
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.emptySub}>Loading communication...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>NO MESSAGES</Text>
                <Text style={styles.emptySub}>
                  Select a Quick message or type below to broadcast to ride {rideCode}.
                </Text>
              </View>
            ) : (
              messages.map((msg, index) => {
                const isOwn =
                  (currentUser?._id && msg.senderId && String(msg.senderId) === String(currentUser._id)) ||
                  (userName && msg.senderName && msg.senderName.trim().toLowerCase() === userName.trim().toLowerCase());

                const isCaptain = msg.senderRole === 'captain';

                return (
                  <View
                    key={msg.messageId || `msg_${index}`}
                    style={[
                      styles.messageRow,
                      isOwn ? styles.messageRowOwn : styles.messageRowOther,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isOwn ? styles.bubbleOwn : styles.bubbleOther,
                      ]}
                    >
                      {/* SENDER LABEL & ROLE */}
                      <View style={styles.bubbleMeta}>
                        <Text style={[styles.bubbleSender, isOwn ? styles.bubbleSenderOwn : styles.bubbleSenderOther]}>
                          {isOwn ? 'YOU' : msg.senderName.toUpperCase()}
                        </Text>
                        {isCaptain && (
                          <Text style={[styles.roleBadge, isOwn ? styles.roleBadgeOwn : styles.roleBadgeOther]}>
                            CAPTAIN
                          </Text>
                        )}
                        <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
                          {formatTime(msg.timestamp || msg.createdAt)}
                        </Text>
                      </View>

                      {/* TEXT */}
                      <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
                        {msg.messageText}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* =====================================================
            TAB 2: QUICK MESSAGES (SWISS VERTICAL LIST)
        ===================================================== */}
        {activeTab === 'quick' && (
          <ScrollView
            style={styles.quickScroll}
            contentContainerStyle={styles.quickContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.quickHeaderBlock}>
              <Text style={styles.quickHeading}>SELECT MESSAGE</Text>
              <Text style={styles.quickHelp}>
                Tap an option to select, then press SEND.
              </Text>
            </View>

            <View style={styles.quickList}>
              {allQuickMessages.map((item, idx) => {
                const isSelected = selectedQuickMessage === item;
                return (
                  <TouchableOpacity
                    key={`q_${idx}`}
                    activeOpacity={0.7}
                    style={[
                      styles.quickRow,
                      isSelected && styles.quickRowSelected,
                    ]}
                    onPress={() => handleSelectQuick(item)}
                  >
                    <Text style={[styles.quickRowText, isSelected && styles.quickRowTextSelected]}>
                      {item.toUpperCase()}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* =====================================================
            COMPOSER (MONOCHROME / MINIMAL)
        ===================================================== */}
        <View style={styles.composerContainer}>
          {/* SELECTED QUICK PREVIEW */}
          {selectedQuickMessage && (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>SELECTED:</Text>
              <Text style={styles.previewText} numberOfLines={1}>
                {selectedQuickMessage}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedQuickMessage(null)}
                style={styles.previewClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}

          {/* INPUT BAR */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={selectedQuickMessage ? 'Quick message selected' : 'Type a message...'}
              placeholderTextColor="#636366"
              value={selectedQuickMessage ? selectedQuickMessage : customText}
              onChangeText={(t) => {
                if (selectedQuickMessage) setSelectedQuickMessage(null);
                setCustomText(t);
              }}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.sendBtn,
                !(selectedQuickMessage || customText.trim()) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={sending || !(selectedQuickMessage || customText.trim())}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.sendBtnText}>SEND</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* FOOTER COUNTER & SHORTCUT */}
          <View style={styles.composerFooter}>
            <Text style={styles.charCount}>
              {selectedQuickMessage ? `${selectedQuickMessage.length} / 300` : `${customText.length} / 300`}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab(activeTab === 'chat' ? 'quick' : 'chat')}
              style={styles.tabToggleLink}
            >
              <Text style={styles.tabToggleLinkText}>
                {activeTab === 'chat' ? 'QUICK MESSAGES →' : '← CHAT HISTORY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  /* HEADER */
  header: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    marginTop: 2,
    fontWeight: '500',
  },
  codeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLive: {
    backgroundColor: '#FFFFFF',
  },
  statusDotReady: {
    backgroundColor: '#8E8E93',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  metaSeparator: {
    fontSize: 11,
    color: '#3A3A3C',
  },
  /* SEGMENTED TABS */
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: '#000000',
  },
  /* CHAT */
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  emptySub: {
    fontSize: 12,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 18,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderBottomLeftRadius: 2,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bubbleSenderOwn: {
    color: '#FFFFFF',
  },
  bubbleSenderOther: {
    color: '#000000',
  },
  roleBadge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  roleBadgeOwn: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  roleBadgeOther: {
    backgroundColor: '#E5E5EA',
    color: '#000000',
  },
  bubbleTime: {
    fontSize: 10,
    marginLeft: 'auto',
  },
  bubbleTimeOwn: {
    color: '#636366',
  },
  bubbleTimeOther: {
    color: '#8E8E93',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  bubbleTextOwn: {
    color: '#FFFFFF',
  },
  bubbleTextOther: {
    color: '#000000',
  },
  /* QUICK MESSAGES */
  quickScroll: {
    flex: 1,
  },
  quickContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  quickHeaderBlock: {
    marginBottom: 16,
  },
  quickHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  quickHelp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  quickList: {
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    minHeight: 52,
  },
  quickRowSelected: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  quickRowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  quickRowTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  /* COMPOSER */
  composerContainer: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 6,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  previewText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewClear: {
    padding: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sendBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#2C2C2E',
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  charCount: {
    fontSize: 10,
    color: '#636366',
    fontWeight: '600',
  },
  tabToggleLink: {
    paddingVertical: 2,
  },
  tabToggleLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
});
