// SDK Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbF7-FR98Pm8l6Ztw8AeFBktu7eyLmwe4",
  authDomain: "db-code-master.firebaseapp.com",
  databaseURL: "https://db-code-master-default-rtdb.firebaseio.com",
  projectId: "db-code-master",
  storageBucket: "db-code-master.firebasestorage.app",
  messagingSenderId: "65137096874",
  appId: "1:65137096874:web:2cd562dd97fc19d27b38d3",
  measurementId: "G-458MDPKFE5",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database, firebaseConfig };
