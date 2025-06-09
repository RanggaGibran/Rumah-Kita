import { SignalingService, SignalingMessage } from './signaling';

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
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private signalingService: SignalingService;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onStateChange: (state: CallState) => void;
  private isInitiator = false;

  // STUN/TURN servers configuration
  private readonly rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  constructor(
    homeId: string, 
    userId: string, 
    onStateChange: (state: CallState) => void
  ) {
    this.signalingService = new SignalingService(homeId, userId);
    this.onStateChange = onStateChange;
    this.setupSignalingListeners();
  }

  private setupSignalingListeners() {
    this.signalingService.onMessage(async (message: SignalingMessage) => {
      try {
        switch (message.type) {
          case 'call-request':
            this.handleIncomingCall(message);
            break;
          case 'call-accept':
            await this.handleCallAccepted();
            break;
          case 'call-reject':
            this.handleCallRejected();
            break;
          case 'call-end':
            this.handleCallEnded();
            break;
          case 'offer':
            await this.handleOffer(message.payload);
            break;
          case 'answer':
            await this.handleAnswer(message.payload);
            break;
          case 'ice-candidate':
            await this.handleIceCandidate(message.payload);
            break;
        }
      } catch (error) {
        console.error('Error handling signaling message:', error);
      }
    });
  }

  // Start a call (video or audio only)
  async startCall(isVideoCall = true): Promise<void> {
    try {
      this.isInitiator = true;
      this.updateState({ isCalling: true, isConnecting: false });

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });

      this.updateState({ localStream: this.localStream });

      // Send call request
      await this.signalingService.sendMessage({
        type: 'call-request',
        from: this.signalingService['userId'],
        to: 'all', // Send to all other users in the home
        payload: { isVideoCall }
      });

      await this.signalingService.setUserStatus('in-call');
    } catch (error) {
      console.error('Failed to start call:', error);
      this.updateState({ isCalling: false });
      throw error;
    }
  }

  // Accept incoming call
  async acceptCall(): Promise<void> {
    try {
      this.updateState({ isConnecting: true, isReceivingCall: false });

      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Always request video, user can turn off later
        audio: true
      });

      this.updateState({ localStream: this.localStream });

      // Send acceptance
      await this.signalingService.sendMessage({
        type: 'call-accept',
        from: this.signalingService['userId'],
        to: 'all'
      });

      // Set up peer connection for the receiver
      await this.setupPeerConnection();
      await this.signalingService.setUserStatus('in-call');
    } catch (error) {
      console.error('Failed to accept call:', error);
      this.rejectCall();
      throw error;
    }
  }

  // Reject incoming call
  async rejectCall(): Promise<void> {
    try {
      await this.signalingService.sendMessage({
        type: 'call-reject',
        from: this.signalingService['userId'],
        to: 'all'
      });

      this.updateState({ 
        isReceivingCall: false, 
        callerInfo: undefined 
      });
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  }

  // End current call
  async endCall(): Promise<void> {
    try {
      await this.signalingService.sendMessage({
        type: 'call-end',
        from: this.signalingService['userId'],
        to: 'all'
      });

      this.cleanup();
      await this.signalingService.setUserStatus('available');
    } catch (error) {
      console.error('Failed to end call:', error);
      this.cleanup(); // Still cleanup local resources
    }
  }

  // Toggle video on/off
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle audio on/off
  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.updateState({ 
        remoteStream: this.remoteStream,
        isConnected: true,
        isConnecting: false 
      });
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.signalingService.sendMessage({
          type: 'ice-candidate',
          from: this.signalingService['userId'],
          to: 'all',
          payload: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.handleCallEnded();
        }
      }
    };
  }

  private handleIncomingCall(message: SignalingMessage) {
    this.updateState({
      isReceivingCall: true,
      callerInfo: {
        userId: message.from,
        displayName: 'Caller' // You can enhance this with user data
      }
    });
  }

  private async handleCallAccepted() {
    if (this.isInitiator) {
      this.updateState({ isConnecting: true, isCalling: false });
      await this.setupPeerConnection();
      
      // Create and send offer
      if (this.peerConnection) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        await this.signalingService.sendMessage({
          type: 'offer',
          from: this.signalingService['userId'],
          to: 'all',
          payload: offer
        });
      }
    }
  }

  private handleCallRejected() {
    this.updateState({ 
      isCalling: false,
      isConnecting: false 
    });
    this.cleanup();
  }

  private handleCallEnded() {
    this.cleanup();
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      await this.setupPeerConnection();
    }

    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await this.signalingService.sendMessage({
        type: 'answer',
        from: this.signalingService['userId'],
        to: 'all',
        payload: answer
      });
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(answer);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private updateState(updates: Partial<CallState>) {
    const currentState: CallState = {
      isConnected: false,
      isConnecting: false,
      isCalling: false,
      isReceivingCall: false,
      localStream: this.localStream || undefined,
      remoteStream: this.remoteStream || undefined,
      ...updates
    };
    
    this.onStateChange(currentState);
  }

  private cleanup() {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.updateState({
      isConnected: false,
      isConnecting: false,
      isCalling: false,
      isReceivingCall: false,
      localStream: undefined,
      remoteStream: undefined,
      callerInfo: undefined
    });

    this.isInitiator = false;
  }

  // Cleanup when component unmounts
  async destroy() {
    this.cleanup();
    await this.signalingService.cleanup();
  }
}
