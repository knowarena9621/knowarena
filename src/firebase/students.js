import {
  collection, doc, getDocs, updateDoc, query, orderBy, where,
} from "firebase/firestore";
import { db } from "./config";

const studentsCol = collection(db, "students");
const attemptsCol = collection(db, "attempts");

/** Get all students (teacher view), with live test-performance stats. */
export async function getStudents() {
  const snap = await getDocs(query(studentsCol, orderBy("createdAt", "desc")));
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Pull all attempts once and group by studentId for live avg/tests/best.
  const attemptsSnap = await getDocs(attemptsCol);
  const byStudent = {};
  attemptsSnap.docs.forEach(d => {
    const a = d.data();
    if (!a.studentId) return;
    (byStudent[a.studentId] ||= []).push(a);
  });

  return students.map(data => {
    const myAttempts = byStudent[data.id] || [];
    const tests = myAttempts.length;
    const avg = tests
      ? Math.round(myAttempts.reduce((s, a) => s + (a.percentage ?? 0), 0) / tests)
      : 0;
    const best = tests ? Math.max(...myAttempts.map(a => a.percentage ?? 0)) : 0;
    return {
      ...data,
      avg,
      tests,
      best,
      rank: data.stats?.rank ?? "-",
    };
  });
}

export async function approveStudent(uid) {
  await updateDoc(doc(db, "students", uid), { status: "approved" });
}

export async function rejectStudent(uid) {
  await updateDoc(doc(db, "students", uid), { status: "rejected" });
}

/** Block a student's access (won't be able to log in / take tests). */
export async function blockStudent(uid) {
  await updateDoc(doc(db, "students", uid), { status: "blocked" });
}

/** Restore a blocked student back to approved (re-enable access). */
export async function unblockStudent(uid) {
  await updateDoc(doc(db, "students", uid), { status: "approved" });
}
