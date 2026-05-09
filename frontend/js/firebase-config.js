import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// =============================================================
// ⚠️  GANTI DENGAN KONFIGURASI FIREBASE PROJECT ANDA
// Cara mendapatkan: Firebase Console → Project Settings → Your Apps
// =============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBU1Y99KodBbZkurhCLsYyQVxPWoeO2gVw",
  authDomain: "dewi-tailor.firebaseapp.com",
  projectId: "dewi-tailor",
  storageBucket: "dewi-tailor.firebasestorage.app",
  messagingSenderId: "530097648228",
  appId: "1:530097648228:web:3a4c1c2b15bae9c10fe571",
  measurementId: "G-88Z47K71TB",
};
// =============================================================

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
