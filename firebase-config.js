/**
 * firebase-config.js
 * ══════════════════════════════════════════════════════
 * كنيسة السيدة العذراء مريم بالشامية - مدارس الأحد
 * ══════════════════════════════════════════════════════
 *
 * ⚠️  مهم: استبدل القيم أدناه ببيانات مشروعك من Firebase Console
 *
 * كيفية الحصول على هذه البيانات:
 *  1. اذهب إلى: https://console.firebase.google.com
 *  2. اختر مشروعك
 *  3. اضغط ⚙️ Project Settings
 *  4. اضغط </> (Web App)
 *  5. انسخ الـ config من هناك والصقه هنا
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

// ↓↓↓ استبدل هذه القيم ببياناتك من Firebase Console ↓↓↓
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
};
// ↑↑↑ ─────────────────────────────────────────────── ↑↑↑

// تهيئة Firebase وجعله متاحاً عالمياً
window.firebaseApp = initializeApp(firebaseConfig);
console.log('🔥 Firebase initialized:', firebaseConfig.projectId);
