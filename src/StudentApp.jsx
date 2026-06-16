import { useState, useEffect, useRef } from "react";
import { getActiveTestsForClass } from "./firebase/tests";
import { getQuestionsForTest } from "./firebase/questions";
import { submitAttempt, hasAttempted, getAttempt, getAttemptsForStudent } from "./firebase/attempts";
import { logout as fbLogout } from "./firebase/auth";
const LOGO_ICON = "data:image/png;base64,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"; // KnowArena icon mark (K+mountain)


// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  blue:"#1a56db", blueD:"#1342a8", blueL:"#e8f0fe",
  gold:"#f5a623", goldL:"#fff8e7",
  white:"#ffffff", bg:"#f0f4ff",
  text:"#0f172a", textM:"#475569", textL:"#94a3b8",
  border:"#e2e8f0", success:"#10b981", error:"#ef4444", warn:"#f59e0b",
  grad:"linear-gradient(135deg,#1a56db 0%,#3b82f6 100%)",
  shadow:"0 2px 12px rgba(26,86,219,0.10)",
};

const SUBJECT_ICONS = {
  Mathematics:"📐", Science:"🔬", English:"📖", Hindi:"🇮🇳",
  "Social Science":"🌍", Physics:"⚛️", Chemistry:"🧪", Biology:"🧬",
  "Computer Science":"💻", Reasoning:"🧠", "General Knowledge":"🏆",
};

const Card = ({children,style={},...rest})=>(
  <div style={{background:T.white,borderRadius:16,boxShadow:T.shadow,
    border:`1px solid ${T.border}`,padding:20,...style}} {...rest}>
    {children}
  </div>
);

const Btn = ({children,onClick,style={},variant="primary",disabled=false})=>{
  const base = {border:"none",borderRadius:10,padding:"11px 22px",fontWeight:700,
    fontSize:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,
    transition:"all 0.15s",...style};
  if(variant==="primary") return <button style={{...base,background:T.grad,color:"#fff"}} onClick={onClick} disabled={disabled}>{children}</button>;
  if(variant==="ghost")   return <button style={{...base,background:"transparent",border:`1.5px solid ${T.border}`,color:T.textM}} onClick={onClick} disabled={disabled}>{children}</button>;
  if(variant==="danger")  return <button style={{...base,background:T.error,color:"#fff"}} onClick={onClick} disabled={disabled}>{children}</button>;
  return <button style={{...base,background:T.blueL,color:T.blue}} onClick={onClick} disabled={disabled}>{children}</button>;
};

const Badge = ({children,color=T.blue})=>(
  <span style={{background:color+"18",color,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700}}>{children}</span>
);

// Avatar using the KnowArena logo (same mark used on the teacher dashboard),
// inside a blue gradient circle to match the app's branding.
const StudentAvatar = ({size=36}) => (
  <div style={{
    width:size,height:size,borderRadius:"50%",
    background:"linear-gradient(135deg,#60a5fa 0%,#1d4ed8 100%)",
    display:"flex",alignItems:"center",justifyContent:"center",
    boxShadow:"0 2px 6px rgba(29,78,216,0.35)",flexShrink:0,
  }}>
    <img src={LOGO_ICON} alt="" style={{width:size*0.66,height:size*0.66,objectFit:"contain"}}/>
  </div>
);

