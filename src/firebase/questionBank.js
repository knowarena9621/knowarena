import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const bankCol = collection(db, "questionBank");
const questionsCol = collection(db, "questions");

/**
 * Fetch question-bank questions, optionally filtered by class/subject/chapter/difficulty.
 * Search (by question text) is applied client-side since Firestore doesn't
 * support partial-text search.
 */
export async function getBankQuestions({ cls, subject, chapter, difficulty } = {}) {
  let q = bankCol;
  const filters = [];
  if (cls) filters.push(where("cls", "==", Number(cls)));
  if (subject) filters.push(where("subject", "==", subject));
  if (chapter) filters.push(where("chapter", "==", chapter));
  if (difficulty) filters.push(where("difficulty", "==", difficulty));
  if (filters.length) q = query(bankCol, ...filters);
  else q = query(bankCol);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Distinct chapter list for a class+subject, for the chapter filter dropdown. */
export async function getBankChapters(cls, subject) {
  const filters = [];
  if (cls) filters.push(where("cls", "==", Number(cls)));
  if (subject) filters.push(where("subject", "==", subject));
  const q = filters.length ? query(bankCol, ...filters) : query(bankCol);
  const snap = await getDocs(q);
  const chapters = new Set();
  snap.forEach(d => {
    const ch = d.data().chapter;
    if (ch) chapters.add(ch);
  });
  return Array.from(chapters).sort();
}

/**
 * Add a single question to the bank.
 * Expected shape: { questionText, optionA, optionB, optionC, optionD,
 *   correctAnswer (0-3), marks, difficulty, chapter, subject, cls, createdBy }
 */
export async function addBankQuestion({
  questionText, optionA, optionB, optionC, optionD,
  correctAnswer, marks, difficulty, chapter, subject, cls, createdBy,
}) {
  const ref = await addDoc(bankCol, {
    questionText,
    options: [optionA, optionB, optionC, optionD],
    correctAnswer: Number(correctAnswer),
    marks: Number(marks) || 1,
    difficulty: difficulty || "medium",
    chapter: chapter || "",
    subject,
    cls: Number(cls),
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBankQuestion(id, updates) {
  await updateDoc(doc(bankCol, id), updates);
}

export async function deleteBankQuestion(id) {
  await deleteDoc(doc(bankCol, id));
}

/** Create a copy of an existing bank question (e.g. for quick variants). */
export async function duplicateBankQuestion(question) {
  const { id, createdAt, ...rest } = question;
  const ref = await addDoc(bankCol, {
    ...rest,
    questionText: `${rest.questionText} (Copy)`,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Bulk-add questions parsed from pasted text. Each item should already be
 * in the shape produced by parseBulkQuestions() in QuestionBank.jsx.
 */
export async function bulkAddBankQuestions(items, createdBy) {
  const batch = writeBatch(db);
  items.forEach(item => {
    const ref = doc(bankCol);
    batch.set(ref, {
      questionText: item.questionText,
      options: [item.optionA, item.optionB, item.optionC, item.optionD],
      correctAnswer: Number(item.correctAnswer),
      marks: Number(item.marks) || 1,
      difficulty: item.difficulty || "medium",
      chapter: item.chapter || "",
      subject: item.subject,
      cls: Number(item.cls),
      createdBy: createdBy || null,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return items.length;
}

/**
 * Import selected question-bank questions into a test, by cloning them
 * into the `questions` collection with the given testId. Existing bank
 * entries are left untouched (so they can be reused elsewhere).
 */
export async function importBankQuestionsToTest(bankQuestions, testId, startOrder = 0) {
  const batch = writeBatch(db);
  bankQuestions.forEach((q, i) => {
    const ref = doc(questionsCol);
    batch.set(ref, {
      testId,
      cls: q.cls,
      subject: q.subject,
      chapter: q.chapter || "",
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
      difficulty: q.difficulty,
      order: startOrder + i,
      inBank: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return bankQuestions.length;
}
