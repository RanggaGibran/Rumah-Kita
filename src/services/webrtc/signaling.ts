import { database } from '../firebase/config';
import { ref, push, onValue, set, remove, off, DataSnapshot, Database } from 'firebase/database';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end';
  payload?: any;
  from: string;
  to: string;
  timestamp: number;
}

export class SignalingService {
  private homeId: string;
  private userId: string;
  private listeners: Map<string, (snapshot: DataSnapshot) => void> = new Map();
  private db: Database;  constructor(homeId: string, userId: string) {
    this.homeId = homeId;
    this.userId = userId;
    
    if (!database) {
      throw new Error('Realtime Database not initialized');
    }
    this.db = database;
  }
  // Send signaling message
  async sendMessage(message: Omit<SignalingMessage, 'timestamp'>) {
    try {
      const messagesRef = ref(this.db, `signaling/${this.homeId}/messages`);
      await push(messagesRef, {
        ...message,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to send signaling message:', error);
      throw error;
    }
  }
  // Listen for signaling messages
  onMessage(callback: (message: SignalingMessage) => void) {
    const messagesRef = ref(this.db, `signaling/${this.homeId}/messages`);
    
    const listener = (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        const messages = snapshot.val();
        Object.values(messages).forEach((message: any) => {
          // Only process messages intended for this user
          if (message.to === this.userId || message.to === 'all') {
            callback(message as SignalingMessage);
          }
        });
      }
    };

    onValue(messagesRef, listener);
    this.listeners.set('messages', listener);

    return () => {
      off(messagesRef, 'value', listener);
      this.listeners.delete('messages');
    };
  }

  // Set user status (available, busy, in-call)
  async setUserStatus(status: 'available' | 'busy' | 'in-call') {
    try {
      const statusRef = ref(this.db, `signaling/${this.homeId}/users/${this.userId}/status`);
      await set(statusRef, {
        status,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error('Failed to set user status:', error);
      throw error;
    }
  }
  // Listen for user status changes
  onUserStatusChange(callback: (userId: string, status: any) => void) {
    const usersRef = ref(this.db, `signaling/${this.homeId}/users`);
    
    const listener = (snapshot: any) => {
      if (snapshot.exists()) {
        const users = snapshot.val();
        Object.entries(users).forEach(([userId, userData]: [string, any]) => {
          if (userId !== this.userId) {
            callback(userId, userData.status);
          }
        });
      }
    };

    onValue(usersRef, listener);
    this.listeners.set('users', listener);

    return () => {
      off(usersRef, 'value', listener);
      this.listeners.delete('users');
    };
  }
  // Clean up signaling data
  async cleanup() {
    try {
      // Remove user status
      const statusRef = ref(this.db, `signaling/${this.homeId}/users/${this.userId}`);
      await remove(statusRef);      // Remove all listeners
      this.listeners.forEach((listener, key) => {
        if (key === 'messages') {
          const messagesRef = ref(this.db, `signaling/${this.homeId}/messages`);
          off(messagesRef, 'value', listener);
        } else if (key === 'users') {
          const usersRef = ref(this.db, `signaling/${this.homeId}/users`);
          off(usersRef, 'value', listener);
        }
      });
      this.listeners.clear();
    } catch (error) {
      console.error('Failed to cleanup signaling:', error);
    }
  }
  // Clear old messages (keep only last 10 minutes)
  async clearOldMessages() {
    try {
      const messagesRef = ref(this.db, `signaling/${this.homeId}/messages`);
      const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago

      onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
          const messages = snapshot.val();
          Object.entries(messages).forEach(([key, message]: [string, any]) => {
            if (message.timestamp < cutoffTime) {
              const messageRef = ref(this.db, `signaling/${this.homeId}/messages/${key}`);
              remove(messageRef);
            }
          });
        }
      }, { onlyOnce: true });
    } catch (error) {
      console.error('Failed to clear old messages:', error);
    }
  }
}
