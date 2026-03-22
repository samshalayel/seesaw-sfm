import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/utils";

interface TriggerConfig {
  enabled: boolean;
  watchUserId: number | null;
  watchStatuses: string[];
  intervalMinutes: number;
  robotId: string;
  doneStatus: string;
}

interface TriggerLog {
  id: string;
  taskId: string;
  taskName: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string;
  toolsUsed: string[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

interface Member {
  id: number;
  username: string;
  email: string;
}

export function AutoTriggerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<TriggerConfig | null>(null);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [interval, setIntervalVal] = useState(5);
  const [selectedRobot, setSelectedRobot] = useState("robot-1");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await apiFetch("/api/auto-trigger/config");
      const data = await res.json();
      setConfig(data);
      if (data.watchUserId) setSelectedUser(data.watchUserId);
      if (data.intervalMinutes) setIntervalVal(data.intervalMinutes);
      if (data.robotId) setSelectedRobot(data.robotId);
    } catch (_e) {}
  };

  const fetchLogs = async () => {
    try {
      const res = await apiFetch("/api/auto-trigger/logs");
      const data = await res.json();
      setLogs(data);
    } catch (_e) {}
  };

  const fetchMembers = async () => {
    try {
      const res = await apiFetch("/api/clickup/members");
      const data = await res.json();
      setMembers(data);
    } catch (_e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchLogs();
      fetchMembers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      fetchConfig();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleStart = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await apiFetch("/api/auto-trigger/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          intervalMinutes: interval,
          robotId: selectedRobot,
        }),
      });
      await fetchConfig();
    } catch (_e) {}
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/auto-trigger/stop", { method: "POST" });
      await fetchConfig();
    } catch (_e) {}
    setLoading(false);
  };

  const handleScanNow = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/auto-trigger/scan", { method: "POST" });
      setTimeout(fetchLogs, 2000);
    } catch (_e) {}
    setLoading(false);
  };

  const handleClearCache = async () => {
    try {
      await apiFetch("/api/auto-trigger/clear-cache", { method: "POST" });
    } catch (_e) {}
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "running": return { label: "قيد التنفيذ", color: "#42a5f5", icon: "⚙️" };
      case "completed": return { label: "تم", color: "#66bb6a", icon: "✅" };
      case "failed": return { label: "فشل", color: "#ef5350", icon: "❌" };
      default: return { label: status, color: "#999", icon: "⏳" };
    }
  };

  const isRunning = config?.enabled || false;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          background: isRunning ? "rgba(40, 100, 40, 0.9)" : "rgba(15, 15, 25, 0.9)",
          border: `2px solid ${isRunning ? "#66bb6a" : "#ff9800"}`,
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
          animation: isRunning ? "triggerPulse 2s infinite" : "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>{isRunning ? "🤖" : "⚡"}</span>
        <span>{isRunning ? "المراقب شغال" : "المراقب التلقائي"}</span>
        {isRunning && (
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#66bb6a",
            animation: "blink 1s infinite",
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "60px",
          right: "16px",
          width: "420px",
          maxHeight: "550px",
          background: "rgba(15, 15, 25, 0.95)",
          borderRadius: "16px",
          border: `2px solid ${isRunning ? "#66bb6a" : "#ff9800"}`,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, sans-serif",
          zIndex: 95,
          boxShadow: `0 0 30px ${isRunning ? "#66bb6a40" : "#ff980040"}`,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: `1px solid ${isRunning ? "#66bb6a40" : "#ff980040"}`,
          }}>
            <span style={{ color: "white", fontSize: "16px", fontWeight: "bold", direction: "rtl" }}>
              ⚡ المراقب التلقائي
            </span>
            <button onClick={() => setIsOpen(false)} style={{
              background: "none", border: "none", color: "#888", fontSize: "18px", cursor: "pointer",
            }}>X</button>
          </div>

          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            maxHeight: "470px",
          }}>
            {!isRunning ? (
              <div style={{ direction: "rtl" }}>
                <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "12px" }}>
                  المراقب التلقائي يفحص ClickUp كل فترة ولما يلاقي مهمة جديدة مسندة لشخص معين، ينفذها تلقائياً بدون ما تكون موجود.
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    راقب مهام مسندة لـ:
                  </label>
                  <select
                    value={selectedUser || ""}
                    onChange={(e) => setSelectedUser(Number(e.target.value) || null)}
                    style={{
                      width: "100%",
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "white",
                      fontSize: "13px",
                      direction: "rtl",
                    }}
                  >
                    <option value="">اختر عضو الفريق</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.username} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    فحص كل (دقائق):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={interval}
                    onChange={(e) => setIntervalVal(Number(e.target.value))}
                    style={{
                      width: "80px",
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "white",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    نفذ باستخدام:
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setSelectedRobot("robot-1")}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: selectedRobot === "robot-1" ? "2px solid #4fc3f7" : "1px solid #333",
                        background: selectedRobot === "robot-1" ? "#4fc3f720" : "#1a1a2e",
                        color: "white",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      GPT-4o
                    </button>
                    <button
                      onClick={() => setSelectedRobot("robot-2")}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: selectedRobot === "robot-2" ? "2px solid #66bb6a" : "1px solid #333",
                        background: selectedRobot === "robot-2" ? "#66bb6a20" : "#1a1a2e",
                        color: "white",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Claude
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleStart}
                  disabled={!selectedUser || loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: !selectedUser || loading ? "#333" : "#66bb6a",
                    color: "white",
                    fontSize: "15px",
                    fontWeight: "bold",
                    cursor: !selectedUser || loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "..." : "شغّل المراقب"}
                </button>
              </div>
            ) : (
              <div style={{ direction: "rtl" }}>
                <div style={{
                  background: "#1a2e1a",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "12px",
                  border: "1px solid #66bb6a30",
                }}>
                  <div style={{ color: "#66bb6a", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>
                    🤖 المراقب شغال
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    يراقب: {members.find(m => m.id === config?.watchUserId)?.username || config?.watchUserId}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    يفحص كل: {config?.intervalMinutes} دقائق
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    الحالات: {config?.watchStatuses?.join(", ")}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    الروبوت: {config?.robotId === "robot-1" ? "GPT-4o" : "Claude"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <button
                    onClick={handleScanNow}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #42a5f5",
                      background: "#42a5f520",
                      color: "#42a5f5",
                      fontSize: "12px",
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    افحص الحين
                  </button>
                  <button
                    onClick={handleClearCache}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #666",
                      background: "transparent",
                      color: "#999",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    إعادة فحص الكل
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid #ef5350",
                      background: "#ef535020",
                      color: "#ef5350",
                      fontSize: "12px",
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    أوقف المراقب
                  </button>
                </div>

                <div style={{ color: "#ddd", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
                  سجل التنفيذ:
                </div>

                {logs.length === 0 && (
                  <div style={{ color: "#666", textAlign: "center", padding: "20px", fontSize: "13px" }}>
                    ما في مهام تم تنفيذها بعد. المراقب يفحص كل {config?.intervalMinutes} دقائق.
                  </div>
                )}

                {logs.map(log => {
                  const statusInfo = getStatusInfo(log.status);
                  const isExpanded = expandedLog === log.id;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      style={{
                        background: "#1a1a2e",
                        borderRadius: "10px",
                        padding: "10px",
                        marginBottom: "6px",
                        cursor: "pointer",
                        border: `1px solid ${statusInfo.color}30`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: "white",
                            fontSize: "13px",
                            marginBottom: "3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: isExpanded ? "normal" : "nowrap",
                            maxWidth: "300px",
                          }}>
                            {log.taskName}
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px" }}>
                            <span style={{ color: statusInfo.color }}>{statusInfo.icon} {statusInfo.label}</span>
                            <span style={{ color: "#666" }}>|</span>
                            <span style={{ color: "#888" }}>{formatTime(log.startedAt)}</span>
                          </div>
                        </div>
                        <span style={{ color: "#666", fontSize: "14px" }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>

                      {isExpanded && log.result && (
                        <div style={{
                          marginTop: "8px",
                          padding: "8px",
                          background: "#0d0d1a",
                          borderRadius: "6px",
                          color: "#ddd",
                          fontSize: "12px",
                          lineHeight: "1.5",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxHeight: "150px",
                          overflowY: "auto",
                        }}>
                          {log.result}
                        </div>
                      )}

                      {isExpanded && log.error && (
                        <div style={{
                          marginTop: "8px",
                          padding: "8px",
                          background: "#1a0d0d",
                          borderRadius: "6px",
                          color: "#ef5350",
                          fontSize: "12px",
                        }}>
                          خطأ: {log.error}
                        </div>
                      )}

                      {isExpanded && log.toolsUsed.length > 0 && (
                        <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {log.toolsUsed.map((tool, i) => (
                            <span key={i} style={{
                              background: "#ff980020",
                              color: "#ff9800",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                            }}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes triggerPulse {
          0%, 100% { box-shadow: 0 0 5px #66bb6a40; }
          50% { box-shadow: 0 0 20px #66bb6a80; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
