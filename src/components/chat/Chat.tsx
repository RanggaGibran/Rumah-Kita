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

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    
    // If today, show time only
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Kemarin ' + messageDate.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // If this week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (messageDate > weekAgo) {
      return messageDate.toLocaleDateString('id-ID', { 
        weekday: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Older than a week
    return messageDate.toLocaleDateString('id-ID', { 
      day: 'numeric',
      month: 'short',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="loading-spinner"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat pesan...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full card-modern overflow-hidden shadow-hard">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/30 bg-slate-900/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Chat</h2>
            <p className="text-sm text-slate-400 mt-1">
              {messages.length} {messages.length === 1 ? 'pesan' : 'pesan'}
            </p>
          </div>
          <div className="bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50 flex items-center">
            <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
            <span className="text-sm text-slate-300">Online</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in" role="alert">
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

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 glassmorphism bg-slate-800/20"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center animate-fade-in">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <svg className="absolute w-20 h-20 text-blue-900/20 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.476L3 21l2.524-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
                <svg className="absolute w-16 h-16 text-indigo-500/20 top-2 left-2 animate-float" style={{animationDelay: '1s'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          messages.map((message) => {
            const isOwnMessage = message.senderId === currentUser?.uid;
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-soft transition-all duration-200 ${
                    isOwnMessage
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-medium hover:-translate-y-0.5'
                      : 'glassmorphism bg-slate-800/40 text-slate-200 hover:shadow-medium hover:-translate-y-0.5'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <div className={`mt-1 text-xs flex items-center justify-between ${
                    isOwnMessage ? 'text-indigo-200' : 'text-slate-400'
                  }`}>
                    <span>{formatTime(message.timestamp)}</span>
                    {isOwnMessage && (
                      <span className="ml-2">{message.read ? "✓✓" : "✓"}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
            className="flex-1 input-modern shadow-soft"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 btn-primary text-white rounded-lg flex items-center justify-center shadow-soft hover:shadow-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:transform-none"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
