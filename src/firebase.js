import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Vite sử dụng import.meta.env để lấy biến môi trường
const getEnv = (key) => {
  return import.meta.env[key];
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Khởi tạo (chỉ khi có config)
let app, db, auth;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("🔥 Firebase initialized");
    } else {
        console.warn("⚠️ Missing Firebase Config in .env file");
    }
} catch (error) {
    console.error("Firebase init error:", error);
}

export { db, auth };
