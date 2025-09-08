// Firebase 설정 및 초기화
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정 객체
// TODO: 실제 Firebase 프로젝트 설정으로 교체해야 함
const firebaseConfig = {
  apiKey: "AIzaSyDv__l6SQKK_gCRvof-8-6t4esNXUxLa3A",
  authDomain: "khtml-a34cf.firebaseapp.com",
  projectId: "khtml-a34cf",
  storageBucket: "khtml-a34cf.firebasestorage.app",
  messagingSenderId: "672411103257",
  appId: "1:672411103257:web:a9e82318885ea778c5ba88",
  measurementId: "G-JSFELST9YV"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Auth와 Firestore 서비스 초기화
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
