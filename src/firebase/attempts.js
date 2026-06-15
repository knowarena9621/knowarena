import {
  collection, doc, getDoc, getDocs, setDoc,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const attemptsCol = collection(db, "attempts");
const progressCol = collection(db, "attemptProgress");

/**
 * Autosave in-progress answers while a student is taking a test.
 * Document ID = `${testId}_${studentId}`. Overwritten on every autosave.
 * `answers` = { [questionId]: selectedIndex }
 */
export async function saveProgress({ testId, studentId, answers, qIdx, timeLeft }) {
  const id = `${testId}_${studentId}`;
  await setDoc(doc(progressCol, id), {
    testId, studentId, answers, qIdx, timeLeft,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Load any previously-saved in-progress answers (resume support). */
export async function getProgress(testId, studentId) {
  const snap = await getDoc(doc(progressCol, `${testId}_${studentId}`));
  return snap.exists() ? snap.data() : null;
}

export async function clearProgress(testId, studentId) {
  await setDoc(doc(progressCol, `${testId}_${studentId}`), {
    testId, studentId, cleared: true, updatedAt: serverTimestamp(),
  });
}

/**
 * Submit a completed test attempt.
 * Document ID = `${testId}_${studentUid}` so a student can only attempt
 * once (Firestore rules block overwrites).
 *
 * `answers` = [{ questionId, selectedIndex, correct, marks }]
 */
export async function submitAttempt({
  studentId, studentName, testId, testTitle, cls, subject,
  answers, score, totalMarks, timeTakenSeconds,
}) {
  const correctCount = answers.filter(a => a.correct).length;
  const wrongCount = answers.filter(a => !a.correct && a.selectedIndex !== null).length;
  const skippedCount = answers.filter(a => a.selectedIndex === null).length;
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const attemptId = `${testId}_${studentId}`;

  await setDoc(doc(attemptsCol, attemptId), {
    studentId, studentName, testId, testTitle, cls, subject,
    answers, score, totalMarks, percentage, timeTakenSeconds,
    correctCount, wrongCount, skippedCount,
    submittedAt: serverTimestamp(),
  });

  return attemptId;
}

export async function hasAttempted(testId, studentId) {
  const snap = await getDoc(doc(attemptsCol, `${testId}_${studentId}`));
  return snap.exists();
}

export async function getAttempt(testId, studentId) {
  const snap = await getDoc(doc(attemptsCol, `${testId}_${studentId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Teacher: all attempts for one test (for test-wise analytics). */
export async function getAttemptsForTest(testId) {
  const q = query(attemptsCol, where("testId", "==", testId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Student: all of their own attempts (for "My Results"). */
export async function getAttemptsForStudent(studentId) {
  const q = query(attemptsCol, where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Teacher: every attempt across all tests (for global analytics/leaderboard). */
export async function getAllAttempts() {
  const snap = await getDocs(attemptsCol);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Compute a student's rank for a specific test based on percentage
 * (1 = highest). Ties share the same rank. Returns { rank, totalAttempts }.
 */
export async function getRankForAttempt(testId, studentId) {
  const attempts = await getAttemptsForTest(testId);
  if (attempts.length === 0) return { rank: 1, totalAttempts: 1 };
  const sorted = [...attempts].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  const me = attempts.find(a => a.studentId === studentId);
  const myPct = me?.percentage ?? 0;
  const rank = sorted.findIndex(a => (a.percentage ?? 0) === myPct) + 1;
  return { rank: rank || sorted.length, totalAttempts: attempts.length };
}
