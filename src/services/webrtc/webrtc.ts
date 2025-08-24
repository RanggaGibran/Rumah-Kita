import { SignalingService, SignalingMessage, Room } from './signaling';
import { 
  checkWebRTCConnectivity, 
  runDiagnostics, 
  DiagnosticResults
} from '../../utils/webrtcDiagnostics';

export interface Participant {
  userId: string;
  displayName: string;
  hasVideo: boolean;
  hasAudio: boolean;
  stream?: MediaStream;
  connection?: RTCPeerConnection;
}

export interface CallState {
  isConnected: boolean;
  isConnecting: boolean;
  isCalling: boolean;
  isReceivingCall: boolean;
  callerInfo?: {
    userId: string;
    displayName: string;
  };
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  
  // Room-based fields
  inRoom: boolean;
  roomId?: string;
  roomName?: string;
  participants: Record<string, Participant>;

  // Connection quality and diagnostic information
  connectionQuality?: 'good' | 'fair' | 'poor';
  diagnosticMode?: boolean;
  lastDiagnosticResult?: DiagnosticResults;
}

export class WebRTCService {
  // For backward compatibility
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private isInitiator = false;
  private connectedPeerId: string | null = null;
  
  // New room-based properties
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();  private connectionMonitors: Map<string, NodeJS.Timeout> = new Map();
  
  private signalingService: SignalingService;
  private onExternalStateChange: (state: CallState) => void;
  private internalCallState: CallState;
  private homeId: string; 
  private userId: string; 
  private userDisplayName: string; 
  private unsubscribeSignaling: (() => void) | null = null;
  private unsubscribeRoom: (() => void) | null = null;
  
  // Room joining properties
  private isJoiningRoom = false;
  private isCreatingRoom = false;
  private creationAttemptCount = 0;
  private lastCreationTime = 0;
  private roomCreationTimeout: NodeJS.Timeout | null = null;
  private joinRoomAttemptCount = 0;
  private readonly MAX_JOIN_ATTEMPTS = 2;
  private joinRoomTimeout: NodeJS.Timeout | null = null;
  private roomListenerActive = false;// STUN/TURN servers configuration
  private readonly rtcConfiguration: RTCConfiguration = {
    iceServers: [
      // Google's public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Twilio's STUN server
      { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
      // Additional public STUN servers for redundancy
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.ekiga.net:3478' },
      // Free TURN servers (limited capacity but better than nothing)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all' // Try 'relay' if we continue having issues
  };
    // ICE gathering configuration
  private readonly iceGatheringTimeout = 10000; // 10 seconds timeout for ICE gathering
  private readonly iceConnectionTimeout = 15000; // 15 seconds for connection establishmentprivate roomCreationTimeout: NodeJS.Timeout | null = null;
  constructor(
    homeId: string,
    userId: string,
    userDisplayName: string, 
    onStateChange: (state: CallState) => void
  ) {
    this.homeId = homeId;
    this.userId = userId;
    this.userDisplayName = userDisplayName;
    this.signalingService = new SignalingService(homeId, userId); 
    this.onExternalStateChange = onStateChange;
    this.internalCallState = { 
      isConnected: false, 
      isConnecting: false, 
      isCalling: false, 
      isReceivingCall: false,
      inRoom: false,
      participants: {}
    };
    this.onExternalStateChange(this.internalCallState); // Initial dispatch
    this.setupSignalingListeners();
    this.setupNetworkListeners();
  }

  private updateState(newState: Partial<CallState>) {
    this.internalCallState = { ...this.internalCallState, ...newState };
    this.onExternalStateChange(this.internalCallState);
  }
  private setupSignalingListeners() {
    if (this.unsubscribeSignaling) {
      this.unsubscribeSignaling();
      this.unsubscribeSignaling = null;
    }
    this.unsubscribeSignaling = this.signalingService.onMessage(async (message: SignalingMessage) => {
      try {
        if (message.from === this.userId && message.to !== this.userId && 
            !['call-request', 'room-join'].includes(message.type)) {
            return;
        }

        // Handle room-based messages
        if (message.roomId && this.internalCallState.roomId !== message.roomId) {
          console.log(`WebRTCService: Ignoring message for different room: ${message.roomId}`);
          return;
        }
        
        switch (message.type) {
          // Handle legacy call messages for backward compatibility
          case 'call-request':
            if (message.from !== this.userId) {
              this.handleIncomingCall(message);
            }
            break;
          case 'call-accept':
            if (message.from !== this.userId) {
              await this.handleCallAccepted(message);
            }
            break;
          case 'call-reject':
            if (message.from !== this.userId) {
              this.handleCallRejected(message);
            }
            break;
          case 'call-end':
            if (message.from !== this.userId) {
              this.handleCallEnded(message);
            }
            break;
            
          // Room-based messages
          case 'room-join':
            if (message.from !== this.userId) {
              await this.handleRoomJoin(message);
            }
            break;
          case 'room-leave':
            if (message.from !== this.userId) {
              await this.handleRoomLeave(message);
            }
            break;
          case 'offer':
            if (message.from !== this.userId) {
              await this.handleOffer(message.payload, message.from);
            }
            break;
          case 'answer':
            if (message.from !== this.userId) {
              await this.handleAnswer(message.payload, message.from);
            }
            break;
          case 'ice-candidate':
            if (message.from !== this.userId) {
              await this.handleIceCandidate(message.payload, message.from);
            }
            break;
        }      } catch (error) {        console.error('WebRTCService: Error handling signaling message:', error);
        
        // Determine if the error is a WebSocket connection issue
        const errorStr = String(error);
        const isWebSocketError = errorStr.includes('WebSocket') || 
                               errorStr.includes('rumahkita.rnggagib.me') ||
                               errorStr.includes('Connection') || 
                               errorStr.includes('network');
        
        if (isWebSocketError) {
          console.warn('WebRTCService: Detected WebSocket connection error. This is expected and being handled by the WebSocket interceptor.');
          // Log a more friendly message to help developers understand what's happening
          console.info('%cWebRTC is still functioning normally despite WebSocket errors - connections are handled through Firebase.', 
                      'color: #2196F3; font-weight: bold;');
          // Don't clean up for WebSocket errors, as they're not critical for our Firebase-based signaling
          return;
        }
        
        if (this.internalCallState.inRoom) {
          // If in a room, don't cleanup fully - just close the problematic connection
          console.log('WebRTCService: Error in room connection, but not cleaning up fully');
        } else {
          this.cleanup();
        }
      }
    });
  }  // Room-based methods
  // Track active room creation and joining to prevent duplicate operations
  private readonly MAX_CREATION_ATTEMPTS = 3;
  private readonly MIN_CREATION_INTERVAL = 5000; // 5 seconds
  async createRoom(roomName?: string, isVideoEnabled = true, isAudioEnabled = true): Promise<string> {
    // Clear any pending timeouts to prevent zombie timeouts
    if (this.roomCreationTimeout) {
      clearTimeout(this.roomCreationTimeout);
      this.roomCreationTimeout = null;
    }
    
    // Check if already in a room or connecting - strict validation
    if (this.internalCallState.isConnecting || this.internalCallState.inRoom) {
      console.warn("WebRTCService: Connection already in progress or already in a room");
      throw new Error("Koneksi sedang berlangsung atau sudah dalam ruangan");
    }
    
    // First check network connection before proceeding
    if (!this.checkNetworkConnection()) {
      console.error("WebRTCService: Cannot create room while offline");
      throw new Error("Tidak dapat membuat ruang - perangkat sedang offline. Periksa koneksi internet Anda.");
    }
    
    // Debounce: Prevent rapid creation attempts with a stricter interval
    const now = Date.now();
    if (now - this.lastCreationTime < this.MIN_CREATION_INTERVAL) {
      console.warn("WebRTCService: Room creation throttled. Please wait before trying again.");
      throw new Error("Harap tunggu sebelum mencoba membuat ruangan baru");
    }
    
    // Critical section - prevent multiple simultaneous calls to createRoom
    if (this.isCreatingRoom) {
      console.error("WebRTCService: Room creation already in progress. Ignored duplicate request.");
      throw new Error("Pembuatan ruangan sedang berlangsung");
    }
    
    // Throttle excessive attempts
    if (this.creationAttemptCount >= this.MAX_CREATION_ATTEMPTS) {
      console.error("WebRTCService: Too many failed room creation attempts. Please reload the application.");
      throw new Error("Terlalu banyak percobaan gagal. Silakan muat ulang aplikasi.");
    }
    
    // Early update of state before async operations to prevent race conditions
    this.updateState({ isConnecting: true, isConnected: false });
    
    // Set flags
    this.isCreatingRoom = true;
    this.lastCreationTime = now;
    this.creationAttemptCount++;
    
    // Setup tiered watchdog timers to provide progressive feedback
    let initialFeedbackTimeout: NodeJS.Timeout | null = null;
    let secondaryFeedbackTimeout: NodeJS.Timeout | null = null;
    
    // Main watchdog timer to prevent hanging operations
    this.roomCreationTimeout = setTimeout(() => {
      if (this.isCreatingRoom) {
        console.error("WebRTCService: Room creation operation timed out after 35 seconds");
        // Additional cleanup to prevent stuck state
        this.isCreatingRoom = false;
        this.updateState({ isConnecting: false });
        // Try to recover from stalled state
        this.emergencyReset().catch(err => console.warn("Error during emergency reset:", err));
      }
      
      // Clear other timeouts
      if (initialFeedbackTimeout) clearTimeout(initialFeedbackTimeout);
      if (secondaryFeedbackTimeout) clearTimeout(secondaryFeedbackTimeout);
    }, 35000); // Increased to 35 seconds for more resilience
    
    // Early feedback timeout - 8 seconds in
    initialFeedbackTimeout = setTimeout(() => {
      if (this.isCreatingRoom) {
        console.log("WebRTCService: Room creation in progress (early notification)");
        // This will be handled in VideoCallChat.tsx by showing a waiting message
      }
    }, 8000);
    
    // Secondary feedback - 20 seconds in
    secondaryFeedbackTimeout = setTimeout(() => {
      if (this.isCreatingRoom) {
        console.log("WebRTCService: Room creation taking longer than expected");
        // This will be handled in VideoCallChat.tsx by showing a waiting message
      }
    }, 20000);
    
    try {
      console.log(`WebRTCService: Creating a new room (Attempt ${this.creationAttemptCount}/${this.MAX_CREATION_ATTEMPTS})`);
      
      // Check for permissions first with a shorter timeout
      try {
        const permissionCheck = await Promise.race([
          navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Permission check timeout")), 5000)
          )
        ]) as MediaStream;
        
        // Stop the tracks from the permission check
        permissionCheck.getTracks().forEach(track => track.stop());
        console.log("WebRTCService: Permission check successful");
      } catch (permErr) {
        // If this fails due to a timeout, it's likely not a permission issue
        if (!(permErr instanceof Error) || !permErr.message.includes("timeout")) {
          console.error('WebRTCService: Media permission check failed:', permErr);
          throw new Error(`Gagal mendapatkan izin kamera/mikrofon: ${permErr instanceof Error ? permErr.message : 'unknown error'}`);
        }
      }
        // Get local media stream with improved error handling and retry
      let mediaStreamPromise: Promise<MediaStream>;
      let mediaError: any = null;
      
      // Try multiple times with different constraints to handle various device capabilities
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // First try with specified constraints
          const constraints: MediaStreamConstraints = {
            video: attempt === 0 ? isVideoEnabled : {facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 }},
            audio: isAudioEnabled
          };
          
          console.log(`WebRTCService: Attempting to get media (attempt ${attempt + 1}) with constraints:`, constraints);
          
          mediaStreamPromise = Promise.race([
            navigator.mediaDevices.getUserMedia(constraints),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Timeout getting user media")), 15000) // 15s timeout
            )
          ]) as Promise<MediaStream>;
          
          this.localStream = await mediaStreamPromise;
          console.log("WebRTCService: Successfully acquired media stream");
          mediaError = null; // Reset error if successful
          break; // Exit loop on success
        } catch (err) {
          mediaError = err;
          console.warn(`WebRTCService: Media acquisition attempt ${attempt + 1} failed:`, err);
          
          // If this is the first attempt and it failed, wait a bit before retry
          if (attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If all attempts failed, throw the last error
      if (mediaError) {
        console.error('WebRTCService: All attempts to get user media failed:', mediaError);
        let errorMessage = "Gagal mengakses kamera/mikrofon";
        
        if (mediaError instanceof Error) {
          if (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError") {
            errorMessage = "Izin kamera/mikrofon ditolak oleh pengguna";
          } else if (mediaError.name === "NotFoundError" || mediaError.name === "DevicesNotFoundError") {
            errorMessage = "Kamera atau mikrofon tidak ditemukan pada perangkat";
          } else if (mediaError.name === "NotReadableError" || mediaError.name === "TrackStartError") {
            errorMessage = "Kamera atau mikrofon sedang digunakan oleh aplikasi lain";
          } else if (mediaError.name === "OverconstrainedError") {
            errorMessage = "Tidak dapat menemukan kamera/mikrofon yang cocok dengan pengaturan";
          } else if (mediaError.message.includes("Timeout")) {
            errorMessage = "Waktu habis saat mencoba mengakses kamera/mikrofon";
          }
        }
        
        throw new Error(errorMessage);
      }
      
      if (!this.localStream) {
        throw new Error("WebRTCService: getUserMedia returned null stream");
      }
      
      // Create room using network resilient method
      const roomId = await this.withNetworkRetry(
        () => this.signalingService.createRoom(roomName, isVideoEnabled, isAudioEnabled),
        3,  // 3 retry attempts
        1500 // Start with 1.5s delay, will increase with exponential backoff
      );
      console.log(`WebRTCService: Room created with ID ${roomId}`);
      
      // Join the room we just created with network resilience
      await this.withNetworkRetry(
        () => this.joinRoomWithStream(roomId, this.userDisplayName, isVideoEnabled, isAudioEnabled, this.localStream!),
        2,  // 2 retry attempts
        2000 // Start with 2s delay
      );
      console.log(`WebRTCService: Successfully joined created room ${roomId}`);
        // Reset counter on successful creation
      this.creationAttemptCount = 0;
      return roomId;
    } catch (error) {
      console.error('WebRTCService: Failed to create room:', error);
      
      // Clear any watchdog timeout
      if (this.roomCreationTimeout) {
        clearTimeout(this.roomCreationTimeout);
        this.roomCreationTimeout = null;
      }
      
      // If media was obtained but room creation failed, clean up media resources
      if (this.localStream) {
        this.cleanupMedia();
      }
      
      // Reset state immediately to ensure UI can recover
      this.updateState({
        isConnecting: false,
        isConnected: false
      });
      
      // Add specific handling for common errors with more descriptive messages
      if (error instanceof Error) {
        if (error.message.includes("getUserMedia") || 
            error.message.includes("Permission denied") ||
            error.message.includes("camera") ||
            error.message.includes("microphone")) {
          throw new Error("Gagal mengakses kamera atau mikrofon. Pastikan izin diberikan dan perangkat tersedia.");
        } else if (error.message.includes("Timeout")) {
          throw new Error("Waktu pembuatan ruangan habis. Mohon periksa koneksi internet Anda.");
        } else if (error.name === "AbortError") {
          throw new Error("Operasi dibatalkan. Mungkin izin kamera/mikrofon ditolak.");
        } else if (error.name === "NotFoundError") {
          throw new Error("Kamera atau mikrofon tidak ditemukan pada perangkat Anda.");
        }
      }
      
      throw error;
    } finally {
      // Clear any watchdog timeout that might still be active
      if (this.roomCreationTimeout) {
        clearTimeout(this.roomCreationTimeout);
        this.roomCreationTimeout = null;
      }
      
      // Always reset the creation flag to prevent locked state
      const wasCreating = this.isCreatingRoom;
      this.isCreatingRoom = false;
      
      if (wasCreating) {        console.log("WebRTCService: Completed room creation process (success or failure)");
      }        // Gradually reduce creation attempt counter over time
      if (this.creationAttemptCount > 0) {
        setTimeout(() => {
          this.creationAttemptCount = Math.max(0, this.creationAttemptCount - 1);
          console.log(`WebRTCService: Reduced creation attempt counter to ${this.creationAttemptCount}`);
        }, 60000); // Reduce counter after 1 minute
      }
    }
}

