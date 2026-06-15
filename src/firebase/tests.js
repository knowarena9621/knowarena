import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const testsCol = collection(db, "tests");

/** Teacher: get all tests (drafts + published), newest first. */
export async function getAllTests() {
  const snap = await getDocs(query(testsCol, orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Student: get published/active tests for their class. */
export async function getActiveTestsForClass(cls) {
  const q = query(
    testsCol,
    where("cls", "==", Number(cls)),
    where("status", "==", "published")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTest(testId) {
  const snap = await getDoc(doc(db, "tests", testId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Find a test by its share code (for "Join Test" flow). */
export async function getTestByShareCode(shareCode) {
  const q = query(testsCol, where("shareCode", "==", shareCode.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * STEP 1: Create a new test as a draft. Teacher is redirected to
 * Question Management after this.
 */
export async function createTest({
  title, subject, cls, type, duration, totalMarks,
  scheduledAt, instructions, createdBy,
}) {
  const ref = await addDoc(testsCol, {
    title, subject, cls: Number(cls), type,
    duration: Number(duration), totalMarks: Number(totalMarks),
    scheduledAt: scheduledAt || null,
    instructions: instructions || "",
    status: "draft", // draft -> published -> (unpublished/archived)
    shareCode: null,
    questionCount: 0,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTest(testId, updates) {
  await updateDoc(doc(db, "tests", testId), { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteTest(testId) {
  await deleteDoc(doc(db, "tests", testId));
}

/** Generate a random 6-character alphanumeric share code. */
function generateShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * STEP 5: Publish a test. Generates a unique share code, sets
 * status="published", and makes it visible to students of that class.
 */
export async function publishTest(testId, questionCount) {
  const shareCode = generateShareCode();
  await updateDoc(doc(db, "tests", testId), {
    status: "published",
    shareCode,
    questionCount,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return shareCode;
}

export async function unpublishTest(testId) {
  await updateDoc(doc(db, "tests", testId), { status: "draft", updatedAt: serverTimestamp() });
}

export async function archiveTest(testId) {
  await updateDoc(doc(db, "tests", testId), { status: "archived", updatedAt: serverTimestamp() });
}

/**
 * Duplicate a test (creates a new draft with the same metadata).
 * Does NOT duplicate questions — caller should also clone questions
 * via importQuestionsToTest if needed.
 */
export async function duplicateTest(test) {
  const ref = await addDoc(testsCol, {
    title: test.title + " (Copy)",
    subject: test.subject,
    cls: test.cls,
    type: test.type,
    duration: test.duration,
    totalMarks: test.totalMarks,
    scheduledAt: null,
    instructions: test.instructions || "",
    status: "draft",
    shareCode: null,
    questionCount: 0,
    createdBy: test.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
