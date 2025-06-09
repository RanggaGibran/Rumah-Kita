import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  deleteField,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { firestore } from "./config";
import { v4 as uuidv4 } from 'uuid';
import { WishlistItem } from "../../types/user";

// Membuat wishlist item baru
export const createWishlistItem = async (
  homeId: string, 
  userId: string, 
  title: string, 
  description?: string, 
  url?: string
) => {
  try {
    const itemData: WishlistItem = {
      id: uuidv4(),
      homeId,
      title,
      description,
      url,
      completed: false,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Prepare data for Firestore, excluding undefined values
    const firestoreData: any = {
      id: itemData.id,
      homeId: itemData.homeId,
      title: itemData.title,
      completed: itemData.completed,
      createdBy: itemData.createdBy,
      createdAt: Timestamp.fromDate(itemData.createdAt),
      updatedAt: Timestamp.fromDate(itemData.updatedAt),
    };

    // Only include optional fields if they have values
    if (description && description.trim()) {
      firestoreData.description = description.trim();
    }
    if (url && url.trim()) {
      firestoreData.url = url.trim();
    }

    const itemRef = doc(firestore, "wishlist", itemData.id);
    await setDoc(itemRef, firestoreData);

    return { item: itemData, error: null };
  } catch (error: any) {
    return { item: null, error: error.message };
  }
};

// Mendapatkan semua wishlist items dari sebuah rumah
export const getHomeWishlist = async (homeId: string) => {
  try {
    const wishlistRef = collection(firestore, "wishlist");
    const q = query(
      wishlistRef, 
      where("homeId", "==", homeId),
      orderBy("completed", "asc"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
      const items: WishlistItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : undefined),
      } as WishlistItem);
    });
    
    return { items, error: null };
  } catch (error: any) {
    return { items: [], error: error.message };
  }
};

// Update wishlist item
export const updateWishlistItem = async (itemId: string, updates: Partial<WishlistItem>) => {
  try {
    const itemRef = doc(firestore, "wishlist", itemId);
    const updateData: any = {
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Process each update field, excluding undefined values
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof WishlistItem];
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    // Jika item di-complete, tambahkan completedAt timestamp
    if (updates.completed === true && !updates.completedAt) {
      updateData.completedAt = Timestamp.fromDate(new Date());
    }

    // Convert Date objects to Timestamps for Firestore
    if (updates.createdAt && updates.createdAt instanceof Date) {
      updateData.createdAt = Timestamp.fromDate(updates.createdAt);
    }
    if (updates.completedAt && updates.completedAt instanceof Date) {
      updateData.completedAt = Timestamp.fromDate(updates.completedAt);
    }    // Jika item di-uncomplete, hapus completedAt dan completedBy dengan deleteField
    if (updates.completed === false) {
      updateData.completedAt = deleteField();
      updateData.completedBy = deleteField();
    }
    
    await updateDoc(itemRef, updateData);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Tandai item sebagai completed
export const completeWishlistItem = async (itemId: string, userId: string) => {
  return updateWishlistItem(itemId, {
    completed: true,
    completedBy: userId,
    completedAt: new Date(),
  });
};

// Tandai item sebagai uncompleted
export const uncompleteWishlistItem = async (itemId: string) => {
  return updateWishlistItem(itemId, {
    completed: false,
    completedBy: undefined,
    completedAt: undefined,
  });
};

// Hapus wishlist item
export const deleteWishlistItem = async (itemId: string) => {
  try {
    const itemRef = doc(firestore, "wishlist", itemId);
    await deleteDoc(itemRef);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Real-time listener untuk wishlist
export const subscribeToHomeWishlist = (homeId: string, callback: (items: WishlistItem[]) => void) => {
  const wishlistRef = collection(firestore, "wishlist");
  const q = query(
    wishlistRef, 
    where("homeId", "==", homeId),
    orderBy("completed", "asc"),
    orderBy("createdAt", "desc")
  );
    return onSnapshot(q, (querySnapshot) => {
    const items: WishlistItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : undefined),
      } as WishlistItem);
    });
    callback(items);
  });
};
