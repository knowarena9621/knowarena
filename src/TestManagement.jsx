import { useState, useEffect } from "react";
import {
  getAllTests, createTest, updateTest, deleteTest,
  publishTest, unpublishTest, archiveTest, duplicateTest,
} from "./firebase/tests";
import {
  getQuestionsForTest, addQuestion, updateQuestion, deleteQuestion,
  getQuestionBank, importQuestionsToTest, getChaptersFor,
} from "./firebase/questions";

const DIFFICULTY_COLORS = { easy: "#10b981", medium: "#f59e0b", hard: "#ef4444" };

const VIEW = {
  LIST: "list",
  CREATE: "create",
  QUESTIONS: "questions",
  BANK: "bank",
  PREVIEW: "preview",
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: TeacherTestsV2 — replaces old TeacherTests
// ═══════════════════════════════════════════════════════════════════════════════
export default function TeacherTestsV2({ T, Card, Btn, Badge, CLASSES, CLASS_SUBJECTS, TEST_TYPES, SUBJECT_ICONS, showToast, teacherUid }) {
  const [view, setView] = useState(VIEW.LIST);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTest, setActiveTest] = useState(null);
  const [activeQuestions, setActiveQuestions] = useState([]);

  const refreshTests = async () => {
    setLoading(true);
    try {
      const list = await getAllTests();
      setTests(list);
    } catch (e) {
      console.error(e);
      showToast("Failed to load tests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshTests(); }, []);

  const refreshQuestions = async (testId) => {
    const qs = await getQuestionsForTest(testId);
    setActiveQuestions(qs);
    return qs;
  };

  const handleCreateTest = async (formData) => {
    try {
      const id = await createTest({ ...formData, createdBy: teacherUid });
      showToast("Test created! Now add questions ✏️");
      const newTest = { id, ...formData, status: "draft", questionCount: 0 };
      setActiveTest(newTest);
      setActiveQuestions([]);
      await refreshTests();
      setView(VIEW.QUESTIONS);
    } catch (e) {
      console.error(e);
      showToast("Failed to create test", "error");
    }
  };

  const openQuestions = async (test) => {
    setActiveTest(test);
    await refreshQuestions(test.id);
    setView(VIEW.QUESTIONS);
  };

  const openPreview = async (test) => {
    setActiveTest(test);
    await refreshQuestions(test.id);
    setView(VIEW.PREVIEW);
  };

  const openBank = (test) => {
    setActiveTest(test);
    setView(VIEW.BANK);
  };

  const handlePublish = async () => {
    if (activeQuestions.length === 0) {
      showToast("Add at least one question before publishing", "error");
      return;
    }
    try {
      const shareCode = await publishTest(activeTest.id, activeQuestions.length);
      showToast(`Published! Share code: ${shareCode} 🎉`);
      await refreshTests();
      setView(VIEW.LIST);
    } catch (e) {
      console.error(e);
      showToast("Failed to publish test", "error");
    }
  };

  const handleUnpublish = async (test) => {
    try {
      await unpublishTest(test.id);
      showToast("Test moved back to draft");
      await refreshTests();
    } catch (e) { showToast("Failed", "error"); }
  };

  const handleArchive = async (test) => {
    try {
      await archiveTest(test.id);
      showToast("Test archived");
      await refreshTests();
    } catch (e) { showToast("Failed", "error"); }
  };

  const handleDuplicate = async (test) => {
    try {
      await duplicateTest(test);
      showToast("Test duplicated as draft 📋");
      await refreshTests();
    } catch (e) { showToast("Failed", "error"); }
  };

  const handleDelete = async (test) => {
    if (!window.confirm(`Delete "${test.title}"? This cannot be undone.`)) return;
    try {
      await deleteTest(test.id);
      showToast("Test deleted");
      await refreshTests();
    } catch (e) { showToast("Failed", "error"); }
  };

  if (view === VIEW.CREATE) {
    return (
      <CreateTestForm
        T={T} Card={Card} Btn={Btn} CLASSES={CLASSES} CLASS_SUBJECTS={CLASS_SUBJECTS} TEST_TYPES={TEST_TYPES}
        onCancel={() => setView(VIEW.LIST)}
        onCreate={handleCreateTest}
      />
    );
  }

  if (view === VIEW.QUESTIONS && activeTest) {
    return (
      <QuestionManagement
        T={T} Card={Card} Btn={Btn} Badge={Badge} SUBJECT_ICONS={SUBJECT_ICONS}
        test={activeTest} questions={activeQuestions}
        teacherUid={teacherUid} showToast={showToast}
        refreshQuestions={() => refreshQuestions(activeTest.id)}
        onOpenBank={() => openBank(activeTest)}
        onPreview={() => openPreview(activeTest)}
        onBack={async () => { await refreshTests(); setView(VIEW.LIST); }}
      />
    );
  }

  if (view === VIEW.BANK && activeTest) {
    return (
      <QuestionBankView
        T={T} Card={Card} Btn={Btn} Badge={Badge} CLASSES={CLASSES} CLASS_SUBJECTS={CLASS_SUBJECTS}
        test={activeTest} showToast={showToast}
        onBack={async () => { await refreshQuestions(activeTest.id); setView(VIEW.QUESTIONS); }}
      />
    );
  }

  if (view === VIEW.PREVIEW && activeTest) {
    return (
      <TestPreview
        T={T} Card={Card} Btn={Btn} Badge={Badge} SUBJECT_ICONS={SUBJECT_ICONS}
        test={activeTest} questions={activeQuestions}
        onBackToEdit={() => setView(VIEW.QUESTIONS)}
        onPublish={handlePublish}
      />
    );
  }

  return (
    <TestsList
      T={T} Card={Card} Btn={Btn} Badge={Badge} SUBJECT_ICONS={SUBJECT_ICONS}
      tests={tests} loading={loading}
      onCreateNew={() => setView(VIEW.CREATE)}
      onManageQuestions={openQuestions}
      onPreview={openPreview}
      onUnpublish={handleUnpublish}
      onArchive={handleArchive}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      showToast={showToast}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS LIST
// ═══════════════════════════════════════════════════════════════════════════════
function TestsList({ T, Card, Btn, Badge, SUBJECT_ICONS, tests, loading, onCreateNew, onManageQuestions, onPreview, onUnpublish, onArchive, onDuplicate, onDelete, showToast }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? tests : tests.filter(t => t.status === filter);
  const statusColor = (s) => s === "published" ? T.success : s === "draft" ? T.warn : T.textL;
  const statusLabel = (s) => s === "published" ? "✅ Published" : s === "draft" ? "📝 Draft" : "🗄️ Archived";

  const copyShareCode = (code) => {
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    showToast(`Share code ${code} copied! 📋`);
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.text}}>Tests</h2>
          <p style={{margin:0,color:T.textM,fontSize:13}}>{tests.length} test{tests.length!==1?"s":""} created</p>
        </div>
        <Btn onClick={onCreateNew}>+ Create Test</Btn>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {["all","draft","published","archived"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{background:filter===f?T.blue:"#fff",color:filter===f?"#fff":T.textM,border:`1.5px solid ${filter===f?T.blue:T.border}`,borderRadius:20,padding:"5px 14px",fontSize:13,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <Card style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:32,marginBottom:8}}>⏳</div>
          <p style={{color:T.textM,margin:0}}>Loading tests...</p>
        </Card>
      )}

      {!loading && filtered.length===0 && (
        <Card style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:40,marginBottom:10}}>📝</div>
          <p style={{color:T.textM,margin:"0 0 14px",fontSize:14}}>
            {filter==="all" ? "No tests yet — create your first test!" : `No ${filter} tests.`}
          </p>
          {filter==="all" && <Btn onClick={onCreateNew}>+ Create Test</Btn>}
        </Card>
      )}

      <div style={{display:"grid",gap:14}}>
        {filtered.map(t=>(
          <Card key={t.id} style={{padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:46,height:46,borderRadius:12,background:T.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{SUBJECT_ICONS[t.subject]||"📝"}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>{t.title}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <Badge color={T.blue}>Class {t.cls}</Badge>
                    <Badge color="#8b5cf6">{t.type}</Badge>
                    <Badge color={T.textM}>{t.duration} min</Badge>
                    <Badge color={T.text}>{t.totalMarks} marks</Badge>
                    <Badge color={t.questionCount>0?T.success:T.error}>{t.questionCount||0} questions</Badge>
                  </div>
                </div>
              </div>
              <Badge color={statusColor(t.status)}>{statusLabel(t.status)}</Badge>
            </div>

            {t.status==="published" && t.shareCode && (
              <div style={{marginTop:12,background:"#ecfdf5",border:`1px solid ${T.success}33`,borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <span style={{fontSize:13,color:T.textM}}>Share Code: <b style={{fontFamily:"monospace",fontSize:15,color:T.success,letterSpacing:2}}>{t.shareCode}</b></span>
                <button onClick={()=>copyShareCode(t.shareCode)} style={{background:T.success,color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Copy</button>
              </div>
            )}

            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <Btn variant="secondary" onClick={()=>onManageQuestions(t)} style={{padding:"8px 14px",fontSize:13}}>✏️ {t.status==="published"?"Edit Questions":"Manage Questions"}</Btn>
              <Btn variant="ghost" onClick={()=>onPreview(t)} style={{padding:"8px 14px",fontSize:13}}>👁️ Preview</Btn>
              {t.status==="published" && (
                <Btn variant="ghost" onClick={()=>onUnpublish(t)} style={{padding:"8px 14px",fontSize:13}}>⏸ Unpublish</Btn>
              )}
              {t.status!=="archived" && (
                <Btn variant="ghost" onClick={()=>onArchive(t)} style={{padding:"8px 14px",fontSize:13}}>🗄️ Archive</Btn>
              )}
              <Btn variant="ghost" onClick={()=>onDuplicate(t)} style={{padding:"8px 14px",fontSize:13}}>📋 Duplicate</Btn>
              <Btn variant="danger" onClick={()=>onDelete(t)} style={{padding:"8px 14px",fontSize:13}}>🗑️ Delete</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: CREATE TEST FORM
// ═══════════════════════════════════════════════════════════════════════════════
function CreateTestForm({ T, Card, Btn, CLASSES, CLASS_SUBJECTS, TEST_TYPES, onCancel, onCreate }) {
  const [form, setForm] = useState({
    title:"", subject:"Mathematics", cls:10, type:"Chapter Test",
    duration:30, totalMarks:50, scheduledAt:"", instructions:"",
  });
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div>
      <h2 style={{margin:"0 0 6px",fontSize:22,fontWeight:800,color:T.text}}>Create New Test</h2>
      <p style={{margin:"0 0 20px",color:T.textM,fontSize:13}}>Step 1 of 5 — Fill in the test details</p>

      <Card style={{border:`1.5px solid ${T.blue}33`,background:"#f0f4ff"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Test Title *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Chapter 3 – Motion"
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Class</label>
            <select value={form.cls} onChange={e=>{
                const cls = Number(e.target.value);
                const subjects = CLASS_SUBJECTS[cls] || [];
                setForm({...form, cls, subject: subjects[0] || form.subject});
              }}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              {CLASSES.map(c=><option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Subject</label>
            <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              {(CLASS_SUBJECTS[form.cls]||[]).map(s=><option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Test Type</label>
            <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              {TEST_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Duration (mins)</label>
            <input type="number" value={form.duration} onChange={e=>setForm({...form,duration:Number(e.target.value)})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Total Marks</label>
            <input type="number" value={form.totalMarks} onChange={e=>setForm({...form,totalMarks:Number(e.target.value)})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>

          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Schedule Date</label>
            <input type="date" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>

          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Instructions (optional)</label>
            <textarea value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})}
              placeholder="e.g. Read all questions carefully. No negative marking."
              rows={3}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:16}}>
          <Btn onClick={handle} disabled={!form.title.trim()||saving}>{saving?"Creating...":"Create Test →"}</Btn>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: QUESTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
function QuestionManagement({ T, Card, Btn, Badge, SUBJECT_ICONS, test, questions, teacherUid, showToast, refreshQuestions, onOpenBank, onPreview, onBack }) {
  const emptyForm = {
    questionText:"", optionA:"", optionB:"", optionC:"", optionD:"",
    correctAnswer:0, marks:1, difficulty:"medium", chapter:"",
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const valid = form.questionText.trim() && form.optionA.trim() && form.optionB.trim() && form.optionC.trim() && form.optionD.trim();

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const saveQuestion = async () => {
    if (!valid) { showToast("Fill question text and all 4 options", "error"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateQuestion(editingId, {
          questionText: form.questionText,
          options: [form.optionA, form.optionB, form.optionC, form.optionD],
          correctAnswer: Number(form.correctAnswer),
          marks: Number(form.marks),
          difficulty: form.difficulty,
          chapter: form.chapter,
        });
        showToast("Question updated ✅");
      } else {
        await addQuestion({
          testId: test.id, cls: test.cls, subject: test.subject,
          chapter: form.chapter, questionText: form.questionText,
          optionA: form.optionA, optionB: form.optionB, optionC: form.optionC, optionD: form.optionD,
          correctAnswer: form.correctAnswer, marks: form.marks, difficulty: form.difficulty,
          order: questions.length, addToBank: true, createdBy: teacherUid,
        });
        showToast("Question added ✅");
      }
      await refreshQuestions();
      resetForm();
    } catch (e) {
      console.error(e);
      showToast("Failed to save question", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setForm({
      questionText: q.questionText,
      optionA: q.options[0], optionB: q.options[1], optionC: q.options[2], optionD: q.options[3],
      correctAnswer: q.correctAnswer, marks: q.marks, difficulty: q.difficulty, chapter: q.chapter || "",
    });
  };

  const removeQuestion = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteQuestion(id);
      showToast("Question deleted");
      await refreshQuestions();
      if (editingId === id) resetForm();
    } catch (e) { showToast("Failed", "error"); }
  };

  const totalMarksAdded = questions.reduce((sum,q)=>sum+(q.marks||0),0);

  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.textM,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:10,padding:0}}>← Back to Tests</button>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800,color:T.text}}>{SUBJECT_ICONS[test.subject]} {test.title}</h2>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge color={T.blue}>Class {test.cls}</Badge>
            <Badge color="#8b5cf6">{test.type}</Badge>
            <Badge color={T.textM}>{test.duration} min</Badge>
            <Badge color={totalMarksAdded===test.totalMarks?T.success:T.warn}>{totalMarksAdded}/{test.totalMarks} marks</Badge>
            <Badge color={questions.length>0?T.success:T.error}>{questions.length} question{questions.length!==1?"s":""}</Badge>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={onOpenBank} style={{padding:"8px 14px",fontSize:13}}>📚 Question Bank</Btn>
          <Btn variant="ghost" onClick={onPreview} style={{padding:"8px 14px",fontSize:13}} disabled={questions.length===0}>👁️ Preview</Btn>
        </div>
      </div>

      <Card style={{marginBottom:20,border:`1.5px solid ${T.blue}33`,background:"#f0f4ff"}}>
        <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700,color:T.blue}}>{editingId?"✏️ Edit Question":"➕ Add New Question"}</h3>

        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Question Text *</label>
          <textarea value={form.questionText} onChange={e=>setForm({...form,questionText:e.target.value})}
            placeholder="Type the question here..."
            rows={2}
            style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:12}}>
          {["A","B","C","D"].map((letter,i)=>{
            const key = `option${letter}`;
            return (
              <div key={letter}>
                <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>
                  Option {letter} {form.correctAnswer===i && <span style={{color:T.success}}>✓ Correct</span>}
                </label>
                <div style={{display:"flex",gap:6}}>
                  <input value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}
                    placeholder={`Option ${letter}`}
                    style={{flex:1,border:`1.5px solid ${form.correctAnswer===i?T.success:T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
                  <button onClick={()=>setForm({...form,correctAnswer:i})} type="button"
                    title="Mark as correct answer"
                    style={{width:40,borderRadius:8,border:`1.5px solid ${form.correctAnswer===i?T.success:T.border}`,background:form.correctAnswer===i?T.success:"#fff",color:form.correctAnswer===i?"#fff":T.textL,cursor:"pointer",fontSize:16,flexShrink:0}}>
                    {form.correctAnswer===i?"✓":"○"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Marks</label>
            <input type="number" min={1} value={form.marks} onChange={e=>setForm({...form,marks:Number(e.target.value)})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Difficulty</label>
            <select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff",textTransform:"capitalize"}}>
              {["easy","medium","hard"].map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Chapter Tag</label>
            <input value={form.chapter} onChange={e=>setForm({...form,chapter:e.target.value})}
              placeholder="e.g. Motion"
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {editingId ? (
            <>
              <Btn onClick={saveQuestion} disabled={!valid||saving}>{saving?"Saving...":"💾 Save Changes"}</Btn>
              <Btn variant="ghost" onClick={resetForm}>Cancel Edit</Btn>
            </>
          ) : (
            <Btn onClick={saveQuestion} disabled={!valid||saving}>{saving?"Saving...":"➕ Add Question"}</Btn>
          )}
        </div>
      </Card>

      <h3 style={{fontSize:15,fontWeight:700,color:T.text,margin:"0 0 12px"}}>Questions ({questions.length})</h3>

      {questions.length===0 && (
        <Card style={{textAlign:"center",padding:"30px 20px"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <p style={{color:T.textM,margin:0,fontSize:14}}>No questions yet. Add your first question above, or import from the Question Bank.</p>
        </Card>
      )}

      <div style={{display:"grid",gap:10}}>
        {questions.map((q,idx)=>(
          <Card key={q.id} style={{padding:"14px 16px",border:editingId===q.id?`1.5px solid ${T.blue}`:undefined}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <Badge color={T.blue}>Q{idx+1}</Badge>
                <Badge color={DIFFICULTY_COLORS[q.difficulty]||T.textM}>{q.difficulty}</Badge>
                <Badge color={T.text}>{q.marks} mark{q.marks!==1?"s":""}</Badge>
                {q.chapter && <Badge color={T.textM}>{q.chapter}</Badge>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>startEdit(q)} style={{background:T.blueL,color:T.blue,border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button>
                <button onClick={()=>removeQuestion(q.id)} style={{background:T.error+"15",color:T.error,border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑️ Delete</button>
              </div>
            </div>
            <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:T.text}}>{q.questionText}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:6}}>
              {q.options.map((opt,i)=>(
                <div key={i} style={{fontSize:12,padding:"6px 10px",borderRadius:6,background:i===q.correctAnswer?T.success+"18":T.bg,color:i===q.correctAnswer?T.success:T.textM,fontWeight:i===q.correctAnswer?700:500,border:`1px solid ${i===q.correctAnswer?T.success+"44":T.border}`}}>
                  {["A","B","C","D"][i]}. {opt} {i===q.correctAnswer&&"✓"}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: QUESTION BANK
// ═══════════════════════════════════════════════════════════════════════════════
function QuestionBankView({ T, Card, Btn, Badge, CLASSES, CLASS_SUBJECTS, test, showToast, onBack }) {
  const [filterCls, setFilterCls] = useState(test.cls);
  const [filterSubject, setFilterSubject] = useState(test.subject);
  const [filterChapter, setFilterChapter] = useState("");
  const [chapters, setChapters] = useState([]);
  const [search, setSearch] = useState("");
  const [bankQuestions, setBankQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [qs, chs] = await Promise.all([
        getQuestionBank({ cls: filterCls, subject: filterSubject, chapter: filterChapter || undefined }),
        getChaptersFor(filterCls, filterSubject),
      ]);
      setBankQuestions(qs);
      setChapters(chs);
    } catch (e) {
      console.error(e);
      showToast("Failed to load question bank", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterCls, filterSubject, filterChapter]);

  const filtered = bankQuestions.filter(q =>
    !search.trim() || q.questionText.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const count = await importQuestionsToTest(Array.from(selected), test.id, 0);
      showToast(`${count} question${count!==1?"s":""} imported! 📥`);
      setSelected(new Set());
      onBack();
    } catch (e) {
      console.error(e);
      showToast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.textM,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:10,padding:0}}>← Back to Questions</button>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,color:T.text}}>📚 Question Bank</h2>
        <Btn onClick={handleImport} disabled={selected.size===0||importing}>
          {importing?"Importing...":`📥 Import ${selected.size>0?`(${selected.size})`:""} to Test`}
        </Btn>
      </div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Class</label>
            <select value={filterCls} onChange={e=>{setFilterCls(Number(e.target.value));setFilterChapter("");}}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              {CLASSES.map(c=><option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Subject</label>
            <select value={filterSubject} onChange={e=>{setFilterSubject(e.target.value);setFilterChapter("");}}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              {(CLASS_SUBJECTS[filterCls]||[]).map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Chapter</label>
            <select value={filterChapter} onChange={e=>setFilterChapter(e.target.value)}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,background:"#fff"}}>
              <option value="">All chapters</option>
              {chapters.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:12,fontWeight:700,color:T.textM,display:"block",marginBottom:4}}>Search</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search question text..."
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"}}/>
          </div>
        </div>
      </Card>

      {loading && (
        <Card style={{textAlign:"center",padding:"30px"}}><p style={{color:T.textM,margin:0}}>⏳ Loading...</p></Card>
      )}

      {!loading && filtered.length===0 && (
        <Card style={{textAlign:"center",padding:"30px"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <p style={{color:T.textM,margin:0,fontSize:14}}>No questions found for this filter. Questions you add to any test are automatically saved here for reuse.</p>
        </Card>
      )}

      <div style={{display:"grid",gap:10}}>
        {filtered.map(q=>(
          <Card key={q.id} onClick={()=>toggle(q.id)} style={{padding:"14px 16px",cursor:"pointer",border:selected.has(q.id)?`1.5px solid ${T.blue}`:undefined,background:selected.has(q.id)?T.blueL:undefined}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${selected.has(q.id)?T.blue:T.border}`,background:selected.has(q.id)?T.blue:"#fff",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>
                {selected.has(q.id)&&"✓"}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  <Badge color={DIFFICULTY_COLORS[q.difficulty]||T.textM}>{q.difficulty}</Badge>
                  <Badge color={T.text}>{q.marks} mark{q.marks!==1?"s":""}</Badge>
                  {q.chapter && <Badge color={T.textM}>{q.chapter}</Badge>}
                </div>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{q.questionText}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4: TEST PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TestPreview({ T, Card, Btn, Badge, SUBJECT_ICONS, test, questions, onBackToEdit, onPublish }) {
  const totalMarks = questions.reduce((sum,q)=>sum+(q.marks||0),0);

  return (
    <div>
      <button onClick={onBackToEdit} style={{background:"none",border:"none",color:T.textM,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:10,padding:0}}>← Back to Edit</button>

      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800,color:T.text}}>👁️ Test Preview</h2>
      <p style={{margin:"0 0 16px",color:T.textM,fontSize:13}}>This is exactly how students will see the test. Correct answers are hidden.</p>

      <Card style={{marginBottom:16,background:T.blueL}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontSize:32}}>{SUBJECT_ICONS[test.subject]||"📝"}</div>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:T.text}}>{test.title}</div>
            <div style={{fontSize:13,color:T.textM}}>{test.subject} · Class {test.cls} · {test.type}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Badge color={T.blue}>⏱ {test.duration} min</Badge>
          <Badge color={T.text}>{totalMarks} / {test.totalMarks} marks</Badge>
          <Badge color={questions.length>0?T.success:T.error}>{questions.length} questions</Badge>
        </div>
        {test.instructions && (
          <div style={{marginTop:12,padding:"10px 14px",background:"#fff",borderRadius:8,fontSize:13,color:T.textM}}>
            <b style={{color:T.text}}>Instructions:</b> {test.instructions}
          </div>
        )}
        {totalMarks !== test.totalMarks && (
          <div style={{marginTop:10,padding:"8px 12px",background:T.warn+"18",borderRadius:8,fontSize:12,color:T.warn,fontWeight:600}}>
            ⚠️ Question marks ({totalMarks}) don't match the test's total marks ({test.totalMarks}). You can still publish, but consider adjusting.
          </div>
        )}
      </Card>

      <div style={{display:"grid",gap:14}}>
        {questions.map((q,idx)=>(
          <Card key={q.id}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <Badge color={T.blue}>Question {idx+1}</Badge>
              <Badge color={T.text}>{q.marks} mark{q.marks!==1?"s":""}</Badge>
            </div>
            <p style={{margin:"0 0 12px",fontSize:15,fontWeight:600,color:T.text}}>{q.questionText}</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {q.options.map((opt,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${T.border}`,fontSize:14}}>
                  <span style={{width:26,height:26,borderRadius:6,background:T.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>{["A","B","C","D"][i]}</span>
                  {opt}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>
        <Btn variant="ghost" onClick={onBackToEdit}>← Back to Edit</Btn>
        <Btn onClick={onPublish} disabled={questions.length===0}>🚀 Publish Test</Btn>
      </div>
    </div>
  );
}
