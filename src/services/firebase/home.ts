import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  arrayUnion,
  arrayRemove,
  deleteDoc,
  writeBatch 
} from "firebase/firestore";
import { firestore } from "./config";
import { v4 as uuidv4 } from 'uuid';

// Tipe data untuk Home
interface Home {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  inviteCode: string;
  createdAt: Date;
}

// Membuat rumah baru
export const createHome = async (userId: string, homeName: string = "Rumah Kita") => {
  try {
    // Generate invite code (format: XXX-XXX-XXX)
    const generateCode = () => {
      const segments = [];
      for (let i = 0; i < 3; i++) {
        segments.push(uuidv4().substring(0, 3).toUpperCase());
      }
      return segments.join("-");
    };

    const inviteCode = generateCode();
    
    const homeData: Home = {
      id: uuidv4(),
      name: homeName,
      createdBy: userId,
      members: [userId],
      inviteCode,
      createdAt: new Date(),
    };

    // Simpan data rumah di Firestore
    const homeRef = doc(firestore, "homes", homeData.id);
    await setDoc(homeRef, homeData);

    // Tambahkan referensi ke user
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, {
      homes: arrayUnion(homeData.id)
    });

    return { home: homeData, error: null };
  } catch (error: any) {
    return { home: null, error: error.message };
  }
};

// Mencari rumah dengan kode undangan
export const findHomeByInviteCode = async (inviteCode: string) => {
  try {
    const homesRef = collection(firestore, "homes");
    const q = query(homesRef, where("inviteCode", "==", inviteCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { home: null, error: "Rumah tidak ditemukan" };
    }

    const homeData = querySnapshot.docs[0].data() as Home;
    return { home: homeData, error: null };
  } catch (error: any) {
    return { home: null, error: error.message };
  }
};

// Bergabung ke rumah dengan kode undangan
export const joinHomeByInviteCode = async (userId: string, inviteCode: string) => {
  try {
    const { home, error } = await findHomeByInviteCode(inviteCode);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan" };
    }

    // Cek apakah user sudah menjadi anggota
    if (home.members.includes(userId)) {
      return { success: true, home, error: null };
    }

    // Update anggota rumah
    const homeRef = doc(firestore, "homes", home.id);
    await updateDoc(homeRef, {
      members: arrayUnion(userId)
    });

    // Update daftar rumah pada user
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, {
      homes: arrayUnion(home.id)
    });

    return { success: true, home, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Mendapatkan detail rumah berdasarkan ID
export const getHomeById = async (homeId: string) => {
  try {
    const homeRef = doc(firestore, "homes", homeId);
    const homeDoc = await getDoc(homeRef);
    
    if (!homeDoc.exists()) {
      return { home: null, error: "Rumah tidak ditemukan" };
    }
    
    const homeData = homeDoc.data() as Home;
    return { home: homeData, error: null };
  } catch (error: any) {
    return { home: null, error: error.message };
  }
};

// Mendapatkan semua rumah yang dimiliki user
export const getUserHomes = async (userId: string) => {
  try {
    const homesRef = collection(firestore, "homes");
    const q = query(homesRef, where("members", "array-contains", userId));
    const querySnapshot = await getDocs(q);
    
    const homes: Home[] = [];
    querySnapshot.forEach((doc) => {
      homes.push(doc.data() as Home);
    });
    
    return { homes, error: null };
  } catch (error: any) {
    return { homes: [], error: error.message };
  }
};

// Keluar dari rumah (leave home)
export const leaveHome = async (userId: string, homeId: string) => {
  try {
    // Mendapatkan data rumah terlebih dahulu
    const { home, error } = await getHomeById(homeId);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan" };
    }

    // Cek apakah user adalah anggota
    if (!home.members.includes(userId)) {
      return { success: false, error: "Anda bukan anggota rumah ini" };
    }

    // Cek apakah user adalah creator dan masih ada anggota lain
    if (home.createdBy === userId && home.members.length > 1) {
      return { 
        success: false, 
        error: "Sebagai pembuat rumah, Anda tidak dapat keluar jika masih ada anggota lain. Hapus rumah atau transfer kepemilikan terlebih dahulu." 
      };
    }

    // Jika user adalah creator dan satu-satunya anggota, hapus rumah
    if (home.createdBy === userId && home.members.length === 1) {
      return await deleteHome(userId, homeId);
    }

    // Remove user dari members rumah
    const homeRef = doc(firestore, "homes", homeId);
    await updateDoc(homeRef, {
      members: arrayRemove(userId)
    });

    // Remove rumah dari daftar homes user
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, {
      homes: arrayRemove(homeId)
    });

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Hapus rumah (hanya creator yang bisa menghapus)
export const deleteHome = async (userId: string, homeId: string) => {
  try {
    // Mendapatkan data rumah terlebih dahulu
    const { home, error } = await getHomeById(homeId);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan" };
    }

    // Cek apakah user adalah creator
    if (home.createdBy !== userId) {
      return { success: false, error: "Hanya pembuat rumah yang dapat menghapus rumah" };
    }

    // Create a batch for atomic operations
    const batch = writeBatch(firestore);

    // Remove rumah dari semua anggota
    for (const memberId of home.members) {
      const userRef = doc(firestore, "users", memberId);
      batch.update(userRef, {
        homes: arrayRemove(homeId)
      });
    }

    // Get and delete all notes in this home
    const notesQuery = query(collection(firestore, "notes"), where("homeId", "==", homeId));
    const notesSnapshot = await getDocs(notesQuery);
    notesSnapshot.forEach((noteDoc) => {
      batch.delete(noteDoc.ref);
    });

    // Get and delete all wishlist items in this home
    const wishlistQuery = query(collection(firestore, "wishlist"), where("homeId", "==", homeId));
    const wishlistSnapshot = await getDocs(wishlistQuery);
    wishlistSnapshot.forEach((wishlistDoc) => {
      batch.delete(wishlistDoc.ref);
    });

    // Get and delete all chat messages in this home
    const messagesQuery = query(collection(firestore, "messages"), where("homeId", "==", homeId));
    const messagesSnapshot = await getDocs(messagesQuery);
    messagesSnapshot.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });

    // Delete the home document
    const homeRef = doc(firestore, "homes", homeId);
    batch.delete(homeRef);

    // Commit all operations
    await batch.commit();

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Generate kode undangan baru
export const regenerateInviteCode = async (userId: string, homeId: string) => {
  try {
    // Mendapatkan data rumah terlebih dahulu
    const { home, error } = await getHomeById(homeId);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan", inviteCode: null };
    }

    // Cek apakah user adalah creator
    if (home.createdBy !== userId) {
      return { success: false, error: "Hanya pembuat rumah yang dapat mengubah kode undangan", inviteCode: null };
    }

    // Generate kode undangan baru
    const generateCode = () => {
      const segments = [];
      for (let i = 0; i < 3; i++) {
        segments.push(uuidv4().substring(0, 3).toUpperCase());
      }
      return segments.join("-");
    };

    const newInviteCode = generateCode();

    // Update kode undangan
    const homeRef = doc(firestore, "homes", homeId);
    await updateDoc(homeRef, {
      inviteCode: newInviteCode
    });

    return { success: true, error: null, inviteCode: newInviteCode };
  } catch (error: any) {
    return { success: false, error: error.message, inviteCode: null };
  }
};

