import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage } from '../../types/user';
import { 
  sendChatMessage, 
  subscribeToChatMessages, 
  markMessageAsRead 
} from '../../services/firebase/chat';

interface ChatProps {
  homeId: string;
}

const Chat: React.FC<ChatProps> = ({ homeId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { currentUser, userProfile } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to real-time messages
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

  // Simplified time formatter
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat pesan...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full card-modern overflow-hidden shadow-hard">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/30 glassmorphism bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Chat</h2>
            <p className="text-sm text-slate-400 mt-1">
              {messages.length} {messages.length === 1 ? 'pesan' : 'pesan'}
            </p>
          </div>
          <div className="bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50 flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></span>
            <span className="text-sm text-slate-300">Online</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages Container */}
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
            {/* Date separators and message grouping logic could be added here */}
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
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

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
  );
};

export default Chat;
