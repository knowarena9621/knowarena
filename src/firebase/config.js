import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
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

// Keep the user logged in across page reloads / app restarts (until they
// explicitly tap Logout). This is the default for the web SDK, but we set
// it explicitly so login sessions are never lost on mobile browsers.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});
