import { useState, useEffect, useRef } from "react";
import { getActiveTestsForClass } from "./firebase/tests";
import { getQuestionsForTest } from "./firebase/questions";
import { submitAttempt, hasAttempted, getAttempt, getAttemptsForStudent } from "./firebase/attempts";
import { logout as fbLogout } from "./firebase/auth";

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

// Modern student avatar: graduation cap over a student silhouette, blue gradient circle.
const StudentAvatar = ({size=36}) => (
  <div style={{
    width:size,height:size,borderRadius:"50%",
    background:"linear-gradient(135deg,#60a5fa 0%,#1d4ed8 100%)",
    display:"flex",alignItems:"center",justifyContent:"center",
    boxShadow:"0 2px 6px rgba(29,78,216,0.35)",flexShrink:0,
  }}>
    <svg width={size*0.62} height={size*0.62} viewBox="0 0 24 24" fill="none">
      {/* silhouette (head + shoulders) */}
      <circle cx="12" cy="10.2" r="3.6" fill="#ffffff" fillOpacity="0.95"/>
      <path d="M5 21c0-3.6 3.13-6 7-6s7 2.4 7 6" stroke="#ffffff" strokeOpacity="0.95" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* graduation cap */}
      <path d="M12 3.2 L21 6.6 L12 10 L3 6.6 Z" fill="#fbbf24"/>
      <path d="M7.2 7.7 V11 C7.2 12.4 9.3 13.4 12 13.4 C14.7 13.4 16.8 12.4 16.8 11 V7.7" stroke="#fbbf24" strokeWidth="1.1" fill="none"/>
      <line x1="21" y1="6.6" x2="21" y2="10.6" stroke="#fbbf24" strokeWidth="1.1" strokeLinecap="round"/>
      <circle cx="21" cy="11.2" r="0.85" fill="#fbbf24"/>
    </svg>
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
        <div style={{width:68,height:68,borderRadius:18,background:T.grad,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:28,fontWeight:900,margin:"0 auto 12px"}}>{student.name[0]}</div>
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
