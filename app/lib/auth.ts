import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

/** "loading" = Firebase لسه بيتأكد من الجلسة المحفوظة. */
export type AuthStatus = "loading" | "in" | "out";

let ready = false;
let started = false;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  if (!started) {
    started = true;
    onAuthStateChanged(auth, () => {
      ready = true;
      for (const listener of listeners) listener();
    });
  }
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): AuthStatus {
  if (auth.currentUser) return "in";
  return ready ? "out" : "loading";
}

const getServerSnapshot = (): AuthStatus => "loading";

/** حالة تسجيل الدخول الحالية، بتتحدث لوحدها عند الدخول أو الخروج. */
export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
