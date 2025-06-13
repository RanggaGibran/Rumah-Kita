import { database } from '../firebase/config';
import { ref, push, onValue, set, remove, off, get, DataSnapshot, Database, update } from 'firebase/database';

export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end' | 'room-join' | 'room-leave';

export interface SignalingMessage {
  type: SignalingMessageType;
  payload?: any;
  from: string;
  to: string;
  timestamp: number;
  roomId?: string;
}

export interface Room {
  id: string;
  name?: string;
  createdBy: string;
  createdAt: number;
  active: boolean;
  participants: Record<string, {
    userId: string;
    displayName: string;
    joinedAt: number;
    hasVideo: boolean;
    hasAudio: boolean;
  }>;
}

export class SignalingService {
  private homeId: string;
  private userId: string;
  private listeners: Map<string, (snapshot: DataSnapshot) => void> = new Map();
  private db: Database;
  private currentRoomId: string | null = null;
  
  constructor(homeId: string, userId: string) {
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
  }  // Room-related methods
  async createRoom(roomName?: string, isVideoEnabled = true, isAudioEnabled = true): Promise<string> {
    try {
      const roomsRef = ref(this.db, `signaling/${this.homeId}/rooms`);
      const newRoomRef = push(roomsRef);
      const roomId = newRoomRef.key as string;
      
      const room: Room = {
        id: roomId,
        name: roomName || `Room ${new Date().toLocaleTimeString()}`,
        createdBy: this.userId,
        createdAt: Date.now(),
        active: true,
        participants: {
          [this.userId]: {
            userId: this.userId,
            displayName: '', // Will be set by joinRoom
            joinedAt: Date.now(),
            hasVideo: isVideoEnabled,
            hasAudio: isAudioEnabled
          }
        }
      };
      
      await set(newRoomRef, room);
      this.currentRoomId = roomId;
      console.log(`SignalingService: Created room ${roomId}`);
      return roomId;
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  }

  async joinRoom(roomId: string, displayName: string, isVideoEnabled = true, isAudioEnabled = true): Promise<boolean> {
    try {
      // Check if room exists
      const roomRef = ref(this.db, `signaling/${this.homeId}/rooms/${roomId}`);
      const snapshot = await get(roomRef);
      
      if (!snapshot.exists()) {
        console.error(`SignalingService: Room ${roomId} does not exist`);
        return false;
      }
      
      const room = snapshot.val() as Room;
      if (!room.active) {
        console.error(`SignalingService: Room ${roomId} is not active`);
        return false;
      }
      
      // Add user to room participants
      const participantRef = ref(this.db, `signaling/${this.homeId}/rooms/${roomId}/participants/${this.userId}`);
      await set(participantRef, {
        userId: this.userId,
        displayName: displayName,
        joinedAt: Date.now(),
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled
      });
      
      // Send join message to all participants
      await this.sendMessage({
        type: 'room-join',
        from: this.userId,
        to: 'all',
        roomId: roomId,
        payload: {
          displayName: displayName,
          hasVideo: isVideoEnabled,
          hasAudio: isAudioEnabled
        }
      });
      
      this.currentRoomId = roomId;
      console.log(`SignalingService: Joined room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  async leaveRoom(roomId?: string): Promise<void> {
    try {
      const actualRoomId = roomId || this.currentRoomId;
      if (!actualRoomId) {
        console.warn('SignalingService: No room to leave');
        return;
      }
      
      // Remove user from room participants
      const participantRef = ref(this.db, `signaling/${this.homeId}/rooms/${actualRoomId}/participants/${this.userId}`);
      await remove(participantRef);
      
      // Send leave message to all participants
      await this.sendMessage({
        type: 'room-leave',
        from: this.userId,
        to: 'all',
        roomId: actualRoomId
      });
      
      // Check if room is now empty and update active status if needed
      const roomRef = ref(this.db, `signaling/${this.homeId}/rooms/${actualRoomId}`);
      const snapshot = await get(roomRef);
      
      if (snapshot.exists()) {
        const room = snapshot.val() as Room;
        const participants = room.participants || {};
        
        if (Object.keys(participants).length === 0) {
          // Room is empty, mark as inactive
          await set(ref(this.db, `signaling/${this.homeId}/rooms/${actualRoomId}/active`), false);
          console.log(`SignalingService: Room ${actualRoomId} marked as inactive (empty)`);
        }
      }
      
      this.currentRoomId = null;
      console.log(`SignalingService: Left room ${actualRoomId}`);
    } catch (error) {
      console.error('Failed to leave room:', error);
      throw error;
    }
  }
  
  async getActiveRooms(): Promise<Room[]> {
    try {
      const roomsRef = ref(this.db, `signaling/${this.homeId}/rooms`);
      const snapshot = await get(roomsRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const rooms = snapshot.val();
      return Object.values(rooms)
        .filter((room: any) => room.active)
        .sort((a: any, b: any) => b.createdAt - a.createdAt) as Room[];
    } catch (error) {
      console.error('Failed to get active rooms:', error);
      throw error;
    }
  }
  
  onRoomUpdated(roomId: string, callback: (room: Room | null) => void) {
    const roomRef = ref(this.db, `signaling/${this.homeId}/rooms/${roomId}`);
    
    const listener = (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as Room);
      } else {
        callback(null);
      }
    };
    
    onValue(roomRef, listener);
    this.listeners.set(`room:${roomId}`, listener);
    
    return () => {
      off(roomRef, 'value', listener);
      this.listeners.delete(`room:${roomId}`);
    };
  }
  
  async updateParticipantMedia(isVideoEnabled: boolean, isAudioEnabled: boolean): Promise<void> {
    if (!this.currentRoomId) {
      console.warn('SignalingService: Not in a room, cannot update media status');
      return;
    }
    
    try {      const participantRef = ref(
        this.db, 
        `signaling/${this.homeId}/rooms/${this.currentRoomId}/participants/${this.userId}`
      );
      
      await update(participantRef, {
        hasVideo: isVideoEnabled,
        hasAudio: isAudioEnabled
      });
      
      console.log(`SignalingService: Updated media status (video: ${isVideoEnabled}, audio: ${isAudioEnabled})`);
    } catch (error) {
      console.error('Failed to update participant media status:', error);
      throw error;
    }
  }
  // Clean up signaling data
  async cleanup() {
    console.log("SignalingService: Starting cleanup");
    try {
      // Leave current room if any
      if (this.currentRoomId) {
        try {
          console.log(`SignalingService: Leaving room ${this.currentRoomId} during cleanup`);
          await this.leaveRoom();
          this.currentRoomId = null;
        } catch (leaveError) {
          console.warn('SignalingService: Error leaving room during cleanup:', leaveError);
        }
      }
      
      // Remove user status
      try {
        const statusRef = ref(this.db, `signaling/${this.homeId}/users/${this.userId}`);
        await remove(statusRef);
        console.log("SignalingService: Removed user status");
      } catch (statusError) {
        console.warn('SignalingService: Error removing user status:', statusError);
      }
      
      // Remove all listeners with better error handling
      console.log(`SignalingService: Removing ${this.listeners.size} listeners`);
      this.listeners.forEach((listener, key) => {
        try {
          if (key === 'messages') {
            const messagesRef = ref(this.db, `signaling/${this.homeId}/messages`);
            off(messagesRef, 'value', listener);
            console.log("SignalingService: Removed messages listener");
          } else if (key === 'users') {
            const usersRef = ref(this.db, `signaling/${this.homeId}/users`);
            off(usersRef, 'value', listener);
            console.log("SignalingService: Removed users listener");
          } else if (key.startsWith('room:')) {
            const roomId = key.substring(5);
            const roomRef = ref(this.db, `signaling/${this.homeId}/rooms/${roomId}`);
            off(roomRef, 'value', listener);
            console.log(`SignalingService: Removed listener for room ${roomId}`);
          } else {
            console.warn(`SignalingService: Unknown listener key during cleanup: ${key}`);
          }
        } catch (listenerError) {
          console.warn(`SignalingService: Error removing listener ${key}:`, listenerError);
        }
      });
      this.listeners.clear();
      
      console.log("SignalingService: Cleanup completed successfully");
    } catch (error) {
      console.error('SignalingService: Failed to cleanup signaling:', error);
      throw error;
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
  
  // Get current room ID
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }
}
