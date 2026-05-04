import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCiclCpOWBGoZqFQnLA8vI6VYkte050goY",
  authDomain: "gym-template-5e751.firebaseapp.com",
  projectId: "gym-template-5e751",
  storageBucket: "gym-template-5e751.firebasestorage.app",
  messagingSenderId: "844467576258",
  appId: "1:844467576258:web:a838dfcba7f6a101658a5b",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);