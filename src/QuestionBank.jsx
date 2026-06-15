import { useState, useEffect } from "react";
import {
  getBankQuestions, getBankChapters, addBankQuestion, updateBankQuestion,
  deleteBankQuestion, duplicateBankQuestion, bulkAddBankQuestions,
  importBankQuestionsToTest,
} from "./firebase/questionBank";
import { getAllTests } from "./firebase/tests";

const DIFFICULTY_COLORS = { easy: "#10b981", medium: "#f59e0b", hard: "#ef4444" };

/**
 * Parse pasted bulk-question text into an array of question objects.
 * Expected per-question format (blank line or "---" separates questions):
 *
 *   Q: What is 2 + 2?
 *   A) 3
 *   B) 4
 *   C) 5
 *   D) 6
 *   Answer: B
 *   Marks: 1
 *   Difficulty: easy
 *   Chapter: Numbers
 *
 * Marks/Difficulty/Chapter lines are optional.
 */
function parseBulkQuestions(text, defaults) {
  const blocks = text
    .split(/\n\s*\n|\n-{3,}\n/)
    .map(b => b.trim())
    .filter(Boolean);

  const parsed = [];
  const errors = [];

  blocks.forEach((block, idx) => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    const item = {
      questionText: "", optionA: "", optionB: "", optionC: "", optionD: "",
      correctAnswer: null, marks: defaults.marks || 1,
      difficulty: defaults.difficulty || "medium",
      chapter: defaults.chapter || "",
      subject: defaults.subject, cls: defaults.cls,
    };

    lines.forEach(line => {
      const qMatch = line.match(/^(?:Q\d*[:.)]|Question[:.)]?)\s*(.+)$/i);
      const optMatch = line.match(/^([A-D])[).:]\s*(.+)$/i);
      const ansMatch = line.match(/^Answer[:.]?\s*([A-D]|\d)\s*$/i);
      const marksMatch = line.match(/^Marks?[:.]?\s*(\d+)\s*$/i);
      const diffMatch = line.match(/^Difficulty[:.]?\s*(easy|medium|hard)\s*$/i);
      const chapMatch = line.match(/^Chapter[:.]?\s*(.+)$/i);

      if (qMatch) { item.questionText = qMatch[1].trim(); return; }
      if (optMatch) {
        const letter = optMatch[1].toUpperCase();
        item[`option${letter}`] = optMatch[2].trim();
        return;
      }
      if (ansMatch) {
        const a = ansMatch[1].toUpperCase();
        item.correctAnswer = /[A-D]/.test(a) ? "ABCD".indexOf(a) : Number(a) - 1;
        return;
      }
      if (marksMatch) { item.marks = Number(marksMatch[1]); return; }
      if (diffMatch) { item.difficulty = diffMatch[1].toLowerCase(); return; }
      if (chapMatch) { item.chapter = chapMatch[1].trim(); return; }
      // First unmatched line, if questionText still empty, treat as question text
      if (!item.questionText) item.questionText = line;
    });

    const missing = [];
    if (!item.questionText) missing.push("question text");
    if (!item.optionA || !item.optionB || !item.optionC || !item.optionD) missing.push("all 4 options");
    if (item.correctAnswer === null || item.correctAnswer < 0 || item.correctAnswer > 3) missing.push("a valid Answer (A-D)");
    if (!item.subject) missing.push("subject");
    if (!item.cls) missing.push("class");

    if (missing.length) {
      errors.push(`Question ${idx + 1}: missing ${missing.join(", ")}`);
    } else {
      parsed.push(item);
    }
  });

  return { parsed, errors };
}

