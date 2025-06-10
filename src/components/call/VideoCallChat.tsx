import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WebRTCService, CallState } from '../../services/webrtc/webrtc';
import { ChatMessage } from '../../types/user';
import { 
  sendChatMessage, 
  subscribeToChatMessages, 
  markMessageAsRead 
} from '../../services/firebase/chat';

interface VideoCallChatProps {
  homeId: string;
}

const VideoCallChat: React.FC<VideoCallChatProps> = ({ homeId }) => {
  // VideoCall state
  const { currentUser, userProfile } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    isConnected: false,
    isConnecting: false,
    isCalling: false,
    isReceivingCall: false
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'call' | 'chat'>('call');
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Initialize WebRTC service
  useEffect(() => {
    if (!currentUser || !homeId) return;

    const displayName = userProfile?.displayName || currentUser.displayName || currentUser.email || 'Anonymous User';

    webrtcServiceRef.current = new WebRTCService(
      homeId,
      currentUser.uid,
      displayName,
      (state) => {
        setCallState(state);
      }
    );

    return () => {
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.destroy();
      }
    };
  }, [homeId, currentUser, userProfile]);

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

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!homeId || !currentUser) return;

    const unsubscribe = subscribeToChatMessages(homeId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Mark messages as read when they arrive
      newMessages.forEach(message => {
        if (message.senderId !== currentUser.uid && !message.read) {
          markMessageAsRead(message.id, currentUser.uid);
        }
      });
    });

    return () => unsubscribe();
  }, [homeId, currentUser]);

  // Video Call functions
  const handleStartCall = async (isVideo = true) => {
    try {
      setError('');
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.startCall(isVideo);
      }
    } catch (err: any) {
      setError('Gagal memulai panggilan: ' + err.message);
    }
  };

  const handleAcceptCall = async () => {
    try {
      setError('');
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.acceptCall();
      }
    } catch (err: any) {
      setError('Gagal menerima panggilan: ' + err.message);
    }
  };

  const handleRejectCall = async () => {
    try {
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.rejectCall();
      }
    } catch (err: any) {
      setError('Gagal menolak panggilan: ' + err.message);
    }
  };

  const handleEndCall = async () => {
    try {
      if (webrtcServiceRef.current) {
        await webrtcServiceRef.current.endCall();
      }
    } catch (err: any) {
      setError('Gagal mengakhiri panggilan: ' + err.message);
    }
  };

  const toggleVideo = () => {
    if (webrtcServiceRef.current) {
      const enabled = webrtcServiceRef.current.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const toggleAudio = () => {
    if (webrtcServiceRef.current) {
      const enabled = webrtcServiceRef.current.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  // Chat functions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser) return;

    setSending(true);
    setError('');

    try {
      const { error } = await sendChatMessage(homeId, currentUser.uid, newMessage.trim());
      
      if (error) {
        setError(error);
      } else {
        setNewMessage('');
      }
    } catch (err: any) {
      setError('Gagal mengirim pesan: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Simplified time formatter for messages
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    const timeStr = messageDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    if (diffDays === 0) {
      return timeStr; // Today: just show time
    } else if (diffDays === 1) {
      return `Kemarin ${timeStr}`; // Yesterday
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString('id-ID', { weekday: 'short' }) + ` ${timeStr}`; // Day of week
    } else {
      return messageDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ` ${timeStr}`; // Date
    }
  };

  // Generate user initials for avatar
  const getUserInitials = (userId: string) => {
    if (userId === currentUser?.uid && userProfile?.displayName) {
      const names = userProfile.displayName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return userProfile.displayName[0].toUpperCase();
    }
    return 'U'; // Default for other users
  };
  
  // Get dynamic background color based on user ID
  const getAvatarColor = (userId: string) => {
    const colors = [
      'from-pink-500 to-purple-500',
      'from-green-400 to-cyan-500',
      'from-amber-500 to-orange-500',
      'from-sky-400 to-blue-500',
      'from-rose-400 to-red-500'
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Incoming call modal
  if (callState.isReceivingCall) {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
        <div className="card-modern max-w-md w-full mx-4 p-8 shadow-hard animate-scale-in">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 mb-6 shadow-soft">
              <svg className="h-10 w-10 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
              Panggilan Masuk
            </h3>
            <p className="text-base text-slate-300 mb-8">
              {callState.callerInfo?.displayName || 'Seseorang'} sedang menelepon Anda
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRejectCall}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-smooth shadow-soft hover:shadow-medium"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.68.28-.53 0-.96-.43-.96-.96V9.72C2.21 11.26 1 13.51 1 16c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5 0-2.49-1.21-4.74-3.07-6.13v5.17c0 .53-.43.96-.96.96-.25 0-.5-.1-.68-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9V9.72C15.15 9.25 13.6 9 12 9z" />
                  </svg>
                  Tolak
                </div>
              </button>
              <button
                onClick={handleAcceptCall}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-smooth shadow-soft hover:shadow-medium"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                  </svg>
                  Terima
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col card-modern shadow-hard overflow-hidden">
      {/* Header with tabs */}
      <div className="p-4 border-b border-slate-700/30 glassmorphism bg-slate-800/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">
              Komunikasi
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Hubungi dan chat dengan anggota rumah lain
            </p>
          </div>
          <div className="flex space-x-2 bg-slate-900/40 p-1 rounded-lg border border-slate-700/40">
            <button 
              onClick={() => setActiveTab('call')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-smooth ${
                activeTab === 'call' 
                  ? 'bg-gradient-to-r from-blue-600/70 to-indigo-600/70 text-white shadow-soft' 
                  : 'text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Panggilan
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-smooth ${
                activeTab === 'chat' 
                  ? 'bg-gradient-to-r from-blue-600/70 to-indigo-600/70 text-white shadow-soft' 
                  : 'text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                </svg>
                Chat
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 my-3 p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="absolute top-2 right-2 text-red-400 hover:text-red-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content: Video Call or Chat based on active tab */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'call' && (
          <div className="flex-1 flex flex-col">
            {(callState.isConnected || callState.isConnecting || callState.isCalling) ? (
              <div className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-800">
                {/* Remote Video (main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                />

                {/* Local Video (picture-in-picture) */}
                <div className="absolute bottom-6 right-6 w-48 h-36 rounded-xl overflow-hidden border-2 border-blue-500/40 shadow-hard glassmorphism">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Call Status Overlay */}
                {callState.isConnecting && (
                  <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                    <div className="text-center text-white">
                      <div className="loading-spinner mx-auto mb-6"></div>
                      <p className="text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 text-lg">Menghubungkan...</p>
                    </div>
                  </div>
                )}

                {callState.isCalling && (
                  <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                    <div className="text-center text-white">
                      <div className="animate-pulse mb-6">
                        <svg className="mx-auto h-16 w-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <p className="text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 text-lg">Memanggil...</p>
                    </div>
                  </div>
                )}

                {/* Call Controls */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 glassmorphism py-3 px-6 rounded-full shadow-hard animate-slide-up">
                  <button
                    onClick={toggleAudio}
                    className={`p-3 rounded-full ${
                      isAudioEnabled 
                        ? 'bg-slate-700/80 hover:bg-slate-600/80' 
                        : 'bg-red-600/90 hover:bg-red-700/90'
                    } text-white transition-smooth shadow-soft`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      {isAudioEnabled ? (
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.941V21H9v2h6v-2h-2v-2.059A9 9 0 0021 12v-2h-2z" />
                      ) : (
                        <path d="M12 1a3 3 0 00-3 3v8c0 .14.01.28.02.42L15 7.5V4a3 3 0 00-3-3zM19 10v2a7.03 7.03 0 01-.1 1.1l1.45 1.44A9.02 9.02 0 0021 12v-2h-2zM4.27 3L21 19.73l-1.41 1.41L15.54 17.1c-.82.4-1.74.63-2.71.78V21h2v2H9v-2h2v-3.12A9 9 0 013 12v-2h2v2c0 .84.15 1.64.41 2.39L4.27 3z" />
                      )}
                    </svg>
                  </button>
                  
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full ${
                      isVideoEnabled 
                        ? 'bg-slate-700/80 hover:bg-slate-600/80' 
                        : 'bg-red-600/90 hover:bg-red-700/90'
                    } text-white transition-smooth shadow-soft`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      {isVideoEnabled ? (
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
                      ) : (
                        <path d="M21 6.5L17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5L21 17.5V6.5zM16 16H4V8h12v8zM2.81 2.81L21.19 21.19l-1.41 1.41L2.81 4.22l1.41-1.41z" />
                      )}
                    </svg>
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="p-3 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-smooth shadow-soft hover:shadow-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.68.28-.53 0-.96-.43-.96-.96V9.72C2.21 11.26 1 13.51 1 16c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5 0-2.49-1.21-4.74-3.07-6.13v5.17c0 .53-.43.96-.96.96-.25 0-.5-.1-.68-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9V9.72C15.15 9.25 13.6 9 12 9z" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // Call start interface
              <div className="flex-1 flex items-center justify-center glassmorphism bg-gradient-to-b from-transparent to-slate-800/30">
                <div className="text-center p-8 max-w-lg animate-fade-in">
                  <div className="mx-auto flex items-center justify-center h-28 w-28 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-indigo-500/30 mb-8 shadow-medium animate-float">
                    <svg className="h-14 w-14 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-3">
                    Mulai Panggilan
                  </h3>
                  <p className="text-base text-slate-300 mb-10 max-w-md mx-auto">
                    Hubungi anggota rumah lain melalui video atau audio call untuk berkomunikasi secara langsung
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                    <button
                      onClick={() => handleStartCall(false)}
                      className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-smooth shadow-soft hover:shadow-medium"
                    >
                      <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-lg">Audio Call</span>
                    </button>
                    <button
                      onClick={() => handleStartCall(true)}
                      className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-smooth shadow-soft hover:shadow-medium"
                    >
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-lg">Video Call</span>
                    </button>
                  </div>
                  
                  <p className="mt-10 text-xs text-slate-400">
                    <span className="inline-flex items-center mr-2">
                      <svg className="w-4 h-4 mr-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Tip:
                    </span>
                    Pastikan kamera dan mikrofon Anda diizinkan di browser untuk pengalaman terbaik
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages Container */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
                  <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat pesan...</div>
                </div>
              </div>
            ) : (
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 glassmorphism bg-slate-800/20"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center animate-fade-in">
                      <div className="relative w-24 h-24 mx-auto mb-4">
                        <svg className="absolute w-24 h-24 text-blue-900/20 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                        </svg>
                        <svg className="absolute w-16 h-16 text-indigo-500/20 top-4 left-4 animate-float" style={{animationDelay: '1s'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                        </svg>
                      </div>
                      <h3 className="mt-2 text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Belum ada pesan</h3>
                      <p className="mt-4 text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Mulai percakapan dengan mengirim pesan pertama kepada anggota rumah Anda.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isOwnMessage = message.senderId === currentUser?.uid;
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}
                        >
                          {!isOwnMessage && (
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center mr-2 shadow-soft`}>
                              <span className="text-xs font-medium text-white">
                                {getUserInitials(message.senderId)}
                              </span>
                            </div>
                          )}
                          
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-soft transition-all duration-200 ${
                              isOwnMessage
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-medium hover:-translate-y-0.5'
                                : 'glassmorphism bg-slate-800/40 text-slate-200 hover:shadow-medium hover:-translate-y-0.5'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{message.text}</p>
                            <div className={`mt-1 text-xs flex items-center justify-between ${
                              isOwnMessage ? 'text-indigo-200/80' : 'text-slate-400'
                            }`}>
                              <span>{formatTime(message.timestamp)}</span>
                              {isOwnMessage && (
                                <span className="ml-2 flex items-center">
                                  {message.read ? (
                                    <svg className="w-3 h-3 ml-1 text-blue-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M4.5 12.75L10.5 18.75L19.5 5.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isOwnMessage && (
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center ml-2 shadow-soft`}>
                              <span className="text-xs font-medium text-white">
                                {getUserInitials(message.senderId)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-slate-700/30 bg-slate-800/50">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 input-modern shadow-soft focus:ring-2 focus:ring-blue-500/50"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 btn-primary text-white rounded-lg flex items-center justify-center shadow-soft hover:shadow-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:transform-none"
                  aria-label="Send message"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.3009 13.6948L20.102 3.89668M10.5795 14.1663L12.8019 18.5317C13.339 19.6473 14.8883 19.7545 15.5975 18.7263L21.3961 10.1245C21.9701 9.31173 21.5224 8.21519 20.564 8.02681L3.75756 4.00984C2.70599 3.8036 1.8299 4.88221 2.25233 5.89143L5.87486 15.5202C6.21456 16.3766 7.26272 16.7249 8.02371 16.2485L10.5795 14.1663Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallChat;