// Transfer kepemilikan rumah
export const transferHomeOwnership = async (currentOwnerId: string, newOwnerId: string, homeId: string) => {
  try {
    // Mendapatkan data rumah terlebih dahulu
    const { home, error } = await getHomeById(homeId);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan" };
    }

    // Cek apakah user adalah creator saat ini
    if (home.createdBy !== currentOwnerId) {
      return { success: false, error: "Hanya pembuat rumah yang dapat transfer kepemilikan" };
    }

    // Cek apakah new owner adalah anggota rumah
    if (!home.members.includes(newOwnerId)) {
      return { success: false, error: "Pemilik baru harus menjadi anggota rumah" };
    }

    // Update pembuat rumah
    const homeRef = doc(firestore, "homes", homeId);
    await updateDoc(homeRef, {
      createdBy: newOwnerId
    });

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get home statistics
export const getHomeStatistics = async (homeId: string) => {
  try {
    // Get notes count
    const notesQuery = query(collection(firestore, "notes"), where("homeId", "==", homeId));
    const notesSnapshot = await getDocs(notesQuery);
    const notesCount = notesSnapshot.size;

    // Get wishlist count
    const wishlistQuery = query(collection(firestore, "wishlist"), where("homeId", "==", homeId));
    const wishlistSnapshot = await getDocs(wishlistQuery);
    const wishlistCount = wishlistSnapshot.size;

    // Get completed wishlist count
    const completedWishlistCount = wishlistSnapshot.docs.filter(doc => 
      doc.data().completed === true
    ).length;

    // Get messages count
    const messagesQuery = query(collection(firestore, "messages"), where("homeId", "==", homeId));
    const messagesSnapshot = await getDocs(messagesQuery);
    const messagesCount = messagesSnapshot.size;

    return {
      success: true,
      statistics: {
        notesCount,
        wishlistCount,
        completedWishlistCount,
        messagesCount
      },
      error: null
    };
  } catch (error: any) {
    return {
      success: false,
      statistics: null,
      error: error.message
    };
  }
};

// Remove member from home (owner only)
export const removeMemberFromHome = async (ownerId: string, memberId: string, homeId: string) => {
  try {
    // Mendapatkan data rumah terlebih dahulu
    const { home, error } = await getHomeById(homeId);
    if (error || !home) {
      return { success: false, error: error || "Rumah tidak ditemukan" };
    }

    // Cek apakah user adalah creator
    if (home.createdBy !== ownerId) {
      return { success: false, error: "Hanya pembuat rumah yang dapat mengeluarkan anggota" };
    }

    // Cek apakah yang akan dikeluarkan bukan owner sendiri
    if (ownerId === memberId) {
      return { success: false, error: "Tidak dapat mengeluarkan diri sendiri" };
    }

    // Cek apakah member adalah anggota rumah
    if (!home.members.includes(memberId)) {
      return { success: false, error: "User bukan anggota rumah ini" };
    }

    // Remove user dari members rumah
    const homeRef = doc(firestore, "homes", homeId);
    await updateDoc(homeRef, {
      members: arrayRemove(memberId)
    });

    // Remove rumah dari daftar homes user
    const userRef = doc(firestore, "users", memberId);
    await updateDoc(userRef, {
      homes: arrayRemove(homeId)
    });

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
