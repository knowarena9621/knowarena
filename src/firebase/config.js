import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuY8Enz5FvQADsDbqwpnjdjCmbquY2np0",
  authDomain: "knowarena96.firebaseapp.com",
  projectId: "knowarena96",
  storageBucket: "knowarena96.firebasestorage.app",
  messagingSenderId: "67481309505",
  appId: "1:67481309505:web:112f4fe8db3c6b55a391c0",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
