import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdToken
} from 'firebase/auth';
import { auth } from '../firebase/config';

// AuthContext 생성
const AuthContext = createContext();

// AuthContext 사용을 위한 커스텀 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider 컴포넌트
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  // 회원가입
  const signup = async (email, password) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  // 로그인
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await signOut(auth);
      setUserToken(null);
    } catch (error) {
      throw error;
    }
  };

  // ID 토큰 가져오기
  const getToken = async () => {
    if (currentUser) {
      try {
        // 강제 토큰 새로고침
        const token = await getIdToken(currentUser, true);
        setUserToken(token);
        return token;
      } catch (error) {
        console.error('Failed to get ID token:', error);
        // 재시도
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryToken = await getIdToken(currentUser, false);
          setUserToken(retryToken);
          return retryToken;
        } catch (retryError) {
          console.error('Failed to get ID token on retry:', retryError);
          return null;
        }
      }
    }
    return null;
  };

  // 인증된 API 요청을 위한 헤더 생성
  const getAuthHeaders = async () => {
    const token = await getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // 인증 상태 변화 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // 사용자가 로그인된 경우 토큰 가져오기
        try {
          const token = await getIdToken(user);
          setUserToken(token);
        } catch (error) {
          console.error('Failed to get ID token:', error);
          setUserToken(null);
        }
      } else {
        setUserToken(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 토큰 갱신 (1시간마다)
  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(async () => {
        try {
          const token = await getIdToken(currentUser, true); // force refresh
          setUserToken(token);
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
      }, 3600000); // 1시간

      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const value = {
    currentUser,
    userToken,
    loading,
    signup,
    login,
    logout,
    getToken,
    getAuthHeaders
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
