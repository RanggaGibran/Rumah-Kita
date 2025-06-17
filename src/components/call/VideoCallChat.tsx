import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WebRTCService, CallState, Participant } from '../../services/webrtc/webrtc';
import { ChatMessage, UserProfile } from '../../types/user';
import { getHomeMemberProfiles } from '../../services/firebase/user';
import WebRTCDiagnostics from './WebRTCDiagnostics';
import { DiagnosticResults } from '../../utils/webrtcDiagnostics';

interface VideoCallChatProps {
  homeId: string;
}

const VideoCallChat: React.FC<VideoCallChatProps> = ({ homeId }) => {
  const { currentUser, userProfile } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isConnecting: false,
    isCalling: false,
    isReceivingCall: false,
    inRoom: false,
    participants: {}
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  
  // Direct call state
  const [homeMembers, setHomeMembers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Diagnostics state
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);

  // Detect screen size changes
  useLayoutEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Service initialization lock to prevent multiple instances
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Initialize WebRTC service
  useEffect(() => {
    if (!currentUser || !homeId) return;
    
    let isEffectActive = true;
    
    async function initializeService() {
      if (isInitializing) return;
      
      try {
        setIsInitializing(true);
        
        // Clean up any existing instance
        if (webrtcServiceRef.current) {
          await webrtcServiceRef.current.destroy();
          webrtcServiceRef.current = null;
        }
        
        if (!isEffectActive) return;
          const displayName = userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Anonymous User';
        
        if (!currentUser) {
          throw new Error("User must be logged in to make calls");
        }
        
        const newService = new WebRTCService(
          homeId,
          currentUser.uid,
          displayName,
          (state) => {
            if (!isEffectActive) return;
            setCallState(state);
          }
        );
        
        if (isEffectActive) {
          webrtcServiceRef.current = newService;
        } else {
          await newService.destroy();
        }
      } catch (err: any) {
        if (isEffectActive) {
          setError('Gagal memulai layanan panggilan video: ' + err.message);
        }
      } finally {
        if (isEffectActive) {
          setIsInitializing(false);
        }
      }
    }
    
    initializeService();
    
    return () => {
      isEffectActive = false;
      setIsInitializing(false);
      
      if (webrtcServiceRef.current) {
        const service = webrtcServiceRef.current;
        webrtcServiceRef.current = null;
        
        (async () => {
          try {
            await service.destroy();
          } catch (err) {
            console.error('Error during WebRTC service cleanup:', err);
          }
        })();
      }
    };
  }, [homeId, currentUser, userProfile, isInitializing]);
  
  // Update video elements when streams change
  useEffect(() => {
    if (callState.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    if (callState.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);
    // Load home members for direct calls
  useEffect(() => {
    if (!homeId || !currentUser) return;
    
    const loadHomeMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const result = await getHomeMemberProfiles(homeId);
        
        if (result.error) {
          setError('Gagal memuat anggota rumah: ' + result.error);
          return;
        }
        
        const otherMembers = result.members.filter((member: UserProfile) => member.uid !== currentUser?.uid);
        setHomeMembers(otherMembers);
      } catch (err: any) {
        setError('Gagal memuat anggota rumah: ' + err.message);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadHomeMembers();
  }, [homeId, currentUser]);

  // Handle direct call initiation
  const handleDirectCall = async (targetUserId: string) => {
    try {
      setError('');
      if (webrtcServiceRef.current) {
        setSelectedUserId(targetUserId);
        await webrtcServiceRef.current.startDirectCall(targetUserId, isVideoEnabled);
      }
    } catch (err: any) {
      setError('Gagal memulai panggilan langsung: ' + err.message);
    }
  };

  // Handle call end
  const handleEndCall = async () => {
    try {
      setError('');
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.endCall();
        setSelectedUserId(null);
      }
    } catch (err: any) {
      setError('Gagal mengakhiri panggilan: ' + err.message);
    }
  };
  // Toggle video
  const toggleVideo = async () => {
    try {
      if (webrtcServiceRef.current) {
        const newState = await webrtcServiceRef.current.toggleVideo();
        setIsVideoEnabled(newState);
      }
    } catch (err: any) {
      setError('Gagal ' + (isVideoEnabled ? 'menonaktifkan' : 'mengaktifkan') + ' video: ' + err.message);
    }
  };
  // Toggle audio
  const toggleAudio = async () => {
    try {
      if (webrtcServiceRef.current) {
        const newState = await webrtcServiceRef.current.toggleAudio();
        setIsAudioEnabled(newState);
      }
    } catch (err: any) {
      setError('Gagal ' + (isAudioEnabled ? 'menonaktifkan' : 'mengaktifkan') + ' mikrofon: ' + err.message);
    }
  };

  // Handle diagnostics modal
  const handleDiagnosticsComplete = (results: DiagnosticResults) => {
    setDiagnosticResults(results);
    setIsDiagnosticsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Error message display */}
      {error && (
        <div className="bg-red-500/80 text-white p-2 mb-2 rounded-md text-sm">
          {error}
          <button 
            onClick={() => setError('')}
            className="ml-2 text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Call in progress UI */}
        {callState.isConnected || callState.isConnecting || callState.isCalling ? (
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Video area */}
            <div className="flex-1 bg-gray-900 relative">
              {/* Local video */}
              <div className="absolute top-2 right-2 w-28 h-28 md:w-40 md:h-32 z-10">
                <video 
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-lg shadow-lg"
                />
              </div>
              
              {/* Remote video */}
              <video 
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Call status overlay */}
              {callState.isConnecting && !callState.isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-t-blue-500 border-blue-200 rounded-full animate-spin mb-2"></div>
                    <p className="text-white">Connecting to call...</p>
                  </div>
                </div>
              )}
              
              {callState.isCalling && !callState.isConnected && !callState.isConnecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-t-blue-500 border-blue-200 rounded-full animate-spin mb-2"></div>
                    <p className="text-white">Calling...</p>
                  </div>
                </div>
              )}
              
              {/* Controls overlay */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <div className="flex space-x-4">
                  <button
                    onClick={toggleAudio}
                    className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
                  >
                    {isAudioEnabled ? 'Mute' : 'Unmute'}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
                  >
                    {isVideoEnabled ? 'Stop Video' : 'Start Video'}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="p-3 rounded-full bg-red-600 text-white"
                  >
                    End Call
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Direct calling interface */
          <div className="flex-1 flex flex-col">
            <div className="p-6">
              <h3 className="text-xl font-medium mb-4">Video Call</h3>
              <p className="text-gray-400 mb-6">
                Start a direct video call with members of your home
              </p>
              
              {/* Direct call options */}
              <div className="mb-6 p-4 bg-gray-800 rounded-xl">
                <h4 className="text-lg font-medium text-blue-400 mb-3">Home Members</h4>
                
                {isLoadingMembers ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-t-transparent border-blue-400 rounded-full animate-spin"></div>
                  </div>
                ) : homeMembers.length === 0 ? (
                  <p className="text-gray-400 text-center py-3">No other members in this home</p>
                ) : (
                  <div className="space-y-3">
                    {homeMembers.map(member => (
                      <div key={member.uid} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full mr-3 bg-blue-500 flex items-center justify-center">
                            <span className="text-white font-medium">
                              {(member.displayName || member.email || 'User').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-white">
                            {member.displayName || member.email || 'User'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDirectCall(member.uid)}
                          disabled={callState.isConnecting || callState.isCalling}
                          className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg"
                        >
                          Call
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Diagnostics button */}
              <button 
                onClick={() => setIsDiagnosticsModalOpen(true)}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Run WebRTC Diagnostics
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Diagnostics Modal */}
      {isDiagnosticsModalOpen && (
        <WebRTCDiagnostics 
          isOpen={isDiagnosticsModalOpen} 
          onClose={() => setIsDiagnosticsModalOpen(false)}
          onDiagnosticsComplete={handleDiagnosticsComplete} 
        />
      )}
    </div>
  );
};

export default VideoCallChat;
