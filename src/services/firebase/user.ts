import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { firestore } from "./config";
import { User } from "firebase/auth";

// Tipe data untuk User Profile
interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  homes: string[];
  createdAt: Date;
  lastLogin: Date;
}

// Membuat atau memperbarui profil pengguna setelah login/register
export const createOrUpdateUserProfile = async (user: User) => {
  try {
    const userRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userRef);
    
    const now = new Date();
    
    if (!userDoc.exists()) {
      // Buat profil baru jika belum ada
      const userData: UserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        homes: [],
        createdAt: now,
        lastLogin: now,
      };
      await setDoc(userRef, userData);
      return { profile: userData, error: null };
    } else {
      // Update lastLogin jika profil sudah ada
      await updateDoc(userRef, {
        lastLogin: now,
        // Update beberapa field jika berubah dari provider auth
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      
      const updatedUserDoc = await getDoc(userRef);
      return { profile: updatedUserDoc.data() as UserProfile, error: null };
    }
  } catch (error: any) {
    return { profile: null, error: error.message };
  }
};

// Mendapatkan profil pengguna berdasarkan ID
export const getUserProfile = async (userId: string) => {
  try {
    const userRef = doc(firestore, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return { profile: null, error: "Profil pengguna tidak ditemukan" };
    }
    
    return { profile: userDoc.data() as UserProfile, error: null };
  } catch (error: any) {
    return { profile: null, error: error.message };
  }
};

// Memperbarui profil pengguna
export const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>) => {
  try {
    const userRef = doc(firestore, "users", userId);
    await updateDoc(userRef, profileData);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get all member profiles for a specific home
export const getHomeMemberProfiles = async (homeId: string) => {
  try {
    // First get the home to get member IDs
    const homeRef = doc(firestore, "homes", homeId);
    const homeDoc = await getDoc(homeRef);
    
    if (!homeDoc.exists()) {
      return { members: [], error: "Home not found" };
    }
    
    const homeData = homeDoc.data();
    const memberIds = homeData.members || [];
    
    // Get each member's profile
    const memberProfiles: UserProfile[] = [];
    for (const userId of memberIds) {
      const { profile, error } = await getUserProfile(userId);
      if (profile && !error) {
        memberProfiles.push(profile);
      }
    }
    
    return { members: memberProfiles, error: null };
  } catch (error: any) {
    console.error("Error getting home member profiles:", error);
    return { members: [], error: error.message };
  }
};
