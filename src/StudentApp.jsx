import { useState, useEffect, useRef } from "react";
import { getActiveTestsForClass } from "./firebase/tests";
import { getQuestionsForTest } from "./firebase/questions";
import { submitAttempt, hasAttempted, getAttempt, getAttemptsForStudent } from "./firebase/attempts";
import { logout as fbLogout } from "./firebase/auth";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  blue: "#1a56db", blueD: "#1342a8", blueL: "#e8f0fe",
  gold: "#f5a623", goldL: "#fff8e7",
  white: "#ffffff", bg: "#f0f4ff",
  text: "#0f172a", textM: "#475569", textL: "#94a3b8",
  border: "#e2e8f0", success: "#10b981", error: "#ef4444", warn: "#f59e0b",
  grad: "linear-gradient(135deg,#1a56db 0%,#3b82f6 100%)",
  shadow: "0 2px 12px rgba(26,86,219,0.10)",
};

const SUBJECT_ICONS = {
  Mathematics: "📐", Science: "🔬", English: "📖", Hindi: "🇮🇳",
  "Social Science": "🌍", Physics: "⚛️", Chemistry: "🧪", Biology: "🧬",
  "Computer Science": "💻", Reasoning: "🧠", "General Knowledge": "🏆",
};

const Card = ({children,style={},onClick}) => (
  <div onClick={onClick} style={{background:T.white, borderRadius:16, padding:16, marginBottom:16, boxShadow:T.shadow, border:`1px solid ${T.border}`, ...style}}>
    {children}
  </div>
);

const Badge = ({children,color=T.blue}) => (
  <span style={{background:color+"15", color:color, padding:"4px 10px", borderRadius:30, fontSize:11, fontWeight:600, display:"inline-block"}}>
    {children}
  </span>
);

const Btn = ({children,onClick,variant="primary",style={},disabled=false}) => {
  const base = {padding:"12px 16px", borderRadius:12, fontSize:14, fontWeight:600, border:"none", cursor:disabled?"not-allowed":"pointer", width:"100%", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:8};
  const st = variant==="primary" ? {background:T.grad, color:T.white, boxShadow:"0 4px 12px rgba(26,86,219,0.2)", ...base}
           : variant==="secondary" ? {background:T.bg, color:T.blue, ...base}
           : variant==="danger" ? {background:T.error, color:T.white, ...base}
           : {background:"transparent", border:`1px solid ${T.border}`, color:T.textM, ...base};
  if(disabled) st.opacity = 0.6;
  return <button disabled={disabled} onClick={onClick} style={{...st,...style}}>{children}</button>;
};

