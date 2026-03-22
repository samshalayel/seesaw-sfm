import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/utils";

interface BackgroundJob {
  id: string;
  message: string;
  robotId: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string;
  toolsUsed: string[];
  createdAt: number;
  completedAt: number | null;
  error: string | null;
}

export function BackgroundJobs() {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [hasNewResults, setHasNewResults] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await apiFetch("/api/jobs");
      const data = await res.json();
      setJobs(data);

      const hasNew = data.some(
        (j: BackgroundJob) => j.status === "completed" || j.status === "failed"
      );
      if (hasNew && !isOpen) {
        setHasNewResults(true);
      }
    } catch (_e) {}
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const clearCompleted = async () => {
    await apiFetch("/api/jobs/completed", { method: "DELETE" });
    fetchJobs();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending": return { label: "بالانتظار", color: "#ffa726", icon: "⏳" };
      case "running": return { label: "قيد التنفيذ", color: "#42a5f5", icon: "⚙️" };
      case "completed": return { label: "تم", color: "#66bb6a", icon: "✅" };
      case "failed": return { label: "فشل", color: "#ef5350", icon: "❌" };
      default: return { label: status, color: "#999", icon: "?" };
    }
  };

  const runningCount = jobs.filter(j => j.status === "running" || j.status === "pending").length;

  return (
    <>
      <button
        onClick={() => { setIsOpen(!isOpen); setHasNewResults(false); }}
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          background: "rgba(15, 15, 25, 0.9)",
          border: "2px solid #7c4dff",
          borderRadius: "12px",
          padding: "8px 16px",
          color: "white",
          fontSize: "14px",
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 90,
          boxShadow: hasNewResults ? "0 0 15px #7c4dff80" : "none",
          animation: hasNewResults ? "pulse 1.5s infinite" : "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>📋</span>
        <span>المهام الخلفية</span>
        {runningCount > 0 && (
          <span style={{
            background: "#42a5f5",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: "bold",
          }}>
            {runningCount}
          </span>
        )}
        {hasNewResults && (
          <span style={{
            background: "#66bb6a",
            borderRadius: "50%",
            width: "8px",
            height: "8px",
            position: "absolute",
            top: "6px",
            right: "6px",
          }} />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "16px",
            width: "420px",
            maxHeight: "500px",
            background: "rgba(15, 15, 25, 0.95)",
            borderRadius: "16px",
            border: "2px solid #7c4dff",
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter, sans-serif",
            zIndex: 95,
            boxShadow: "0 0 30px #7c4dff40",
          }}
        >
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #7c4dff40",
          }}>
            <span style={{ color: "white", fontSize: "16px", fontWeight: "bold", direction: "rtl" }}>
              📋 المهام الخلفية
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {jobs.some(j => j.status === "completed" || j.status === "failed") && (
                <button onClick={clearCompleted} style={{
                  background: "#333",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  color: "#aaa",
                  fontSize: "12px",
                  cursor: "pointer",
                }}>
                  مسح المكتمل
                </button>
              )}
              <button onClick={() => setIsOpen(false)} style={{
                background: "none",
                border: "none",
                color: "#888",
                fontSize: "18px",
                cursor: "pointer",
              }}>
                X
              </button>
            </div>
          </div>

          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 12px",
            maxHeight: "420px",
          }}>
            {jobs.length === 0 && (
              <div style={{
                color: "#666",
                textAlign: "center",
                padding: "30px",
                fontSize: "13px",
                direction: "rtl",
              }}>
                ما في مهام خلفية بعد.<br />
                من المحادثة مع الروبوت، اضغط "نفذ بالخلفية" عشان يشتغل حتى لو سكرت الصفحة.
              </div>
            )}

            {jobs.map(job => {
              const statusInfo = getStatusInfo(job.status);
              const isExpanded = expandedJob === job.id;
              const robotName = job.robotId === "robot-1" ? "GPT" : "Claude";

              return (
                <div
                  key={job.id}
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  style={{
                    background: "#1a1a2e",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "8px",
                    cursor: "pointer",
                    border: `1px solid ${statusInfo.color}30`,
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    direction: "rtl",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: "white",
                        fontSize: "13px",
                        marginBottom: "4px",
                        direction: "rtl",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: isExpanded ? "normal" : "nowrap",
                        maxWidth: "280px",
                      }}>
                        {job.message}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "11px" }}>
                        <span style={{ color: statusInfo.color }}>
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                        <span style={{ color: "#666" }}>|</span>
                        <span style={{ color: "#888" }}>{robotName}</span>
                        <span style={{ color: "#666" }}>|</span>
                        <span style={{ color: "#888" }}>{formatTime(job.createdAt)}</span>
                      </div>
                    </div>
                    <span style={{ color: "#666", fontSize: "16px", marginRight: "8px" }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {isExpanded && job.status === "completed" && job.result && (
                    <div style={{
                      marginTop: "10px",
                      padding: "10px",
                      background: "#0d0d1a",
                      borderRadius: "8px",
                      color: "#ddd",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      direction: "rtl",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}>
                      {job.result}
                    </div>
                  )}

                  {isExpanded && job.status === "failed" && job.error && (
                    <div style={{
                      marginTop: "10px",
                      padding: "10px",
                      background: "#1a0d0d",
                      borderRadius: "8px",
                      color: "#ef5350",
                      fontSize: "13px",
                      direction: "rtl",
                    }}>
                      خطأ: {job.error}
                    </div>
                  )}

                  {isExpanded && job.toolsUsed.length > 0 && (
                    <div style={{
                      marginTop: "6px",
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                    }}>
                      {job.toolsUsed.map((tool, i) => (
                        <span key={i} style={{
                          background: "#7c4dff20",
                          color: "#7c4dff",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "10px",
                        }}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}

                  {isExpanded && job.status === "running" && (
                    <div style={{
                      marginTop: "10px",
                      color: "#42a5f5",
                      fontSize: "13px",
                      textAlign: "center",
                      direction: "rtl",
                    }}>
                      ⚙️ جاري التنفيذ... يمكنك إغلاق الصفحة والرجوع لاحقاً
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 5px #7c4dff40; }
          50% { box-shadow: 0 0 20px #7c4dff80; }
        }
      `}</style>
    </>
  );
}