export default function QuestionBank({ T, Card, Btn, Badge, CLASSES, CLASS_SUBJECTS, SUBJECT_ICONS, showToast, teacherUid }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  // Filters
  const [filterCls, setFilterCls] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [chapters, setChapters] = useState([]);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = {
    questionText: "", optionA: "", optionB: "", optionC: "", optionD: "",
    correctAnswer: 0, marks: 1, difficulty: "medium", chapter: "",
    subject: "", cls: CLASSES[0],
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Bulk import
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDefaults, setBulkDefaults] = useState({ cls: CLASSES[0], subject: "", chapter: "", marks: 1, difficulty: "medium" });
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);

  // Import to Test
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [targetTestId, setTargetTestId] = useState("");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getBankQuestions({
        cls: filterCls || undefined,
        subject: filterSubject || undefined,
        chapter: filterChapter || undefined,
        difficulty: filterDifficulty || undefined,
      });
      setQuestions(list);
    } catch (e) {
      console.error(e);
      showToast("Failed to load question bank", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async () => {
    try {
      const chs = await getBankChapters(filterCls || undefined, filterSubject || undefined);
      setChapters(chs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, [filterCls, filterSubject, filterChapter, filterDifficulty]);
  useEffect(() => { loadChapters(); }, [filterCls, filterSubject]);

  const filtered = questions.filter(q =>
    !search.trim() || q.questionText.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(filtered.map(q => q.id)));
  const clearSelection = () => setSelected(new Set());

  // ── Add / Edit form ──────────────────────────────────────────────────────
  const valid = form.questionText.trim() && form.optionA.trim() && form.optionB.trim()
    && form.optionC.trim() && form.optionD.trim() && form.subject;

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const startAdd = () => {
    setForm({ ...emptyForm, cls: filterCls || CLASSES[0], subject: filterSubject || "", chapter: filterChapter || "" });
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (q) => {
    setForm({
      questionText: q.questionText,
      optionA: q.options[0], optionB: q.options[1], optionC: q.options[2], optionD: q.options[3],
      correctAnswer: q.correctAnswer, marks: q.marks, difficulty: q.difficulty,
      chapter: q.chapter || "", subject: q.subject, cls: q.cls,
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const saveQuestion = async () => {
    if (!valid) { showToast("Fill question text, all 4 options, and subject", "error"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateBankQuestion(editingId, {
          questionText: form.questionText,
          options: [form.optionA, form.optionB, form.optionC, form.optionD],
          correctAnswer: Number(form.correctAnswer),
          marks: Number(form.marks),
          difficulty: form.difficulty,
          chapter: form.chapter,
          subject: form.subject,
          cls: Number(form.cls),
        });
        showToast("Question updated ✅");
      } else {
        await addBankQuestion({
          ...form, correctAnswer: form.correctAnswer, createdBy: teacherUid,
        });
        showToast("Question added to bank ✅");
      }
      await load();
      await loadChapters();
      resetForm();
    } catch (e) {
      console.error(e);
      showToast("Failed to save question", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (id) => {
    if (!window.confirm("Delete this question from the bank?")) return;
    try {
      await deleteBankQuestion(id);
      showToast("Question deleted");
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      await load();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete question", "error");
    }
  };

  const handleDuplicate = async (q) => {
    try {
      await duplicateBankQuestion(q);
      showToast("Question duplicated ✅");
      await load();
    } catch (e) {
      console.error(e);
      showToast("Failed to duplicate question", "error");
    }
  };

  // ── Bulk import ──────────────────────────────────────────────────────────
  const handleBulkPreview = () => {
    if (!bulkText.trim()) { showToast("Paste some questions first", "error"); return; }
    if (!bulkDefaults.subject) { showToast("Pick a default subject for these questions", "error"); return; }
    const { parsed, errors } = parseBulkQuestions(bulkText, bulkDefaults);
    setBulkErrors(errors);
    return parsed;
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) { showToast("Paste some questions first", "error"); return; }
    if (!bulkDefaults.subject) { showToast("Pick a default subject for these questions", "error"); return; }
    const { parsed, errors } = parseBulkQuestions(bulkText, bulkDefaults);
    setBulkErrors(errors);
    if (parsed.length === 0) {
      showToast("No valid questions found — check the format", "error");
      return;
    }
    setBulkImporting(true);
    try {
      const count = await bulkAddBankQuestions(parsed, teacherUid);
      showToast(`${count} question${count !== 1 ? "s" : ""} added to bank ✅${errors.length ? ` (${errors.length} skipped)` : ""}`);
      setBulkText("");
      setShowBulk(false);
      setBulkErrors([]);
      await load();
      await loadChapters();
    } catch (e) {
      console.error(e);
      showToast("Bulk import failed", "error");
    } finally {
      setBulkImporting(false);
    }
  };

  // ── Import to Test ───────────────────────────────────────────────────────
  const openImportPanel = async () => {
    if (selected.size === 0) { showToast("Select at least one question", "error"); return; }
    try {
      const tests = await getAllTests();
      setAvailableTests(tests);
      setTargetTestId(tests[0]?.id || "");
      setShowImportPanel(true);
    } catch (e) {
      console.error(e);
      showToast("Failed to load tests", "error");
    }
  };

  const handleImportToTest = async () => {
    if (!targetTestId) { showToast("Pick a test to import into", "error"); return; }
    setImporting(true);
    try {
      const toImport = questions.filter(q => selected.has(q.id));
      const count = await importBankQuestionsToTest(toImport, targetTestId, 0);
      showToast(`${count} question${count !== 1 ? "s" : ""} imported to test 📥`);
      setSelected(new Set());
      setShowImportPanel(false);
    } catch (e) {
      console.error(e);
      showToast("Import to test failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const previewParsed = showBulk ? parseBulkQuestions(bulkText, bulkDefaults) : { parsed: [], errors: [] };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>📚 Question Bank</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={() => setShowBulk(s => !s)} style={{ padding: "8px 14px", fontSize: 13 }}>
            📋 Bulk Import
          </Btn>
          <Btn onClick={startAdd} style={{ padding: "8px 14px", fontSize: 13 }}>➕ Add Question</Btn>
        </div>
      </div>
      <p style={{ color: T.textM, fontSize: 13, margin: "0 0 16px" }}>
        Reusable MCQs for any test — filter, edit, and import directly into a test's question list.
      </p>

      {/* ── Bulk import panel ── */}
      {showBulk && (
        <Card style={{ marginBottom: 16, border: `1.5px solid ${T.blue}33`, background: "#f0f4ff" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: T.blue }}>📋 Bulk Import Questions</h3>
          <p style={{ color: T.textM, fontSize: 12, margin: "0 0 12px", lineHeight: 1.6 }}>
            Paste multiple MCQs, separated by a blank line. Each question should look like:
            <br />
            <code style={{ display: "block", marginTop: 6, padding: 8, background: "#fff", borderRadius: 6, fontSize: 11, whiteSpace: "pre-wrap", border: `1px solid ${T.border}` }}>
{`Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
Marks: 1
Difficulty: easy
Chapter: Numbers`}
            </code>
            Marks, Difficulty and Chapter are optional — defaults below are used if not given.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Default Class *</label>
              <select value={bulkDefaults.cls} onChange={e => setBulkDefaults({ ...bulkDefaults, cls: Number(e.target.value), subject: "" })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Default Subject *</label>
              <select value={bulkDefaults.subject} onChange={e => setBulkDefaults({ ...bulkDefaults, subject: e.target.value })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
                <option value="">Select subject</option>
                {(CLASS_SUBJECTS[bulkDefaults.cls] || []).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Default Chapter</label>
              <input value={bulkDefaults.chapter} onChange={e => setBulkDefaults({ ...bulkDefaults, chapter: e.target.value })}
                placeholder="e.g. Motion"
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Default Marks</label>
              <input type="number" min={1} value={bulkDefaults.marks} onChange={e => setBulkDefaults({ ...bulkDefaults, marks: Number(e.target.value) })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Default Difficulty</label>
              <select value={bulkDefaults.difficulty} onChange={e => setBulkDefaults({ ...bulkDefaults, difficulty: e.target.value })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", textTransform: "capitalize" }}>
                {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
            placeholder="Paste your questions here..."
            style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "monospace", resize: "vertical", marginBottom: 10 }} />

          {bulkText.trim() && (
            <div style={{ marginBottom: 10, fontSize: 12, color: T.textM }}>
              {previewParsed.parsed.length > 0 && <span style={{ color: T.success, fontWeight: 700 }}>{previewParsed.parsed.length} question{previewParsed.parsed.length !== 1 ? "s" : ""} ready to import. </span>}
              {previewParsed.errors.length > 0 && <span style={{ color: T.error, fontWeight: 700 }}>{previewParsed.errors.length} skipped.</span>}
              {previewParsed.errors.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {previewParsed.errors.map((err, i) => <li key={i} style={{ color: T.error }}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={handleBulkImport} disabled={bulkImporting || !bulkText.trim()}>
              {bulkImporting ? "Importing..." : "📋 Import All to Bank"}
            </Btn>
            <Btn variant="ghost" onClick={() => { setShowBulk(false); setBulkText(""); setBulkErrors([]); }}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* ── Add / Edit form ── */}
      {showForm && (
        <Card style={{ marginBottom: 16, border: `1.5px solid ${T.blue}33`, background: "#f0f4ff" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: T.blue }}>{editingId ? "✏️ Edit Question" : "➕ Add New Question"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Class *</label>
              <select value={form.cls} onChange={e => setForm({ ...form, cls: Number(e.target.value), subject: "" })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Subject *</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
                <option value="">Select subject</option>
                {(CLASS_SUBJECTS[form.cls] || []).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Question Text *</label>
            <textarea value={form.questionText} onChange={e => setForm({ ...form, questionText: e.target.value })}
              placeholder="Type the question here..."
              rows={2}
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
            {["A", "B", "C", "D"].map((letter, i) => {
              const key = `option${letter}`;
              return (
                <div key={letter}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>
                    Option {letter} {form.correctAnswer === i && <span style={{ color: T.success }}>✓ Correct</span>}
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={`Option ${letter}`}
                      style={{ flex: 1, border: `1.5px solid ${form.correctAnswer === i ? T.success : T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                    <button onClick={() => setForm({ ...form, correctAnswer: i })} type="button"
                      title="Mark as correct answer"
                      style={{ width: 40, borderRadius: 8, border: `1.5px solid ${form.correctAnswer === i ? T.success : T.border}`, background: form.correctAnswer === i ? T.success : "#fff", color: form.correctAnswer === i ? "#fff" : T.textL, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>
                      {form.correctAnswer === i ? "✓" : "○"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Marks</label>
              <input type="number" min={1} value={form.marks} onChange={e => setForm({ ...form, marks: Number(e.target.value) })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Difficulty</label>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", textTransform: "capitalize" }}>
                {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Chapter Tag</label>
              <input value={form.chapter} onChange={e => setForm({ ...form, chapter: e.target.value })}
                placeholder="e.g. Motion"
                style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={saveQuestion} disabled={!valid || saving}>{saving ? "Saving..." : editingId ? "💾 Save Changes" : "➕ Add to Bank"}</Btn>
            <Btn variant="ghost" onClick={resetForm}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* ── Filters ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Class</label>
            <select value={filterCls} onChange={e => { setFilterCls(e.target.value); setFilterSubject(""); setFilterChapter(""); }}
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
              <option value="">All classes</option>
              {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Subject</label>
            <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterChapter(""); }}
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
              <option value="">All subjects</option>
              {(filterCls ? (CLASS_SUBJECTS[filterCls] || []) : Array.from(new Set(Object.values(CLASS_SUBJECTS).flat()))).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Chapter</label>
            <select value={filterChapter} onChange={e => setFilterChapter(e.target.value)}
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
              <option value="">All chapters</option>
              {chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Difficulty</label>
            <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff", textTransform: "capitalize" }}>
              <option value="">All difficulties</option>
              {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search question text..."
              style={{ width: "100%", border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
          </div>
        </div>
      </Card>

      {/* ── Selection toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{filtered.length} question{filtered.length !== 1 ? "s" : ""}</span>
          {selected.size > 0 && <Badge color={T.blue}>{selected.size} selected</Badge>}
          <button onClick={selectAll} disabled={filtered.length === 0}
            style={{ background: "none", border: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: filtered.length === 0 ? "not-allowed" : "pointer", opacity: filtered.length === 0 ? 0.5 : 1 }}>Select All</button>
          <button onClick={clearSelection} disabled={selected.size === 0}
            style={{ background: "none", border: "none", color: T.textM, fontSize: 12, fontWeight: 700, cursor: selected.size === 0 ? "not-allowed" : "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>Clear Selection</button>
        </div>
        <Btn onClick={openImportPanel} disabled={selected.size === 0} style={{ padding: "8px 14px", fontSize: 13 }}>
          📥 Import to Test {selected.size > 0 ? `(${selected.size})` : ""}
        </Btn>
      </div>

      {/* ── Import-to-test panel ── */}
      {showImportPanel && (
        <Card style={{ marginBottom: 16, border: `1.5px solid ${T.blue}33`, background: "#f0f4ff" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: T.blue }}>📥 Import {selected.size} Question{selected.size !== 1 ? "s" : ""} to Test</h3>
          {availableTests.length === 0 ? (
            <p style={{ color: T.textM, fontSize: 13, margin: "0 0 12px" }}>No tests found. Create a test first under "Tests".</p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textM, display: "block", marginBottom: 4 }}>Target Test</label>
              <select value={targetTestId} onChange={e => setTargetTestId(e.target.value)}
                style={{ width: "100%", maxWidth: 400, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "#fff" }}>
                {availableTests.map(t => (
                  <option key={t.id} value={t.id}>
                    {SUBJECT_ICONS[t.subject] || "📝"} {t.title} — Class {t.cls} ({t.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={handleImportToTest} disabled={importing || availableTests.length === 0}>
              {importing ? "Importing..." : "📥 Import Now"}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowImportPanel(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* ── Loading / empty states ── */}
      {loading && (
        <Card style={{ textAlign: "center", padding: "30px" }}><p style={{ color: T.textM, margin: 0 }}>⏳ Loading question bank...</p></Card>
      )}

      {!loading && filtered.length === 0 && (
        <Card style={{ textAlign: "center", padding: "30px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <p style={{ color: T.textM, margin: 0, fontSize: 14 }}>
            {questions.length === 0
              ? "No questions in the bank yet. Add your first question or use Bulk Import."
              : "No questions match the current filters."}
          </p>
        </Card>
      )}

      {/* ── Question list ── */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((q, idx) => (
          <Card key={q.id} style={{ padding: "14px 16px", border: selected.has(q.id) ? `1.5px solid ${T.blue}` : (editingId === q.id ? `1.5px solid ${T.blue}` : undefined), background: selected.has(q.id) ? T.blueL : undefined }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div onClick={() => toggleSelect(q.id)} title="Select question"
                style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${selected.has(q.id) ? T.blue : T.border}`, background: selected.has(q.id) ? T.blue : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2, cursor: "pointer" }}>
                {selected.has(q.id) && "✓"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge color={T.blue}>Class {q.cls}</Badge>
                    <Badge color="#8b5cf6">{SUBJECT_ICONS[q.subject] || "📘"} {q.subject}</Badge>
                    <Badge color={DIFFICULTY_COLORS[q.difficulty] || T.textM}>{q.difficulty}</Badge>
                    <Badge color={T.text}>{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                    {q.chapter && <Badge color={T.textM}>{q.chapter}</Badge>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(q)} style={{ background: T.blueL, color: T.blue, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✏️ Edit</button>
                    <button onClick={() => handleDuplicate(q)} style={{ background: "#8b5cf615", color: "#8b5cf6", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📄 Duplicate</button>
                    <button onClick={() => removeQuestion(q.id)} style={{ background: T.error + "15", color: T.error, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑️ Delete</button>
                  </div>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: T.text }}>{q.questionText}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 6 }}>
                  {q.options.map((opt, i) => (
                    <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: i === q.correctAnswer ? T.success + "18" : T.bg, color: i === q.correctAnswer ? T.success : T.textM, fontWeight: i === q.correctAnswer ? 700 : 500, border: `1px solid ${i === q.correctAnswer ? T.success + "44" : T.border}` }}>
                      {["A", "B", "C", "D"][i]}. {opt} {i === q.correctAnswer && "✓"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
