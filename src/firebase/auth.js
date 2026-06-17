import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
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

// Username must be plain alphanumeric (+ underscore/dot) — no "@" or other
// symbols, since it gets embedded into a fake internal email address
// (e.g. "name@9621" would otherwise produce "name@9621@knowarena.student",
// which Firebase rejects as an invalid email).
const USERNAME_RE = /^[a-zA-Z0-9._]{3,20}$/;

export async function studentSignup({ name, username, password, mobile, cls, parentMobile, recoveryEmail }) {
  const cleanUsername = username.trim().toLowerCase();
  if (!USERNAME_RE.test(cleanUsername)) {
    throw new Error("Username can only contain letters, numbers, dots, and underscores (no @ or spaces).");
  }
  const email = usernameToEmail(cleanUsername);
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  const profile = {
    name,
    username: cleanUsername,
    mobile,
    cls: Number(cls),
    parentMobile: parentMobile || null,
    recoveryEmail: recoveryEmail ? recoveryEmail.trim().toLowerCase() : null,
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

/**
 * Given a Firebase Auth uid (from onAuthStateChanged), figure out whether
 * this user is a teacher or a student and return their profile.
 * Used to restore a session on app load so users don't have to log in
 * again every time (until they explicitly log out).
 */
export async function getUserProfile(uid) {
  const teacherDoc = await getDoc(doc(db, "teachers", uid));
  if (teacherDoc.exists()) {
    return { role: "teacher", profile: { uid, ...teacherDoc.data() } };
  }
  const studentDoc = await getDoc(doc(db, "students", uid));
  if (studentDoc.exists()) {
    return { role: "student", profile: { uid, ...studentDoc.data() } };
  }
  return null;
}
