import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage } from '../../types/user';
import { 
  sendChatMessage, 
  subscribeToChatMessages, 
  markMessageAsRead,
  addEmojiReaction,
  removeEmojiReaction
} from '../../services/firebase/chat';
import { format, formatDistanceToNow, isToday, isYesterday, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface ChatProps {
  homeId: string;
}

// Common emoji set
const commonEmojis = ['👍', '❤️', '😂', '🎉', '🙏', '👏', '🔥', '😍'];

const Chat: React.FC<ChatProps> = ({ homeId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { currentUser, userProfile } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [markingMessageIds, setMarkingMessageIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    text: string;
    senderId: string;
  } | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  
  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
    // Focus the input field when messages load
    if (!loading && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [messages, loading, scrollToBottom]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!homeId || !currentUser) return;

    const unsubscribe = subscribeToChatMessages(homeId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Mark messages as read when they are visible
      // But do this on a slight delay to avoid excessive marking operations
      const markMessagesAsReadDebounced = setTimeout(() => {
        const unreadMessages = newMessages.filter(
          message => message.senderId !== currentUser.uid && !message.read
        );

        if (unreadMessages.length > 0) {
          // Mark all unread messages from others as read
          unreadMessages.forEach(message => {
            markMessageAsRead(message.id, currentUser.uid);
          });
        }
      }, 1000); // 1 second delay

      return () => clearTimeout(markMessagesAsReadDebounced);
    });

    return () => unsubscribe();
  }, [homeId, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser) return;

    setSending(true);
    setError('');

    try {
      const { error } = await sendChatMessage(
        homeId, 
        currentUser.uid, 
        newMessage.trim(),
        replyingTo
      );
      
      if (error) {
        setError(error);
      } else {
        setNewMessage('');
        setReplyingTo(undefined); // Clear reply state after sending
      }
    } catch (err: any) {
      setError('Gagal mengirim pesan: ' + err.message);
    } finally {
      setSending(false);
    }
  };
  
  // Manual mark as read
  const handleMarkMessageAsRead = async (messageId: string) => {
    if (!currentUser || markingMessageIds.has(messageId)) return;
    
    try {
      setMarkingMessageIds(prev => new Set(prev).add(messageId));
      await markMessageAsRead(messageId, currentUser.uid);
    } catch (err: any) {
      console.error('Failed to mark message as read:', err);
    } finally {
      setMarkingMessageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };
  
  // Handle replying to a message
  const handleReplyToMessage = (message: ChatMessage) => {
    setReplyingTo({
      id: message.id,
      text: message.text,
      senderId: message.senderId
    });
    inputRef.current?.focus();
  };
  
  // Cancel a reply
  const handleCancelReply = () => {
    setReplyingTo(undefined);
  };
  
  // Handle emoji reactions
  const handleEmojiReaction = async (messageId: string, emojiType: string) => {
    if (!currentUser) return;
    
    // Check if user already reacted with this emoji
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const emojiReaction = message.emoji?.find(e => e.type === emojiType);
    
    if (emojiReaction && emojiReaction.users.includes(currentUser.uid)) {
      // User already reacted with this emoji, remove it
      await removeEmojiReaction(messageId, currentUser.uid, emojiType);
    } else {
      // Add the reaction
      await addEmojiReaction(messageId, currentUser.uid, emojiType);
    }
  };

  // Enhanced time formatter using date-fns with more human-readable format
  const formatMessageTime = (timestamp: Date) => {
    const messageDate = new Date(timestamp);
    
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm", { locale: id });
    } else if (isYesterday(messageDate)) {
      return `Kemarin ${format(messageDate, "HH:mm", { locale: id })}`;
    } else {
      return format(messageDate, "d MMM", { locale: id });
    }
  };
  
  // Format date for message groups
  const formatMessageDate = (timestamp: Date) => {
    const messageDate = new Date(timestamp);
    
    if (isToday(messageDate)) {
      return 'Hari Ini';
    } else if (isYesterday(messageDate)) {
      return 'Kemarin';
    } else if (new Date().getTime() - messageDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return format(messageDate, "EEEE", { locale: id });
    } else {
      return format(messageDate, "d MMMM yyyy", { locale: id });
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
  
  // Determine if we should show a date separator between messages
  const shouldShowDateSeparator = (currentMsg: ChatMessage, prevMsg: ChatMessage | null) => {
    if (!prevMsg) return true; // Always show for first message
    
    const currentDate = new Date(currentMsg.timestamp);
    const prevDate = new Date(prevMsg.timestamp);
    
    return !isSameDay(currentDate, prevDate);
  };  
  
  // Get message sender name
  const getSenderName = (senderId: string) => {
    if (senderId === currentUser?.uid && userProfile) {
      return userProfile.displayName || 'Saya';
    }
    return 'Anggota Keluarga'; // Default for others until we implement proper user profiles
  };
  
  // Toggle emoji picker for a message
  const toggleEmojiPicker = (messageId: string | null) => {
    setActiveMessage(messageId);
    setShowEmojiPicker(messageId !== null);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-5 bg-gradient-to-b from-slate-800/30 to-slate-900/30 rounded-lg border border-indigo-500/20 shadow-lg animate-pulse">
          <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent border-indigo-500 animate-spin mb-3"></div>
          <div className="text-indigo-300 text-sm font-medium mt-2">Memuat percakapan...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-[calc(100vh-260px)] md:h-[450px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/30 shadow-xl transition-all duration-300 hover:shadow-indigo-500/10">      
      {/* Header - More compact, minimal design */}
      <div className="p-2.5 bg-gradient-to-r from-indigo-800/30 to-slate-800/30 border-b border-indigo-700/20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="relative h-7 w-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              {currentUser && messages.filter(m => !m.read && m.senderId !== currentUser.uid).length > 0 && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border border-slate-800 animate-pulse"></span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Chat Rumah</h2>
              <div className="flex items-center text-[10px] text-indigo-200/70">
                {currentUser && messages.filter(m => !m.read && m.senderId !== currentUser.uid).length > 0 ? (
                  <span className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse mr-1"></span>
                    <span>{messages.filter(m => !m.read && m.senderId !== currentUser.uid).length} pesan baru</span>
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                    <span>{messages.length} {messages.length === 1 ? 'pesan' : 'pesan'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex space-x-1.5">
            <button 
              className="text-indigo-300 hover:text-indigo-100 transition-all p-1 rounded-full hover:bg-indigo-600/20" 
              title="Refresh chat"
              onClick={scrollToBottom}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
            <button className="text-indigo-300 hover:text-indigo-100 transition-all p-1 rounded-full hover:bg-indigo-600/20" title="Pengaturan chat">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Message - Minimalist toast-like styling */}
      {error && (
        <div className="mx-2 my-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2 text-xs animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-200 flex-grow">{error}</span>
          <button 
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-300 p-0.5 rounded-full hover:bg-red-500/10"
            aria-label="Dismiss error"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Messages Container - More compact with fixed height */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 bg-gradient-to-b from-slate-800/50 to-slate-900/50"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/20 shadow-inner max-w-xs transform transition-all duration-500 hover:scale-105">
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mx-auto text-indigo-400 mb-3 animate-[bounce_2s_infinite]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-indigo-200">Mulai Percakapan</h3>
              <p className="mt-2 text-xs text-indigo-300/70">
                Kirim pesan pertama untuk mulai mengobrol.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === currentUser?.uid;
              const prevMessage = index > 0 ? messages[index-1] : null;
              
              // Show date separator if needed
              const showDateSeparator = shouldShowDateSeparator(message, prevMessage);
              
              // Group messages by sender with smaller gap between same sender messages
              const showSender = index === 0 || 
                messages[index-1].senderId !== message.senderId || 
                new Date(message.timestamp).getTime() - new Date(messages[index-1].timestamp).getTime() > 5 * 60 * 1000;
              
              // Animation delay based on index for staggered appearance
              const animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
              
              return (
                <React.Fragment key={message.id}>
                  {/* Date separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-2">
                      <div className="px-2 py-0.5 rounded-full bg-indigo-900/30 border border-indigo-700/30 text-[10px] font-medium text-indigo-200/80 animate-fade-in">
                        {formatMessageDate(message.timestamp)}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`flex items-end ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s]`}
                    style={{ 
                      animationDelay, 
                      marginTop: showSender ? '8px' : '1px'
                    }}
                  >
                    {/* Small avatar dot for other users - Only show if it's first in sequence */}
                    {!isOwnMessage && showSender && (
                      <div className="flex-shrink-0 mr-1">
                        <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center ring-1 ring-indigo-400/30 animate-[scaleIn_0.3s]`}>
                          <span className="text-[7px] font-medium text-white">
                            {getUserInitials(message.senderId)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Message bubble - More compact and subtle with improved read/unread indicators */}
                    <div
                      className={`px-2.5 py-1.5 rounded-xl max-w-[75%] ${
                        isOwnMessage
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm'
                          : message.read 
                            ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-200 rounded-bl-sm'
                            : 'bg-gradient-to-br from-slate-700 to-slate-800 border-l-2 border-blue-400 text-slate-200 rounded-bl-sm'
                      } transform hover:scale-[1.02] transition-all duration-200 shadow-sm hover:shadow-md relative group cursor-pointer ${
                        !message.read && !isOwnMessage 
                          ? 'hover:ring-2 hover:ring-blue-500/40'
                          : ''
                      }`}
                      onDoubleClick={() => !message.read && !isOwnMessage && handleMarkMessageAsRead(message.id)}
                    >
                      {/* "Mark as read" tooltip - only show for unread messages from others on hover */}
                      {!message.read && !isOwnMessage && (
                        <span className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-md shadow-md pointer-events-none">
                          Double-click untuk menandai <span className="font-bold">sudah dibaca</span>
                        </span>
                      )}
                      
                      {/* Display reply reference if this message is a reply */}
                      {message.replyTo && (
                        <div className="mb-1 p-1.5 rounded bg-slate-700/30 border-l-2 border-indigo-400/50 text-[10px] text-slate-300/80 max-w-[200px] truncate">
                          <div className="font-medium text-indigo-300/80">
                            {message.replyTo.senderId === currentUser?.uid ? 'Anda' : 'Mereka'}:
                          </div>
                          <div className="truncate">{message.replyTo.text}</div>
                        </div>
                      )}
                      
                      <p className="text-xs md:text-xs leading-relaxed break-words">{message.text}</p>
                      
                      <div className="flex justify-between items-center gap-1 mt-0.5">
                        {/* Time and read indicators */}
                        <div className="flex items-center">
                          {markingMessageIds.has(message.id) ? (
                            <span className="text-[9px] text-blue-300 flex items-center">
                              <svg className="animate-spin -ml-0.5 mr-1 h-2 w-2 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Menandai...
                            </span>
                          ) : (
                            <span className={`text-[9px] ${isOwnMessage ? 'text-indigo-200/70' : 'text-slate-400/70'}`}>
                              {formatMessageTime(message.timestamp)}
                            </span>
                          )}
                          
                          {isOwnMessage && !markingMessageIds.has(message.id) && (
                            <div className="flex items-center ml-1" title={message.read ? "Dibaca" : "Terkirim"}>
                              {message.read ? (
                                <svg className="w-2.5 h-2.5 text-blue-300" viewBox="0 0 24 24" fill="none">
                                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              ) : (
                                <svg className="w-2.5 h-2.5 text-slate-400/70" viewBox="0 0 24 24" fill="none">
                                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Message actions - React, Reply, etc */}
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Reply button */}
                          <button 
                            onClick={() => handleReplyToMessage(message)} 
                            className={`p-0.5 rounded hover:bg-indigo-500/20 ${isOwnMessage ? 'text-indigo-300/70' : 'text-slate-400/70'} hover:text-white transition-all`}
                            title="Balas"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          {/* Emoji button */}
                          <button 
                            onClick={() => toggleEmojiPicker(activeMessage === message.id ? null : message.id)} 
                            className={`p-0.5 rounded hover:bg-indigo-500/20 ${isOwnMessage ? 'text-indigo-300/70' : 'text-slate-400/70'} hover:text-white transition-all ${activeMessage === message.id ? 'bg-indigo-500/30' : ''}`}
                            title="Tambah Emoji"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      {/* Show emoji reactions if any */}
                      {message.emoji && message.emoji.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.emoji.map((reaction) => (
                            <button
                              key={reaction.type}
                              onClick={() => handleEmojiReaction(message.id, reaction.type)}
                              className={`text-xs py-0.5 px-1 rounded-full border ${
                                currentUser && reaction.users.includes(currentUser.uid)
                                  ? 'bg-indigo-500/30 border-indigo-500/50'
                                  : 'bg-slate-800/30 border-slate-700/30'
                              } transition-all hover:scale-110`}
                              title={`${reaction.users.length} reaksi`}
                            >
                              <span>{reaction.type}</span>
                              <span className="ml-1 text-[9px]">{reaction.users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Emoji picker popup */}
                      {showEmojiPicker && activeMessage === message.id && (
                        <div className="absolute bottom-full left-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-1 z-10 animate-fade-in">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {commonEmojis.map(emoji => (
                              <button
                                key={emoji}
                                className="hover:bg-slate-700/50 p-1 rounded transition-all text-lg"
                                onClick={() => {
                                  handleEmojiReaction(message.id, emoji);
                                  toggleEmojiPicker(null);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Small avatar dot for self - Only show if it's first in sequence */}
                    {isOwnMessage && showSender && (
                      <div className="flex-shrink-0 ml-1">
                        <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center ring-1 ring-indigo-400/30 animate-[scaleIn_0.3s]`}>
                          <span className="text-[7px] font-medium text-white">
                            {getUserInitials(message.senderId)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} className="pt-1" />
          </>
        )}
      </div>
      
      {/* Reply preview bar - only show when replying */}
      {replyingTo && (
        <div className="px-3 py-1.5 border-t border-slate-700/30 bg-indigo-900/20 flex items-center justify-between">
          <div className="flex items-center flex-grow">
            <div className="w-1 h-6 bg-indigo-500 rounded-full mr-2"></div>
            <div className="flex-grow">
              <div className="text-[10px] text-indigo-300 font-medium">
                Membalas {replyingTo.senderId === currentUser?.uid ? 'pesan Anda' : 'pesan mereka'}
              </div>
              <div className="text-xs text-slate-300 truncate pr-2">
                {replyingTo.text}
              </div>
            </div>
          </div>
          <button 
            onClick={handleCancelReply} 
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700/50"
            title="Batalkan balasan"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Message Input - Modernized and minimalist */}
      <div className="p-2 border-t border-slate-700/30 bg-slate-800/80 backdrop-blur-sm">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-700/50 rounded-full px-2.5 py-0.5 border border-slate-600/30">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
            </svg>
          </button>
          
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan..."
            className="flex-1 bg-transparent text-white border-0 focus:ring-0 placeholder-slate-400 text-xs py-1.5"
            disabled={sending}
          />
          
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className={`rounded-full p-1.5 flex items-center justify-center transition-all ${
              sending || !newMessage.trim() 
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105'
            }`}
            aria-label="Send message"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-1.5 border-current border-t-transparent"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </form>
        
        {/* Emoji picker for message input */}
        {showEmojiPicker && !activeMessage && (
          <div className="absolute bottom-16 left-2 z-10 bg-slate-800 border border-slate-700/50 rounded-lg shadow-lg p-2">
            <div className="flex flex-wrap gap-1.5 max-w-[250px]">
              {commonEmojis.map(emoji => (
                <button
                  key={emoji}
                  className="hover:bg-slate-700 p-1.5 rounded transition-all text-xl"
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    setShowEmojiPicker(false);
                    inputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
              <button
                className="text-xs text-indigo-300 hover:text-indigo-100 mt-1 self-end ml-auto"
                onClick={() => setShowEmojiPicker(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Define animations in the component's CSS
const chatAnimations = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;

export default Chat;
