import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
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
  text: string
) => {
  try {
    const messageData: ChatMessage = {
      id: uuidv4(),
      homeId,
      text,
      senderId,
      timestamp: new Date(),
      read: false,
    };

    const messageRef = doc(firestore, "messages", messageData.id);
    await setDoc(messageRef, {
      ...messageData,
      timestamp: Timestamp.fromDate(messageData.timestamp),
    });

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