  private async joinRoomWithStream(
    roomId: string, 
    displayName: string,
    isVideoEnabled: boolean,
    isAudioEnabled: boolean,
    stream: MediaStream
  ): Promise<void> {
    // Clear any pending timeouts
    if (this.joinRoomTimeout) {
      clearTimeout(this.joinRoomTimeout);
      this.joinRoomTimeout = null;
    }
    
    // Avoid excessive retries
    if (this.joinRoomAttemptCount >= this.MAX_JOIN_ATTEMPTS) {
      console.error(`WebRTCService: Too many room join attempts (${this.joinRoomAttemptCount}). Abandoning.`);
      this.joinRoomAttemptCount = 0;
      throw new Error("Terlalu banyak percobaan bergabung dengan ruang. Silakan coba lagi nanti.");
    }
    
    this.joinRoomAttemptCount++;
      // Set up watchdog timer with extended timeout
    this.joinRoomTimeout = setTimeout(() => {
      console.error("WebRTCService: Room joining operation timed out");
      this.updateState({ isConnecting: false });
      // Try to recover from stalled state
      this.emergencyReset().catch(err => console.warn("Error during emergency reset after join timeout:", err));
    }, 25000); // Increased to 25 seconds to allow more time for connection establishment
    
    try {
      console.log(`WebRTCService: Joining room with stream (Attempt ${this.joinRoomAttemptCount}/${this.MAX_JOIN_ATTEMPTS})`);
      
      // Join the room in the signaling service
      const joined = await this.signalingService.joinRoom(
        roomId, 
        displayName, 
        isVideoEnabled, 
        isAudioEnabled
      );
      
      if (!joined) {
        throw new Error("WebRTC: Gagal bergabung dengan ruangan");
      }
      
      // Set up room update listener
      this.setupRoomListener(roomId);
      
      // Update our state
      this.updateState({
        inRoom: true,
        roomId: roomId,
        localStream: stream,
        isConnecting: true,
        isConnected: false,
        isCalling: false,
        isReceivingCall: false
      });
      
      // Reset attempt counter on success
      this.joinRoomAttemptCount = 0;
      console.log(`WebRTCService: Successfully joined room ${roomId}`);
    } catch (error) {
      console.error('WebRTCService: Error in joinRoomWithStream:', error);
      
      // Handle WebSocket specific errors by ignoring them
      // WebSocket errors are expected and handled by the interceptor
      const errorStr = String(error);
      const isWebSocketError = errorStr.includes('WebSocket') || 
                              errorStr.includes('rumahkita.rnggagib.me');
      
      if (isWebSocketError) {
        console.warn('WebRTCService: WebSocket error ignored - this is expected and not critical');
        
        // Try to continue despite WebSocket error
        try {
          this.setupRoomListener(roomId);
          
          this.updateState({
            inRoom: true,
            roomId: roomId,
            localStream: stream,
            isConnecting: true,
            isConnected: false,
            isCalling: false,
            isReceivingCall: false
          });
          
          // Reset attempt counter on success
          this.joinRoomAttemptCount = 0;
          console.log(`WebRTCService: Continuing with room ${roomId} despite WebSocket error`);
          return;
        } catch (innerError) {
          console.error('WebRTCService: Failed to recover from WebSocket error:', innerError);
        }
      }
      
      // Clean up media resources if join failed
      this.cleanupMedia();
      throw error;
    } finally {
      // Clear the watchdog timeout
      if (this.joinRoomTimeout) {
        clearTimeout(this.joinRoomTimeout);
        this.joinRoomTimeout = null;
      }
    }
  }
  
