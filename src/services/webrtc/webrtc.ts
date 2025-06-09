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
  
  private onExternalStateChange: (state: CallState) => void;
  private internalCallState: CallState;
  private isInitiator = false;
  private homeId: string; 
  private userId: string; 
  private userDisplayName: string; 
  private connectedPeerId: string | null = null; 
  private unsubscribeSignaling: (() => void) | null = null; 


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
    userDisplayName: string, 
    onStateChange: (state: CallState) => void
  ) {
    this.homeId = homeId;
    this.userId = userId;
    this.userDisplayName = userDisplayName;
    this.signalingService = new SignalingService(homeId, userId); 
    this.onExternalStateChange = onStateChange;
    this.internalCallState = { isConnected: false, isConnecting: false, isCalling: false, isReceivingCall: false };
    this.onExternalStateChange(this.internalCallState); // Initial dispatch
    this.setupSignalingListeners();
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
        if (message.from === this.userId && message.to !== this.userId && message.type !== 'call-request') {
            // console.log(`WebRTCService: Ignoring self-sent message type ${message.type} not explicitly to self or not a call-request`);
            return;
        }

        switch (message.type) {
          case 'call-request':
            if (message.from !== this.userId) {
              this.handleIncomingCall(message);
            }
            break;
          case 'call-accept':
            if (message.from !== this.userId) { // Accept must be from another user
              await this.handleCallAccepted(message);
            }
            break;
          case 'call-reject':
            if (message.from !== this.userId) { // Reject must be from another user
              this.handleCallRejected(message);
            }
            break;
          case 'call-end':
            if (message.from !== this.userId) { // End must be from another user
              this.handleCallEnded(message);
            }
            break;
          case 'offer':
            if (message.from !== this.userId) { // Offer must be from another user
              await this.handleOffer(message.payload, message.from);
            }
            break;
          case 'answer':
            if (message.from !== this.userId) { // Answer must be from another user
              await this.handleAnswer(message.payload, message.from);
            }
            break;
          case 'ice-candidate':
            if (message.from !== this.userId) { // ICE candidate must be from another user
              await this.handleIceCandidate(message.payload, message.from);
            }
            break;
        }
      } catch (error) {
        console.error('WebRTCService: Error handling signaling message:', error);
        this.cleanup(); 
      }
    });
  }

  // Start a call (video or audio only)
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

  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`WebRTCService: Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        return videoTrack.enabled;
      }
    }
    return false;
  }

  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(`WebRTCService: Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        return audioTrack.enabled;
      }
    }
    return false;
  }
  
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
            payload: event.candidate.toJSON() // This one is already correct
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
          payload: new RTCSessionDescription(offer).toJSON() // Wrap with RTCSessionDescription
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

  private async handleOffer(offerData: RTCSessionDescriptionInit, fromId: string) {
    // Non-initiator (receiver who accepted) handles offers from the initiator
    if (!this.isInitiator && fromId === this.connectedPeerId) { 
      console.log("WebRTCService: Handling offer from", fromId);
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
          payload: new RTCSessionDescription(answer).toJSON() // Wrap with RTCSessionDescription
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
    // Initiator handles answers from the peer they sent an offer to
    if (this.isInitiator && this.peerConnection && fromId === this.connectedPeerId) { 
      console.log("WebRTCService: Handling answer from", fromId);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
      console.log("WebRTCService: Remote description (answer) set.");
    } else {
        console.log(`WebRTCService: Ignoring answer from ${fromId}. isInitiator: ${this.isInitiator}, connectedPeerId: ${this.connectedPeerId}`);
    }
  }

  private async handleIceCandidate(candidateData: RTCIceCandidateInit, fromId: string) {
    // Both initiator and receiver handle ICE candidates from their connected peer
    if (this.peerConnection && fromId === this.connectedPeerId) {
      try {
        console.log("WebRTCService: Adding received ICE candidate from", fromId);
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch (e) {
        console.error('WebRTCService: Error adding received ICE candidate', e);
      }
    } else {
        // console.log(`WebRTCService: Ignoring ICE candidate from ${fromId}. PeerConnection: ${!!this.peerConnection}, connectedPeerId: ${this.connectedPeerId}`);
    }
  }
  
  private cleanup() {
    console.log("WebRTCService: Cleaning up resources.");
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      console.log("WebRTCService: Local stream stopped.");
    }
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
      console.log("WebRTCService: PeerConnection closed.");
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
    this.connectedPeerId = null;
    console.log("WebRTCService: State reset.");
  }

  public destroy() {
    console.log("WebRTCService: Destroying service instance.");
    this.cleanup();
    if (this.unsubscribeSignaling) {
      this.unsubscribeSignaling();
      this.unsubscribeSignaling = null;
      console.log("WebRTCService: Signaling listener unsubscribed.");
    }
    if (this.signalingService && typeof (this.signalingService as any).cleanup === 'function') {
        (this.signalingService as any).cleanup();
        console.log("WebRTCService: SignalingService cleanup called.");
    }
  }
}
