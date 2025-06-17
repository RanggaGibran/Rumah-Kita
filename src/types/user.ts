// User Profile Type
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  homes: string[];
  createdAt: Date;
  lastLogin: Date;
}

// Home Type
export interface Home {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  inviteCode: string;
  createdAt: Date;
}

// Note Type
export interface Note {
  id: string;
  homeId: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Wishlist Item Type
export interface WishlistItem {
  id: string;
  homeId: string;
  title: string;
  description?: string;
  url?: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  rating?: number; // Rating from 1-5 stars
  ratingComment?: string; // Comment for the rating
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Message Type
export interface ChatMessage {
  id: string;
  homeId: string;
  text: string;
  senderId: string;
  timestamp: Date;
  read: boolean;
  readAt?: Date;
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
  };
  emoji?: {
    type: string;
    users: string[];
  }[];
}
