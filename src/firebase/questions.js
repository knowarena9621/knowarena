import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch, orderBy,
} from "firebase/firestore";
import { db } from "./config";

const questionsCol = collection(db, "questions");

/** Get all questions belonging to a specific test (by testId). */
export async function getQuestionsForTest(testId) {
  const q = query(questionsCol, where("testId", "==", testId));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list;
}

/** Get questions by their IDs (used for question bank import). */
export async function getQuestionsByIds(ids) {
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = [];
  for (const chunk of chunks) {
    const q = query(questionsCol, where("__name__", "in", chunk));
    const snap = await getDocs(q);
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
  }
  return results;
}

/** Question Bank: get reusable questions filtered by class/subject/chapter. */
export async function getQuestionBank({ cls, subject, chapter } = {}) {
  let q = query(questionsCol, where("inBank", "==", true));
  if (cls) q = query(q, where("cls", "==", Number(cls)));
  if (subject) q = query(q, where("subject", "==", subject));
  if (chapter) q = query(q, where("chapter", "==", chapter));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Add a question to a test (and optionally to the reusable question bank).
 */
export async function addQuestion({
  testId, cls, subject, chapter, questionText,
  optionA, optionB, optionC, optionD, correctAnswer,
  marks, difficulty, order, addToBank = false, createdBy,
}) {
  const ref = await addDoc(questionsCol, {
    testId: testId || null,
    cls: Number(cls),
    subject,
    chapter: chapter || "",
    questionText,
    options: [optionA, optionB, optionC, optionD],
    correctAnswer: Number(correctAnswer), // 0-3
    marks: Number(marks) || 1,
    difficulty: difficulty || "medium",
    order: order || 0,
    inBank: !!addToBank,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuestion(id, updates) {
  await updateDoc(doc(db, "questions", id), updates);
}

export async function deleteQuestion(id) {
  await deleteDoc(doc(db, "questions", id));
}

/**
 * Import existing question-bank questions into a test by cloning them
 * with a new testId (so editing in one test doesn't affect the bank copy).
 */
export async function importQuestionsToTest(bankQuestionIds, testId, startOrder = 0) {
  const bankQuestions = await getQuestionsByIds(bankQuestionIds);
  const batch = writeBatch(db);
  bankQuestions.forEach((q, i) => {
    const ref = doc(questionsCol);
    const { id, ...rest } = q;
    batch.set(ref, {
      ...rest,
      testId,
      order: startOrder + i,
      inBank: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return bankQuestions.length;
}

/** Get distinct chapter list for a class+subject (for filter dropdowns). */
export async function getChaptersFor(cls, subject) {
  const q = query(questionsCol, where("cls", "==", Number(cls)), where("subject", "==", subject));
  const snap = await getDocs(q);
  const chapters = new Set();
  snap.forEach(d => {
    const ch = d.data().chapter;
    if (ch) chapters.add(ch);
  });
  return Array.from(chapters).sort();
}
