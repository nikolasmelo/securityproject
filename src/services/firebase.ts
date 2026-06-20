import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "securityproject-67800",
  appId: "1:755006353966:web:5970d92f77307c4cd025bf",
  storageBucket: "securityproject-67800.firebasestorage.app",
  apiKey: "AIzaSyCyQACRBbmWUxX0fYcXHkQaLo80bpV9Txo",
  authDomain: "securityproject-67800.firebaseapp.com",
  messagingSenderId: "755006353966",
  measurementId: "G-8331VW6BPG"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa serviços do Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
