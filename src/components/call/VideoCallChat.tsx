import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WebRTCService, CallState, Participant } from '../../services/webrtc/webrtc';
import { Room } from '../../services/webrtc/signaling';
import { ChatMessage } from '../../types/user';
import { 
  sendChatMessage, 
  subscribeToChatMessages, 
  markMessageAsRead 
} from '../../services/firebase/chat';
import WebRTCDiagnostics from './WebRTCDiagnostics';
import { DiagnosticResults } from '../../utils/webrtcDiagnostics';

interface VideoCallChatProps {
  homeId: string;
}

const VideoCallChat: React.FC<VideoCallChatProps> = ({ homeId }) => {  // VideoCall state
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
  const [activeTab, setActiveTab] = useState<'call' | 'chat'>('call');
  const [isMobile, setIsMobile] = useState(false);
  
  // Room-related state
  const [rooms, setRooms] = useState<Room[]>([]);  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const participantVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Diagnostics state
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Detect screen size changes
  useLayoutEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);  // Service initialization lock to prevent multiple instances
  const [isInitializing, setIsInitializing] = useState(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize WebRTC service with enhanced cleanup and anti-loop protection
  useEffect(() => {
    if (!currentUser || !homeId) return;
    
    // Create a tracking variable for this effect instance
    let effectInstanceId = Date.now();
    let isEffectActive = true;
    
    // Set timeout to detect hanging initialization
    const watchdogTimeout = setTimeout(() => {
      if (isInitializing) {
        console.warn('VideoCallChat: WebRTC initialization seems to be hanging, resetting state');
        setIsInitializing(false);
      }
    }, 30000); // 30 seconds watchdog
    
    const displayName = userProfile?.displayName || currentUser.displayName || currentUser.email || 'Anonymous User';
    
    async function initializeService() {
      // Lock mechanism to prevent concurrent initializations
      if (isInitializing) {
        console.log('VideoCallChat: Initialization already in progress, skipping duplicate request');
        return;
      }
      
      try {
        setIsInitializing(true);
        
        // Clean up any existing instance first
        if (webrtcServiceRef.current) {
          console.log(`VideoCallChat[${effectInstanceId}]: Cleaning up previous WebRTC service instance`);
          
          try {
            // First perform emergency reset to ensure all flags are cleared
            await webrtcServiceRef.current.emergencyReset();
            
            // Then destroy the service
            await webrtcServiceRef.current.destroy();
          } catch (err) {
            console.error('VideoCallChat: Error destroying previous WebRTC service:', err);
          } finally {
            webrtcServiceRef.current = null;
          }
        }
        
        // If the effect was cleaned up during the async operation, stop here
        if (!isEffectActive) {
          console.log(`VideoCallChat[${effectInstanceId}]: Effect no longer active, stopping initialization`);
          return;
        }
          // Initialize new instance with logging
        console.log(`VideoCallChat[${effectInstanceId}]: Creating new WebRTC service instance`);
        
        // Safety check for null currentUser
        if (!currentUser) {
          throw new Error("Tidak dapat membuat layanan WebRTC: pengguna tidak terautentikasi");
        }
        
        const newService = new WebRTCService(
          homeId,
          currentUser.uid,
          displayName,
          (state) => {
            if (!isEffectActive) return;
            
            // Track state changes selectively to reduce log spam
            if (state.isConnecting || state.isConnected || state.inRoom || 
                Object.keys(state.participants).length > 0) {
              console.log('WebRTC state update:', 
                JSON.stringify({
                  isConnecting: state.isConnecting,
                  isConnected: state.isConnected,
                  inRoom: state.inRoom,
                  participantCount: Object.keys(state.participants).length
                })
              );
            }
            
            setCallState(state);
          }
        );
        
        // Only set the reference if the effect is still active
        if (isEffectActive) {
          webrtcServiceRef.current = newService;
          console.log(`VideoCallChat[${effectInstanceId}]: WebRTC service initialization complete`);
        } else {
          // If the component unmounted during initialization, cleanup the service
          console.log(`VideoCallChat[${effectInstanceId}]: Component unmounted during init, cleaning up`);
          try {
            await newService.destroy();
          } catch (err) {
            console.error('Error destroying orphaned WebRTC service:', err);
          }
        }
      } catch (err) {
        console.error('VideoCallChat: Error initializing WebRTC service:', err);
        if (isEffectActive) {
          setError('Gagal memulai layanan panggilan video: ' + (err instanceof Error ? err.message : String(err)));
        }
      } finally {
        if (isEffectActive) {
          setIsInitializing(false);
        }
      }
    }    // Start the initialization
    initializeService().catch(err => {
      console.error(`VideoCallChat[${effectInstanceId}]: Unhandled error during initialization:`, err);
      if (isEffectActive) {
        setIsInitializing(false);
        setError('Gagal memulai layanan panggilan video: ' + (err instanceof Error ? err.message : String(err)));
      }
    });
    
    // Return a more robust cleanup function with timeout cancellation
    return () => {
      console.log(`VideoCallChat[${effectInstanceId}]: Component unmounting, cleaning up`);
      isEffectActive = false;
      clearTimeout(watchdogTimeout);
      
      // Cancel any pending initialization timeout
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
      
      // Set initializing to false for any subsequent renders
      setIsInitializing(false);
      
      // Handle the WebRTC service cleanup
      if (webrtcServiceRef.current) {
        const service = webrtcServiceRef.current;
        webrtcServiceRef.current = null; // Clear reference immediately to prevent race conditions
        
        console.log('VideoCallChat: Destroying WebRTC service on unmount');
        
        (async () => {
          try {
            // First leave any room if we're in one
            if (callState.inRoom && callState.roomId) {
              console.log('VideoCallChat: Leaving room on unmount');
              try {
                // Set a timeout for leaving the room to prevent hanging
                await Promise.race([
                  service.leaveRoom(),
                  new Promise((_,reject) => setTimeout(() => reject(new Error('Room leave timeout')), 3000))
                ]);
              } catch (leaveErr) {
                console.warn('VideoCallChat: Error leaving room on unmount:', leaveErr);
              }
            }
            
            // Then perform emergency reset to ensure all flags are cleared
            await service.emergencyReset();
            
            // Finally destroy the service
            await service.destroy();
            console.log('VideoCallChat: WebRTC service cleanup completed');
          } catch (err) {
            console.error('VideoCallChat: Error during WebRTC service cleanup:', err);
          }
        })().catch(err => {
          console.error('VideoCallChat: Unhandled promise rejection during cleanup:', err);
        });
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
  
  // Handle room participants and their streams
  useEffect(() => {
    if (!callState.inRoom) return;
    
    // Connect participant videos
    Object.values(callState.participants).forEach(participant => {
      if (participant.userId !== currentUser?.uid && participant.stream) {
        const videoElement = participantVideosRef.current.get(participant.userId);
        if (videoElement && videoElement.srcObject !== participant.stream) {
          videoElement.srcObject = participant.stream;
        }
      }
    });
  }, [callState.participants, callState.inRoom, currentUser?.uid]);
  
  // Fetch available rooms
  const fetchRooms = async () => {
    if (!webrtcServiceRef.current) return;
    
    try {
      setIsLoadingRooms(true);
      const activeRooms = await webrtcServiceRef.current.getActiveRooms();
      setRooms(activeRooms);
    } catch (err: any) {
      setError('Gagal memuat ruang panggilan: ' + err.message);
    } finally {
      setIsLoadingRooms(false);
    }
  };  // Track room fetch activity
  const lastFetchTimeRef = useRef(0);
  const isFetchingRoomsRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  
  // Improved rooms fetch with backoff strategy and better error handling
  useEffect(() => {
    // Skip if not ready, already in a room, or currently creating a room
    if (!webrtcServiceRef.current || callState.inRoom || isCreatingRoom || isInitializing) {
      return;
    }
    
    // Create a unique ID for this effect instance to track in logs
    const fetchEffectId = Date.now();
    console.log(`VideoCallChat[${fetchEffectId}]: Setting up rooms fetch`);
    
    // Prevent multiple intervals
    let isEffectActive = true;
    
    // Calculate appropriate fetch interval based on error count
    const getFetchInterval = () => {
      const baseInterval = 5000; // 5 seconds base
      const errorBackoff = consecutiveErrorsRef.current * 2000; // Add 2s per error
      const maxInterval = 30000; // Cap at 30s
      return Math.min(baseInterval + errorBackoff, maxInterval);
    };
    
    // Fetch rooms with better error handling
    const performFetch = async () => {
      // Prevent concurrent fetches
      if (isFetchingRoomsRef.current) return;
      
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      const minInterval = getFetchInterval();
      
      // Skip if too soon after last fetch
      if (timeSinceLastFetch < minInterval) return;
      
      try {
        if (!isEffectActive) return;
        if (!webrtcServiceRef.current) return;
        
        isFetchingRoomsRef.current = true;
        
        // Only log periodic fetches if there are errors or debug mode
        if (consecutiveErrorsRef.current > 0) {
          console.log(`VideoCallChat[${fetchEffectId}]: Fetching rooms (after ${consecutiveErrorsRef.current} errors)`);
        }
        
        await fetchRooms();
        
        // Reset error counter on success
        if (consecutiveErrorsRef.current > 0) {
          console.log(`VideoCallChat[${fetchEffectId}]: Room fetch succeeded after ${consecutiveErrorsRef.current} errors`);
          consecutiveErrorsRef.current = 0;
        }
      } catch (err) {
        consecutiveErrorsRef.current++;
        console.error(`VideoCallChat[${fetchEffectId}]: Room fetch error #${consecutiveErrorsRef.current}:`, err);
        
        // After multiple errors, show a message to the user
        if (consecutiveErrorsRef.current >= 3 && isEffectActive) {
          setError('Gagal memuat daftar ruang panggilan. Cek koneksi internet Anda.');
        }
      } finally {
        lastFetchTimeRef.current = Date.now();
        isFetchingRoomsRef.current = false;
      }
    };
    
    // Initial fetch with delay to ensure service is ready
    const initialFetchTimeout = setTimeout(() => {
      if (isEffectActive && !callState.inRoom && !isCreatingRoom) {
        console.log(`VideoCallChat[${fetchEffectId}]: Initial rooms fetch`);
        performFetch();
      }
    }, 2000);
    
    // Periodic fetch with dynamic interval
    const fetchInterval = setInterval(() => {
      if (!isEffectActive || callState.inRoom || isCreatingRoom) return;
      performFetch();
    }, 5000);
    
    // Cleanup function
    return () => {
      console.log(`VideoCallChat[${fetchEffectId}]: Cleaning up rooms fetch effect`);
      isEffectActive = false;
      clearTimeout(initialFetchTimeout);
      clearInterval(fetchInterval);
    };
  }, [callState.inRoom, isCreatingRoom, isInitializing]);

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
    });    return () => unsubscribe();  }, [homeId, currentUser]);  
  
  // Video Call functions - Room-based approach with enhanced protection
  const [lastCreateRoomTime, setLastCreateRoomTime] = useState(0);
  const [creationAttemptCount, setCreationAttemptCount] = useState(0);
  const MIN_CREATE_INTERVAL = 10000; // 10 seconds minimum between creation attempts
  const MAX_CREATION_ATTEMPTS = 3;   // Maximum number of attempts before requiring a page refresh
  
  // Tambahkan semaphore untuk mencegah multiple calls dari event handler yang sama
  const isCreatingRoomRef = useRef(false);
  
  const handleCreateRoom = async () => {
    // Dual protection - check both state dan ref
    // Ref protection untuk mencegah multiple calls sebelum state terupdate
    if (isCreatingRoom || isCreatingRoomRef.current) {
      console.log('VideoCallChat: Room creation blocked - already in progress');
      setError('Permintaan pembuatan ruang diabaikan: operasi sedang berlangsung');
      return;
    }
    
    // Extra check for WebRTC service readiness
    if (isInitializing) {
      console.log('VideoCallChat: Room creation blocked - WebRTC service still initializing');
      setError('Layanan WebRTC sedang dipersiapkan, harap tunggu sebentar');
      return;
    }
    
    // Throttle excessive attempts with clearer messaging
    if (creationAttemptCount >= MAX_CREATION_ATTEMPTS) {
      console.error('VideoCallChat: Too many room creation attempts. Suggesting page refresh');
      setError(`Terlalu banyak percobaan (${creationAttemptCount}/${MAX_CREATION_ATTEMPTS}). Silakan muat ulang halaman untuk mencoba lagi.`);
      return;
    }
    
    // Strict interval checking with clearer timing display
    const now = Date.now();
    const timeSinceLastCreate = now - lastCreateRoomTime;
    if (timeSinceLastCreate < MIN_CREATE_INTERVAL) {
      const waitTimeSeconds = Math.ceil((MIN_CREATE_INTERVAL - timeSinceLastCreate) / 1000);
      console.log(`VideoCallChat: Room creation throttled, must wait ${waitTimeSeconds}s`);
      setError(`Harap tunggu ${waitTimeSeconds} detik lagi sebelum membuat ruang baru`);
      return;
    }
    
    // Set the semaphore first to block any parallel attempts
    isCreatingRoomRef.current = true;
    
    // Update tracking state
    setLastCreateRoomTime(now);
    setCreationAttemptCount(prev => prev + 1);
    setError('');
    setIsCreatingRoom(true);
    
    const attemptId = Date.now(); // Generate unique ID for this attempt for logging
    console.log(`VideoCallChat[${attemptId}]: Starting room creation (Attempt ${creationAttemptCount + 1}/${MAX_CREATION_ATTEMPTS})`);      // Setup tiered feedback for better UX and network resilience
    let earlyFeedbackTimeout: NodeJS.Timeout | null = null;
    let midFeedbackTimeout: NodeJS.Timeout | null = null;
    
    // First-tier feedback - early indication (8 seconds)
    earlyFeedbackTimeout = setTimeout(() => {
      if (isCreatingRoomRef.current) {
        console.log(`VideoCallChat[${attemptId}]: Room creation taking longer than expected (early notification)`);
        setError('Membuat ruangan... mohon bersabar (ini mungkin memerlukan beberapa saat)');
      }
    }, 8000);

    // Second-tier feedback - mid-process indication (20 seconds)
    midFeedbackTimeout = setTimeout(() => {
      if (isCreatingRoomRef.current) {
        console.log(`VideoCallChat[${attemptId}]: Room creation still in progress (mid notification)`);
        
        // Check network status
        if (!window.navigator.onLine) {
          setError('Koneksi internet terputus. Mencoba melanjutkan saat terhubung kembali...');
        } else {
          setError('Masih membuat ruangan... koneksi mungkin lambat, harap tunggu');
        }
        
        // Attempt to check if WebRTC service is still responsive
        if (webrtcServiceRef.current) {
          webrtcServiceRef.current.checkNetworkConnection?.();
        }
      }
    }, 20000);
    
    // Final watchdog timeout to prevent UI getting stuck if something goes wrong
    const watchdogTimeout = setTimeout(() => {
      if (isCreatingRoomRef.current) {
        console.error(`VideoCallChat[${attemptId}]: Room creation watchdog timeout triggered`);
        isCreatingRoomRef.current = false;
        setIsCreatingRoom(false);
        setError('Pembuatan ruang terlalu lama. Silakan coba lagi.');
        
        // Attempt to recover WebRTC service on timeout
        if (webrtcServiceRef.current) {
          console.log(`VideoCallChat[${attemptId}]: Attempting emergency reset after timeout`);
          webrtcServiceRef.current.emergencyReset().catch(err => 
            console.error(`VideoCallChat[${attemptId}]: Reset error:`, err)
          );
        }
      }
      
      // Clear other timeouts
      if (earlyFeedbackTimeout) clearTimeout(earlyFeedbackTimeout);
      if (midFeedbackTimeout) clearTimeout(midFeedbackTimeout);
    }, 35000); // 35 second watchdog, synchronized with WebRTC service timeout
    
    try {
      // Check for WebRTC service
      if (!webrtcServiceRef.current) {
        throw new Error('Layanan WebRTC belum siap, harap tunggu');
      }
      
      // Perform emergency reset for cleaner state (always)
      console.log(`VideoCallChat[${attemptId}]: Performing preventative emergency reset`);
      await webrtcServiceRef.current.emergencyReset();
      
      // Generate room name with timestamp for uniqueness
      const name = roomName.trim() || `Room ${new Date().toLocaleTimeString()}`;
      console.log(`VideoCallChat[${attemptId}]: Creating new room: ${name}`);        // Race between room creation and timeout with adaptive feedback
      const timeoutPromise = new Promise<never>((_, reject) => { 
        let timeoutTriggered = false;
        let networkStatusCheckInterval: NodeJS.Timeout | null = null;
        
        // Network connectivity monitoring
        networkStatusCheckInterval = setInterval(() => {
          if (!timeoutTriggered && !window.navigator.onLine) {
            console.warn(`VideoCallChat[${attemptId}]: Network is offline during room creation`);
            setError('Koneksi internet terputus. Akan mencoba lagi saat terhubung kembali.');
          }
        }, 3000); // Check every 3 seconds
        
        // First timeout warning - display early feedback
        setTimeout(() => {
          if (!timeoutTriggered) {
            console.log(`VideoCallChat[${attemptId}]: Room creation taking longer than expected`);
            setError('Membuat ruangan... harap tunggu (ini mungkin memerlukan beberapa detik)');
          }
        }, 8000);
        
        // Intermediate warning with additional details
        setTimeout(() => {
          if (!timeoutTriggered) {
            console.log(`VideoCallChat[${attemptId}]: Room creation still in progress`);
            setError('Masih membuat ruangan... mungkin koneksi lambat');
          }
        }, 15000);
        
        // Final timeout - actual failure, but with network awareness
        setTimeout(() => {
          if (networkStatusCheckInterval) {
            clearInterval(networkStatusCheckInterval);
          }
          
          timeoutTriggered = true;
          
          // If offline, provide more helpful message
          if (!window.navigator.onLine) {
            reject(new Error('Koneksi internet terputus saat membuat ruangan. Silakan periksa koneksi Anda.'));
          } else {
            reject(new Error('Waktu habis saat membuat ruangan - koneksi mungkin lambat atau tidak stabil'));
          }
        }, 30000);
      });
        // Check network status before attempting to create room
      const networkAvailable = webrtcServiceRef.current.isNetworkAvailable?.() ?? window.navigator.onLine;
      if (!networkAvailable) {
        console.warn(`VideoCallChat[${attemptId}]: Network appears to be offline, warning user`);
        setError('Koneksi internet tidak tersedia. Harap periksa koneksi Anda dan coba lagi.');
        throw new Error('Network offline');
      }
      
      const roomId = await Promise.race([
        webrtcServiceRef.current.createRoom(name, isVideoEnabled, isAudioEnabled),
        timeoutPromise
      ]);
      
      // Success - clear form and log
      setRoomName('');
      console.log(`VideoCallChat[${attemptId}]: Room successfully created with ID: ${roomId}`);
      
      // Reset attempt counter on success and clear any error
      setCreationAttemptCount(0);
      setError('');
      
    } catch (err: any) {
      console.error(`VideoCallChat[${attemptId}]: Error creating room:`, err);
      
      // Enhance error message based on error type
      let errorMsg = 'Gagal membuat ruang panggilan: ';
      
      if (!err.message) {
        errorMsg += 'Terjadi kesalahan tidak diketahui';
      } else if (err.message.includes('Timeout') || err.message.includes('Waktu habis')) {
        errorMsg += 'Waktu pembuatan ruang habis, mungkin karena masalah jaringan';
      } else if (err.message.includes('getUserMedia')) {
        errorMsg += 'Tidak dapat mengakses kamera atau mikrofon';
      } else if (err.message.includes('berlangsung')) {
        errorMsg += 'Sudah ada operasi yang berlangsung';
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
      
      // Perform cleanup and reset for any error
      if (webrtcServiceRef.current) {
        try {
          console.log(`VideoCallChat[${attemptId}]: Performing emergency reset due to error`);
          await webrtcServiceRef.current.emergencyReset();
        } catch (cleanupErr) {
          console.error(`VideoCallChat[${attemptId}]: Failed to reset state after error:`, cleanupErr);
        }
      }
    } finally {
      // Clear watchdog
      clearTimeout(watchdogTimeout);
      
      // Use increasing delay to reset UI state to prevent rapid retries
      const delayTime = Math.min(3000 + (creationAttemptCount * 1500), 8000);
      
      setTimeout(() => {
        isCreatingRoomRef.current = false;
        setIsCreatingRoom(false);
        console.log(`VideoCallChat[${attemptId}]: Room creation UI state reset after ${delayTime}ms delay`);
      }, delayTime);
    }
  };
    // Ref untuk mencegah multiple join operations
  const isJoiningRoomRef = useRef(false);
  
  const handleJoinRoom = async (roomId: string) => {
    // Dual protection with state and ref
    if (isJoiningRoom || isJoiningRoomRef.current || callState.inRoom) {
      console.log('VideoCallChat: Room join operation already in progress or already in a room');
      setError('Proses bergabung ke ruangan sedang berlangsung');
      return;
    }
    
    // Block join if WebRTC service is initializing
    if (isInitializing) {
      console.log('VideoCallChat: Join blocked - WebRTC service still initializing');
      setError('Layanan WebRTC sedang dipersiapkan, harap tunggu sebentar');
      return;
    }
    
    // Set protection flags
    isJoiningRoomRef.current = true;
    setIsJoiningRoom(true);
    setError('');
    
    const joinAttemptId = Date.now();
    console.log(`VideoCallChat[${joinAttemptId}]: Attempting to join room ${roomId}`);
    
    // Setup watchdog timer
    const watchdogTimeout = setTimeout(() => {
      if (isJoiningRoomRef.current) {
        console.error(`VideoCallChat[${joinAttemptId}]: Room join operation timed out`);
        isJoiningRoomRef.current = false;
        setIsJoiningRoom(false);
        setError('Waktu bergabung ke ruangan habis. Silakan coba lagi.');
      }
    }, 20000);
    
    try {      
      if (!webrtcServiceRef.current) {
        throw new Error('Layanan WebRTC belum siap');
      }
      
      // Reset service state first to ensure clean join
      console.log(`VideoCallChat[${joinAttemptId}]: Performing preventative reset before joining`);
      await webrtcServiceRef.current.emergencyReset();
      
      // Join with timeout protection
      console.log(`VideoCallChat[${joinAttemptId}]: Joining room ${roomId}`);      // Join room with adaptive feedback and network awareness
      const joinTimeoutPromise = new Promise<never>((_, reject) => {
        let joinTimeoutTriggered = false;
        let networkStatusCheckInterval: NodeJS.Timeout | null = null;
        
        // Network monitoring
        networkStatusCheckInterval = setInterval(() => {
          if (!joinTimeoutTriggered && !window.navigator.onLine) {
            console.warn(`VideoCallChat[${joinAttemptId}]: Network is offline during room joining`);
            setError('Koneksi internet terputus. Menunggu koneksi kembali...');
          }
        }, 2000); // Check every 2 seconds
        
        // First warning - early feedback
        setTimeout(() => {
          if (!joinTimeoutTriggered) {
            console.log(`VideoCallChat[${joinAttemptId}]: Room join taking longer than expected`);
            setError('Bergabung dengan ruangan... harap tunggu');
          }
        }, 5000);
        
        // Second warning - mid-process
        setTimeout(() => {
          if (!joinTimeoutTriggered) {
            console.log(`VideoCallChat[${joinAttemptId}]: Room join still in progress`);
            setError('Masih mencoba bergabung... memerlukan waktu lebih lama dari biasanya');
          }
        }, 12000);
        
        // Final timeout - actual failure but with network awareness
        setTimeout(() => {
          if (networkStatusCheckInterval) {
            clearInterval(networkStatusCheckInterval);
          }
          
          joinTimeoutTriggered = true;
          
          // If offline, provide more helpful message
          if (!window.navigator.onLine) {
            reject(new Error('Koneksi internet terputus saat bergabung ruangan. Silakan periksa koneksi Anda.'));
          } else {
            reject(new Error('Waktu habis saat bergabung ke ruangan - koneksi mungkin lambat atau tidak stabil'));
          }
        }, 25000); // Extended to 25s matching WebRTC service timeout
      });
        // Check network status before attempting to join room
      const networkAvailable = webrtcServiceRef.current.isNetworkAvailable?.() ?? window.navigator.onLine;
      if (!networkAvailable) {
        console.warn(`VideoCallChat[${joinAttemptId}]: Network appears to be offline, warning user`);
        setError('Koneksi internet tidak tersedia. Harap periksa koneksi Anda dan coba lagi.');
        throw new Error('Network offline');
      }
      
      await Promise.race([
        webrtcServiceRef.current.joinRoom(roomId, isVideoEnabled, isAudioEnabled),
        joinTimeoutPromise
      ]);
      
      console.log(`VideoCallChat[${joinAttemptId}]: Successfully joined room ${roomId}`);
    } catch (err: any) {
      console.error(`VideoCallChat[${joinAttemptId}]: Error joining room:`, err);
      
      // Create a more helpful error message
      let errorMsg = 'Gagal bergabung ke ruang panggilan: ';
      
      if (!err.message) {
        errorMsg += 'Terjadi kesalahan tidak diketahui';
      } else if (err.message.includes('Timeout') || err.message.includes('Waktu habis')) {
        errorMsg += 'Waktu habis, mungkin karena masalah jaringan';
      } else if (err.message.includes('getUserMedia')) {
        errorMsg += 'Tidak dapat mengakses kamera atau mikrofon';
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
      
      // Try to recover service state
      if (webrtcServiceRef.current) {
        try {
          await webrtcServiceRef.current.emergencyReset();
        } catch (resetErr) {
          console.error(`VideoCallChat[${joinAttemptId}]: Failed to reset state after join error:`, resetErr);
        }
      }
    } finally {
      // Clear watchdog
      clearTimeout(watchdogTimeout);
      
      // Delay resetting the joining flags to prevent rapid retries
      setTimeout(() => {
        isJoiningRoomRef.current = false;
        setIsJoiningRoom(false);
        console.log(`VideoCallChat[${joinAttemptId}]: Join operation complete, state reset`);
      }, 2000);
    }
  };
    // Ref untuk mencegah multiple leave operations
  const isLeavingRoomRef = useRef(false);
  
  const handleLeaveRoom = async () => {
    // Prevent duplicate leave attempts
    if (isLeavingRoomRef.current) {
      console.log('VideoCallChat: Leave room operation already in progress');
      return;
    }
    
    // Skip if not in a room
    if (!callState.inRoom) {
      console.log('VideoCallChat: Not in a room, nothing to leave');
      return;
    }
    
    isLeavingRoomRef.current = true;
    setError('');
    
    const leaveAttemptId = Date.now();
    console.log(`VideoCallChat[${leaveAttemptId}]: Leaving room ${callState.roomId || 'unknown'}`);
    
    try {
      if (!webrtcServiceRef.current) {
        throw new Error('Layanan WebRTC tidak tersedia');
      }
      
      // Set a timeout for the leave operation
      await Promise.race([
        webrtcServiceRef.current.leaveRoom(),
        new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            console.warn(`VideoCallChat[${leaveAttemptId}]: Leave room timeout, forcing reset`);
            if (webrtcServiceRef.current) {
              webrtcServiceRef.current.emergencyReset()
                .then(() => resolve())
                .catch(err => {
                  console.error(`VideoCallChat[${leaveAttemptId}]: Error in emergency reset:`, err);
                  reject(new Error('Gagal melakukan reset darurat'));
                });
            } else {
              resolve();
            }
          }, 5000);
        })
      ]);
      
      console.log(`VideoCallChat[${leaveAttemptId}]: Successfully left room`);
    } catch (err: any) {
      console.error(`VideoCallChat[${leaveAttemptId}]: Error leaving room:`, err);
      setError('Gagal keluar dari ruang panggilan: ' + 
               (err.message || 'Terjadi kesalahan tidak diketahui'));
      
      // Force reset on error
      if (webrtcServiceRef.current) {
        try {
          console.log(`VideoCallChat[${leaveAttemptId}]: Performing emergency reset after leave error`);
          await webrtcServiceRef.current.emergencyReset();
        } catch (resetErr) {
          console.error(`VideoCallChat[${leaveAttemptId}]: Failed to reset after leave error:`, resetErr);
        }
      }
    } finally {
      // Small delay before resetting flag to prevent rapid retries
      setTimeout(() => {
        isLeavingRoomRef.current = false;
        console.log(`VideoCallChat[${leaveAttemptId}]: Leave operation state reset`);
      }, 1000);
    }
  };
  
  // Legacy functions for backward compatibility
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
    if (callState.inRoom) {
      await handleLeaveRoom();
    } else {
      try {
        if (webrtcServiceRef.current) {
          await webrtcServiceRef.current.endCall();
        }
      } catch (err: any) {
        setError('Gagal mengakhiri panggilan: ' + err.message);
      }
    }
  };

  const toggleVideo = async () => {
    if (webrtcServiceRef.current) {
      const enabled = await webrtcServiceRef.current.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const toggleAudio = async () => {
    if (webrtcServiceRef.current) {
      const enabled = await webrtcServiceRef.current.toggleAudio();
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

  // Diagnostic functions
  const handleDiagnosticsComplete = (results: DiagnosticResults) => {
    setDiagnosticResults(results);
    
    // Enable diagnostic mode in WebRTC service if we have connectivity issues
    if (webrtcServiceRef.current && (!results.stunConnectivity.success || !results.turnConnectivity.success)) {
      webrtcServiceRef.current.enableDiagnosticMode(true);
    }
  };

  // Run diagnostic optimization after issues detected
  const applyDiagnosticOptimizations = async () => {
    if (!webrtcServiceRef.current || !diagnosticResults) return;
    
    try {
      setError('Menerapkan pengoptimalan berdasarkan hasil diagnostik...');
      
      // Get optimized ICE servers based on diagnostic results
      const optimalServers = await webrtcServiceRef.current.getOptimalIceServers();
      console.log('VideoCallChat: Applied optimal ICE servers based on diagnostics:', 
        optimalServers.map(s => typeof s.urls === 'string' ? s.urls : s.urls?.[0]).join(', '));
      
      setError('Pengoptimalan jaringan diterapkan. Silakan coba lagi membuat ruangan.');
      setTimeout(() => setError(''), 5000);
    } catch (err) {
      console.error('Error applying diagnostic optimizations:', err);
      setError('Gagal menerapkan pengoptimalan. Silakan coba lagi nanti.');
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
        <div className="card-modern max-w-md w-full mx-2 sm:mx-4 p-4 sm:p-8 shadow-hard animate-scale-in">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 mb-4 sm:mb-6 shadow-soft">
              <svg className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
              Panggilan Masuk
            </h3>
            <p className="text-sm sm:text-base text-slate-300 mb-6 sm:mb-8">
              {callState.callerInfo?.displayName || 'Seseorang'} sedang menelepon Anda
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleRejectCall}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-smooth shadow-soft hover:shadow-medium"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.68.28-.53 0-.96-.43-.96-.96V9.72C2.21 11.26 1 13.51 1 16c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5 0-2.49-1.21-4.74-3.07-6.13v5.17c0 .53-.43.96-.96.96-.25 0-.5-.1-.68-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9V9.72C15.15 9.25 13.6 9 12 9z" />
                  </svg>
                  Tolak
                </div>
              </button>
              <button
                onClick={handleAcceptCall}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-smooth shadow-soft hover:shadow-medium"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
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

  return (      <div className="h-full flex flex-col card-modern shadow-hard overflow-hidden">
      {/* Header with tabs */}
      <div className="p-3 sm:p-4 border-b border-slate-700/30 glassmorphism bg-slate-800/40">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-sm text-red-200 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p>{error}</p>
              {(error.includes('koneksi') || 
                error.includes('jaringan') || 
                error.includes('Timeout') || 
                error.includes('Waktu habis') || 
                error.includes('koneksi internet')) && (
                <button
                  onClick={() => setIsDiagnosticsModalOpen(true)}
                  className="mt-2 flex items-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Jalankan Diagnostik Koneksi
                </button>
              )}
            </div>
            <button 
              className="ml-2 text-red-400 hover:text-red-300 flex-shrink-0" 
              onClick={() => setError('')}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">
              Komunikasi
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 mb-3 sm:mb-0">
              Hubungi dan chat dengan anggota rumah lain
            </p>
          </div>
          <div className="flex space-x-2 bg-slate-900/40 p-1 rounded-lg border border-slate-700/40">
            <button 
              onClick={() => setActiveTab('call')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-smooth ${
                activeTab === 'call' 
                  ? 'bg-gradient-to-r from-blue-600/70 to-indigo-600/70 text-white shadow-soft' 
                  : 'text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start">
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Panggilan</span>
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-smooth ${
                activeTab === 'chat' 
                  ? 'bg-gradient-to-r from-blue-600/70 to-indigo-600/70 text-white shadow-soft' 
                  : 'text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center justify-center sm:justify-start">
                <svg className="w-4 h-4 sm:mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                </svg>
                <span className="hidden sm:inline">Chat</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-2 sm:mx-4 my-2 sm:my-3 p-3 sm:p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in" role="alert">
          <div className="flex items-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="absolute top-2 right-2 text-red-400 hover:text-red-300"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content: Video Call or Chat based on active tab */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'call' && (
          <div className="flex-1 flex flex-col">
            {(callState.isConnected || callState.isConnecting || callState.isCalling) ? (              <div className="flex-1 relative bg-gradient-to-b from-slate-900 to-slate-800">
                {/* Room-based interface */}
                {callState.inRoom ? (
                  <div className="relative h-full">
                    {/* Room header */}
                    <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 z-10 glassmorphism bg-slate-900/70 backdrop-blur-sm flex items-center">
                      <div className="flex-1">
                        <h3 className="text-sm sm:text-base text-white font-medium">
                          {callState.roomName || 'Ruang Panggilan'}
                        </h3>
                        <p className="text-2xs sm:text-xs text-slate-300">
                          {Object.keys(callState.participants).length} peserta
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Connection quality indicator */}
                        {callState.connectionQuality && (
                          <div className="text-xs bg-slate-800/70 px-2 py-1 rounded-md flex items-center mr-1">
                            <span 
                              className={`w-2 h-2 rounded-full mr-1.5 ${
                                callState.connectionQuality === 'good' 
                                  ? 'bg-green-500' 
                                  : callState.connectionQuality === 'fair' 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-500'
                              }`}
                            ></span>
                            <span className={
                              callState.connectionQuality === 'good' 
                                ? 'text-green-400' 
                                : callState.connectionQuality === 'fair' 
                                ? 'text-yellow-400' 
                                : 'text-red-400'
                            }>
                              {callState.connectionQuality === 'good' 
                                ? 'Koneksi baik' 
                                : callState.connectionQuality === 'fair' 
                                ? 'Koneksi sedang' 
                                : 'Koneksi buruk'}
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-slate-400 bg-slate-800/70 px-2 py-1 rounded-md flex items-center">
                          <span className="animate-pulse w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                          Live
                        </div>
                      </div>
                    </div>
                    
                    {/* Participants grid */}
                    <div className="h-full p-2 sm:p-4 pt-12 sm:pt-14">
                      {Object.keys(callState.participants).length <= 1 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-slate-400">
                            <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-indigo-500/30 mb-4 sm:mb-6 shadow-medium flex items-center justify-center">
                              <svg className="h-8 w-8 sm:h-10 sm:w-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <h4 className="text-sm sm:text-base font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Menunggu peserta lain</h4>
                            <p className="mt-2 text-xs sm:text-sm max-w-xs mx-auto">Bagikan tautan ruangan kepada anggota rumah lain agar mereka bisa bergabung ke panggilan</p>
                          </div>
                        </div>
                      ) : (
                        <div className={`grid grid-cols-1 ${
                          Object.keys(callState.participants).length <= 2 ? 'sm:grid-cols-1' : 
                          Object.keys(callState.participants).length <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
                        } gap-2 sm:gap-4 h-full`}>
                          {Object.values(callState.participants).map((participant) => {
                            const isCurrentUser = participant.userId === currentUser?.uid;
                            
                            return (
                              <div key={participant.userId} className="relative aspect-video h-auto bg-slate-800 rounded-lg overflow-hidden">
                                {isCurrentUser ? (
                                  <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <video
                                    ref={(element) => {
                                      if (element) {
                                        participantVideosRef.current.set(participant.userId, element);
                                        if (participant.stream && element.srcObject !== participant.stream) {
                                          element.srcObject = participant.stream;
                                        }
                                      }
                                    }}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                
                                {/* Overlay with participant info and status */}
                                <div className="absolute bottom-0 left-0 right-0 p-2 glassmorphism bg-gradient-to-t from-slate-900/80 to-transparent">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-600/70 to-indigo-600/70 flex items-center justify-center mr-2 shadow-soft">
                                        <span className="text-2xs sm:text-xs font-medium text-white">
                                          {participant.displayName?.slice(0, 1) || '?'}
                                        </span>
                                      </div>
                                      <span className="text-xs sm:text-sm text-white truncate">
                                        {participant.displayName || 'Unknown'}
                                        {isCurrentUser && ' (Anda)'}
                                      </span>
                                    </div>
                                    <div className="flex space-x-1 sm:space-x-2">
                                      {!participant.hasAudio && (
                                        <div className="p-1 rounded-full bg-red-500/80">
                                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.586 15.414a8 8 0 1112.828-9.9A8 8 0 015.586 15.414zM10 3a7 7 0 00-7 7 7 7 0 103-5.723V7a1 1 0 10-2 0v3.586a1 1 0 00.293.707l2 2a1 1 0 001.414 0l2-2a1 1 0 00.293-.707V6a2 2 0 114 0v5a1 1 0 11-2 0V8a1 1 0 10-2 0v3.586a1 1 0 00.293.707L12 14.586A7 7 0 0010 3z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      )}
                                      {!participant.hasVideo && (
                                        <div className="p-1 rounded-full bg-red-500/80">
                                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Legacy call interface */}
                    {/* Remote Video (main) */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                    />

                    {/* Local Video (picture-in-picture) */}
                    <div className="absolute bottom-2 sm:bottom-6 right-2 sm:right-6 w-1/4 sm:w-1/3 md:w-48 h-auto rounded-xl overflow-hidden border-2 border-blue-500/40 shadow-hard glassmorphism aspect-video">
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
                          <p className="text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 text-base sm:text-lg">Menghubungkan...</p>
                        </div>
                      </div>
                    )}

                    {callState.isCalling && (
                      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                        <div className="text-center text-white">
                          <div className="animate-pulse mb-4 sm:mb-6">
                            <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <p className="text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 text-base sm:text-lg">Memanggil...</p>
                        </div>
                      </div>
                    )}
                  </>
                )}                {/* Call Controls */}
                <div className="absolute bottom-2 sm:bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 sm:space-x-4 glassmorphism py-2 sm:py-3 px-3 sm:px-6 rounded-full shadow-hard animate-slide-up">
                  <button
                    onClick={toggleAudio}
                    className={`p-2 sm:p-3 rounded-full ${
                      isAudioEnabled 
                        ? 'bg-slate-700/80 hover:bg-slate-600/80' 
                        : 'bg-red-600/90 hover:bg-red-700/90'
                    } text-white transition-smooth shadow-soft`}
                    title={isAudioEnabled ? "Matikan mikrofon" : "Nyalakan mikrofon"}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                      {isAudioEnabled ? (
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.941V21H9v2h6v-2h-2v-2.059A9 9 0 0021 12v-2h-2z" />
                      ) : (
                        <path d="M12 1a3 3 0 00-3 3v8c0 .14.01.28.02.42L15 7.5V4a3 3 0 00-3-3zM19 10v2a7.03 7.03 0 01-.1 1.1l1.45 1.44A9.02 9.02 0 0021 12v-2h-2zM4.27 3L21.19 21.19l-1.41 1.41L15.54 17.1c-.82.4-1.74.63-2.71.78V21h2v2H9v-2h2v-3.12A9 9 0 013 12v-2h2v2c0 .84.15 1.64.41 2.39L4.27 3z" />
                      )}
                    </svg>
                  </button>
                  
                  <button
                    onClick={toggleVideo}
                    className={`p-2 sm:p-3 rounded-full ${
                      isVideoEnabled 
                        ? 'bg-slate-700/80 hover:bg-slate-600/80' 
                        : 'bg-red-600/90 hover:bg-red-700/90'
                    } text-white transition-smooth shadow-soft`}
                    title={isVideoEnabled ? "Matikan kamera" : "Nyalakan kamera"}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                      {isVideoEnabled ? (
                        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
                      ) : (
                        <path d="M21 6.5L17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5L21 17.5V6.5zM16 16H4V8h12v8zM2.81 2.81L21.19 21.19l-1.41 1.41L2.81 4.22l1.41-1.41z" />
                      )}
                    </svg>
                  </button>
                  
                  {callState.inRoom ? (
                    <button
                      onClick={handleLeaveRoom}
                      className="flex items-center p-2 sm:p-3 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-smooth shadow-soft hover:shadow-medium"
                      title="Tinggalkan ruangan"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleEndCall}
                      className="p-2 sm:p-3 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white transition-smooth shadow-soft hover:shadow-medium"
                      title="Akhiri panggilan"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.68.28-.53 0-.96-.43-.96-.96V9.72C2.21 11.26 1 13.51 1 16c0 2.76 2.24 5 5 5h12c2.76 0 5-2.24 5-5 0-2.49-1.21-4.74-3.07-6.13v5.17c0 .53-.43.96-.96.96-.25 0-.5-.1-.68-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9V9.72C15.15 9.25 13.6 9 12 9z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (              // Room-based interface
              <div className="flex-1 flex flex-col glassmorphism bg-gradient-to-b from-transparent to-slate-800/30">
                <div className="p-4 sm:p-6 animate-fade-in">
                  <div className="mx-auto flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-indigo-500/30 mb-4 sm:mb-6 shadow-medium animate-float">
                    <svg className="h-10 w-10 sm:h-12 sm:w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>                  <h3 className="text-xl sm:text-2xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-2 sm:mb-3 text-center">
                    Ruang Panggilan Video
                  </h3>
                  <p className="text-sm sm:text-base text-slate-400">
                    Buat ruangan baru atau bergabung dengan ruangan yang sudah ada untuk melakukan panggilan video
                  </p>
                  
                  {/* Create new room */}
                  <div className="mb-6 p-4 sm:p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-soft">
                    <h4 className="text-base sm:text-lg font-medium text-blue-400 mb-3">Buat Ruang Baru</h4>
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Nama Ruangan (opsional)"
                        className="flex-1 input-modern shadow-soft text-sm h-10 sm:h-auto"
                      />                      <button
                        onClick={handleCreateRoom}
                        disabled={isCreatingRoom || callState.inRoom || isJoiningRoom}
                        className={`flex items-center justify-center px-4 py-2 ${
                          isCreatingRoom || callState.inRoom || isJoiningRoom
                            ? 'bg-slate-500 cursor-not-allowed opacity-60'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                        } text-white rounded-lg transition-smooth shadow-soft hover:shadow-medium`}
                      >
                        {isCreatingRoom ? (
                          <>
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                            <span className="text-sm sm:text-base">Membuat...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="text-sm sm:text-base">Buat Ruang</span>
                          </>
                        )}
                      </button>
                    </div>                    <div className="mt-3 text-xs text-slate-400 flex items-center">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Ruang baru langsung aktif dan Anda akan otomatis bergabung</span>
                    </div>
                    {callState.isConnecting && (
                      <div className="mt-3 py-2 px-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center text-xs text-blue-300">
                          <div className="w-3 h-3 border-2 border-t-transparent border-blue-400 rounded-full animate-spin mr-2"></div>
                          <span>Menghubungkan ke ruang panggilan... Mohon tunggu.</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Active rooms list */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base sm:text-lg font-medium text-blue-400">Ruang Aktif</h4>
                      <button 
                        onClick={fetchRooms}
                        className="flex items-center text-xs sm:text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        <svg className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 ${isLoadingRooms ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                    
                    {isLoadingRooms ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 sm:border-3 border-t-transparent border-blue-500 animate-spin"></div>
                        <span className="ml-3 text-sm text-slate-400">Memuat ruangan...</span>
                      </div>
                    ) : rooms.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
                        </svg>
                        <p className="mt-2 sm:mt-3 text-sm">Belum ada ruang aktif</p>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        {rooms.map(room => {
                          const participantCount = Object.keys(room.participants || {}).length;
                          const isCreator = room.createdBy === currentUser?.uid;
                          
                          return (
                            <div key={room.id} className="p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 shadow-soft hover:shadow-medium transition-smooth flex flex-col sm:flex-row sm:items-center">
                              <div className="flex-1 mb-3 sm:mb-0">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-indigo-500/30 flex items-center justify-center shadow-soft">
                                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h5 className="text-sm sm:text-base font-medium text-white">{room.name || `Room ${room.id.slice(0, 4)}`}</h5>
                                    <div className="flex items-center mt-1 text-xs text-slate-400">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                      </svg>
                                      <span>{participantCount} {participantCount === 1 ? 'peserta' : 'peserta'}</span>
                                      {isCreator && (
                                        <span className="ml-2 bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded text-2xs">Pembuat</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>                              <button
                                onClick={() => handleJoinRoom(room.id)}
                                disabled={isJoiningRoom || callState.inRoom || isCreatingRoom || 
                                    (isJoiningRoom && room.id === callState.roomId)}
                                className={`flex items-center justify-center px-3 sm:px-4 py-2 ${
                                  isJoiningRoom || callState.inRoom || isCreatingRoom
                                    ? 'bg-slate-500 cursor-not-allowed opacity-60'
                                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                                } text-white rounded-lg transition-smooth shadow-soft hover:shadow-medium text-xs sm:text-sm`}
                              >
                                {isJoiningRoom && room.id === callState.roomId ? (
                                  <>
                                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-1.5"></div>
                                    <span>Bergabung...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z" clipRule="evenodd" />
                                    </svg>
                                    Gabung Sekarang
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-6 text-xs text-slate-400 text-center">
                    <span className="inline-flex items-center mr-2">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="flex items-center justify-center h-48 sm:h-64">
                <div className="relative">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-3 sm:border-4 border-t-transparent border-blue-500 animate-spin"></div>
                  <div className="mt-3 sm:mt-4 text-blue-400 text-xs sm:text-sm animate-pulse">Memuat pesan...</div>
                </div>
              </div>
            ) : (
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 glassmorphism bg-slate-800/20"
                style={{ maxHeight: isMobile ? 'calc(100vh - 180px)' : 'calc(100vh - 200px)' }}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center animate-fade-in">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4">
                        <svg className="absolute w-20 h-20 sm:w-24 sm:h-24 text-blue-900/20 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                        </svg>
                        <svg className="absolute w-14 h-14 sm:w-16 sm:h-16 text-indigo-500/20 top-3 sm:top-4 left-3 sm:left-4 animate-float" style={{animationDelay: '1s'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                        </svg>
                      </div>
                      <h3 className="mt-2 text-lg sm:text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Belum ada pesan</h3>
                      <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
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
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center mr-1.5 sm:mr-2 shadow-soft mt-1`}>
                              <span className="text-2xs sm:text-xs font-medium text-white">
                                {getUserInitials(message.senderId)}
                              </span>
                            </div>
                          )}
                          
                          <div
                            className={`max-w-[75%] sm:max-w-xs md:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-soft transition-all duration-200 ${
                              isOwnMessage
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-medium hover:-translate-y-0.5'
                                : 'glassmorphism bg-slate-800/40 text-slate-200 hover:shadow-medium hover:-translate-y-0.5'
                            }`}
                          >
                            <p className="text-xs sm:text-sm leading-relaxed">{message.text}</p>
                            <div className={`mt-1 text-2xs sm:text-xs flex items-center justify-between ${
                              isOwnMessage ? 'text-indigo-200/80' : 'text-slate-400'
                            }`}>
                              <span>{formatTime(message.timestamp)}</span>
                              {isOwnMessage && (
                                <span className="ml-2 flex items-center">
                                  {message.read ? (
                                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-1 text-blue-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M4.5 12.75L10.5 18.75L19.5 5.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isOwnMessage && (
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center ml-1.5 sm:ml-2 shadow-soft mt-1`}>
                              <span className="text-2xs sm:text-xs font-medium text-white">
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
            <div className="p-2 sm:p-4 border-t border-slate-700/30 bg-slate-800/50">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 input-modern shadow-soft focus:ring-2 focus:ring-blue-500/50 text-xs sm:text-sm h-10 sm:h-auto"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-3 sm:px-4 py-2 btn-primary text-white rounded-lg flex items-center justify-center shadow-soft hover:shadow-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:transform-none"
                  aria-label="Send message"
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.3009 13.6948L20.102 3.89668M10.5795 14.1663L12.8019 18.5317C13.339 19.6473 14.8883 19.7545 15.5975 18.7263L21.3961 10.1245C21.9701 9.31173 21.5224 8.21519 20.564 8.02681L3.75756 4.00984C2.70599 3.8036 1.8299 4.88221 2.25233 5.89143L5.87486 15.5202C6.21456 16.3766 7.26272 16.7249 8.02371 16.2485L10.5795 14.1663Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </form>
            </div>            {/* Diagnostics Modal */}
            {isDiagnosticsModalOpen && (
              <WebRTCDiagnostics 
                onClose={() => setIsDiagnosticsModalOpen(false)} 
                onDiagnosticsComplete={handleDiagnosticsComplete}
                isOpen={isDiagnosticsModalOpen}
              />
            )}
            
            {/* Optimization button shown after diagnostics */}
            {diagnosticResults && !isDiagnosticsModalOpen && (
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 16l-6.36-6.33 1.42-1.42L12 13.17l4.94-4.95 1.42 1.42z"/>
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-blue-200">Diagnostik telah selesai. {
                      (!diagnosticResults.stunConnectivity.success || !diagnosticResults.turnConnectivity.success) 
                        ? 'Ditemukan masalah koneksi WebRTC.' 
                        : 'Koneksi WebRTC tampak baik.'
                    }</p>
                    
                    <button
                      onClick={applyDiagnosticOptimizations}
                      className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-10v6h2V7h-2z"/>
                      </svg>
                      Terapkan Pengoptimalan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallChat;
