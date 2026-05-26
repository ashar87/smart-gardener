import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, signInWithGoogle, loginWithEmail as fbLoginWithEmail, registerWithEmail as fbRegisterWithEmail } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  registerWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured yet, skip auth listener
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    await signInWithGoogle();
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await fbLoginWithEmail(email, pass);
  };

  const registerWithEmail = async (email: string, pass: string) => {
    await fbRegisterWithEmail(email, pass);
  };

  const logout = async () => {
    if (auth) await signOut(auth);
  };

  const value = {
    currentUser,
    loading,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-6 relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#5A5A40]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#C97C5D]/10 rounded-full blur-3xl" />
          
          <div className="z-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-6 relative animate-pulse">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#5A5A40" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-12 h-12 text-[#5A5A40]"
              >
                <path d="M7 20h10" />
                <path d="M10 20v-5a2 2 0 0 1 4 0v5" />
                <path d="M12 4v16" />
                <path d="M2 11c0 2.67 2 4 6 4a4 4 0 0 0 4-4c0-2.67-2-4-6-4a4 4 0 0 0-4 4Z" />
                <path d="M22 11c0 2.67-2 4-6 4a4 4 0 0 1-4-4c0-2.67 2-4 6-4a4 4 0 0 1 4 4Z" />
              </svg>
              <div className="absolute inset-0 rounded-[2rem] border-2 border-[#5A5A40]/20 animate-ping opacity-20" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-[#5A5A40] mb-2 tracking-tight">
              PlantPatrol
            </h1>
            <p className="text-[#333333]/50 font-serif italic text-sm animate-pulse">
              Tending to your garden...
            </p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