// View inside student app
const SV = { DASH:"dash", MY_TESTS:"mytests", TEST_DETAIL:"detail", QUIZ:"quiz", RESULT:"result", MY_RESULTS:"myresults", PROFILE:"profile" };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STUDENT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function StudentApp({ student, onLogout, showToast }) {
  const [view, setView]               = useState(SV.DASH);
  const [tests, setTests]             = useState([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questions, setQuestions]     = useState([]);
  const [quizResult, setQuizResult]   = useState(null);
  const [myResults, setMyResults]     = useState([]);
  const [attemptedIds, setAttemptedIds] = useState(new Set());

  // ── Load tests on mount ────────────────────────────────────────────────────
  useEffect(() => { loadTests(); loadMyResults(); }, []);

  const loadTests = async () => {
    setTestsLoading(true);
    try {
      const raw = await getActiveTestsForClass(Number(student.cls));
      // normalize Firestore Timestamps
      const normalized = await Promise.all(raw.map(async t => {
        let scheduledStr = "";
        if (t.scheduledAt) {
          const d = t.scheduledAt?.toDate ? t.scheduledAt.toDate() : new Date(t.scheduledAt);
          scheduledStr = d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
        }
        const attempted = await hasAttempted(t.id, student.uid).catch(()=>false);
        return { ...t, scheduledStr, attempted, marks: t.totalMarks };
      }));
      setTests(normalized);
      setAttemptedIds(new Set(normalized.filter(t=>t.attempted).map(t=>t.id)));
    } catch(e) {
      console.error(e);
      showToast("Could not load tests", "error");
    } finally {
      setTestsLoading(false);
    }
  };

  const loadMyResults = async () => {
    try {
      const results = await getAttemptsForStudent(student.uid);
      setMyResults(results.sort((a,b)=>b.submittedAt?.toMillis?.()-a.submittedAt?.toMillis?.()));
    } catch(e) { console.error(e); }
  };

  // ── Open test detail ───────────────────────────────────────────────────────
  const openDetail = async (test) => {
    setSelectedTest(test);
    setView(SV.TEST_DETAIL);
  };

  // ── Start test (load questions) ────────────────────────────────────────────
  const startTest = async () => {
    try {
      showToast("Loading questions...");
      const qs = await getQuestionsForTest(selectedTest.id);
      if (qs.length === 0) { showToast("No questions added yet", "error"); return; }
      setQuestions(qs);
      setView(SV.QUIZ);
    } catch(e) {
      console.error(e);
      showToast("Failed to load questions", "error");
    }
  };

  // ── Quiz finish (submit to Firestore) ──────────────────────────────────────
  const handleQuizFinish = async (result) => {
    try {
      await submitAttempt({
        studentId: student.uid,
        studentName: student.name,
        testId: selectedTest.id,
        testTitle: selectedTest.title,
        cls: student.cls,
        subject: selectedTest.subject,
        answers: result.answers,
        score: result.score,
        totalMarks: result.total,
        timeTakenSeconds: result.timeTaken,
      });
      setAttemptedIds(prev => new Set([...prev, selectedTest.id]));
      setTests(prev => prev.map(t => t.id===selectedTest.id ? {...t, attempted:true} : t));
      setQuizResult(result);
      await loadMyResults();
      setView(SV.RESULT);
    } catch(e) {
      console.error(e);
      // Still show result even if submission fails
      setQuizResult(result);
      setView(SV.RESULT);
      showToast("Result saved locally (sync failed)", "error");
    }
  };

  const handleLogout = async () => { await fbLogout(); onLogout(); };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === SV.QUIZ && selectedTest && questions.length > 0) {
    return <QuizScreen test={selectedTest} questions={questions} student={student} onFinish={handleQuizFinish} onQuit={()=>setView(SV.MY_TESTS)} />;
  }

  if (view === SV.RESULT && quizResult) {
    return <ResultScreen result={quizResult} test={selectedTest} student={student} onBack={()=>{ setView(SV.MY_TESTS); loadTests(); }} />;
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",paddingBottom:70}}>
      {/* Top bar */}
      <div style={{background:T.grad,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1.1}}>Know<span style={{color:T.gold}}>Arena</span></div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",fontWeight:600,letterSpacing:0.2}}>The Field of Knowledge</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",textAlign:"right"}}>Class {student.cls}<br/>Student</div>
          <StudentAvatar/>
        </div>
      </div>

      <div style={{padding:"18px 16px",maxWidth:540,margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {view===SV.DASH && (
          <DashboardView
            student={student} tests={tests} myResults={myResults}
            testsLoading={testsLoading}
            onOpenTest={openDetail}
            onGoToTests={()=>setView(SV.MY_TESTS)}
            onGoToResults={()=>setView(SV.MY_RESULTS)}
            attemptedIds={attemptedIds}
          />
        )}

        {/* ── MY TESTS ── */}
        {view===SV.MY_TESTS && (
          <MyTestsView
            tests={tests} testsLoading={testsLoading}
            onOpenTest={openDetail} attemptedIds={attemptedIds}
            onRefresh={loadTests}
          />
        )}

        {/* ── TEST DETAIL ── */}
        {view===SV.TEST_DETAIL && selectedTest && (
          <TestDetailView
            test={selectedTest} attempted={attemptedIds.has(selectedTest.id)}
            onStart={startTest}
            onBack={()=>setView(SV.MY_TESTS)}
            student={student}
          />
        )}

        {/* ── MY RESULTS ── */}
        {view===SV.MY_RESULTS && (
          <MyResultsView results={myResults} onBack={()=>setView(SV.DASH)}/>
        )}

        {/* ── PROFILE ── */}
        {view===SV.PROFILE && (
          <ProfileView student={student} myResults={myResults} onLogout={handleLogout} onBack={()=>setView(SV.DASH)}/>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`1px solid ${T.border}`,display:"flex",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",zIndex:10}}>
        {[
          {id:SV.DASH,   icon:"🏠", label:"Home"},
          {id:SV.MY_TESTS, icon:"📝", label:"My Tests"},
          {id:SV.MY_RESULTS, icon:"📊", label:"Results"},
          {id:SV.PROFILE, icon:"👤", label:"Profile"},
        ].map(n=>(
          <button key={n.id} onClick={()=>setView(n.id)}
            style={{flex:1,border:"none",background:"none",padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:700,color:[SV.DASH,SV.MY_TESTS,SV.MY_RESULTS,SV.PROFILE].includes(view)&&view===n.id?T.blue:T.textL}}>{n.label}</span>
            {view===n.id&&<div style={{width:20,height:3,background:T.blue,borderRadius:99}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ student, tests, myResults, testsLoading, onOpenTest, onGoToTests, onGoToResults, attemptedIds }) {
  const available = tests.filter(t=>!attemptedIds.has(t.id));
  const avgScore = myResults.length ? Math.round(myResults.reduce((s,r)=>s+r.percentage,0)/myResults.length) : 0;

  return (
    <div>
      {/* Welcome card */}
      <div style={{background:T.grad,borderRadius:18,padding:"20px",marginBottom:20,color:"#fff"}}>
        <div style={{fontSize:13,opacity:0.8,marginBottom:4}}>Welcome back 👋</div>
        <div style={{fontSize:22,fontWeight:900}}>{student.name.split(" ")[0]}</div>
        <div style={{fontSize:13,opacity:0.8,marginTop:4}}>Class {student.cls} · {available.length} test{available.length!==1?"s":""} available</div>
        <div style={{display:"flex",gap:16,marginTop:16,borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:14}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900}}>{myResults.length}</div>
            <div style={{fontSize:11,opacity:0.75}}>Tests Done</div>
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.2)"}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900}}>{avgScore}%</div>
            <div style={{fontSize:11,opacity:0.75}}>Avg Score</div>
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.2)"}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900}}>{available.length}</div>
            <div style={{fontSize:11,opacity:0.75}}>Pending</div>
          </div>
        </div>
      </div>

      {/* Available tests */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:700,color:T.text}}>Available Tests</h3>
        <button onClick={onGoToTests} style={{background:"none",border:"none",color:T.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>See All →</button>
      </div>

      {testsLoading && <Card style={{textAlign:"center",padding:"24px"}}><p style={{color:T.textM,margin:0}}>⏳ Loading tests...</p></Card>}

      {!testsLoading && available.length===0 && (
        <Card style={{textAlign:"center",padding:"24px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>🎉</div>
          <p style={{color:T.textM,margin:0,fontSize:14}}>All tests completed! Check back later for new tests.</p>
        </Card>
      )}

      {!testsLoading && available.length>0 && (
        <SubjectGroupedTests tests={available} onOpenTest={onOpenTest}/>
      )}

      {/* Recent results */}
      {myResults.length>0 && (
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0 12px"}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700,color:T.text}}>Recent Results</h3>
            <button onClick={onGoToResults} style={{background:"none",border:"none",color:T.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>See All →</button>
          </div>
          {myResults.slice(0,2).map(r=>(
            <Card key={r.id} style={{marginBottom:10,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:4}}>{r.testTitle}</div>
                  <div style={{fontSize:12,color:T.textM}}>{r.subject}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:r.percentage>=80?T.success:r.percentage>=60?T.gold:T.error}}>{r.percentage}%</div>
                  <div style={{fontSize:11,color:T.textM}}>{r.score}/{r.totalMarks}</div>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// Groups tests by subject, listing each test's chapter/title underneath —
// e.g. "Mathematics" → "Introduction to Linear Polynomials", "Coordinate Geometry"
function SubjectGroupedTests({ tests, onOpenTest }) {
  const bySubject = {};
  tests.forEach(t => {
    const subj = t.subject || "Other";
    if (!bySubject[subj]) bySubject[subj] = [];
    bySubject[subj].push(t);
  });

  return (
    <div>
      {Object.entries(bySubject).map(([subject, subjectTests]) => (
        <Card key={subject} style={{marginBottom:14,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:T.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
              {SUBJECT_ICONS[subject]||"📝"}
            </div>
            <div style={{fontWeight:800,fontSize:15,color:T.text}}>{subject}</div>
          </div>
          <div>
            {subjectTests.map(t => (
              <button key={t.id} onClick={()=>onOpenTest(t)}
                style={{
                  width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
                  background:"none",border:"none",borderTop:`1px solid ${T.border}`,
                  padding:"10px 2px",cursor:"pointer",textAlign:"left",
                }}>
                <span style={{fontSize:14,color:T.text,fontWeight:600}}>• {t.title}</span>
                <span style={{color:T.blue,fontSize:13,fontWeight:700,flexShrink:0}}>Start →</span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function MyTestsView({ tests, testsLoading, onOpenTest, attemptedIds, onRefresh }) {
  const [filter, setFilter] = useState("all");

  const filtered = tests.filter(t=>{
    if(filter==="pending") return !attemptedIds.has(t.id);
    if(filter==="done") return attemptedIds.has(t.id);
    return true;
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,color:T.text}}>My Tests</h2>
        <button onClick={onRefresh} style={{background:T.blueL,border:"none",borderRadius:8,padding:"6px 12px",color:T.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>🔄 Refresh</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["all","All"],["pending","Pending"],["done","Completed"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{background:filter===v?T.blue:"#fff",color:filter===v?"#fff":T.textM,border:`1.5px solid ${filter===v?T.blue:T.border}`,borderRadius:20,padding:"5px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      {testsLoading && <Card style={{textAlign:"center",padding:"30px"}}><p style={{color:T.textM,margin:0}}>⏳ Loading...</p></Card>}

      {!testsLoading && filtered.length===0 && (
        <Card style={{textAlign:"center",padding:"30px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>📭</div>
          <p style={{color:T.textM,margin:0,fontSize:14}}>
            {filter==="all" ? "No tests assigned yet. Ask your teacher to publish tests." : filter==="pending" ? "All tests completed! 🎉" : "No completed tests yet."}
          </p>
        </Card>
      )}

      {filtered.map(t=>(
        <TestCard key={t.id} test={t} attempted={attemptedIds.has(t.id)} onOpen={()=>onOpenTest(t)}/>
      ))}
    </div>
  );
}

// ── Reusable test card ────────────────────────────────────────────────────────
function TestCard({ test, attempted, onOpen }) {
  return (
    <Card style={{marginBottom:14,padding:"16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
        <div style={{width:44,height:44,borderRadius:12,background:T.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
          {SUBJECT_ICONS[test.subject]||"📝"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:6}}>{test.title}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Badge color={T.blue}>{test.subject}</Badge>
            <Badge color="#8b5cf6">{test.type}</Badge>
            <Badge color={T.textM}>{test.duration} min</Badge>
            <Badge color={T.text}>{test.totalMarks||test.marks||"?"} marks</Badge>
          </div>
          {test.scheduledStr && (
            <div style={{fontSize:12,color:T.textL,marginTop:6}}>📅 {test.scheduledStr}</div>
          )}
        </div>
      </div>
      {attempted
        ? <div style={{background:"#ecfdf5",border:`1px solid ${T.success}33`,borderRadius:10,padding:"10px 14px",color:T.success,fontWeight:700,fontSize:14,textAlign:"center"}}>✅ Completed</div>
        : <Btn onClick={onOpen} style={{width:"100%"}}>▶ View & Start Test</Btn>
      }
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DETAIL VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TestDetailView({ test, attempted, onStart, onBack, student }) {
  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.textM,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:14,padding:0}}>← Back to Tests</button>

      {/* Test info */}
      <Card style={{marginBottom:16,background:T.blueL,border:`1.5px solid ${T.blue}22`}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <div style={{fontSize:36}}>{SUBJECT_ICONS[test.subject]||"📝"}</div>
          <div>
            <div style={{fontWeight:800,fontSize:18,color:T.text}}>{test.title}</div>
            <div style={{fontSize:13,color:T.textM}}>{test.subject} · Class {test.cls} · {test.type}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:test.instructions?14:0}}>
          {[["⏱️","Duration",`${test.duration} min`],["📊","Total Marks",test.totalMarks||test.marks||"—"],["📅","Date",test.scheduledStr||"—"]].map(([ic,label,val])=>(
            <div key={label} style={{background:"#fff",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:20}}>{ic}</div>
              <div style={{fontSize:18,fontWeight:800,color:T.blue}}>{val}</div>
              <div style={{fontSize:10,color:T.textM}}>{label}</div>
            </div>
          ))}
        </div>
        {test.instructions && (
          <div style={{background:"#fff",borderRadius:10,padding:"12px 14px",fontSize:13,color:T.textM}}>
            <b style={{color:T.text}}>📋 Instructions: </b>{test.instructions}
          </div>
        )}
      </Card>

      {/* Rules */}
      <Card style={{marginBottom:16}}>
        <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:T.text}}>⚠️ Important Rules</h3>
        {[
          "Timer will start automatically when you click Start Test",
          "Test will auto-submit when time runs out",
          "Do not switch tabs or apps — violations are recorded",
          "Each question must be answered before moving to next",
          "You cannot attempt the same test twice",
        ].map((rule,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:8,fontSize:13,color:T.textM}}>
            <span style={{color:T.warn,fontWeight:700,flexShrink:0}}>{i+1}.</span>{rule}
          </div>
        ))}
      </Card>

      {attempted
        ? <div style={{background:"#ecfdf5",border:`1px solid ${T.success}33`,borderRadius:12,padding:"16px",color:T.success,fontWeight:700,fontSize:15,textAlign:"center"}}>✅ You have already completed this test.</div>
        : <Btn onClick={onStart} style={{width:"100%",fontSize:16,padding:"14px"}}>🚀 Start Test Now</Btn>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function QuizScreen({ test, questions, student, onFinish, onQuit }) {
  const [qIdx, setQIdx]         = useState(0);
  const [answers, setAnswers]   = useState(Array(questions.length).fill(null)); // null = not answered
  const [timeLeft, setTimeLeft] = useState(test.duration * 60);
  const [started, setStarted]   = useState(false);
  const [violations, setViolations] = useState(0);
  const [warningMsg, setWarningMsg] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef();
  const MAX_V = 3;

  // Start timer
  useEffect(() => {
    if (!started) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); submit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started]);

  // Tab switch / visibility detection
  useEffect(() => {
    if (!started) return;
    const onVis = () => {
      if (document.hidden) recordViolation("Switched away from test");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started, violations]);

  const recordViolation = (reason) => {
    if (submitted) return;
    setViolations(prev => {
      const next = prev + 1;
      if (next >= MAX_V) {
        setWarningMsg(`🚫 Auto-submitted: ${MAX_V} violations detected!`);
        setTimeout(() => submit(true), 1500);
      } else {
        setWarningMsg(`⚠️ Warning ${next}/${MAX_V}: ${reason}`);
        setTimeout(() => setWarningMsg(null), 4000);
      }
      return next;
    });
  };

  const submit = (auto = false) => {
    if (submitted) return;
    setSubmitted(true);
    clearInterval(timerRef.current);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});

    const timeTaken = test.duration * 60 - timeLeft;
    const processedAnswers = answers.map((sel, i) => ({
      questionId: questions[i]?.id || i,
      questionText: questions[i]?.questionText || "",
      selectedIndex: sel,
      correct: sel !== null && sel === questions[i]?.correctAnswer,
      correctAnswer: questions[i]?.correctAnswer,
      options: questions[i]?.options || [],
      marks: questions[i]?.marks || 1,
    }));

    const score = processedAnswers.reduce((s, a) => s + (a.correct ? (a.marks || 1) : 0), 0);
    const total = questions.reduce((s, q) => s + (q.marks || 1), 0);

    onFinish({ answers: processedAnswers, score, total, timeTaken, autoSubmit: auto });
  };

  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen?.(); } catch(e) {}
    setStarted(true);
  };

  const selectAnswer = (optIdx) => {
    const newAnswers = [...answers];
    newAnswers[qIdx] = optIdx;
    setAnswers(newAnswers);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const isUrgent = timeLeft < 60;
  const q = questions[qIdx];
  const progress = ((qIdx) / questions.length) * 100;
  const answeredCount = answers.filter(a => a !== null).length;

  // Pre-test screen
  if (!started) return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{maxWidth:440,width:"100%",textAlign:"center",padding:"32px 24px"}}>
        <div style={{fontSize:44,marginBottom:10}}>🔒</div>
        <h2 style={{margin:"0 0 8px",fontSize:20,fontWeight:800,color:T.text}}>Secure Test Mode</h2>
        <p style={{color:T.textM,fontSize:14,lineHeight:1.6,margin:"0 0 16px"}}>
          Switching tabs or apps will count as a violation. After <b>{MAX_V} violations</b>, your test will be <b>auto-submitted</b>.
        </p>
        <div style={{background:T.blueL,borderRadius:10,padding:"12px 14px",marginBottom:20,textAlign:"left"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.blue,marginBottom:4}}>{test.title}</div>
          <div style={{fontSize:12,color:T.textM}}>{test.subject} · {test.duration} min · {questions.length} questions · {questions.reduce((s,q)=>s+(q.marks||1),0)} marks</div>
        </div>
        <Btn onClick={enterFullscreen} style={{width:"100%",marginBottom:10,fontSize:15,padding:"14px"}}>🔓 Enter Fullscreen & Start</Btn>
        <Btn variant="ghost" onClick={onQuit} style={{width:"100%"}}>Cancel</Btn>
      </Card>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Warning popup */}
      {warningMsg && (
        <div style={{position:"fixed",top:14,left:14,right:14,zIndex:999,background:T.error,color:"#fff",borderRadius:12,padding:"14px 18px",fontWeight:700,fontSize:14,boxShadow:"0 8px 24px rgba(239,68,68,0.4)",textAlign:"center"}}>
          {warningMsg}
        </div>
      )}

      {/* Header */}
      <div style={{background:T.grad,padding:"12px 16px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.8)",fontSize:11}}>{test.subject}</div>
            <div style={{color:"#fff",fontWeight:700,fontSize:14,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{test.title}</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {violations>0 && (
              <div style={{background:"rgba(239,68,68,0.3)",border:"1px solid rgba(239,68,68,0.6)",borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
                <div style={{color:"#fca5a5",fontSize:9,fontWeight:600}}>⚠️ FLAGS</div>
                <div style={{color:"#fca5a5",fontWeight:900,fontSize:16}}>{violations}/{MAX_V}</div>
              </div>
            )}
            <div style={{background:isUrgent?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.2)",border:isUrgent?"1px solid rgba(239,68,68,0.6)":undefined,borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
              <div style={{color:isUrgent?"#fca5a5":"rgba(255,255,255,0.8)",fontSize:9,fontWeight:600}}>⏱ TIME</div>
              <div style={{color:isUrgent?"#fca5a5":"#fff",fontWeight:900,fontSize:18,fontFamily:"monospace"}}>{mm}:{ss}</div>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:4,background:"rgba(255,255,255,0.2)",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,background:T.gold,borderRadius:99,transition:"width 0.3s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{color:"rgba(255,255,255,0.7)",fontSize:10}}>Q{qIdx+1}/{questions.length}</span>
          <span style={{color:"rgba(255,255,255,0.7)",fontSize:10}}>{answeredCount} answered</span>
        </div>
      </div>

      <div style={{padding:"16px",maxWidth:540,margin:"0 auto"}}>
        {/* Question card */}
        <Card style={{marginBottom:14,padding:"18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:T.blue,letterSpacing:0.5}}>QUESTION {qIdx+1}</span>
            <span style={{fontSize:12,fontWeight:700,color:T.textM}}>{q.marks||1} mark{(q.marks||1)!==1?"s":""}</span>
          </div>
          <p style={{margin:0,fontSize:16,fontWeight:600,color:T.text,lineHeight:1.6}}>{q.questionText}</p>
        </Card>

        {/* Options */}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {(q.options||[]).map((opt,i)=>{
            const selected = answers[qIdx]===i;
            return (
              <button key={i} onClick={()=>selectAnswer(i)}
                style={{display:"flex",alignItems:"center",gap:14,background:selected?T.blue+"12":"#fff",border:`2px solid ${selected?T.blue:T.border}`,borderRadius:12,padding:"13px 14px",cursor:"pointer",textAlign:"left",color:selected?T.blue:T.text,transition:"all 0.15s"}}>
                <span style={{width:30,height:30,borderRadius:8,background:selected?T.blue:T.blueL,color:selected?"#fff":T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0}}>
                  {["A","B","C","D"][i]}
                </span>
                <span style={{fontSize:14,fontWeight:selected?700:500}}>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{display:"flex",gap:10}}>
          <Btn variant="ghost" onClick={()=>setQIdx(Math.max(0,qIdx-1))} disabled={qIdx===0} style={{flex:1}}>← Prev</Btn>
          {qIdx<questions.length-1
            ? <Btn onClick={()=>setQIdx(qIdx+1)} style={{flex:1}}>Next →</Btn>
            : <Btn onClick={()=>submit(false)} style={{flex:1,background:T.success}}>✓ Submit</Btn>
          }
        </div>

        {/* Question dots */}
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:14,justifyContent:"center"}}>
          {questions.map((_,i)=>(
            <button key={i} onClick={()=>setQIdx(i)}
              style={{width:32,height:32,borderRadius:8,border:`2px solid ${i===qIdx?T.blue:answers[i]!==null?T.success:T.border}`,background:i===qIdx?T.blue:answers[i]!==null?T.success+"20":"#fff",color:i===qIdx?"#fff":answers[i]!==null?T.success:T.textM,fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {i+1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function ResultScreen({ result, test, student, onBack }) {
  const { score, total, answers, timeTaken } = result;
  const pct = total > 0 ? Math.round((score/total)*100) : 0;
  const correct = answers.filter(a=>a.correct).length;
  const incorrect = answers.filter(a=>!a.correct && a.selectedIndex!==null).length;
  const skipped = answers.filter(a=>a.selectedIndex===null).length;

  const grade = pct>=90 ? {label:"Outstanding! 🏆",color:"#f5a623"}
              : pct>=75 ? {label:"Excellent! 🌟",color:"#10b981"}
              : pct>=60 ? {label:"Good Job! 👍",color:"#1a56db"}
              : pct>=40 ? {label:"Keep Trying! 💪",color:"#f59e0b"}
              : {label:"Needs Work 📖",color:"#ef4444"};

  const mm = String(Math.floor(timeTaken/60)).padStart(2,"0");
  const ss = String(timeTaken%60).padStart(2,"0");

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",paddingBottom:30}}>
      <div style={{background:T.grad,padding:"16px 20px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>Know<span style={{color:T.gold}}>Arena</span></div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginLeft:"auto"}}>Test Results</div>
      </div>

      <div style={{padding:"20px 16px",maxWidth:520,margin:"0 auto"}}>
        {/* Score circle */}
        <Card style={{textAlign:"center",padding:"28px 20px",marginBottom:16,border:`2px solid ${grade.color}22`}}>
          <div style={{width:120,height:120,borderRadius:"50%",border:`5px solid ${grade.color}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",background:"#fff",boxShadow:`0 0 24px ${grade.color}33`}}>
            <span style={{fontSize:28,fontWeight:900,color:grade.color,lineHeight:1}}>{pct}%</span>
            <span style={{fontSize:12,color:T.textM}}>{score}/{total}</span>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:4}}>{grade.label}</div>
          <div style={{fontSize:13,color:T.textM}}>{student.name} · Class {test.cls} · {test.subject}</div>
        </Card>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[["✅",correct,"Correct","#10b981"],["❌",incorrect,"Wrong","#ef4444"],["⏭",skipped,"Skipped","#94a3b8"],["⏱",`${mm}:${ss}`,"Time","#6366f1"]].map(([ic,val,lbl,color])=>(
            <Card key={lbl} style={{padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:18}}>{ic}</div>
              <div style={{fontSize:18,fontWeight:900,color}}>{val}</div>
              <div style={{fontSize:10,color:T.textM}}>{lbl}</div>
            </Card>
          ))}
        </div>

        {/* Question-wise analysis */}
        <h3 style={{fontSize:15,fontWeight:700,color:T.text,margin:"0 0 12px"}}>Question-wise Analysis</h3>
        <div style={{display:"grid",gap:10,marginBottom:20}}>
          {answers.map((a,i)=>(
            <Card key={i} style={{padding:"14px 16px",borderLeft:`4px solid ${a.correct?T.success:a.selectedIndex===null?"#94a3b8":T.error}`}}>
              <div style={{fontSize:12,fontWeight:700,color:T.textM,marginBottom:6}}>Q{i+1} · {a.marks||1} mark{(a.marks||1)!==1?"s":""}</div>
              <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:8}}>{a.questionText}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                {(a.options||[]).map((opt,oi)=>(
                  <div key={oi} style={{fontSize:12,padding:"6px 10px",borderRadius:8,
                    background: oi===a.correctAnswer ? T.success+"18" : oi===a.selectedIndex && !a.correct ? T.error+"18" : T.bg,
                    color: oi===a.correctAnswer ? T.success : oi===a.selectedIndex && !a.correct ? T.error : T.textM,
                    border: `1px solid ${oi===a.correctAnswer?T.success+"44":oi===a.selectedIndex&&!a.correct?T.error+"44":T.border}`,
                    fontWeight: (oi===a.correctAnswer||oi===a.selectedIndex)?700:400,
                  }}>
                    {["A","B","C","D"][oi]}. {opt}
                    {oi===a.correctAnswer&&" ✓"}
                    {oi===a.selectedIndex&&!a.correct&&" ✗"}
                  </div>
                ))}
              </div>
              {a.selectedIndex===null && <div style={{fontSize:12,color:"#94a3b8",marginTop:6,fontWeight:600}}>⏭ Not attempted · Correct: {["A","B","C","D"][a.correctAnswer]}. {(a.options||[])[a.correctAnswer]}</div>}
            </Card>
          ))}
        </div>

        <Btn onClick={onBack} style={{width:"100%",fontSize:15}}>← Back to My Tests</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function MyResultsView({ results, onBack }) {
  return (
    <div>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800,color:T.text}}>My Results</h2>
      <p style={{color:T.textM,fontSize:13,margin:"0 0 16px"}}>{results.length} test{results.length!==1?"s":""} completed</p>

      {results.length===0 && (
        <Card style={{textAlign:"center",padding:"30px 16px"}}>
          <div style={{fontSize:32,marginBottom:8}}>📊</div>
          <p style={{color:T.textM,margin:0,fontSize:14}}>No results yet. Attempt your first test!</p>
        </Card>
      )}

      <div style={{display:"grid",gap:12}}>
        {results.map(r=>(
          <Card key={r.id} style={{padding:"14px 16px",borderLeft:`4px solid ${r.percentage>=80?T.success:r.percentage>=60?T.gold:T.error}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:4}}>{r.testTitle}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Badge color={T.blue}>{r.subject}</Badge>
                  <Badge color={T.textM}>✅ {r.correctCount} · ❌ {r.wrongCount} · ⏭ {r.skippedCount}</Badge>
                </div>
              </div>
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:24,fontWeight:900,color:r.percentage>=80?T.success:r.percentage>=60?T.gold:T.error}}>{r.percentage}%</div>
                <div style={{fontSize:11,color:T.textM}}>{r.score}/{r.totalMarks}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileView({ student, myResults, onLogout, onBack }) {
  const avgScore = myResults.length ? Math.round(myResults.reduce((s,r)=>s+r.percentage,0)/myResults.length) : 0;
  const bestScore = myResults.length ? Math.max(...myResults.map(r=>r.percentage)) : 0;

  return (
    <div>
      <Card style={{textAlign:"center",marginBottom:16,padding:"28px 20px"}}>
        <div style={{margin:"0 auto 12px",display:"flex",justifyContent:"center"}}><StudentAvatar size={68}/></div>
        <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:4}}>{student.name}</div>
        <Badge color={T.blue}>Class {student.cls}</Badge>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:18}}>
          {[["🎯",`${avgScore}%`,"Avg Score"],["📝",myResults.length,"Tests Done"],["🏆",`${bestScore}%`,"Best Score"]].map(([ic,val,lbl])=>(
            <div key={lbl} style={{background:T.bg,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontSize:20}}>{ic}</div>
              <div style={{fontSize:18,fontWeight:900,color:T.blue}}>{val}</div>
              <div style={{fontSize:10,color:T.textM}}>{lbl}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{marginBottom:14}}>
        {[["📱","Mobile",student.mobile||"—"],["👤","Username",student.username||"—"],["🏫","Class","Class "+student.cls]].map(([ic,label,val])=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:18}}>{ic}</span>
            <span style={{fontSize:13,color:T.textM,flex:1}}>{label}</span>
            <span style={{fontSize:14,fontWeight:600,color:T.text}}>{val}</span>
          </div>
        ))}
      </Card>

      <button onClick={onLogout} style={{width:"100%",background:T.error,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>🚪 Logout</button>
    </div>
  );
}
