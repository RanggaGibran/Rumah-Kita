import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ChatMessage } from '../../types/user';
import { 
  sendChatMessage, 
  subscribeToChatMessages, 
  markMessageAsRead 
} from '../../services/firebase/chat';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
  // Enhanced time formatter using date-fns
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(messageDate, "HH:mm", { locale: id }); // Today: just show time
    } else if (diffDays === 1) {
      return `Kemarin ${format(messageDate, "HH:mm", { locale: id })}`; // Yesterday
    } else if (diffDays < 7) {
      return format(messageDate, "EEEE, HH:mm", { locale: id }); // Day of week
    } else {
      return format(messageDate, "d MMM, HH:mm", { locale: id }); // Date
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
        <div className="text-center">
          <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent border-indigo-500 animate-spin mb-3"></div>
          <div className="text-indigo-400 text-sm">Memuat pesan...</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/20 shadow-lg">
      {/* Header - Simplified modern design */}
      <div className="p-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-slate-700/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Chat</h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
              <span>{messages.length} {messages.length === 1 ? 'pesan' : 'pesan'} · Online</span>
            </p>
          </div>
          <button className="text-slate-400 hover:text-slate-200 transition-colors" title="Pengaturan chat">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>      {/* Error Message - Simplified modern styling */}
      {error && (
        <div className="mx-3 my-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2 animate-fade-in text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-red-200 flex-grow">{error}</span>
          <button 
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-500/10"
            aria-label="Dismiss error"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}{/* Messages Container - Simplified modern design */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >{messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6 bg-slate-800/40 rounded-2xl border border-slate-700/30 shadow-lg max-w-md">
              <div className="mb-4 relative">
                <div className="h-16 w-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-medium text-white">Belum ada percakapan</h3>
              <p className="mt-3 text-sm text-slate-300 max-w-xs mx-auto leading-relaxed">
                Kirim pesan pertama untuk memulai percakapan dengan anggota rumah Anda.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Date separators and message grouping logic could be added here */}            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === currentUser?.uid;
              // Determine if we should show the avatar (only show for first message in a sequence)
              const showAvatar = index === 0 || 
                messages[index-1].senderId !== message.senderId || 
                new Date(message.timestamp).getTime() - new Date(messages[index-1].timestamp).getTime() > 5 * 60 * 1000;
              
              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} transition-opacity duration-200 opacity-100`}
                >
                  {/* Avatar for other users - Only show if it's first in sequence */}
                  {!isOwnMessage && (
                    <div className={`flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'} h-6 w-6`}>
                      {showAvatar && (
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center shadow-md`}>
                          <span className="text-xs font-medium text-white">
                            {getUserInitials(message.senderId)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  <div
                    className={`px-3 py-2 rounded-2xl max-w-[80%] shadow-sm ${
                      isOwnMessage
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-700 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm leading-relaxed break-words">{message.text}</p>
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className={`text-[10px] ${isOwnMessage ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {formatTime(message.timestamp)}
                      </span>
                      {isOwnMessage && (
                        <span className="flex items-center">
                          {message.read ? (
                            <svg className="w-3 h-3 text-indigo-200" viewBox="0 0 24 24" fill="none">
                              <path d="M4.5 12.75L10.5 18.75L19.5 5.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-indigo-200/70" viewBox="0 0 24 24" fill="none">
                              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Avatar for self - Only show if it's first in sequence */}
                  {isOwnMessage && (
                    <div className={`flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'} h-6 w-6`}>
                      {showAvatar && (
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(message.senderId)} flex items-center justify-center shadow-md`}>
                          <span className="text-xs font-medium text-white">
                            {getUserInitials(message.senderId)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>      {/* Message Input - Modernized */}
      <div className="p-3 border-t border-slate-700/30 bg-slate-800/80 backdrop-blur-sm">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-700/50 rounded-full px-3 py-1 border border-slate-600/30">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z" clipRule="evenodd" />
            </svg>
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ketik pesan..."
            className="flex-1 bg-transparent text-white border-0 focus:ring-0 placeholder-slate-400 text-sm py-2"
            disabled={sending}
          />
          
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className={`rounded-full p-2 flex items-center justify-center transition-colors ${
              sending || !newMessage.trim() 
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
            aria-label="Send message"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
