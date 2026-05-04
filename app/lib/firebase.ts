import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBedWvr55EqluPJ-Fcwz3Lqn2B0jIrk6Ac",
  authDomain: "nursery-app-77c80.firebaseapp.com",
  projectId: "nursery-app-77c80",
  storageBucket: "nursery-app-77c80.firebasestorage.app",
  messagingSenderId: "177123113404",
  appId: "1:177123113404:web:37a7b68c0c22a0109713b9",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);