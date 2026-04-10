import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const maskValue = (value: string | undefined, visibleStart = 6, visibleEnd = 4) => {
  if (!value) return "(missing)";
  if (value.length <= visibleStart + visibleEnd) return value;
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingEnvVars = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

console.log("[firebase] import.meta.env check", {
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  hasApiKey: Boolean(firebaseConfig.apiKey),
  apiKeyPreview: maskValue(firebaseConfig.apiKey),
  authDomain: firebaseConfig.authDomain ?? "(missing)",
  projectId: firebaseConfig.projectId ?? "(missing)",
  storageBucket: firebaseConfig.storageBucket ?? "(missing)",
  messagingSenderId: firebaseConfig.messagingSenderId ?? "(missing)",
  appIdPreview: maskValue(firebaseConfig.appId),
  missingEnvVars,
});

if (missingEnvVars.length > 0) {
  throw new Error(
    `[firebase] Missing Vite env vars: ${missingEnvVars.join(", ")}. ` +
      "Check your .env file, keep the VITE_ prefix, and restart the dev server.",
  );
}

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

console.log("[firebase] initialized", {
  projectId: app.options.projectId,
  authDomain: app.options.authDomain,
  apiKeyPreview: maskValue(app.options.apiKey),
  storageBucket: app.options.storageBucket,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storageService = storage;
export default app;
