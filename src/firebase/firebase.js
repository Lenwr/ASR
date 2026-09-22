// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDp1aYxASO-oiXv14x_nPDwv59ea5lLPo4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "automotive-88ebc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "automotive-88ebc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "automotive-88ebc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "980317268020",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:980317268020:web:60684325f2559d9fca4261"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;