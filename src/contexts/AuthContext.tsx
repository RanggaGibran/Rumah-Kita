import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { observeAuthState, logout as firebaseLogout } from '../services/firebase/auth';
import { createOrUpdateUserProfile } from '../services/firebase/user';
import { UserProfile } from '../types/user';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({ 
  currentUser: null, 
  userProfile: null, 
  loading: true,
  logout: async () => ({ success: false, error: 'Not implemented' })
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuthState(async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Jika user login, ambil atau buat profile
        const { profile } = await createOrUpdateUserProfile(user);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    return await firebaseLogout();
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
