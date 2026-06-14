import {
  collection, doc, getDoc, getDocs, setDoc,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

const attemptsCol = collection(db, "attempts");

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
