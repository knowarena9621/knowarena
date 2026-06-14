import {
  collection, doc, getDocs, updateDoc, query, orderBy,
} from "firebase/firestore";
import { db } from "./config";

const studentsCol = collection(db, "students");

/** Get all students (teacher view). */
export async function getStudents() {
  const snap = await getDocs(query(studentsCol, orderBy("createdAt", "desc")));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      avg: data.stats?.avgScore ?? 0,
      tests: data.stats?.totalTests ?? 0,
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
