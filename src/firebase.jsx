import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwavIircrdfThljUFcwCBnMJeUvFDUPkI",
  authDomain: "projeto1-58759.firebaseapp.com",
  projectId: "projeto1-58759",
  storageBucket: "projeto1-58759.firebasestorage.app",
  messagingSenderId: "389149024411",
  appId: "1:389149024411:web:25b920d4f6db910d46263e",
  measurementId: "G-NHX2M1GDH4"
};

// inicia firebase
const app = initializeApp(firebaseConfig);

// exporta serviços
export const auth = getAuth(app);
export const db = getFirestore(app);

export { app };