  async leaveRoom(): Promise<void> {
    try {
      const roomId = this.internalCallState.roomId;
      if (!roomId) {
        console.warn("WebRTCService: Not in a room, nothing to leave");
        return;
      }
      
      console.log(`WebRTCService: Leaving room ${roomId}`);
      
      // Leave room in signaling service
      await this.signalingService.leaveRoom(roomId);
      
      // Cleanup
      this.cleanupRoom();
      
    } catch (error) {
      console.error('WebRTCService: Failed to leave room:', error);
      // Still attempt to cleanup local state
      this.cleanupRoom();
      throw error;
    }  }
    
  private setupRoomListener(roomId: string) {
    // Prevent duplicate listeners for the same room
    if (this.unsubscribeRoom) {
      console.log(`WebRTCService: Removing existing room listener before setting up new one`);
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    
    if (this.roomListenerActive) {
      console.log(`WebRTCService: Room listener already active. Avoiding duplicate setup.`);
      return;
    }
    
    this.roomListenerActive = true;
    console.log(`WebRTCService: Setting up room listener for ${roomId}`);
    
    this.unsubscribeRoom = this.signalingService.onRoomUpdated(roomId, async (room) => {
      if (!room) {
        console.log(`WebRTCService: Room ${roomId} no longer exists`);
        this.cleanupRoom();
        this.roomListenerActive = false;
        return;
      }
      
      if (!room.active) {
        console.log(`WebRTCService: Room ${roomId} is no longer active`);
        this.cleanupRoom();
        this.roomListenerActive = false;
        return;
      }
      
      // Update room info in state
      this.updateState({
        roomName: room.name
      });
      
      // Process participants
      const participants = room.participants || {};
      const currentParticipantIds = Object.keys(this.internalCallState.participants);
      const newParticipantIds = Object.keys(participants);
      
      // Find participants that are new (need to establish connection)
      for (const id of newParticipantIds) {
        if (id !== this.userId && !currentParticipantIds.includes(id)) {
          console.log(`WebRTCService: New participant detected: ${id}`);
          
          // Add to our local state
          const newParticipants = { ...this.internalCallState.participants };
          newParticipants[id] = {
            userId: id,
            displayName: participants[id].displayName,
            hasVideo: participants[id].hasVideo,
            hasAudio: participants[id].hasAudio
          };
          
          this.updateState({ participants: newParticipants });
          
          // Create peer connection for this user
          if (this.localStream) {
            try {
              await this.createPeerConnection(id);
            } catch (error) {
              console.error(`WebRTCService: Error creating peer connection for ${id}:`, error);
            }
          }
        }
      }
      
      // Find participants that have left
      for (const id of currentParticipantIds) {
        if (id !== this.userId && !newParticipantIds.includes(id)) {
          console.log(`WebRTCService: Participant left: ${id}`);
          this.closePeerConnection(id);
          
          // Remove from our local state
          const newParticipants = { ...this.internalCallState.participants };
          delete newParticipants[id];
          this.updateState({ participants: newParticipants });
        }
      }
      
      // Update connection state
      const hasOtherParticipants = newParticipantIds.filter(id => id !== this.userId).length > 0;
      if (hasOtherParticipants && !this.internalCallState.isConnected) {
        this.updateState({ isConnected: true, isConnecting: false });
      } else if (!hasOtherParticipants && this.internalCallState.isConnected) {
        this.updateState({ isConnected: false, isConnecting: false });
      }
    });
  }
  
  // Start a call (video or audio only) - Legacy method for backward compatibility
  async startCall(isVideoCall = true): Promise<void> {
    try {
      this.isInitiator = true;
      this.updateState({ isCalling: true, isConnecting: false, isConnected: false, remoteStream: undefined, localStream: undefined });
      console.log("WebRTCService: Starting call, isVideo:", isVideoCall);

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      if (!this.localStream) throw new Error("getUserMedia returned null stream");
      this.updateState({ localStream: this.localStream });
      console.log("WebRTCService: Local stream obtained.");

      // Send to 'all' but expect others to ignore if it's from themselves or if they are busy
      await this.signalingService.sendMessage({
        type: 'call-request',
        from: this.userId,
        to: 'all', 
        payload: { isVideoCall, callerDisplayName: this.userDisplayName }
      });
      console.log("WebRTCService: Call request sent.");
      await this.signalingService.setUserStatus('in-call');
    } catch (error) {
      console.error('WebRTCService: Failed to start call:', error);
      this.cleanup(); 
      throw error;
    }
  }

  // New method for direct calls to specific users
  async startDirectCall(targetUserId: string, isVideoCall = true): Promise<void> {
    try {
      this.isInitiator = true;
      this.connectedPeerId = targetUserId; // Set the peer ID immediately to target the specific user
      this.updateState({ 
        isCalling: true, 
        isConnecting: false, 
        isConnected: false, 
        remoteStream: undefined, 
        localStream: undefined 
      });
      console.log(`WebRTCService: Starting direct call to ${targetUserId}, isVideo:`, isVideoCall);

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      if (!this.localStream) throw new Error("getUserMedia returned null stream");
      this.updateState({ localStream: this.localStream });
      console.log("WebRTCService: Local stream obtained for direct call.");

      // Send directly to the target user
      await this.signalingService.sendMessage({
        type: 'call-request',
        from: this.userId,
        to: targetUserId,
        payload: { isVideoCall, callerDisplayName: this.userDisplayName }
      });
      console.log(`WebRTCService: Direct call request sent to ${targetUserId}.`);
      await this.signalingService.setUserStatus('in-call');
    } catch (error) {
      console.error('WebRTCService: Failed to start direct call:', error);
      this.cleanup(); 
      throw error;
    }
  }

  // Accept incoming call
  async acceptCall(): Promise<void> {
    const callerId = this.internalCallState.callerInfo?.userId;
    if (!callerId) {
        console.error("WebRTCService: Cannot accept call, callerInfo is missing.");
        this.updateState({ isReceivingCall: false });
        return;
    }
    this.connectedPeerId = callerId; 

    try {
      this.updateState({ isConnecting: true, isReceivingCall: false, isConnected: false, remoteStream: undefined });
      console.log("WebRTCService: Accepting call from", callerId);

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true, 
        audio: true
      });
      if (!this.localStream) throw new Error("getUserMedia returned null stream for acceptCall");
      this.updateState({ localStream: this.localStream });
      console.log("WebRTCService: Local stream obtained for accepting call.");

      await this.signalingService.sendMessage({
        type: 'call-accept',
        from: this.userId,
        to: callerId 
      });
      console.log("WebRTCService: Call accept message sent to", callerId);
      
      await this.setupPeerConnection();
      await this.signalingService.setUserStatus('in-call');
    } catch (error) {
      console.error('WebRTCService: Failed to accept call:', error);
      this.cleanup();
      throw error;
    }
  }

  // Reject incoming call
  async rejectCall(): Promise<void> {
    const callerId = this.internalCallState.callerInfo?.userId;
    if (!callerId) {
        console.warn("WebRTCService: Cannot reject call, callerInfo is missing.");
        this.updateState({ isReceivingCall: false }); 
        return;
    }
    try {
      console.log("WebRTCService: Rejecting call from", callerId);
      await this.signalingService.sendMessage({
        type: 'call-reject',
        from: this.userId,
        to: callerId
      });
      this.updateState({
        isReceivingCall: false,
        callerInfo: undefined
      });
    } catch (error) {
      console.error('WebRTCService: Failed to send reject call message:', error);
      this.updateState({
        isReceivingCall: false,
        callerInfo: undefined
      });
    }
  }

  // End current call
  async endCall(): Promise<void> {
    try {
      console.log("WebRTCService: Ending call.");
      const target = this.connectedPeerId || 'all'; // If not connected to specific, send to all to clear any pending states
      await this.signalingService.sendMessage({
        type: 'call-end',
        from: this.userId,
        to: target 
      });
      await this.signalingService.setUserStatus('available');
    } catch (error) {
      console.error('WebRTCService: Failed to send end call message:', error);
    } finally {
      this.cleanup(); 
    }
  }
  async toggleVideo(): Promise<boolean> {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`WebRTCService: Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        
        // If in a room, update participant media status
        if (this.internalCallState.inRoom) {
          const audioEnabled = this.localStream.getAudioTracks()[0]?.enabled ?? false;
          await this.signalingService.updateParticipantMedia(videoTrack.enabled, audioEnabled);
        }
        
        return videoTrack.enabled;
      }
    }
    return false;
  }

  async toggleAudio(): Promise<boolean> {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(`WebRTCService: Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        
        // If in a room, update participant media status
        if (this.internalCallState.inRoom) {
          const videoEnabled = this.localStream.getVideoTracks()[0]?.enabled ?? false;
          await this.signalingService.updateParticipantMedia(videoEnabled, audioTrack.enabled);
        }
        
        return audioTrack.enabled;
      }
    }
    return false;
  }
    // Legacy method for backward compatibility
  private async setupPeerConnection(): Promise<void> {
    if (this.peerConnection) {
        console.log("WebRTCService: PeerConnection already exists. Closing previous before creating new.");
        this.peerConnection.close();
        this.peerConnection = null;
    }
    console.log("WebRTCService: Setting up PeerConnection.");
    this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) { 
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });
      console.log("WebRTCService: Local stream tracks added to PeerConnection.");
    } else {
      console.warn("WebRTCService: Local stream not available for PeerConnection setup.");
    }

    this.peerConnection.ontrack = (event) => {
      console.log("WebRTCService: Remote track received.");
      this.remoteStream = event.streams[0];
      this.updateState({
        remoteStream: this.remoteStream,
        isConnected: true, 
        isConnecting: false
      });
    };

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const targetId = this.connectedPeerId;
        if (targetId) {
          console.log("WebRTCService: Sending ICE candidate to", targetId);
          await this.signalingService.sendMessage({
            type: 'ice-candidate',
            from: this.userId,
            to: targetId,
            payload: event.candidate.toJSON()
          });
        } else {
          console.warn("WebRTCService: No targetId to send ICE candidate to. This might happen if call was rejected/ended before ICE negotiation completed.");
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        console.log("WebRTCService: PeerConnection state changed to", state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          console.log("WebRTCService: PeerConnection disconnected/failed/closed. Cleaning up.");
          this.cleanup(); 
        } else if (state === 'connected') {
             this.updateState({ isConnected: true, isConnecting: false });
        } else if (state === 'connecting') {
            this.updateState({ isConnecting: true, isConnected: false });
        }
      }
    };
  }
  
  // Room-based peer connection methods
  private async createPeerConnection(targetUserId: string): Promise<RTCPeerConnection> {
    // Close existing connection if any
    this.closePeerConnection(targetUserId);
    
    console.log(`WebRTCService: Creating peer connection for user ${targetUserId}`);
      // Create new RTCPeerConnection
    const peerConnection = new RTCPeerConnection(this.rtcConfiguration);
    this.peerConnections.set(targetUserId, peerConnection);
    
    // Add local stream tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }
    
    // Start connection monitoring for auto-recovery
    this.monitorConnection(targetUserId);
    
    // Start bandwidth monitoring for quality adaptation
    this.adaptMediaQuality(peerConnection, targetUserId);
    
    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await this.signalingService.sendMessage({
            type: 'ice-candidate',
            from: this.userId,
            to: targetUserId,
            roomId: this.internalCallState.roomId,
            payload: event.candidate.toJSON()
          });
        } catch (error) {
          console.error(`WebRTCService: Error sending ICE candidate to ${targetUserId}:`, error);
        }
      }
    };
    
    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log(`WebRTCService: Received track from ${targetUserId}`);
      
      const stream = event.streams[0];
      if (!stream) return;
      
      this.remoteStreams.set(targetUserId, stream);
      
      // Update participant in state
      const newParticipants = { ...this.internalCallState.participants };
      if (newParticipants[targetUserId]) {
        newParticipants[targetUserId] = {
          ...newParticipants[targetUserId],
          stream
        };
        
        this.updateState({ participants: newParticipants });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`WebRTCService: Connection state for ${targetUserId} changed to ${state}`);
      
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.closePeerConnection(targetUserId);
      }
    };
    
    // Create and send offer if we're initiating
    if (this.internalCallState.inRoom) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await this.signalingService.sendMessage({
          type: 'offer',
          from: this.userId,
          to: targetUserId,
          roomId: this.internalCallState.roomId,
          payload: offer
        });
        
        console.log(`WebRTCService: Sent offer to ${targetUserId}`);
      } catch (error) {
        console.error(`WebRTCService: Error creating/sending offer to ${targetUserId}:`, error);
        this.closePeerConnection(targetUserId);
        throw error;
      }
    }
    
    return peerConnection;
  }
    private closePeerConnection(targetUserId: string) {
    const peerConnection = this.peerConnections.get(targetUserId);
    if (peerConnection) {
      console.log(`WebRTCService: Closing peer connection for ${targetUserId}`);
      
      // Clean up event handlers
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.onicegatheringstatechange = null;
      
      // Close the connection
      peerConnection.close();
      this.peerConnections.delete(targetUserId);
      
      // Remove the stream
      this.remoteStreams.delete(targetUserId);
      
      // Clear connection monitors
      const monitor = this.connectionMonitors.get(targetUserId);
      if (monitor) {
        clearInterval(monitor);
        this.connectionMonitors.delete(targetUserId);
        console.log(`WebRTCService: Cleared connection monitor for ${targetUserId}`);
      }
      
      // Clear bandwidth monitoring
      const bandwidthMonitor = this.connectionMonitors.get(`${targetUserId}-bandwidth`);
      if (bandwidthMonitor) {
        clearInterval(bandwidthMonitor);
        this.connectionMonitors.delete(`${targetUserId}-bandwidth`);
        console.log(`WebRTCService: Cleared bandwidth monitor for ${targetUserId}`);
      }
      
      // Update participant in state
      const newParticipants = { ...this.internalCallState.participants };
      if (newParticipants[targetUserId]) {
        newParticipants[targetUserId] = {
          ...newParticipants[targetUserId],
          stream: undefined,
          connection: undefined
        };
        
        this.updateState({ participants: newParticipants });
      }
    }
  }

  private handleIncomingCall(message: SignalingMessage) {
    if (this.internalCallState.isCalling || this.internalCallState.isConnecting || this.internalCallState.isConnected || this.internalCallState.isReceivingCall) {
      console.log("WebRTCService: Already in a call or processing one. Ignoring new call-request from:", message.from);
      this.signalingService.sendMessage({ type: 'call-reject', from: this.userId, to: message.from, payload: { reason: 'busy' } });
      return;
    }
    console.log("WebRTCService: Handling incoming call from", message.from);
    this.updateState({
      isReceivingCall: true,
      callerInfo: {
        userId: message.from,
        displayName: message.payload?.callerDisplayName || message.from 
      }
    });
  }

  private async handleCallAccepted(message: SignalingMessage) { 
    if (this.isInitiator && message.from !== this.userId) { 
      this.connectedPeerId = message.from; 
      console.log("WebRTCService: Call accepted by", this.connectedPeerId);
      this.updateState({ isConnecting: true, isCalling: false });
      
      await this.setupPeerConnection(); 
      if (this.peerConnection) {
        console.log("WebRTCService: Initiator creating offer for", this.connectedPeerId);
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        await this.signalingService.sendMessage({
          type: 'offer',
          from: this.userId,
          to: this.connectedPeerId, 
          payload: offer // <-- FIX: send offer directly, do not use offer.toJSON()
        });
        console.log("WebRTCService: Offer sent to", this.connectedPeerId);
      }
    }
  }
  
  private handleCallRejected(message: SignalingMessage) {
    if (this.isInitiator && (this.internalCallState.isCalling || this.internalCallState.isConnecting) && message.from === this.connectedPeerId ) {
        console.log(`WebRTCService: Call rejected by ${message.from}. Reason: ${message.payload?.reason}`);
        this.cleanup(); 
    } else if (this.isInitiator && this.internalCallState.isCalling && message.to === 'all'){
        // This case might happen if a general reject is sent to 'all' by someone not specifically targeted yet.
        // Or if the call request was to 'all' and someone rejects it.
        console.log(`WebRTCService: Call request to 'all' was rejected by ${message.from}. Reason: ${message.payload?.reason}`);
        // If we are still in 'isCalling' state and haven't connected to anyone, a reject from anyone means we stop trying.
        if(!this.connectedPeerId) this.cleanup();
    }
  }
  private handleCallEnded(message: SignalingMessage) {
    if ((this.internalCallState.isConnected && message.from === this.connectedPeerId) || 
        (this.internalCallState.isConnecting && message.from === this.connectedPeerId) || 
        (this.internalCallState.isCalling && !this.connectedPeerId && message.from !== this.userId) || // If still calling 'all' and someone ends
        (this.internalCallState.isReceivingCall && message.from === this.internalCallState.callerInfo?.userId) // If receiving a call and caller ends
    ) {
        console.log(`WebRTCService: Call ended by ${message.from}. Cleaning up.`);
        this.cleanup();
    }
  }
  
  // Room-based handlers
  private async handleRoomJoin(message: SignalingMessage) {
    if (!this.internalCallState.inRoom || !this.internalCallState.roomId) {
      console.log(`WebRTCService: Ignoring room join for ${message.from}, not in a room`);
      return;
    }
    
    if (message.roomId !== this.internalCallState.roomId) {
      console.log(`WebRTCService: Ignoring room join for different room: ${message.roomId}`);
      return;
    }
    
    console.log(`WebRTCService: User ${message.from} joined room ${message.roomId}`);
    
    // Add the participant to our local state
    const newParticipants = { ...this.internalCallState.participants };
    newParticipants[message.from] = {
      userId: message.from,
      displayName: message.payload?.displayName || 'Unknown User',
      hasVideo: message.payload?.hasVideo || false,
      hasAudio: message.payload?.hasAudio || false
    };
    
    this.updateState({ participants: newParticipants });
    
    // If we have a local stream, initiate connection with the new participant
    if (this.localStream) {
      await this.createPeerConnection(message.from);
    }
  }
  
  private async handleRoomLeave(message: SignalingMessage) {
    if (!this.internalCallState.inRoom || !this.internalCallState.roomId) {
      return;
    }
    
    if (message.roomId !== this.internalCallState.roomId) {
      return;
    }
    
    console.log(`WebRTCService: User ${message.from} left room ${message.roomId}`);
    
    // Remove the participant from our local state
    const newParticipants = { ...this.internalCallState.participants };
    delete newParticipants[message.from];
    
    // Close and remove peer connection for this participant
    this.closePeerConnection(message.from);
    
    this.updateState({ participants: newParticipants });
  }
  private async handleOffer(offerData: RTCSessionDescriptionInit, fromId: string) {
    // Room-based offer handling
    if (this.internalCallState.inRoom && this.internalCallState.participants[fromId]) {
      console.log(`WebRTCService: Handling room-based offer from ${fromId}`);
      
      let peerConnection = this.peerConnections.get(fromId);
      
      // Create connection if it doesn't exist
      if (!peerConnection) {
        peerConnection = new RTCPeerConnection(this.rtcConfiguration);
        this.peerConnections.set(fromId, peerConnection);
        
        // Add local tracks
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => {
            peerConnection!.addTrack(track, this.localStream!);
          });
        }
        
        // Set up event handlers
        this.setupPeerConnectionEvents(peerConnection, fromId);
      }
      
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData));
        console.log(`WebRTCService: Remote description (offer) set for ${fromId}`);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log(`WebRTCService: Local description (answer) created and set for ${fromId}`);
        
        await this.signalingService.sendMessage({
          type: 'answer',
          from: this.userId,
          to: fromId,
          roomId: this.internalCallState.roomId,
          payload: answer
        });
        console.log(`WebRTCService: Answer sent to ${fromId}`);
      } catch (error) {
        console.error(`WebRTCService: Error handling offer from ${fromId}:`, error);
        this.closePeerConnection(fromId);
      }
      
      return;
    }
    
    // Legacy path for backward compatibility
    if (!this.isInitiator && fromId === this.connectedPeerId) { 
      console.log("WebRTCService: Handling legacy offer from", fromId);
      if (!this.peerConnection) {
          console.log("WebRTCService: PeerConnection not ready for offer, setting up now.");
          await this.setupPeerConnection();
      }
      if (this.peerConnection) {
        this.updateState({ isConnecting: true });
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerData));
        console.log("WebRTCService: Remote description (offer) set.");
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        console.log("WebRTCService: Local description (answer) created and set.");
        await this.signalingService.sendMessage({
          type: 'answer',
          from: this.userId,
          to: fromId, 
          payload: answer
        });
        console.log("WebRTCService: Answer sent to", fromId);
      } else {
        console.error("WebRTCService: PeerConnection is null, cannot handle offer.");
      }
    } else {
        console.log(`WebRTCService: Ignoring offer from ${fromId}. isInitiator: ${this.isInitiator}, connectedPeerId: ${this.connectedPeerId}`);
    }
  }

  private async handleAnswer(answerData: RTCSessionDescriptionInit, fromId: string) {
    // Room-based answer handling
    if (this.internalCallState.inRoom && this.internalCallState.participants[fromId]) {
      console.log(`WebRTCService: Handling room-based answer from ${fromId}`);
      
      const peerConnection = this.peerConnections.get(fromId);
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
          console.log(`WebRTCService: Remote description (answer) set for ${fromId}`);
        } catch (error) {
          console.error(`WebRTCService: Error handling answer from ${fromId}:`, error);
          this.closePeerConnection(fromId);
        }
      } else {
        console.warn(`WebRTCService: Received answer from ${fromId} but no peer connection found`);
      }
      
      return;
    }
    
    // Legacy path for backward compatibility
    if (this.isInitiator && this.peerConnection && fromId === this.connectedPeerId) { 
      console.log("WebRTCService: Handling legacy answer from", fromId);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
      console.log("WebRTCService: Remote description (answer) set.");
    } else {
        console.log(`WebRTCService: Ignoring legacy answer from ${fromId}. isInitiator: ${this.isInitiator}, connectedPeerId: ${this.connectedPeerId}`);
    }
  }

  private async handleIceCandidate(candidateData: RTCIceCandidateInit, fromId: string) {
    // Room-based ICE candidate handling
    if (this.internalCallState.inRoom && this.internalCallState.participants[fromId]) {
      console.log(`WebRTCService: Handling room-based ICE candidate from ${fromId}`);
      
      const peerConnection = this.peerConnections.get(fromId);
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
        } catch (error) {
          console.error(`WebRTCService: Error adding ICE candidate from ${fromId}:`, error);
        }
      } else {
        console.warn(`WebRTCService: Received ICE candidate from ${fromId} but no peer connection found`);
      }
      
      return;
    }
    
    // Legacy path for backward compatibility
    if (this.peerConnection && fromId === this.connectedPeerId) {
      try {
        console.log("WebRTCService: Adding legacy ICE candidate from", fromId);
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (e) {
        console.error('WebRTCService: Error adding legacy ICE candidate', e);
      }
    }
  }
  
  // Helper for setting up event listeners on peer connections
  private setupPeerConnectionEvents(peerConnection: RTCPeerConnection, targetUserId: string) {
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await this.signalingService.sendMessage({
            type: 'ice-candidate',
            from: this.userId,
            to: targetUserId,
            roomId: this.internalCallState.roomId,
            payload: event.candidate.toJSON()
          });
        } catch (error) {
          console.error(`WebRTCService: Error sending ICE candidate to ${targetUserId}:`, error);
        }
      }
    };
    
    peerConnection.ontrack = (event) => {
      console.log(`WebRTCService: Received track from ${targetUserId}`);
      
      const stream = event.streams[0];
      if (!stream) return;
      
      this.remoteStreams.set(targetUserId, stream);
      
      // Update participant in state
      const newParticipants = { ...this.internalCallState.participants };
      if (newParticipants[targetUserId]) {
        newParticipants[targetUserId] = {
          ...newParticipants[targetUserId],
          stream
        };
        
        this.updateState({ participants: newParticipants });
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`WebRTCService: Connection state for ${targetUserId} changed to ${state}`);
      
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.closePeerConnection(targetUserId);
      }
    };
  }
  
  /**
   * Enhanced cleanup for media resources with better error handling
   */
  private cleanupMedia() {
    console.log("WebRTCService: Cleaning up media resources");
    
    // Clean up local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn("WebRTCService: Error stopping local track:", err);
        }
      });
      this.localStream = null;
    }
    
    // Clean up remote streams
    this.remoteStreams.forEach((stream, userId) => {
      try {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.warn(`WebRTCService: Error stopping remote track from ${userId}:`, err);
          }
        });
      } catch (err) {
        console.warn(`WebRTCService: Error cleaning up remote stream from ${userId}:`, err);
      }
    });
    this.remoteStreams.clear();
    
    console.log("WebRTCService: Media resources cleanup completed");
  }
  
  /**
   * Clean up peer connections with improved error handling
   */
  private cleanupPeerConnections() {
    // Close all peer connections
    this.peerConnections.forEach((connection, userId) => {
      try {
        console.log(`WebRTCService: Closing peer connection for ${userId}`);
        
        // Clean up event handlers
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.onconnectionstatechange = null;
        
        // Close the connection
        connection.close();
      } catch (err) {
        console.warn(`WebRTCService: Error closing peer connection for ${userId}:`, err);
      }
    });
    this.peerConnections.clear();
    
    // Also clean up legacy peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
      } catch (err) {
        console.warn("WebRTCService: Error closing legacy peer connection:", err);
      }
      this.peerConnection = null;
    }
  }
  
  /**
   * Clean up room resources
   */
  private cleanupRoom() {
    console.log("WebRTCService: Cleaning up room resources");
    
    // Reset operation flags to prevent issues with subsequent operations
    this.isCreatingRoom = false;
    this.isJoiningRoom = false;
    this.roomListenerActive = false;
    
    // Clean up all peer connections
    this.peerConnections.forEach((connection, userId) => {
      this.closePeerConnection(userId);
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
    
    // Clean up room listener
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    
    // Clean up media
    this.cleanupMedia();
    
    // Reset state
    this.updateState({
      inRoom: false,
      roomId: undefined,
      roomName: undefined,
      participants: {},
      isConnected: false,
      isConnecting: false
    });
    
    console.log("WebRTCService: Room cleanup complete");
  }
  
  /**
   * Perform complete cleanup of all WebRTC resources
   */
  private cleanup() {
    console.log("WebRTCService: Cleaning up all resources");
    
    // Reset all operation flags to prevent any ongoing operations
    this.isCreatingRoom = false;
    this.isJoiningRoom = false;
    this.roomListenerActive = false;
    this.creationAttemptCount = 0;
    this.lastCreationTime = 0;
    
    // Clean up any timeouts
    if (this.roomCreationTimeout) {
      clearTimeout(this.roomCreationTimeout);
      this.roomCreationTimeout = null;
    }
    
    if (this.joinRoomTimeout) {
      clearTimeout(this.joinRoomTimeout);
      this.joinRoomTimeout = null;
    }
    
    // Clean up all monitoring intervals
    this.connectionMonitors.forEach((monitor, id) => {
      clearInterval(monitor);
      console.log(`WebRTCService: Cleared monitor for ${id}`);
    });
    this.connectionMonitors.clear();
    
    // Clean up room if needed
    if (this.internalCallState.inRoom) {
      this.cleanupRoom();
    }
    
    // Clean up media resources
    this.cleanupMedia();
    
    // Clean up peer connections
    this.cleanupPeerConnections();
    
    // Reset state completely
    this.updateState({
      isConnected: false,
      isConnecting: false,
      isCalling: false,
      isReceivingCall: false,
      localStream: undefined,
      remoteStream: undefined,
      callerInfo: undefined,
      inRoom: false,
      roomId: undefined,
      roomName: undefined,
      participants: {},
      connectionQuality: undefined
    });
    
    this.isInitiator = false;
    this.connectedPeerId = null;
    
    console.log("WebRTCService: Cleanup complete");
  }
    /**
   * Emergency reset method - can be called if the application detects
   * that the service is stuck in a bad state
   * This is a comprehensive reset that attempts to recover from any state
   */
  async emergencyReset(): Promise<void> {
    console.warn("WebRTCService: Performing emergency reset");
    
    try {
      // Try to leave any room first, but don't wait for it if it fails
      if (this.internalCallState.inRoom && this.internalCallState.roomId) {
        try {
          console.log(`WebRTCService: Emergency leaving room ${this.internalCallState.roomId}`);
          await Promise.race([
            this.signalingService.leaveRoom(this.internalCallState.roomId),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Room leave timeout")), 3000))
          ]);
        } catch (leaveError) {
          console.warn("WebRTCService: Error leaving room during emergency reset:", leaveError);
          // Continue with reset regardless of leave error
        }
      }
      
      // Clear all operational flags immediately to prevent race conditions
      this.isCreatingRoom = false;
      this.isJoiningRoom = false;
      this.creationAttemptCount = 0;
      this.joinRoomAttemptCount = 0;
      this.roomListenerActive = false;
      this.lastCreationTime = 0;
      this.isInitiator = false;
      this.connectedPeerId = null;
      
      // Clear all timeouts
      [
        this.roomCreationTimeout,
        this.joinRoomTimeout
      ].forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      this.roomCreationTimeout = null;
      this.joinRoomTimeout = null;
      
      // Clean up all media resources with enhanced error handling
      try {
        await this.cleanupMediaEnhanced();
      } catch (mediaError) {
        console.error("WebRTCService: Error in media cleanup:", mediaError);
      }
      
      // Clean up peer connections
      this.cleanupPeerConnections();
      
      // Try to reset Firebase signaling status
      try {
        await Promise.race([
          this.signalingService.setUserStatus('available'),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Status update timeout")), 2000))
        ]);
      } catch (statusError) {
        console.warn("WebRTCService: Error resetting user status:", statusError);
      }
      
      // Clean up signaling listeners and recreate them
      if (this.unsubscribeSignaling) {
        this.unsubscribeSignaling();
        this.unsubscribeSignaling = null;
      }
      
      if (this.unsubscribeRoom) {
        this.unsubscribeRoom();
        this.unsubscribeRoom = null;
      }
      
      // Reset state completely
      this.updateState({
        isConnected: false,
        isConnecting: false,
        isCalling: false,
        isReceivingCall: false,
        inRoom: false,
        roomId: undefined,
        roomName: undefined,
        callerInfo: undefined,
        localStream: undefined,
        remoteStream: undefined,
        participants: {}
      });
      
      // Re-setup listeners after a small delay to ensure everything is properly reset
      setTimeout(() => {
        try {
          this.setupSignalingListeners();
          console.log("WebRTCService: Signaling listeners restored after reset");
        } catch (listenerError) {
          console.error("WebRTCService: Error restoring listeners after reset:", listenerError);
        }
      }, 500);
      
      console.log("WebRTCService: Emergency reset completed successfully");
    } catch (error) {
      console.error("WebRTCService: Error during emergency reset:", error);
      // Still need to ensure critical flags are reset even if errors occur
      this.isCreatingRoom = false;
      this.isJoiningRoom = false;
      
      // Force state reset even on error
      this.updateState({
        isConnected: false,
        isConnecting: false,
        inRoom: false
      });
    }
  }

  // Enhanced media cleanup with more thorough error handling
  private async cleanupMediaEnhanced(): Promise<void> {
    console.log("WebRTCService: Enhanced cleanup of media resources");
    
    // Cleanup local stream
    if (this.localStream) {
      try {
        const tracks = this.localStream.getTracks();
        
        // Create a promise for each track stop operation
        const stopPromises = tracks.map(track => {
          return new Promise<void>((resolve) => {
            try {
              console.log(`WebRTCService: Stopping local ${track.kind} track`);
              track.stop();
              track.enabled = false;
              resolve();
            } catch (err) {
              console.warn(`WebRTCService: Error stopping local ${track.kind} track:`, err);
              resolve(); // Still resolve to continue with cleanup
            }
          });
        });
        
        // Wait for all tracks to be stopped with a timeout
        await Promise.race([
          Promise.all(stopPromises),
          new Promise(resolve => setTimeout(resolve, 2000)) // Maximum 2s for media cleanup
        ]);
      } catch (err) {
        console.warn("WebRTCService: Error cleaning up local stream:", err);
      } finally {
        this.localStream = null;
      }
    }
    
    // Clean up remote streams with similar approach
    const remoteUserIds = Array.from(this.remoteStreams.keys());
    for (const userId of remoteUserIds) {
      const stream = this.remoteStreams.get(userId);
      if (stream) {
        try {
          const tracks = stream.getTracks();
          for (const track of tracks) {
            try {
              track.stop();
              track.enabled = false;
            } catch (err) {
              console.warn(`WebRTCService: Error stopping remote track from ${userId}:`, err);
            }
          }
        } catch (err) {
          console.warn(`WebRTCService: Error cleaning up remote stream from ${userId}:`, err);
        }
      }
    }
    
    this.remoteStreams.clear();
    this.remoteStream = null;
  }
  
  /**
   * Complete destroy method to be called when the service is no longer needed
   * This should be called when the component using the service unmounts
   */
  async destroy(): Promise<void> {
    console.log("WebRTCService: Destroying service");
    
    // First attempt an emergency reset to ensure all flags are cleared
    await this.emergencyReset();
    
    // Ensure we leave any room we might be in
    if (this.internalCallState.inRoom && this.internalCallState.roomId) {
      try {
        await this.signalingService.leaveRoom(this.internalCallState.roomId);
      } catch (error) {
        console.warn("WebRTCService: Error leaving room during destroy:", error);
      }
    }
    
    // Clean up all resources
    this.cleanup();
    
    // Extra cleanup to ensure signaling service listeners are removed
    if (this.unsubscribeSignaling) {
      this.unsubscribeSignaling();
      this.unsubscribeSignaling = null;
    }
    
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    
    // Clean up the signaling service
    try {
      await this.signalingService.cleanup();
    } catch (error) {
      console.warn("WebRTCService: Error cleaning up signaling service:", error);
    }
    
    console.log("WebRTCService: Service destroyed");
  }

  // Helper methods to get room info
  getActiveRooms(): Promise<Room[]> {
    return this.signalingService.getActiveRooms();
  }
  
  getCurrentRoomId(): string | null {
    return this.signalingService.getCurrentRoomId();
  }

  // Network detection helpers
  private isOffline: boolean = false;
  // Make public to allow external components to check network status
  checkNetworkConnection(): boolean {
    const online = window.navigator.onLine;
    if (!online && !this.isOffline) {
      console.warn("WebRTCService: Device is offline - network connection lost");
      this.isOffline = true;
    } else if (online && this.isOffline) {
      console.log("WebRTCService: Network connection restored");
      this.isOffline = false;
    }
    return online;
  }

  private setupNetworkListeners() {
    // Add network event listeners
    window.addEventListener('online', () => {
      console.log("WebRTCService: Network came online");
      this.isOffline = false;
      
      // If we were in the middle of creating a room, we might want to notify the UI
      if (this.isCreatingRoom) {
        console.log("WebRTCService: Network restored during room creation");
      }
    });
    
    window.addEventListener('offline', () => {
      console.warn("WebRTCService: Network went offline");
      this.isOffline = true;
      
      // If we were in the middle of creating a room, we might want to notify the UI
      if (this.isCreatingRoom) {
        console.error("WebRTCService: Network lost during room creation");
      }
    });
  }

  // Helper method to make Firebase operations more resilient
  private async withNetworkRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3,
    initialRetryDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    let delay = initialRetryDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check network status before attempting
        if (!this.checkNetworkConnection()) {
          console.warn(`WebRTCService: Network appears to be offline, waiting before attempt ${attempt + 1}`);
          const currentDelay = delay;
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          
          // Double the retry delay for next attempt (exponential backoff)
          delay *= 2;
          continue;
        }
        
        // Attempt the operation
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a network related error
        const isNetworkError = 
          error.code === 'NETWORK_ERROR' || 
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.message?.includes('connection') ||
          !this.checkNetworkConnection();
        
        if (isNetworkError && attempt < maxRetries) {
          const currentDelay = delay;
          console.warn(`WebRTCService: Network error detected (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${currentDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          
          // Double the retry delay for next attempt (exponential backoff)
          delay *= 2;
        } else {
          // Either not a network error or we've exhausted retries
          throw error;
        }
      }
    }
    
    // If we get here, we've exhausted all retries
    throw lastError || new Error('Operation failed after multiple retries');
  }
  // Network status utility methods for UI components
  isNetworkAvailable(): boolean {
    return window.navigator.onLine;
  }
  
  getNetworkStatus(): { online: boolean, offline: boolean } {
    return {
      online: window.navigator.onLine,
      offline: this.isOffline
    };
  }
  
  // Helper method for ICE connection handling with restart capability
  private async createAndSendOffer(
    peerConnection: RTCPeerConnection, 
    targetUserId: string, 
    iceRestart: boolean = false
  ): Promise<void> {
    try {
      // Create offer with optional ICE restart
      const offerOptions: RTCOfferOptions = iceRestart ? { iceRestart: true } : {};
      console.log(`WebRTCService: Creating offer for ${targetUserId}${iceRestart ? ' with ICE restart' : ''}`);
      
      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);
      
      // Send the offer through signaling
      if (this.internalCallState.roomId) {
        await this.signalingService.sendMessage({
          type: 'offer',
          from: this.userId,
          to: targetUserId,
          roomId: this.internalCallState.roomId,
          payload: offer
        });
        console.log(`WebRTCService: Offer sent to ${targetUserId}`);
      } else {
        throw new Error(`Cannot send offer - not in a room`);
      }
    } catch (error) {
      console.error(`WebRTCService: Error creating/sending offer to ${targetUserId}:`, error);
      throw error;
    }
  }

  // Handle reconnection with specific participant
  private async handleReconnection(targetUserId: string): Promise<void> {
    try {
      console.log(`WebRTCService: Attempting reconnection with ${targetUserId}`);
      
      // First, clean up existing connection
      this.closePeerConnection(targetUserId);
      
      // Wait a short moment to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create new connection if we're still in the room
      if (this.internalCallState.inRoom && this.internalCallState.roomId) {
        await this.createPeerConnection(targetUserId);
        console.log(`WebRTCService: Reconnection attempt with ${targetUserId} completed`);
      } else {
        console.log(`WebRTCService: Skipped reconnection with ${targetUserId} - no longer in room`);
      }
    } catch (error) {
      console.error(`WebRTCService: Reconnection with ${targetUserId} failed:`, error);
    }
  }

  /**
   * Monitor WebRTC connections and attempt automatic recovery when needed
   * @param targetUserId The participant ID to monitor
   */
  private monitorConnection(targetUserId: string): void {
    const peerConnection = this.peerConnections.get(targetUserId);
    if (!peerConnection) return;
    
    let recoveryAttempts = 0;
    let lastConnectionState = peerConnection.connectionState;
    let lastIceConnectionState = peerConnection.iceConnectionState;
    let iceGatheringStartTime = Date.now();
    let connectionTimeout: NodeJS.Timeout | null = null;
    
    const clearConnectionTimeout = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
    };
    
    // Monitor ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
      const state = peerConnection.iceGatheringState;
      console.log(`WebRTCService: ICE gathering state for ${targetUserId} changed to ${state}`);
      
      if (state === 'gathering') {
        iceGatheringStartTime = Date.now();
        
        // Set timeout for ICE gathering
        connectionTimeout = setTimeout(async () => {
          if (peerConnection.iceGatheringState === 'gathering') {
            console.warn(`WebRTCService: ICE gathering timeout for ${targetUserId}`);
            
            // Try to recover the connection
            if (recoveryAttempts < 2) {
              recoveryAttempts++;
              console.log(`WebRTCService: Attempting recovery #${recoveryAttempts} for ${targetUserId}`);
              
              // Get optimized ICE servers
              try {
                const optimizedIceServers = await this.getOptimalIceServers();
                
                // Apply new ICE configuration
                peerConnection.setConfiguration({
                  ...this.rtcConfiguration,
                  iceServers: optimizedIceServers,
                  iceTransportPolicy: recoveryAttempts > 1 ? 'relay' : 'all' // Force TURN on second try
                });
                
                // Restart ICE gathering
                if (peerConnection.restartIce && this.localStream) {
                  peerConnection.restartIce();
                  await this.createAndSendOffer(peerConnection, targetUserId, true);
                }
              } catch (err) {
                console.error(`WebRTCService: Recovery attempt failed for ${targetUserId}:`, err);
              }
            }
          }
          connectionTimeout = null;
        }, this.iceGatheringTimeout);
      } else if (state === 'complete') {
        clearConnectionTimeout();
        console.log(`WebRTCService: ICE gathering completed for ${targetUserId} in ${Date.now() - iceGatheringStartTime}ms`);
      }
    };
    
    // Enhanced connection state monitoring
    const enhancedConnectionMonitor = setInterval(() => {
      if (!this.peerConnections.has(targetUserId) || !peerConnection) {
        clearInterval(enhancedConnectionMonitor);
        clearConnectionTimeout();
        return;
      }
      
      const currentState = peerConnection.connectionState;
      const currentIceState = peerConnection.iceConnectionState;
      
      // Only log if state changed
      if (currentState !== lastConnectionState || currentIceState !== lastIceConnectionState) {
        console.log(`WebRTCService: Connection monitor - ${targetUserId} connection:${currentState}, ice:${currentIceState}`);
               lastConnectionState = currentState;
        lastIceConnectionState = currentIceState;
      }
      
      // Attempt recovery for problematic states
      if ((currentState === 'failed' || currentIceState === 'failed') && recoveryAttempts < 2) {
        recoveryAttempts++;
        console.log(`WebRTCService: Auto-recovery #${recoveryAttempts} triggered for ${targetUserId}`);
        
        // Schedule recovery with exponential backoff
        setTimeout(async () => {
          try {
                       // Check if connection is still relevant
            if (!this.peerConnections.has(targetUserId)) return;
            
            const optimizedIceServers = await this.getOptimalIceServers();
            
            // Apply recovery configuration
            peerConnection.setConfiguration({
              ...this.rtcConfiguration,
              iceServers: optimizedIceServers,
              iceTransportPolicy: recoveryAttempts > 1 ? 'relay' : 'all'
            });
            
            // Restart ICE and create new offer
            if (peerConnection.restartIce && this.localStream) {
              peerConnection.restartIce();
              await this.createAndSendOffer(peerConnection, targetUserId, true);
              console.log(`WebRTCService: Recovery attempt #${recoveryAttempts} completed for ${targetUserId}`);
            }
          } catch (err) {
            console.error(`WebRTCService: Auto-recovery attempt failed:`, err);
          }
        }, recoveryAttempts * 2000); // Exponential backoff (2s, 4s)
      }
      
      // Collect connection statistics for diagnostics
      if (this.internalCallState.diagnosticMode) {
        this.logConnectionStats(peerConnection, targetUserId);
      }
    }, 5000); // Check every 5 seconds
    
    // Store the interval for cleanup
    this.connectionMonitors.set(targetUserId, enhancedConnectionMonitor);
  }
  
  /**
   * Log connection statistics for diagnostics
   */
  private async logConnectionStats(peerConnection: RTCPeerConnection, targetUserId: string): Promise<void> {
    try {
      const stats = await peerConnection.getStats();
      let rttSum = 0;
      let rttCount = 0;
      let packetsLost = 0;
      let packetsReceived = 0;
      
      stats.forEach(report => {
        if (report.type === 'remote-inbound-rtp' && report.roundTripTime) {
          rttSum += report.roundTripTime;
          rttCount++;
        }
        
        if (report.type === 'inbound-rtp') {
          packetsLost = report.packetsLost || 0;
          packetsReceived = report.packetsReceived || 0;
        }
      });
      
      // Calculate average RTT
      const averageRtt = rttCount > 0 ? rttSum / rttCount : 0;
      
      // Calculate packet loss percentage
      const packetLossPercentage = 
        (packetsReceived + packetsLost > 0) ? 
          (packetsLost / (packetsReceived + packetsLost) * 100) : 0;
      
      // Determine connection quality
      let connectionQuality: 'good' | 'fair' | 'poor' = 'good';
      if (averageRtt > 0.300 || packetLossPercentage > 10) {
        connectionQuality = 'poor';
      } else if (averageRtt > 0.150 || packetLossPercentage > 3) {
        connectionQuality = 'fair';
      }
      
      // Only log significant changes or in diagnostic mode
      if (
        this.internalCallState.connectionQuality !== connectionQuality || 
        this.internalCallState.diagnosticMode
      ) {
        console.log(`WebRTCService: Connection quality for ${targetUserId}: ${connectionQuality}, RTT: ${Math.round(averageRtt * 1000)}ms, Packet loss: ${packetLossPercentage.toFixed(1)}%`);
        
        // Update state with connection quality
        this.updateState({
          connectionQuality
        });
      }
    } catch (err) {
      // Don't log errors in production as this is just diagnostic info
      if (this.internalCallState.diagnosticMode) {
        console.warn(`WebRTCService: Error collecting connection stats:`, err);
      }
    }
  }

  // Add diagnostic methods
  /**
   * Run WebRTC connectivity diagnostics
   * @returns Diagnostic results
   */
  public async runDiagnostics(): Promise<DiagnosticResults> {
    console.log('WebRTCService: Running WebRTC diagnostics');
    
    try {
      const results = await runDiagnostics();
      
      // Store the diagnostic results in the call state
      this.updateState({
        lastDiagnosticResult: results
      });
      
      return results;
    } catch (error) {
      console.error('WebRTCService: Error running diagnostics:', error);
      throw error;
    }
  }
  
  /**
   * Check if WebRTC connections are possible
   * @returns True if connections are possible
   */
  public async checkConnectivity(): Promise<boolean> {
    try {
      console.log('WebRTCService: Checking WebRTC connectivity');
      const { canConnect } = await checkWebRTCConnectivity();
      return canConnect;
    } catch (error) {
      console.error('WebRTCService: Error checking connectivity:', error);
      return false;
    }
  }
  
  /**
   * Enable diagnostic mode to collect additional connection metrics and logs
   */
  public enableDiagnosticMode(enabled: boolean = true): void {
    console.log(`WebRTCService: ${enabled ? 'Enabling' : 'Disabling'} diagnostic mode`);
    
    this.updateState({
      diagnosticMode: enabled
    });
    
    // Reset diagnostic results when disabling
    if (!enabled && this.internalCallState.lastDiagnosticResult) {
      this.updateState({
        lastDiagnosticResult: undefined
      });
    }
  }
    /**
   * Get optimal ICE servers based on connectivity test results
   * This method prioritizes TURN servers if STUN isn't working
   */
  public async getOptimalIceServers(): Promise<RTCIceServer[]> {
    try {
      // Run a quick connectivity check
      const diagnostics = await this.runDiagnostics();
      
      // Default configuration
      const iceServers = this.rtcConfiguration.iceServers || [];
      
      // If STUN doesn't work but TURN does, prioritize TURN servers
      if (!diagnostics.stunConnectivity.success && diagnostics.turnConnectivity.success) {
        console.log('WebRTCService: STUN not working, prioritizing TURN servers');
        
        // Move TURN servers to the beginning of the array
        const turnServers = iceServers
          .filter(server => {
            const urls = typeof server.urls === 'string' ? server.urls : server.urls?.[0] || '';
                       return urls.includes('turn:');
          });
          
        const stunServers = iceServers
          .filter(server => {
            const urls = typeof server.urls === 'string' ? server.urls : server.urls?.[0] || '';
            return !urls.includes('turn:');
          });
          
        return [...turnServers, ...stunServers];
      } else if (!diagnostics.turnConnectivity.success && diagnostics.stunConnectivity.success) {
        console.log('WebRTCService: TURN not working but STUN is, using only STUN servers');
        
        // Filter to only use working STUN servers
        return iceServers
          .filter(server => {
            const urls = typeof server.urls === 'string' ? server.urls : server.urls?.[0] || '';
            return urls.includes('stun:');
          });
      } else if (!diagnostics.stunConnectivity.success && !diagnostics.turnConnectivity.success) {
        console.log('WebRTCService: Both STUN and TURN not working, using all available servers as fallback');
        // Try all available servers as a last resort
        return iceServers;
  }
      
      return iceServers;
    } catch (error) {
      console.error('WebRTCService: Error getting optimal ICE servers:', error);
      // Fall back to default configuration
      return this.rtcConfiguration.iceServers || [];
    }
  }
  
  /**
   * Auto-recover WebRTC connection during connection establishment
   * This tries different network strategies if the initial connection fails
   */
  private async attemptConnectionRecovery(
    targetUserId: string, 
    retryCount = 0
  ): Promise<boolean> {
    if (retryCount >= 2) {
      console.warn(`WebRTCService: Maximum recovery attempts reached for user ${targetUserId}`);
      return false;
    }
    
    console.log(`WebRTCService: Attempting connection recovery for user ${targetUserId} (attempt ${retryCount + 1})`);
    
    try {
      const peerConnection = this.peerConnections.get(targetUserId);
      if (!peerConnection) {
        console.warn(`WebRTCService: No peer connection found for ${targetUserId}`);
        return false;
      }
      
      // Try with different ICE servers based on diagnostics
      const optimizedIceServers = await this.getOptimalIceServers();
      
      if (peerConnection.iceConnectionState !== 'connected' && 
          peerConnection.iceConnectionState !== 'completed' &&
          peerConnection.connectionState !== 'connected') {
        
        // Apply new ICE configuration
        try {
          peerConnection.setConfiguration({
            ...this.rtcConfiguration,
            iceServers: optimizedIceServers,
            iceTransportPolicy: retryCount === 1 ? 'relay' : 'all' // Force TURN on second retry
          });
          
          console.log(`WebRTCService: Applied new ICE configuration for ${targetUserId} with ${
            optimizedIceServers.length
          } servers, transport policy: ${retryCount === 1 ? 'relay' : 'all'}`);
          
          // Trigger ICE restart if allowed
          if (peerConnection.restartIce) {
            peerConnection.restartIce();
            console.log(`WebRTCService: Restarted ICE gathering for ${targetUserId}`);
            
            // Create and send a new offer with ICE restart
            if (this.localStream) {
              await this.createAndSendOffer(peerConnection, targetUserId, true);
              return true;
            }
          }
        } catch (err) {
          console.error('WebRTCService: Error applying recovery configuration:', err);
        }
      }
      
      return false;
    } catch (error) {
      console.error('WebRTCService: Error during connection recovery:', error);
      return false;
    }
  }
  /**
   * Adapts the media quality based on bandwidth estimation
   * This helps with poor network conditions by reducing video resolution when needed
   */
  private adaptMediaQuality(peerConnection: RTCPeerConnection, targetUserId: string): void {
    if (!this.localStream || !peerConnection) return;
    
    let lastBandwidthEstimate = 0;
    let consecutiveLowBandwidth = 0;
    let adaptationCount = 0;
    const MAX_ADAPTATIONS = 2;
    
    // Video quality levels for adaptation (from best to worst)
    const videoConstraints = [
      { width: { ideal: 1280 }, height: { ideal: 720 } }, // HD
      { width: { ideal: 640 }, height: { ideal: 360 } },  // SD
      { width: { ideal: 320 }, height: { ideal: 240 } }   // Low
    ];
    
    // Set sampling interval for bandwidth estimation
    const bandwidthSamplingInterval = setInterval(async () => {
      // Stop if connection is gone or peerConnection is null
      if (!this.peerConnections.has(targetUserId) || !peerConnection) {
        clearInterval(bandwidthSamplingInterval);
        return;
      }
      
      try {
        // Get connection stats
        const stats = await peerConnection.getStats();
        let currentBandwidth = 0;
        
        // Calculate available bandwidth based on stats
        stats.forEach(report => {
          // Look for outbound-rtp stats with bytesTransmitted info
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.bytesSent && report.timestamp && lastBandwidthEstimate) {
              const bytesSent = report.bytesSent;
              const timeDelta = report.timestamp - lastBandwidthEstimate;
              if (timeDelta > 0) {
                // Calculate bandwidth in kbps
                currentBandwidth = 8 * (bytesSent - lastBandwidthEstimate) / timeDelta;
                lastBandwidthEstimate = bytesSent;
              }
            } else if (report.bytesSent) {
              lastBandwidthEstimate = report.bytesSent;
            }
          }
        });
        
        // Check if we need to adapt quality based on bandwidth
        if (currentBandwidth > 0) {
          // Low bandwidth detection (500kbps threshold for decent video)
          if (currentBandwidth < 500 && adaptationCount < MAX_ADAPTATIONS) {
            consecutiveLowBandwidth++;
            
            // Only adapt after consistent low bandwidth
            if (consecutiveLowBandwidth >= 2) {
              console.log(`WebRTCService: Low bandwidth detected (${Math.round(currentBandwidth)}kbps), adapting video quality`);
              
              // Get video track to adapt
              const videoTrack = this.localStream?.getVideoTracks()?.[0];
              if (videoTrack) {
                adaptationCount++;
                
                // Apply lower quality constraints based on adaptation count
                const constraints = videoConstraints[adaptationCount];
                try {
                  await videoTrack.applyConstraints(constraints);
                  console.log(`WebRTCService: Reduced video quality to ${constraints.width.ideal}x${constraints.height.ideal}`);
                } catch (err) {
                  console.warn('WebRTCService: Could not apply video constraints:', err);
                }
                consecutiveLowBandwidth = 0;
              }
            }
          } else if (currentBandwidth > 1500 && consecutiveLowBandwidth > 0) {
            // Reset counter when bandwidth is good
            consecutiveLowBandwidth = 0;
          }
          
          // Update connection quality in state
          let connectionQuality: 'good' | 'fair' | 'poor' = 'good';
          if (currentBandwidth < 250) {
            connectionQuality = 'poor';
          } else if (currentBandwidth < 750) {
            connectionQuality = 'fair';
          }
          
          if (this.internalCallState.connectionQuality !== connectionQuality) {
            this.updateState({ connectionQuality });
          }
        }
      } catch (err) {
        // Don't log errors in production as this is just optimization
        if (this.internalCallState.diagnosticMode) {
          console.warn('WebRTCService: Error monitoring bandwidth:', err);
        }
      }
    }, 5000); // Check every 5 seconds
    
    // Store interval for cleanup
    this.connectionMonitors.set(`${targetUserId}-bandwidth`, bandwidthSamplingInterval);
  }

  /**
   * Join an existing room by roomId
   */
  async joinRoom(roomIdInput: string, isVideoEnabled = true, isAudioEnabled = true): Promise<void> {
    // Prevent multiple simultaneous calls to joinRoom
    if (this.isJoiningRoom || this.isCreatingRoom || this.internalCallState.inRoom) {
      console.warn("WebRTCService: Room joining already in progress or already in a room. Ignored duplicate request.");
      throw new Error("Room joining already in progress or already in a room");
    }
    
    this.isJoiningRoom = true;
    
    try {
      console.log(`WebRTCService: Joining room ${roomIdInput}`);
      
      // Get local media stream
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled
        });
      } catch (error: any) {
        console.error('WebRTCService: Failed to get user media:', error);
        const errorMessage = error?.message || 'unknown error';
        throw new Error(`Failed to access camera/microphone: ${errorMessage}`);
      }
      
      if (!this.localStream) {
        throw new Error("Failed to get media stream");
      }
      
      // Update state with local stream
      this.updateState({
        isConnecting: true,
        localStream: this.localStream
      });
      
      // Join the room through signaling service
      await this.signalingService.joinRoom(roomIdInput, this.userDisplayName, isVideoEnabled, isAudioEnabled);
      
      // Set internal state
      this.updateState({
        inRoom: true,
        roomId: roomIdInput,
        roomName: `Room ${roomIdInput}`
      });
      
      console.log(`WebRTCService: Successfully joined room ${roomIdInput}`);
    } catch (error) {
      console.error('WebRTCService: Error joining room:', error);
      this.cleanupMedia();
      this.isJoiningRoom = false;
      throw error;
    } finally {
      this.isJoiningRoom = false;
    }
  }
}
