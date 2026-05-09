import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =============================================================
// ⚠️  GANTI DENGAN KONFIGURASI FIREBASE PROJECT ANDA
// Cara mendapatkan: Firebase Console → Project Settings → Your Apps
// =============================================================
const firebaseConfig = {
  apiKey:            "AIzaSy_GANTI_DENGAN_API_KEY_ANDA",
  authDomain:        "nama-project-anda.firebaseapp.com",
  projectId:         "nama-project-anda",
  storageBucket:     "nama-project-anda.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890",
};
// =============================================================

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;
