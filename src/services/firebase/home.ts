import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  arrayUnion 
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
