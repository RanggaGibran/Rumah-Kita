import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { firestore } from "./config";
import { v4 as uuidv4 } from 'uuid';
import { Note } from "../../types/user";

// Membuat note baru
export const createNote = async (homeId: string, userId: string, title: string, content: string = "") => {
  try {
    const noteData: Note = {
      id: uuidv4(),
      homeId,
      title,
      content,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const noteRef = doc(firestore, "notes", noteData.id);
    await setDoc(noteRef, {
      ...noteData,
      createdAt: Timestamp.fromDate(noteData.createdAt),
      updatedAt: Timestamp.fromDate(noteData.updatedAt),
    });

    return { note: noteData, error: null };
  } catch (error: any) {
    return { note: null, error: error.message };
  }
};

// Mendapatkan semua notes dari sebuah rumah
export const getHomeNotes = async (homeId: string) => {
  try {
    const notesRef = collection(firestore, "notes");
    const q = query(
      notesRef, 
      where("homeId", "==", homeId),
      orderBy("updatedAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    const notes: Note[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notes.push({
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Note);
    });
    
    return { notes, error: null };
  } catch (error: any) {
    return { notes: [], error: error.message };
  }
};

// Update note (real-time collaborative editing)
export const updateNote = async (noteId: string, updates: Partial<Note>) => {
  try {
    const noteRef = doc(firestore, "notes", noteId);
    const updateData = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    };
    
    await updateDoc(noteRef, updateData);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Hapus note
export const deleteNote = async (noteId: string) => {
  try {
    const noteRef = doc(firestore, "notes", noteId);
    await deleteDoc(noteRef);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Real-time listener untuk notes
export const subscribeToHomeNotes = (homeId: string, callback: (notes: Note[]) => void) => {
  const notesRef = collection(firestore, "notes");
  const q = query(
    notesRef, 
    where("homeId", "==", homeId),
    orderBy("updatedAt", "desc")
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const notes: Note[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notes.push({
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Note);
    });
    callback(notes);
  });
};

// Real-time listener untuk single note (untuk collaborative editing)
export const subscribeToNote = (noteId: string, callback: (note: Note | null) => void) => {
  const noteRef = doc(firestore, "notes", noteId);
  
  return onSnapshot(noteRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const note: Note = {
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Note;
      callback(note);
    } else {
      callback(null);
    }
  });
};
