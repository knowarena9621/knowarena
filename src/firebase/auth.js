import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

// ─── TEACHER LOGIN (email/password) ─────────────────────────────────────────
export async function teacherLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const teacherDoc = await getDoc(doc(db, "teachers", cred.user.uid));
  if (!teacherDoc.exists()) {
    await signOut(auth);
    throw new Error("This account is not registered as a teacher.");
  }
  return { uid: cred.user.uid, ...teacherDoc.data() };
}

// ─── STUDENT: username/password (stored as fake email internally) ──────────
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@knowarena.student`;
}

export async function studentSignup({ name, username, password, mobile, cls, parentMobile }) {
  const email = usernameToEmail(username);
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  const profile = {
    name,
    username: username.trim().toLowerCase(),
    mobile,
    cls: Number(cls),
    parentMobile: parentMobile || null,
    status: "pending",
    createdAt: serverTimestamp(),
    scores: { math: 0, sci: 0, eng: 0 },
    stats: { totalTests: 0, avgScore: 0, rank: null },
  };

  await setDoc(doc(db, "students", cred.user.uid), profile);
  return { uid: cred.user.uid, ...profile };
}

export async function studentLogin(username, password) {
  const email = usernameToEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const studentDoc = await getDoc(doc(db, "students", cred.user.uid));
  if (!studentDoc.exists()) {
    await signOut(auth);
    throw new Error("Student profile not found.");
  }
  return { uid: cred.user.uid, ...studentDoc.data() };
}

export async function logout() {
  await signOut(auth);
}

// ─── SESSION RESTORE HELPERS ─────────────────────────────────────────────────
// Used by onAuthStateChanged to check if user is teacher or student
export async function getTeacherProfile(uid) {
  const snap = await getDoc(doc(db, "teachers", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function getStudentProfile(uid) {
  const snap = await getDoc(doc(db, "students", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}
