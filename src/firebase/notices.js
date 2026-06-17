import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, limit,
} from "firebase/firestore";
import { db } from "./config";

const noticesCol = collection(db, "notices");

/**
 * Teacher: post a notice/quote, optionally scoped to one class.
 * `cls = null` means "all classes".
 */
export async function postNotice({ message, cls, teacherName }) {
  await addDoc(noticesCol, {
    message: message.trim(),
    cls: cls ? Number(cls) : null,
    teacherName: teacherName || "Teacher",
    createdAt: serverTimestamp(),
  });
}

/** Teacher: get all notices they've sent (newest first), for management/history. */
export async function getAllNotices() {
  const snap = await getDocs(query(noticesCol, orderBy("createdAt", "desc"), limit(50)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteNotice(noticeId) {
  await deleteDoc(doc(db, "notices", noticeId));
}

/**
 * Student: get notices relevant to their class (class-specific + all-class),
 * newest first, capped at 30 most recent so the list stays light.
 */
export async function getNoticesForClass(cls) {
  const snap = await getDocs(query(noticesCol, orderBy("createdAt", "desc"), limit(50)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(n => n.cls === null || n.cls === Number(cls));
}

// ─── AUTO-ROTATING DAILY QUOTE (free, no backend needed) ───────────────────
// A small built-in set of motivational quotes that rotates by date, so
// students always see something fresh without the teacher having to do
// anything. Combined with teacher notices in the notification list.
const DAILY_QUOTES = [
  "Success is the sum of small efforts repeated day in and day out. 🌟",
  "The expert in anything was once a beginner. Keep going! 💪",
  "Don't watch the clock; do what it does — keep going. ⏳",
  "Believe you can, and you're halfway there. 🚀",
  "Small progress is still progress. Celebrate it! 🎉",
  "Mistakes are proof that you are trying. 📝",
  "Your only limit is the one you set yourself. 🔥",
  "Push yourself, because no one else is going to do it for you. 💯",
  "Great things never come from comfort zones. 🌱",
  "Dream big, study hard, stay humble. 📚",
  "The harder you work, the luckier you get. ⭐",
  "Today's effort is tomorrow's result. ✨",
  "Focus on progress, not perfection. 🎯",
  "Every test is a step closer to your goal. 🏆",
  "Consistency beats intensity. Keep showing up! 🙌",
];

/** Returns today's quote, rotating deterministically by date (no storage needed). */
export function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / 86400000); // days since epoch
  return DAILY_QUOTES[dayIndex % DAILY_QUOTES.length];
}
