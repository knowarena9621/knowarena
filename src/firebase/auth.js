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

// ─── STUDENT: username/password ─────────────────────────────────────────────
// Students log in by typing a username, but Firebase Auth always needs a real
// email. We use the student's recovery email (collected at signup) as their
// actual Firebase Auth email — this is what makes "Forgot Password" work for
// free (Firebase can only email a reset link to an account's real, registered
// email address; it can't redirect to a different inbox after the fact).

// Username must be plain alphanumeric (+ underscore/dot) — no "@" or other
// symbols, to keep it simple and unambiguous as a lookup key.
const USERNAME_RE = /^[a-zA-Z0-9._]{3,20}$/;

export async function studentSignup({ name, username, password, mobile, cls, parentMobile, recoveryEmail }) {
  const cleanUsername = username.trim().toLowerCase();
  if (!USERNAME_RE.test(cleanUsername)) {
    throw new Error("Username can only contain letters, numbers, dots, and underscores (no @ or spaces).");
  }
  if (!recoveryEmail || !recoveryEmail.trim()) {
    throw new Error("Email is required so you can reset your password later.");
  }
  const cleanEmail = recoveryEmail.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

  const profile = {
    name,
    username: cleanUsername,
    mobile,
    cls: Number(cls),
    parentMobile: parentMobile || null,
    recoveryEmail: cleanEmail,
    status: "pending",
    createdAt: serverTimestamp(),
    scores: { math: 0, sci: 0, eng: 0 },
    stats: { totalTests: 0, avgScore: 0, rank: null },
  };

  await setDoc(doc(db, "students", cred.user.uid), profile);
  return { uid: cred.user.uid, ...profile };
}

// Look up a student's real (recovery) email from their username, then sign
// in with that — this keeps the "type a username" UX while still using a
// real email under the hood for Firebase Auth.
export async function studentLogin(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  const q = query(collection(db, "students"), where("username", "==", cleanUsername));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error("No account found with that username.");
  }
  const email = snap.docs[0].data().recoveryEmail;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const studentDoc = await getDoc(doc(db, "students", cred.user.uid));
  if (!studentDoc.exists()) {
    await signOut(auth);
    throw new Error("Student profile not found.");
  }
  return { uid: cred.user.uid, ...studentDoc.data() };
}

/**
 * Teacher forgot-password: sends a Firebase reset link straight to their
 * real login email.
 */
export async function teacherForgotPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Student forgot-password: students log in with a username, so we look up
 * their registered email (the recovery email collected at signup, which is
 * also their real Firebase Auth email) and send the reset link there.
 */
export async function studentForgotPassword(username) {
  const cleanUsername = username.trim().toLowerCase();
  const q = query(collection(db, "students"), where("username", "==", cleanUsername));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error("No account found with that username.");
  }
  const email = snap.docs[0].data().recoveryEmail;
  if (!email) {
    throw new Error("No recovery email on file for this account. Please contact your teacher.");
  }
  await sendPasswordResetEmail(auth, email);
  return email;
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
