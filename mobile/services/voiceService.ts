/**
 * RYDO Voice Service
 * Manages WebRTC mesh peer connections for group push-to-talk voice.
 *
 * Architecture: Full mesh (every peer ↔ every peer directly via WebRTC)
 * Signaling: Existing RYDO Socket.IO (socketService.ts)
 * Audio control: PTT (push-to-talk) — mic track.enabled true/false
 * Speaker lock: Backend-authoritative (voice:request / voice:granted / voice:denied)
 *
 * Safe for both Expo Go (graceful degradation) and Development Builds (full WebRTC).
 */

import { socketService } from './socketService';

/* =====================================================
   SAFE LAZY WEBRTC MODULE ACCESS
===================================================== */

export function getWebRTCModule(): any {
  try {
    const webrtc = require('react-native-webrtc');
    if (webrtc && (webrtc.RTCPeerConnection || webrtc.default?.RTCPeerConnection)) {
      return webrtc.RTCPeerConnection ? webrtc : webrtc.default;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function isWebRTCSupported(): boolean {
  const mod = getWebRTCModule();
  return Boolean(mod && mod.RTCPeerConnection);
}

/* =====================================================
   TYPES
===================================================== */

export interface VoiceMember {
  socketId: string;
  userName: string;
  role: string;
  memberId: string;
}

export interface VoiceRoomState {
  members: VoiceMember[];
  activeSpeaker: string | null;
  activeSpeakerName: string | null;
}

type VoiceStateCallback = (state: VoiceRoomState) => void;
type SpeakerCallback = (speakerName: string | null, socketId: string | null) => void;
type StatusCallback = (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
type GrantCallback = (granted: boolean, reason?: string, blockerName?: string) => void;

/* =====================================================
   STUN / ICE CONFIGURATION
===================================================== */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

/* =====================================================
   VOICE SERVICE SINGLETON
===================================================== */

class VoiceService {
  private localStream: any | null = null;
  private peers: Map<string, any> = new Map(); // socketId → RTCPeerConnection
  private remoteStreams: Map<string, any> = new Map(); // socketId → remote stream
  private isJoined = false;
  private isSpeaking = false;
  private activeRideCode: string | null = null;
  private currentUserName: string | null = null;
  private currentRole: string | null = null;
  private currentMemberId: string | null = null;

  // Socket event cleanup refs
  private unsubscribers: (() => void)[] = [];

  // Listeners
  private stateListeners = new Set<VoiceStateCallback>();
  private speakerListeners = new Set<SpeakerCallback>();
  private statusListeners = new Set<StatusCallback>();
  private grantListeners = new Set<GrantCallback>();
  private streamListeners = new Set<(socketId: string, stream: any | null) => void>();

  private currentState: VoiceRoomState = {
    members: [],
    activeSpeaker: null,
    activeSpeakerName: null,
  };

  /* ===================================================
     JOIN VOICE ROOM
  =================================================== */

  public async join(params: {
    rideCode: string;
    userName: string;
    role: string;
    memberId: string;
  }): Promise<void> {
    const webrtc = getWebRTCModule();
    if (!webrtc) {
      this.notifyStatus('error');
      throw new Error('WebRTC native module is not available in Expo Go. Please open using the Development Build.');
    }

    if (this.isJoined && this.activeRideCode === params.rideCode.toUpperCase()) {
      console.log('[VOICE] Already joined voice room:', params.rideCode);
      return;
    }

    // Leave previous room if switching
    if (this.isJoined) {
      await this.leave();
    }

    this.activeRideCode = params.rideCode.toUpperCase().trim();
    this.currentUserName = params.userName;
    this.currentRole = params.role;
    this.currentMemberId = params.memberId;

    this.notifyStatus('connecting');

    try {
      // Acquire microphone stream (starts muted — PTT controls enable/disable)
      this.localStream = await webrtc.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
        video: false,
      });

      // Disable mic track by default (PTT — only enable when user holds button)
      this.setMicEnabled(false);

      // Register socket listeners BEFORE emitting voice:join
      this.registerSocketListeners();

      const socket = socketService.getSocket();
      if (!socket) throw new Error('Socket not connected');

      // Tell server we joined the voice room
      socket.emit('voice:join', {
        rideCode: this.activeRideCode,
        userName: this.currentUserName,
        role: this.currentRole,
        memberId: this.currentMemberId,
      });

      this.isJoined = true;
      this.notifyStatus('connected');
      console.log('[VOICE] Joined voice room:', this.activeRideCode);
    } catch (err: any) {
      console.error('[VOICE] Failed to join voice room:', err);
      this.notifyStatus('error');
      throw err;
    }
  }

  /* ===================================================
     LEAVE VOICE ROOM
  =================================================== */

  public async leave(): Promise<void> {
    const socket = socketService.getSocket();

    if (socket && this.activeRideCode) {
      socket.emit('voice:leave', { rideCode: this.activeRideCode });
    }

    this.cleanup();
    this.notifyStatus('disconnected');
    console.log('[VOICE] Left voice room');
  }

  /* ===================================================
     PUSH-TO-TALK: Request mic (HOLD)
  =================================================== */

  public requestToSpeak(): void {
    const socket = socketService.getSocket();
    if (!socket || !this.activeRideCode) return;
    if (!this.isJoined) return;

    socket.emit('voice:request', { rideCode: this.activeRideCode });
  }

  /* ===================================================
     PUSH-TO-TALK: Release mic (RELEASE)
  =================================================== */

  public releaseSpeak(): void {
    const socket = socketService.getSocket();
    if (!socket || !this.activeRideCode) return;

    if (this.isSpeaking) {
      this.setMicEnabled(false);
      this.isSpeaking = false;
      socket.emit('voice:release', { rideCode: this.activeRideCode });
    }
  }

  /* ===================================================
     MIC ENABLE/DISABLE (track.enabled)
  =================================================== */

  private setMicEnabled(enabled: boolean): void {
    if (!this.localStream) return;
    try {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = enabled;
      });
    } catch (_) {}
  }

  /* ===================================================
     SOCKET LISTENERS (WebRTC Signaling)
  =================================================== */

  private registerSocketListeners(): void {
    this.unregisterSocketListeners(); // clean up any old listeners

    const socket = socketService.getSocket();
    if (!socket) return;

    /* voice:state — initial state when joining */
    const onState = (data: any) => {
      const rideCode = String(data?.rideCode || '').toUpperCase().trim();
      if (rideCode !== this.activeRideCode) return;

      if (data.state) {
        this.currentState = data.state;
        this.notifyState();
      }

      // Initiate offers to all existing peers
      if (Array.isArray(data.peers)) {
        data.peers.forEach((peer: any) => {
          if (peer.socketId) {
            this.initiateOffer(peer.socketId);
          }
        });
      }
    };

    /* voice:member-joined — new peer entered voice room */
    const onMemberJoined = (data: any) => {
      const rideCode = String(data?.rideCode || '').toUpperCase().trim();
      if (rideCode !== this.activeRideCode) return;

      if (data.state) {
        this.currentState = data.state;
        this.notifyState();
      }

      console.log('[VOICE] Member joined:', data.userName);
    };

    /* voice:member-left — peer left voice room */
    const onMemberLeft = (data: any) => {
      const rideCode = String(data?.rideCode || '').toUpperCase().trim();
      if (rideCode !== this.activeRideCode) return;

      const leftSocketId = data.socketId;
      const pc = this.peers.get(leftSocketId);
      if (pc) {
        try { pc.close(); } catch (_) {}
        this.peers.delete(leftSocketId);
      }
      this.remoteStreams.delete(leftSocketId);
      this.streamListeners.forEach((l) => l(leftSocketId, null));

      if (data.state) {
        this.currentState = data.state;
        this.notifyState();
      }

      console.log('[VOICE] Member left:', data.userName);
    };

    /* voice:speaker — speaker lock update */
    const onSpeaker = (data: any) => {
      const rideCode = String(data?.rideCode || '').toUpperCase().trim();
      if (rideCode !== this.activeRideCode) return;

      this.currentState.activeSpeaker = data.activeSpeaker;
      this.currentState.activeSpeakerName = data.activeSpeakerName;
      this.notifyState();
      this.speakerListeners.forEach((l) => l(data.activeSpeakerName, data.activeSpeaker));
    };

    /* voice:granted — server granted us the mic */
    const onGranted = (data: any) => {
      if (String(data?.rideCode || '').toUpperCase() !== this.activeRideCode) return;
      this.isSpeaking = true;
      this.setMicEnabled(true);
      this.grantListeners.forEach((l) => l(true));
      console.log('[VOICE] Microphone granted');
    };

    /* voice:denied — server denied our mic request */
    const onDenied = (data: any) => {
      if (String(data?.rideCode || '').toUpperCase() !== this.activeRideCode) return;
      this.grantListeners.forEach((l) => l(false, data.reason, data.activeSpeakerName));
      console.log('[VOICE] Microphone denied:', data.reason);
    };

    /* voice:offer — received WebRTC offer from another peer */
    const onOffer = async (data: any) => {
      if (String(data?.rideCode || '').toUpperCase() !== this.activeRideCode) return;
      const webrtc = getWebRTCModule();
      if (!webrtc) return;

      try {
        const fromSocketId = data.fromSocketId;
        const pc = this.getOrCreatePeerConnection(fromSocketId);
        if (!pc) return;

        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const socket = socketService.getSocket();
        socket?.emit('voice:answer', {
          rideCode: this.activeRideCode,
          targetSocketId: fromSocketId,
          sdp: answer,
        });
      } catch (err) {
        console.error('[VOICE] Error handling offer:', err);
      }
    };

    /* voice:answer — received WebRTC answer from peer */
    const onAnswer = async (data: any) => {
      if (String(data?.rideCode || '').toUpperCase() !== this.activeRideCode) return;
      const webrtc = getWebRTCModule();
      if (!webrtc) return;

      try {
        const pc = this.peers.get(data.fromSocketId);
        if (!pc) return;
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('[VOICE] Error handling answer:', err);
      }
    };

    /* voice:ice-candidate — received ICE candidate from peer */
    const onIceCandidate = async (data: any) => {
      if (String(data?.rideCode || '').toUpperCase() !== this.activeRideCode) return;
      const webrtc = getWebRTCModule();
      if (!webrtc) return;

      try {
        const pc = this.peers.get(data.fromSocketId);
        if (!pc || !data.candidate) return;
        await pc.addIceCandidate(new webrtc.RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('[VOICE] Error adding ICE candidate:', err);
      }
    };

    /* voice:available — mic lock released by previous speaker */
    const onAvailable = (_data: any) => {
      console.log('[VOICE] Mic is now available');
    };

    socket.on('voice:state', onState);
    socket.on('voice:member-joined', onMemberJoined);
    socket.on('voice:member-left', onMemberLeft);
    socket.on('voice:speaker', onSpeaker);
    socket.on('voice:granted', onGranted);
    socket.on('voice:denied', onDenied);
    socket.on('voice:offer', onOffer);
    socket.on('voice:answer', onAnswer);
    socket.on('voice:ice-candidate', onIceCandidate);
    socket.on('voice:available', onAvailable);

    this.unsubscribers = [
      () => socket.off('voice:state', onState),
      () => socket.off('voice:member-joined', onMemberJoined),
      () => socket.off('voice:member-left', onMemberLeft),
      () => socket.off('voice:speaker', onSpeaker),
      () => socket.off('voice:granted', onGranted),
      () => socket.off('voice:denied', onDenied),
      () => socket.off('voice:offer', onOffer),
      () => socket.off('voice:answer', onAnswer),
      () => socket.off('voice:ice-candidate', onIceCandidate),
      () => socket.off('voice:available', onAvailable),
    ];
  }

  private unregisterSocketListeners(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }

  /* ===================================================
     WEBRTC — CREATE / GET PEER CONNECTION
  =================================================== */

  private getOrCreatePeerConnection(remoteSocketId: string): any {
    if (this.peers.has(remoteSocketId)) {
      return this.peers.get(remoteSocketId)!;
    }

    const webrtc = getWebRTCModule();
    if (!webrtc) return null;

    const pc = new webrtc.RTCPeerConnection(ICE_SERVERS);

    // Add local audio track to this peer connection
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track: any) => {
          pc.addTrack(track, this.localStream!);
        });
      } catch (err) {
        console.warn('[VOICE] Error adding track to peer connection:', err);
      }
    }

    // ICE candidate — forward to peer via signaling
    pc.addEventListener('icecandidate', (event: any) => {
      if (event.candidate) {
        const socket = socketService.getSocket();
        socket?.emit('voice:ice-candidate', {
          rideCode: this.activeRideCode,
          targetSocketId: remoteSocketId,
          candidate: event.candidate,
        });
      }
    });

    // Remote track received — this is the other person's audio
    pc.addEventListener('track', (event: any) => {
      const remoteStream = event.streams?.[0] || (webrtc.MediaStream ? new webrtc.MediaStream([event.track]) : null);
      if (remoteStream) {
        this.remoteStreams.set(remoteSocketId, remoteStream);
        this.streamListeners.forEach((l) => l(remoteSocketId, remoteStream));
        console.log('[VOICE] Got remote audio track from:', remoteSocketId);
      }
    });

    pc.addEventListener('connectionstatechange', () => {
      const state = pc.connectionState;
      console.log(`[VOICE] Peer ${remoteSocketId} connection state:`, state);
    });

    this.peers.set(remoteSocketId, pc);
    return pc;
  }

  private async initiateOffer(remoteSocketId: string): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(remoteSocketId);
      if (!pc) return;

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      const socket = socketService.getSocket();
      socket?.emit('voice:offer', {
        rideCode: this.activeRideCode,
        targetSocketId: remoteSocketId,
        sdp: offer,
      });
    } catch (err) {
      console.error('[VOICE] Error creating offer:', err);
    }
  }

  /* ===================================================
     CLEANUP
  =================================================== */

  private cleanup(): void {
    this.setMicEnabled(false);
    this.isSpeaking = false;

    // Stop all local tracks
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((t: any) => t.stop());
      } catch (_) {}
      this.localStream = null;
    }

    // Close all peer connections
    this.peers.forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    this.peers.clear();
    this.remoteStreams.clear();

    this.unregisterSocketListeners();

    this.isJoined = false;
    this.activeRideCode = null;
    this.currentState = { members: [], activeSpeaker: null, activeSpeakerName: null };
  }

  /* ===================================================
     GETTERS
  =================================================== */

  public getIsJoined(): boolean { return this.isJoined; }
  public getIsSpeaking(): boolean { return this.isSpeaking; }
  public getActiveRideCode(): string | null { return this.activeRideCode; }
  public getCurrentState(): VoiceRoomState { return this.currentState; }
  public getRemoteStreams(): Map<string, any> { return this.remoteStreams; }

  /* ===================================================
     SUBSCRIPTIONS
  =================================================== */

  public onState(cb: VoiceStateCallback): () => void {
    this.stateListeners.add(cb);
    cb(this.currentState);
    return () => this.stateListeners.delete(cb);
  }

  public onSpeaker(cb: SpeakerCallback): () => void {
    this.speakerListeners.add(cb);
    return () => this.speakerListeners.delete(cb);
  }

  public onStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public onGrant(cb: GrantCallback): () => void {
    this.grantListeners.add(cb);
    return () => this.grantListeners.delete(cb);
  }

  public onRemoteStream(cb: (socketId: string, stream: any | null) => void): () => void {
    this.streamListeners.add(cb);
    return () => this.streamListeners.delete(cb);
  }

  /* ===================================================
     NOTIFY HELPERS
  =================================================== */

  private notifyState(): void {
    this.stateListeners.forEach((l) => {
      try { l(this.currentState); } catch (_) {}
    });
  }

  private notifyStatus(status: 'connected' | 'connecting' | 'disconnected' | 'error'): void {
    this.statusListeners.forEach((l) => {
      try { l(status); } catch (_) {}
    });
  }
}

export const voiceService = new VoiceService();
