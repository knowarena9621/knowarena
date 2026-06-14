import { useState, useEffect } from "react";
import { getActiveTestsForClass } from "./firebase/tests";
import { getQuestionsForTest } from "./firebase/questions";
import { submitAttempt, hasAttempted, getAttempt, getAttemptsForStudent } from "./firebase/attempts";
import { logout as fbLogout } from "./firebase/auth";

export default function StudentApp({ student, onLogout }) {
  const [activeTab, setActiveTab] = useState("home"); // home, myTests, results, profile, liveTest
  const [tests, setTests] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [selTest, setSelTest] = useState(null); // Rules screen/modal view ke liye
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
      // Puraane structure ke mutabik student.cls se tests filter ho rahe hain
      const allTests = await getActiveTestsForClass(student.cls);
      const attempts = await getAttemptsForStudent(student.uid || student.username || student.mobile);
      
      const testsWithStatus = await Promise.all(
        allTests.map(async (t) => {
          const attempted = await hasAttempted(t.id, student.uid || student.username || student.mobile);
          let score = null;
          if (attempted) {
            const details = await getAttempt(t.id, student.uid || student.username || student.mobile);
            score = details ? details.score : null;
          }
          return { ...t, attempted, score };
        })
      );

      setTests(testsWithStatus);
      setMyResults(attempts || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };
   // ─── TEST START PROCESS ─────────────────────────────────────────────────────
  const handleStartTest = async (test) => {
    try {
      setLoading(true);
      setSelTest(null); // Rules view clear karein
      
      const qList = await getQuestionsForTest(test.id);
      if (!qList || qList.length === 0) {
        alert("Is test mein koi sawal nahi hain! Please teacher se sampark karein.");
        setLoading(false);
        return;
      }

      setQuestions(qList);
      setCurrentTest(test);
      setSelectedAnswers({});
      setCurQIdx(0);
      setTimeLeft(parseInt(test.duration) * 60); // Convert to seconds
      setActiveTab("liveTest"); // Live quiz par switch karein
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

      if (totalObtained < 0) totalObtained = 0;
      const finalPercentage = totalMaxMarks > 0 ? Math.round((totalObtained / totalMaxMarks) * 100) : 0;

      await submitAttempt(currentTest.id, student.uid || student.username || student.mobile, {
        studentName: student.name,
        testTitle: currentTest.title,
        subject: currentTest.subject,
        score: finalPercentage,
        answers: answersLog,
        submittedAt: new Date().toLocaleString()
      });

      alert(`Test successfully submit ho gaya! Aapka score: ${finalPercentage}%`);
      setActiveTab("home");
      loadDashboardData();
    } catch (err) {
      alert("Submit karne mein dikkat aayi: " + err.message);
    } finally {
      setSubmittingTest(false);
      setCurrentTest(null);
    }
  }; 
const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Stats Calculations
  const pendingTestsCount = tests.filter(t => !t.attempted).length;
  const avgScore = myResults.length ? Math.round(myResults.reduce((a, c) => a + c.score, 0) / myResults.length) : 0;
  const bestScore = myResults.length ? Math.max(...myResults.map(r => r.score)) : 0;

  if (loading && activeTab !== "liveTest") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4ff", color: "#1a56db", fontWeight: 700 }}>
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
      <div style={{ minHeight: "100vh", background: "#f4f7fe", padding: 16, boxSizing: "border-box" }}>
        {/* Live Quiz Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #1a56db 0%, #3b82f6 100%)", color: "#ffffff", padding: "14px 18px", borderRadius: 16, marginBottom: 16, boxShadow: "0 4px 12px rgba(26,86,219,0.15)" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{currentTest.title}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{currentTest.subject} · Q {curQIdx + 1}/{questions.length}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: 10, fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>
            ⏱️ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Question Area */}
        <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", minHeight: 180 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <span style={{ background: "#e8f0fe", color: "#1a56db", padding: "4px 10px", borderRadius: 30, fontSize: 11, fontWeight: 600 }}>+{q?.marks || 1} Marks</span>
            {parseFloat(q?.negativeMarks) > 0 && <span style={{ background: "#ef444415", color: "#ef4444", padding: "4px 10px", borderRadius: 30, fontSize: 11, fontWeight: 600 }}>-{q.negativeMarks} Negative</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", lineHeight: "1.6rem" }}>{q?.questionText}</div>
        </div>

        {/* Options */}
        <div style={{ marginBottom: 24 }}>
          {q?.options?.map((opt, idx) => {
            const isSelected = selectedAnswers[q.id] === idx;
            return (
              <div
                key={idx}
                onClick={() => setSelectedAnswers({ ...selectedAnswers, [q.id]: idx })}
                style={{
                  background: isSelected ? "#e8f0fe" : "#ffffff",
                  border: isSelected ? "2px solid #1a56db" : "1px solid #e2e8f0",
                  padding: 14, borderRadius: 12, marginBottom: 10, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s"
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSelected ? "#1a56db" : "#94a3b8"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", background: isSelected ? "#1a56db" : "transparent"
                }}>
                  {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffffff" }} />}
                </div>
                <div style={{ fontSize: 14, color: "#0f172a", fontWeight: isSelected ? 600 : 500 }}>{opt}</div>
              </div>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap:12, marginBottom: 16 }}>
          <button disabled={curQIdx === 0} onClick={() => setCurQIdx(curQIdx - 1)} style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "1px solid #e2e8f0", background: "#ffffff", color: "#475569", cursor: curQIdx === 0 ? "not-allowed" : "pointer" }}>
            ⬅️ Previous
          </button>
          
          {curQIdx < questions.length - 1 ? (
            <button onClick={() => setCurQIdx(curQIdx + 1)} style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", background: "linear-gradient(135deg, #1a56db 0%, #3b82f6 100%)", color: "#ffffff", cursor: "pointer" }}>
              Next ➡️
            </button>
          ) : (
            <button onClick={submitTestLogic} disabled={submittingTest} style={{ padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, border: "none", background: "#ef4444", color: "#ffffff", cursor: "pointer" }}>
              {submittingTest ? "Submitting..." : "🏁 Submit Test"}
            </button>
          )}
        </div>

        {/* Question Palette Grid */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", background: "#ffffff", padding: 12, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          {questions.map((_, idx) => {
            const isAnswered = selectedAnswers[questions[idx].id] !== undefined;
            const isCurrent = idx === curQIdx;
            return (
              <div
                key={idx}
                onClick={() => setCurQIdx(idx)}
                style={{
                  width: 32, height: 32, borderRadius: 8, fontSize:12, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: isCurrent ? "#1a56db" : isAnswered ? "#10b98120" : "#f0f4ff",
                  color: isCurrent ? "#ffffff" : isAnswered ? "#10b981" : "#475569",
                  border: isCurrent ? "none" : "1px solid #e2e8f0"
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
  // ─── MAIN APPLICATION UI (Home, Profile, Rules Screen) ──────────────────────
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fe", paddingBottom: 80, boxSizing: "border-box" }}>
      
      {/* 1. ORIGINAL PREMIUM APP BAR */}
      <div style={{ background: "linear-gradient(135deg, #1a56db 0%, #3b82f6 100%)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#ffffff", letterSpacing: "0.5px" }}>
          Know<span style={{ color: "#f5a623" }}>Arena</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Class {student.cls}</span>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Student</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 700, fontSize: 15 }}>
            {student.name ? student.name.charAt(0).toUpperCase() : "S"}
          </div>
        </div>
      </div>

      {/* 2. SPECIFIC SCREEN ROUTING */}
      {selTest ? (
        /* ─── ORIGINAL TEST DETAILS & RULES VIEW ─── */
        <div style={{ padding: 16 }}>
          <button onClick={() => setSelTest(null)} style={{ background: "none", border: "none", color: "#1a56db", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            ← Back to Tests
          </button>

          <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.02)", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 36 }}>📐</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{selTest.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{selTest.subject} · Class {selTest.cls} · {selTest.type || "Test"}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
              <div style={{ background: "#f0f4ff", borderRadius: 12, padding: "12px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <span style={{ display: "block", fontSize: 20, marginBottom: 4 }}>⏱️</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#1a56db" }}>{selTest.duration} min</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Duration</span>
              </div>
              <div style={{ background: "#f0f4ff", borderRadius: 12, padding: "12px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <span style={{ display: "block", fontSize: 20, marginBottom: 4 }}>📊</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#1a56db" }}>50</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Total Marks</span>
              </div>
              <div style={{ background: "#f0f4ff", borderRadius: 12, padding: "12px 6px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                <span style={{ display: "block", fontSize: 20, marginBottom: 4 }}>📅</span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1a56db", lineHeight: "1.2rem" }}>13 Jun 2026</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Date</span>
              </div>
            </div>
          </div>

           {/* Important Rules Block */}
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0", marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>⚠️ Important Rules</h3>
            <ol style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 13, lineHeight: "1.6rem" }}>
              <li>Timer will start automatically when you click Start Test</li>
              <li>Test will auto-submit when time runs out</li>
              <li>Do not switch tabs or apps — violations are recorded</li>
              <li>Each question must be answered before moving to next</li>
              <li>You cannot attempt the same test twice</li>
            </ol>
          </div>

          {selTest.attempted ? (
            <div style={{ background: "#10b98110", color: "#10b981", padding: 14, borderRadius: 12, textAlign: "center", fontWeight: 700, fontSize: 14 }}>
              Score: {selTest.score}% (Already Attempted)
            </div>
          ) : (
            <button onClick={() => handleStartTest(selTest)} style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, background: "#1a56db", color: "#ffffff", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(26,86,219,0.2)" }}>
              🚀 Start Test Now
            </button>
          )}
        </div>
      ) : (
        <>
          {activeTab === "home" && (
            <div style={{ padding: 16 }}>
              {/* ORIGINAL HERO BLUE HERO CARD */}
              <div style={{ background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)", borderRadius: 20, padding: 20, color: "#ffffff", boxShadow: "0 4px 14px rgba(37,99,235,0.15)", marginBottom: 24 }}>
                <span style={{ fontSize: 13, opacity: 0.9 }}>Welcome back 👋</span>
                <h2 style={{ margin: "4px 0 2px 0", fontSize: 24, fontWeight: 900 }}>{student.name || "Demo"}</h2>
                <p style={{ margin: "0 0 16px 0", fontSize: 12, opacity: 0.85 }}>Class {student.cls} · {pendingTestsCount} tests available</p>
                <div style={{ height: "1px", background: "rgba(255,255,255,0.15)", marginBottom: 14 }} />
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{myResults.length}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Tests Done</div>
                  </div>
                  <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", borderRight: "1px solid rgba(255,255,255,0.15)" }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{avgScore}%</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Avg Score</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{pendingTestsCount}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Pending</div>
                  </div>
                </div>
              </div>

              {/* AVAILABLE TESTS BANNER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Available Tests</h3>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a56db", cursor: "pointer" }}>See All →</span>
              </div>

              {/* LIST ITEMS */}
              {tests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>
                  No tests available for Class {student.cls}
                </div>
              ) : (
                tests.map((t) => (
                  <div key={t.id} style={{ background: "#ffffff", borderRadius: 16, padding: 16, marginBottom: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.01)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, background: "#e8f0fe", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                        📐
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{t.title}</h4>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          <span style={{ background: "#e8f0fe", color: "#1a56db", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{t.subject}</span>
                          <span style={{ background: "#f3e8ff", color: "#9333ea", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{t.type || "Unit Test"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b", marginTop: 8, alignItems: "center" }}>
                          <span>⏱️ {t.duration} min</span>
                          <span>•</span>
                          <span>📊 50 marks</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelTest(t)} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "#1a56db", color: "#ffffff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {t.attempted ? `View Result (${t.score}%)` : "▶ View & Start Test"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

         {activeTab === "profile" && (
            <div style={{ padding: 16 }}>
              <div style={{ background: "#ffffff", borderRadius: 20, padding: 24, textAlign: "center", border: "1px solid #e2e8f0", marginBottom: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "#1a56db", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: 28, fontWeight: 800 }}>
                  {student.name ? student.name.charAt(0).toUpperCase() : "D"}
                </div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{student.name || "Demo"}</h3>
                <span style={{ background: "#e8f0fe", color: "#1a56db", padding: "3px 12px", borderRadius: 30, fontSize: 11, fontWeight: 700 }}>Class {student.cls}</span>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 20 }}>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 16 }}>🎯</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{avgScore}%</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Avg Score</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 16 }}>📝</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{myResults.length}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Tests Done</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 16 }}>🏆</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{bestScore}%</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Best Score</div>
                  </div>
                </div>
              </div>

              {/* Profile Fields */}
              <div style={{ background: "#ffffff", borderRadius: 16, padding: 16, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                {[
                  ["📱", "Mobile", student.mobile || "9999999999"],
                  ["👤", "Username", student.username || "demo00"],
                  ["🏫", "Class", "Class " + student.cls]
                ].map(([ic, label, val], i) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i === 2 ? "none" : "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: 18 }}>{ic}</span>
                    <span style={{ fontSize: 13, color: "#64748b", flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{val}</span>
                  </div>
                ))}
              </div>

              <button onClick={fbLogout} style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#ef4444", color: "#ffffff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                🚪 Logout
              </button>
            </div>
          )}
        </>
      )}

      {/* 3. ORIGINAL STICKY BOTTOM NAVIGATION BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "10px 0", boxShadow: "0 -4px 12px rgba(0,0,0,0.03)", zIndex: 90 }}>
        <div onClick={() => { setSelTest(null); setActiveTab("home"); }} style={{ textAlign: "center", color: activeTab === "home" ? "#1a56db" : "#94a3b8", cursor: "pointer" }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Home</div>
        </div>
        <div onClick={() => { setSelTest(null); setActiveTab("myTests"); }} style={{ textAlign: "center", color: activeTab === "myTests" ? "#1a56db" : "#94a3b8", cursor: "pointer" }}>
          <div style={{ fontSize: 20 }}>📝</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>My Tests</div>
        </div>
        <div onClick={() => { setSelTest(null); setActiveTab("results"); }} style={{ textAlign: "center", color: activeTab === "results" ? "#1a56db" : "#94a3b8", cursor: "pointer" }}>
          <div style={{ fontSize: 20 }}>📊</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Results</div>
        </div>
        <div onClick={() => { setSelTest(null); setActiveTab("profile"); }} style={{ textAlign: "center", color: activeTab === "profile" ? "#1a56db" : "#94a3b8", cursor: "pointer" }}>
          <div style={{ fontSize: 20 }}>👤</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Profile</div>
        </div>
      </div>

    </div>
  );
}
