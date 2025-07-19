// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCW59nZRS5c0oHziU2plu3Y-olPLJl2dI8",
  authDomain: "e-commerce-assistent-bot.firebaseapp.com",
  projectId: "e-commerce-assistent-bot",
  storageBucket: "e-commerce-assistent-bot.firebasestorage.app",
  messagingSenderId: "231092957274",
  appId: "1:231092957274:web:7f1ac606a82e47c3caa863",
  measurementId: "G-Q2LY6X5HEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db }; 