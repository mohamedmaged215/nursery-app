import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
// النسخة الخفيفة من Firestore: كفاية للقراءة والكتابة العادية وحجمها أصغر بكتير.
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyBedWvr55EqluPJ-Fcwz3Lqn2B0jIrk6Ac",
  authDomain: "nursery-app-77c80.firebaseapp.com",
  projectId: "nursery-app-77c80",
  storageBucket: "nursery-app-77c80.firebasestorage.app",
  messagingSenderId: "177123113404",
  appId: "1:177123113404:web:37a7b68c0c22a0109713b9",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// initializeAuth بدل getAuth: الدخول هنا بالإيميل وكلمة المرور بس، فمش محتاجين كود
// الدخول بـ popup/redirect (أخف، ومش بيحمّل سكربت إضافي من جوجل على الموبايل).
// الجلسة بتتحفظ في نفس المكان (IndexedDB) فالمستخدم بيفضل مسجل دخوله.
const globalAuth = globalThis as typeof globalThis & { __nurseryAuth?: Auth };
export const auth = (globalAuth.__nurseryAuth ??= initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
}));
export const db = getFirestore(app);
