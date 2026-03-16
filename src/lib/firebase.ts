import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA7X8Nl9ZJ3zJHU4bRklYpZdU5KtYH8dbw",
  authDomain: "ai-smart-intelligence-platform.firebaseapp.com",
  projectId: "ai-smart-intelligence-platform",
  storageBucket: "ai-smart-intelligence-platform.firebasestorage.app",
  messagingSenderId: "673665291438",
  appId: "1:673665291438:web:b789fb7321761cf154893f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