export default function StudentApp({ student, onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, profile, liveTest
  const [tests, setTests] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [selTest, setSelTest] = useState(null); // Detail view modal ke liye
  const [loading, setLoading] = useState(true);

  // ─── LIVE QUIZ STATES ────────────────────────────────────────────────────────
  const [currentTest, setCurrentTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [curQIdx, setCurQIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { qId: selectedOptionIndex }
  const [timeLeft, setTimeLeft] = useState(0);
  const [submittingTest, setSubmittingTest] = useState(false);

  useEffect(() => {
    if (!student) return;
    loadDashboardData();
  }, [student]);

  // Quiz Timer Effect
  useEffect(() => {
    if (activeTab !== "liveTest" || timeLeft <= 0) {
      if (activeTab === "liveTest" && timeLeft === 0) {
        autoSubmitTest();
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab, timeLeft]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const allTests = await getActiveTestsForClass(student.cls);
      const attempts = await getAttemptsForStudent(student.uid || student.username);
      
      const testsWithStatus = await Promise.all(allTests.map(async (t) => {
        const attempted = await hasAttempted(t.id, student.uid || student.username);
        let score = null;
        if (attempted) {
          const details = await getAttempt(t.id, student.uid || student.username);
          score = details ? details.score : null;
        }
        return { ...t, attempted, score };
      }));

      setTests(testsWithStatus);
      setMyResults(attempts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── TEST START PROCESS ─────────────────────────────────────────────────────
  const handleStartTest = async (test) => {
    try {
      setLoading(true);
      setSelTest(null); // Modal close karein
      
      // 1. Firebase se questions load karein
      const qList = await getQuestionsForTest(test.id);
      if (!qList || qList.length === 0) {
        alert("Is test mein koi sawal nahi hain! Please teacher se sampark karein.");
        setLoading(false);
        return;
      }

      // 2. States reset aur set karein
      setQuestions(qList);
      setCurrentTest(test);
      setSelectedAnswers({});
      setCurQIdx(0);
      setTimeLeft(parseInt(test.duration) * 60); // Minutes ko seconds mein badlein
      setActiveTab("liveTest"); // Live quiz screen par le jayein
    } catch (err) {
      alert("Test start karne mein dikkat aayi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── TEST SUBMIT PROCESS ─────────────────────────────────────────────────────
  const autoSubmitTest = () => {
    alert("Time khatam! Aapka test automatic submit ho raha hai.");
    submitTestLogic();
  };

  const submitTestLogic = async () => {
    if (submittingTest) return;
    setSubmittingTest(true);

    try {
      let totalObtained = 0;
      const totalMaxMarks = questions.reduce((acc, q) => acc + (parseFloat(q.marks) || 1), 0);
      
      const answersLog = questions.map((q) => {
        const chosen = selectedAnswers[q.id];
        const isAnswered = chosen !== undefined;
        const isCorrect = isAnswered && parseInt(chosen) === parseInt(q.correctOption);
        
        let marksForThisQ = 0;
        if (isCorrect) {
          marksForThisQ = parseFloat(q.marks) || 1;
        } else if (isAnswered) {
          marksForThisQ = -(parseFloat(q.negativeMarks) || 0);
        }
        
        totalObtained += marksForThisQ;

        return {
          questionId: q.id,
          chosen: isAnswered ? parseInt(chosen) : null,
          correct: isCorrect,
          marksObtained: marksForThisQ
        };
      });

      // Percentage calculation (Negative score zero se kam na ho)
      if (totalObtained < 0) totalObtained = 0;
      const finalPercentage = totalMaxMarks > 0 ? Math.round((totalObtained / totalMaxMarks) * 100) : 0;

      // Firebase par submit karein
      await submitAttempt(currentTest.id, student.uid || student.username, {
        studentName: student.name,
        testTitle: currentTest.title,
        subject: currentTest.subject,
        score: finalPercentage,
        answers: answersLog,
        submittedAt: new Date().toLocaleString()
      });

      alert(`Test successfully submit ho gaya! Aapka score: ${finalPercentage}%`);
      setActiveTab("dashboard");
      loadDashboardData();
    } catch (err) {
      alert("Submit karne mein dikkat aayi: " + err.message);
    } finally {
      setSubmittingTest(false);
      setCurrentTest(null);
    }
  };

  // Format Time (Seconds to MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const avgScore = myResults.length ? Math.round(myResults.reduce((a,c)=>a+c.score,0)/myResults.length) : 0;
  const bestScore = myResults.length ? Math.max(...myResults.map(r=>r.score)) : 0;

  if (loading && activeTab !== "liveTest") {
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:\"center\",background:T.bg,color:T.blue,fontWeight:700}}>
        Loading KnowArena...
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ─── LIVE TEST SCREEN UI ────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────
  if (activeTab === "liveTest" && currentTest) {
    const q = questions[curQIdx];
    return (
      <div style={{minHeight:"100vh", background:T.bg, padding:16, boxSizing:"border-box"}}>
        {/* Quiz Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", background:T.grad, color:T.white, padding:"14px 18px", borderRadius:16, marginBottom:16, boxShadow:"0 4px 12px rgba(26,86,219,0.15)"}}>
          <div>
            <div style={{fontSize:16, fontWeight:700}}>{currentTest.title}</div>
            <div style={{fontSize:11, opacity:0.9}}>{currentTest.subject} · Q {curQIdx + 1}/{questions.length}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.2)", padding:"6px 12px", borderRadius:10, fontSize:16, fontWeight:800, fontFamily:"monospace"}}>
            ⏱️ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Question Area */}
        <Card style={{minHeight:220, display:"flex", flexDirection:"column", justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
              <Badge color={T.blue}>+ {q?.marks || 1} Marks</Badge>
              {parseFloat(q?.negativeMarks) > 0 && <Badge color={T.error}>-{q.negativeMarks} Negative</Badge>}
            </div>
            <div style={{fontSize:15, fontWeight:600, color:T.text, lineHeight:"1.5rem"}}>{q?.questionText}</div>
          </div>
        </Card>

        {/* Options */}
        <div style={{marginBottom:24}}>
          {q?.options?.map((opt, idx) => {
            const isSelected = selectedAnswers[q.id] === idx;
            return (
              <div
                key={idx}
                onClick={() => setSelectedAnswers({ ...selectedAnswers, [q.id]: idx })}
                style={{
                  background: isSelected ? T.blueL : T.white,
                  border: isSelected ? `2px solid ${T.blue}` : `1px solid ${T.border}`,
                  padding:14, borderRadius:12, marginBottom:10, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:12, boxShadow: T.shadow,
                  transition:"all 0.2s"
                }}
              >
                <div style={{
                  width:20, height:20, borderRadius:"50%", border:`2px solid ${isSelected ? T.blue : T.textL}`,
                  display:"flex", alignItems:"center", justifyContent:"center", background: isSelected ? T.blue : "transparent"
                }}>
                  {isSelected && <div style={{width:8, height:8, borderRadius:"50%", background:T.white}} />}
                </div>
                <div style={{fontSize:14, color:T.text, fontWeight: isSelected ? 600 : 500}}>{opt}</div>
              </div>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16}}>
          <Btn variant="secondary" disabled={curQIdx === 0} onClick={() => setCurQIdx(curQIdx - 1)}>
            ⬅️ Previous
          </Btn>
          
          {curQIdx < questions.length - 1 ? (
            <Btn variant="primary" onClick={() => setCurQIdx(curQIdx + 1)}>
              Next ➡️
            </Btn>
          ) : (
            <Btn variant="danger" onClick={submitTestLogic} disabled={submittingTest}>
              {submittingTest ? "Submitting..." : "🏁 Submit Test"}
            </Btn>
          )}
        </div>

        {/* Question Pallet Quick View */}
        <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", background:T.white, padding:10, borderRadius:12}}>
          {questions.map((_, idx) => {
            const isAnswered = selectedAnswers[questions[idx].id] !== undefined;
            const isCurrent = idx === curQIdx;
            return (
              <div
                key={idx}
                onClick={() => setCurQIdx(idx)}
                style={{
                  width:32, height:32, borderRadius:8, fontSize:12, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
                  background: isCurrent ? T.blue : isAnswered ? T.success + "20" : T.bg,
                  color: isCurrent ? T.white : isAnswered ? T.success : T.textM,
                  border: isCurrent ? "none" : `1px solid ${T.border}`
                }}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ─── DASHBOARD & PROFILE UI ─────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:16,paddingBottom:80,boxSizing:"border-box"}}>
      
      {/* Upper Brand Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <span style={{fontSize:11,fontWeight:700,color:T.blue,letterSpacing:1,display:"block"}}>STUDENT PORTAL</span>
          <h2 style={{margin:0,fontSize:20,fontWeight:900,color:T.text}}>KnowArena</h2>
        </div>
        <button onClick={fbLogout} style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:12,padding:"8px 12px",fontSize:12,fontWeight:600,color:T.error,boxShadow:T.shadow}}>
          Logout 🚪
        </button>
      </div>

      {activeTab === "dashboard" && (
        <>
          {/* Quick Stats */}
          <Card style={{marginBottom:20,background:T.grad,color:T.white,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-10,bottom:-10,fontSize:100,opacity:0.1}}>🎓</div>
            <div style={{fontSize:14,opacity:0.9}}>Welcome back,</div>
            <div style={{fontSize:22,fontWeight:900,marginBottom:4}}>{student.name}</div>
            <Badge color={T.white}>Class {student.cls}</Badge>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)\",gap:10,marginTop:18}}>
              {[["🎯",`${avgScore}%`,"Avg Score"],["📝",myResults.length,"Tests Done"],["🏆",`${bestScore}%`,"Best Score"]].map(([ic,val,lbl])=> (
                <div key={lbl} style={{background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:20}}>{ic}</div>
                  <div style={{fontSize:18,fontWeight:900,color:T.white}}>{val}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>{lbl}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Active Tests List */}
          <h3 style={{fontSize:16,fontWeight:800,color:T.text,marginBottom:12}}>Available Tests</h3>
          {tests.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:T.textL,fontSize:14}}>No tests available for Class {student.cls}</div>
          ) : (
            tests.map((t) => (
              <Card key={t.id} onClick={() => setSelTest(t)} style={{cursor:"pointer", position:"relative"}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{fontSize:28,background:T.bg,width:50,height:50,borderRadius:12,display:"flex",alignItems:"center",justifyContent:\"center\"}}>
                    {SUBJECT_ICONS[t.subject] || "📝"}
                  </div>
                  <div style={{flex:1}}>
                    <h4 style={{margin:"0 0 4px",fontSize:15,fontWeight:700,color:T.text}}>{t.title}</h4>
                    <div style={{fontSize:12,color:T.textM,display:"flex",gap:8}}>
                      <span>⏱️ {t.duration} Mins</span>
                      <span>•</span>
                      <span>{t.subject}</span>
                    </div>
                  </div>
                  <div>
                    {t.attempted ? (
                      <Badge color={T.success}>Score: {t.score}%</Badge>
                    ) : (
                      <Badge color={T.gold}>Live</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {activeTab === "profile" && (
        <Card style={{marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:800,marginBottom:16}}>My Account Profile</h3>
          {[["📱","Mobile",student.mobile||"—"],["👤","Username",student.username||"—"],["🏫","Class","Class "+student.cls]].map(([ic,label,val])=> (
            <div key={label} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:18}}>{ic}</span>
              <span style={{fontSize:13,color:T.textM,flex:1}}>{label}</span>
              <span style={{fontSize:14,fontWeight:600,color:T.text}}>{val}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Detail View Modal */}
      {selTest && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,0.6)\",display:\"flex\",alignItems:\"flex-end\",zIndex:100}}>
          <div style={{background:T.white,width:"100%",borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,boxSizing:"border-box",boxShadow:"0 -4px 20px rgba(0,0,0,0.15)"}}>
            <div style={{width:40,height:5,background:T.border,borderRadius:10,margin:"0 auto 16px"}} onClick={()=>setSelTest(null)}/>
            
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:40,marginBottom:8}}>{SUBJECT_ICONS[selTest.subject] || "📝"}</div>
              <h3 style={{margin:"0 0 4px",fontSize:18,fontWeight:800}}>{selTest.title}</h3>
              <p style={{margin:0,fontSize:13,color:T.textM}}>{selTest.subject} · Class {selTest.cls}</p>
            </div>

            <div style={{background:T.bg,borderRadius:14,padding:14,marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:11,color:T.textM,display:"block"}}>DURATION</span>
                <span style={{fontSize:15,fontWeight:700,color:T.blue}}>{selTest.duration} Minutes</span>
              </div>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:11,color:T.textM,display:"block"}}>STATUS</span>
                <span style={{fontSize:15,fontWeight:700,color:selTest.attempted?T.success:T.gold}}>{selTest.attempted?"Completed":"Not Attempted"}</span>
              </div>
            </div>

            {selTest.attempted ? (
              <div style={{background:T.success+"10",color:T.success,padding:12,borderRadius:12,textAlign:"center",fontWeight:600,fontSize:14,marginBottom:10}}>
                🎉 Aap yeh test pehle hi de chuke hain! Your Score: {selTest.score}%
              </div>
            ) : (
              <Btn variant="primary" onClick={() => handleStartTest(selTest)}>
                🚀 Start Test Now
              </Btn>
            )}
            
            <Btn variant="ghost" style={{marginTop:8}} onClick={()=>setSelTest(null)}>Close</Btn>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.white,borderTop:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 1fr",padding:"10px 24px\",boxShadow:\"0 -4px 12px rgba(0,0,0,0.03)\"}}>
        <div onClick={()=>setActiveTab("dashboard")} style={{textAlign:"center",color:activeTab==="dashboard"?T.blue:T.textL,cursor:"pointer"}}>
          <div style={{fontSize:20}}>🏠</div>
          <div style={{fontSize:11,fontWeight:600}}>Dashboard</div>
        </div>
        <div onClick={()=>setActiveTab("profile")} style={{textAlign:"center",color:activeTab==="profile"?T.blue:T.textL,cursor:"pointer"}}>
          <div style={{fontSize:20}}>👤</div>
          <div style={{fontSize:11,fontWeight:600}}>Profile</div>
        </div>
      </div>

    </div>
  );
      }
