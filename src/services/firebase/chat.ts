import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  limit 
} from "firebase/firestore";
import { firestore } from "./config";
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from "../../types/user";

// Mengirim pesan chat
export const sendChatMessage = async (
  homeId: string, 
  senderId: string, 
  text: string,
  replyTo?: {
    id: string;
    text: string;
    senderId: string;
  }
) => {
  try {
    // Create base message data without optional fields
    const messageData: ChatMessage = {
      id: uuidv4(),
      homeId,
      text,
      senderId,
      timestamp: new Date(),
      read: false,
      emoji: []
    };

    // Add replyTo field only if it's provided and not undefined
    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    // Convert to Firestore-compatible object
    const firestoreData = {
      ...messageData,
      timestamp: Timestamp.fromDate(messageData.timestamp),
    };

    const messageRef = doc(firestore, "messages", messageData.id);
    await setDoc(messageRef, firestoreData);

    return { message: messageData, error: null };
  } catch (error: any) {
    return { message: null, error: error.message };
  }
};

// Mengambil pesan chat dengan pagination
export const getChatMessages = async (homeId: string, limitCount: number = 50) => {
  try {
    const messagesQuery = query(
      collection(firestore, "messages"),
      where("homeId", "==", homeId),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const snapshot = await getDocs(messagesQuery);
    const messages: ChatMessage[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        ...data,
        timestamp: data.timestamp.toDate(),
        readAt: data.readAt ? data.readAt.toDate() : undefined,
      } as ChatMessage);
    });

    // Reverse to show oldest first
    return { messages: messages.reverse(), error: null };
  } catch (error: any) {
    return { messages: [], error: error.message };
  }
};

// Subscribe to real-time chat messages
export const subscribeToChatMessages = (
  homeId: string, 
  callback: (messages: ChatMessage[]) => void,
  limitCount: number = 50
) => {
  const messagesQuery = query(
    collection(firestore, "messages"),
    where("homeId", "==", homeId),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        ...data,
        timestamp: data.timestamp.toDate(),
        readAt: data.readAt ? data.readAt.toDate() : undefined,
      } as ChatMessage);
    });

    // Reverse to show oldest first
    callback(messages.reverse());
  });
};

// Menandai pesan sebagai sudah dibaca
export const markMessageAsRead = async (messageId: string, userId: string) => {
  try {
    const messageRef = doc(firestore, "messages", messageId);
    await setDoc(messageRef, {
      read: true,
      readAt: Timestamp.fromDate(new Date()),
      readBy: userId
    }, { merge: true });

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Add emoji reaction to message
export const addEmojiReaction = async (messageId: string, userId: string, emojiType: string) => {
  try {
    // First get the current emoji reactions
    const messageRef = doc(firestore, "messages", messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      return { error: "Message not found" };
    }
    
    const messageData = messageDoc.data();
    let emoji = messageData.emoji || [];
      // Check if this emoji type already exists
    const existingEmojiIndex = emoji.findIndex((e: { type: string, users: string[] }) => e.type === emojiType);
    
    if (existingEmojiIndex >= 0) {
      // Add the user if not already included
      if (!emoji[existingEmojiIndex].users.includes(userId)) {
        emoji[existingEmojiIndex].users.push(userId);
      }
    } else {
      // Add new emoji type
      emoji.push({
        type: emojiType,
        users: [userId]
      });
    }
    
    // Update the message
    await setDoc(messageRef, {
      emoji: emoji
    }, { merge: true });
    
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Remove emoji reaction from message
export const removeEmojiReaction = async (messageId: string, userId: string, emojiType: string) => {
  try {
    // First get the current emoji reactions
    const messageRef = doc(firestore, "messages", messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      return { error: "Message not found" };
    }
    
    const messageData = messageDoc.data();
    let emoji = messageData.emoji || [];
      // Find this emoji type
    const existingEmojiIndex = emoji.findIndex((e: { type: string, users: string[] }) => e.type === emojiType);
    
    if (existingEmojiIndex >= 0) {
      // Remove the user
      emoji[existingEmojiIndex].users = emoji[existingEmojiIndex].users.filter((u: string) => u !== userId);
      
      // If no users left, remove the emoji type
      if (emoji[existingEmojiIndex].users.length === 0) {
        emoji = emoji.filter((e: { type: string, users: string[] }) => e.type !== emojiType);
      }
    }
    
    // Update the message
    await setDoc(messageRef, {
      emoji: emoji
    }, { merge: true });
    
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Menghapus pesan (hanya untuk pengirim)
export const deleteChatMessage = async (messageId: string) => {
  try {
    const messageRef = doc(firestore, "messages", messageId);
    await setDoc(messageRef, {
      deleted: true,
      deletedAt: Timestamp.fromDate(new Date())
    }, { merge: true });

    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};
