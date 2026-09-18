/**
 * firebase-config.js
 * كنيسة السيدة العذراء مريم بالشامية - مدارس الأحد
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCgKoDbaR2kqS-kGqUujzjut0SxQ9hCZVU",
  authDomain:        "sunday-school-shamiya.firebaseapp.com",
  projectId:         "sunday-school-shamiya",
  storageBucket:     "sunday-school-shamiya.firebasestorage.app",
  messagingSenderId: "66035861267",
  appId:             "1:66035861267:web:5b4d9a08c7765929053ce6",
  measurementId:     "G-GC4LL3J38C"
};

window.firebaseApp = initializeApp(firebaseConfig);
console.log('🔥 Firebase connected:', firebaseConfig.projectId);
