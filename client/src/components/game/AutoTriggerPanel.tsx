import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/utils";

interface TriggerConfig {
  enabled: boolean;
  watchUserId: number | null;
  watchStatuses: string[];
  intervalMinutes: number;
  robotId: string;
  doneStatus: string;
  parallelMode: boolean;
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
  modelUsed?: string;
}

interface Member {
  id: number;
  username: string;
  email: string;
}

interface VaultModel {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "gemini";
}

const PROVIDER_COLOR: Record<string, string> = {
  openai:    "#74aa9c",
  anthropic: "#c084fc",
  gemini:    "#4fc3f7",
};

const PROVIDER_ICON: Record<string, string> = {
  openai:    "🟢",
  anthropic: "🟣",
  gemini:    "🔵",
};

export function AutoTriggerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<TriggerConfig | null>(null);
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [vaultModels, setVaultModels] = useState<VaultModel[]>([]);

  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [interval, setIntervalVal] = useState(5);
  const [selectedRobot, setSelectedRobot] = useState("robot-1");
  const [parallelMode, setParallelMode] = useState(false);
  const [whatsappNotify, setWhatsappNotify] = useState(false);

  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await apiFetch("/api/auto-trigger/config");
      const data = await res.json();
      setConfig(data);
      if (data.watchUserId)   setSelectedUser(data.watchUserId);
      if (data.intervalMinutes) setIntervalVal(data.intervalMinutes);
      if (data.robotId)       setSelectedRobot(data.robotId);
      if (data.parallelMode    !== undefined) setParallelMode(data.parallelMode);
      if (data.whatsappNotify  !== undefined) setWhatsappNotify(data.whatsappNotify);
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

  const fetchVaultModels = async () => {
    setModelsLoading(true);
    try {
      const res = await apiFetch("/api/auto-trigger/vault-models");
      const data = await res.json();
      setVaultModels(Array.isArray(data) ? data : []);
    } catch (_e) {
      setVaultModels([]);
    }
    setModelsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchLogs();
      fetchMembers();
      fetchVaultModels();
    }
  }, [isOpen]);

  // تحديث دوري
  useEffect(() => {
    if (!isOpen) return;
    const iv = setInterval(() => {
      fetchConfig();
      fetchLogs();
    }, 5000);
    return () => clearInterval(iv);
  }, [isOpen]);

  // إعادة جلب الموديلات عند تفعيل وضع التوازي
  useEffect(() => {
    if (parallelMode && isOpen) fetchVaultModels();
  }, [parallelMode]);

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
          parallelMode,
          whatsappNotify,
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

  const handleCancelLog = async (logId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // لا نفتح/نغلق الـ card
    setCancellingId(logId);
    try {
      await apiFetch(`/api/auto-trigger/cancel/${logId}`, { method: "POST" });
      await fetchLogs();
    } catch (_e) {}
    setCancellingId(null);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "running":   return { label: "قيد التنفيذ", color: "#42a5f5", icon: "⚙️" };
      case "completed": return { label: "تم",          color: "#66bb6a", icon: "✅" };
      case "failed":    return { label: "فشل",         color: "#ef5350", icon: "❌" };
      default:          return { label: status,         color: "#999",    icon: "⏳" };
    }
  };

  const isRunning = config?.enabled || false;
  const isParallel = config?.parallelMode || false;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "absolute", top: "16px", right: "16px",
          background: isRunning
            ? (isParallel ? "rgba(60, 20, 90, 0.9)" : "rgba(40, 100, 40, 0.9)")
            : "rgba(15, 15, 25, 0.9)",
          border: `2px solid ${isRunning ? (isParallel ? "#c084fc" : "#66bb6a") : "#ff9800"}`,
          borderRadius: "12px", padding: "8px 16px",
          color: "white", fontSize: "14px", cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: "8px",
          zIndex: 90,
          animation: isRunning ? "triggerPulse 2s infinite" : "none",
        }}
      >
        <span style={{ fontSize: "18px" }}>{isRunning ? (isParallel ? "🔀" : "🤖") : "⚡"}</span>
        <span>{isRunning ? (isParallel ? "متوازي شغال" : "المراقب شغال") : "المراقب التلقائي"}</span>
        {isRunning && (
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: isParallel ? "#c084fc" : "#66bb6a",
            animation: "blink 1s infinite",
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "60px", right: "16px",
          width: "440px", maxHeight: "580px",
          background: "rgba(15, 15, 25, 0.97)",
          borderRadius: "16px",
          border: `2px solid ${isRunning ? (isParallel ? "#c084fc" : "#66bb6a") : "#ff9800"}`,
          display: "flex", flexDirection: "column",
          fontFamily: "Inter, sans-serif", zIndex: 95,
          boxShadow: `0 0 30px ${isRunning ? (isParallel ? "#c084fc40" : "#66bb6a40") : "#ff980040"}`,
        }}>
          {/* Header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px",
            borderBottom: `1px solid ${isRunning ? (isParallel ? "#c084fc40" : "#66bb6a40") : "#ff980040"}`,
          }}>
            <span style={{ color: "white", fontSize: "16px", fontWeight: "bold", direction: "rtl" }}>
              {isParallel ? "🔀 المراقب المتوازي" : "⚡ المراقب التلقائي"}
            </span>
            <button onClick={() => setIsOpen(false)} style={{
              background: "none", border: "none", color: "#888", fontSize: "18px", cursor: "pointer",
            }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", maxHeight: "510px" }}>
            {!isRunning ? (
              /* ─── لوحة الإعداد ────────────────────────────────────────────── */
              <div style={{ direction: "rtl" }}>
                <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "14px" }}>
                  يفحص ClickUp دورياً ويُنفّذ المهام الجديدة تلقائياً.
                </div>

                {/* عضو الفريق */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    راقب مهام مسندة لـ:
                  </label>
                  <select
                    value={selectedUser || ""}
                    onChange={(e) => setSelectedUser(Number(e.target.value) || null)}
                    style={{
                      width: "100%", background: "#1a1a2e",
                      border: "1px solid #333", borderRadius: "8px",
                      padding: "8px 12px", color: "white", fontSize: "13px", direction: "rtl",
                    }}
                  >
                    <option value="">اختر عضو الفريق</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.username} ({m.email})</option>
                    ))}
                  </select>
                </div>

                {/* الفترة الزمنية */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                    فحص كل (دقائق):
                  </label>
                  <input
                    type="number" min={1} max={60} value={interval}
                    onChange={(e) => setIntervalVal(Number(e.target.value))}
                    style={{
                      width: "80px", background: "#1a1a2e", border: "1px solid #333",
                      borderRadius: "8px", padding: "8px 12px", color: "white",
                      fontSize: "13px", textAlign: "center",
                    }}
                  />
                </div>

                {/* ─── مفتاح وضع التوازي ─── */}
                <div style={{
                  background: parallelMode ? "rgba(192,132,252,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${parallelMode ? "#c084fc40" : "#333"}`,
                  borderRadius: "10px", padding: "12px", marginBottom: "14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#ddd", fontSize: "13px", fontWeight: "bold" }}>
                        🔀 وضع التوازي
                      </div>
                      <div style={{ color: "#888", fontSize: "11px", marginTop: "2px" }}>
                        كل مهمة على موديل مختلف من الخزنة بنفس الوقت
                      </div>
                    </div>
                    <button
                      onClick={() => setParallelMode(p => !p)}
                      style={{
                        width: "44px", height: "24px", borderRadius: "12px",
                        border: "none", cursor: "pointer",
                        background: parallelMode ? "#c084fc" : "#333",
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: "3px", left: parallelMode ? "22px" : "3px",
                        width: "18px", height: "18px",
                        borderRadius: "50%", background: "white",
                        transition: "left 0.2s",
                      }} />
                    </button>
                  </div>

                  {/* عرض الموديلات المتاحة */}
                  {parallelMode && (
                    <div style={{ marginTop: "10px" }}>
                      {modelsLoading ? (
                        <div style={{ color: "#888", fontSize: "12px" }}>جارٍ جلب الموديلات...</div>
                      ) : vaultModels.length === 0 ? (
                        <div style={{
                          color: "#ef5350", fontSize: "12px",
                          background: "#1a0d0d", borderRadius: "6px", padding: "8px",
                        }}>
                          ⚠ لا يوجد موديلات بـ API Key في الخزنة. أضف موديلاً أولاً.
                        </div>
                      ) : (
                        <>
                          <div style={{ color: "#aaa", fontSize: "11px", marginBottom: "6px" }}>
                            الموديلات المتاحة ({vaultModels.length} — الحد الأقصى للتوازي):
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {vaultModels.map((m, i) => (
                              <div key={m.id} style={{
                                display: "flex", alignItems: "center", gap: "5px",
                                background: `${PROVIDER_COLOR[m.provider]}15`,
                                border: `1px solid ${PROVIDER_COLOR[m.provider]}40`,
                                borderRadius: "6px", padding: "4px 8px", fontSize: "12px",
                                color: PROVIDER_COLOR[m.provider],
                              }}>
                                {PROVIDER_ICON[m.provider]} {m.name}
                                <span style={{ color: "#555", fontSize: "10px" }}>#{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── مفتاح إشعارات واتساب ─── */}
                <div style={{
                  background: whatsappNotify ? "rgba(37,211,102,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${whatsappNotify ? "#25d36640" : "#333"}`,
                  borderRadius: "10px", padding: "10px 12px", marginBottom: "14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ color: "#ddd", fontSize: "13px", fontWeight: "bold" }}>
                      💬 إشعارات واتساب
                    </div>
                    <div style={{ color: "#888", fontSize: "11px", marginTop: "2px" }}>
                      {whatsappNotify ? "يُرسل ملخص بعد كل مهمة ✅" : "لا يُرسل إلا لو المهمة طلبت"}
                    </div>
                  </div>
                  <button
                    onClick={() => setWhatsappNotify(p => !p)}
                    style={{
                      width: "44px", height: "24px", borderRadius: "12px",
                      border: "none", cursor: "pointer",
                      background: whatsappNotify ? "#25d366" : "#333",
                      position: "relative", transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      top: "3px", left: whatsappNotify ? "22px" : "3px",
                      width: "18px", height: "18px",
                      borderRadius: "50%", background: "white",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>

                {/* اختيار الموديل في وضع التسلسل */}
                {!parallelMode && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ color: "#ddd", fontSize: "13px", display: "block", marginBottom: "6px" }}>
                      نفذ باستخدام:
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {[
                        { id: "robot-1", label: "GPT-4o",  color: "#74aa9c" },
                        { id: "robot-2", label: "Claude",  color: "#c084fc" },
                        { id: "robot-4", label: "Gemini",  color: "#4fc3f7" },
                        { id: "robot-3", label: "CLI",     color: "#ff9800" },
                      ].map(r => (
                        <button key={r.id}
                          onClick={() => setSelectedRobot(r.id)}
                          style={{
                            flex: 1, padding: "8px", borderRadius: "8px",
                            border: selectedRobot === r.id ? `2px solid ${r.color}` : "1px solid #333",
                            background: selectedRobot === r.id ? `${r.color}20` : "#1a1a2e",
                            color: "white", fontSize: "12px", cursor: "pointer",
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={!selectedUser || loading || (parallelMode && vaultModels.length === 0)}
                  style={{
                    width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                    background: !selectedUser || loading || (parallelMode && vaultModels.length === 0)
                      ? "#333"
                      : parallelMode ? "#c084fc" : "#66bb6a",
                    color: "white", fontSize: "15px", fontWeight: "bold",
                    cursor: !selectedUser || loading || (parallelMode && vaultModels.length === 0)
                      ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "..." : parallelMode ? `🔀 شغّل المتوازي (${vaultModels.length} موديل)` : "🤖 شغّل المراقب"}
                </button>
              </div>
            ) : (
              /* ─── لوحة الحالة أثناء التشغيل ─────────────────────────────── */
              <div style={{ direction: "rtl" }}>
                <div style={{
                  background: isParallel ? "#1a0e2e" : "#1a2e1a",
                  borderRadius: "10px", padding: "12px", marginBottom: "12px",
                  border: `1px solid ${isParallel ? "#c084fc30" : "#66bb6a30"}`,
                }}>
                  <div style={{ color: isParallel ? "#c084fc" : "#66bb6a", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>
                    {isParallel ? "🔀 وضع التوازي شغّال" : "🤖 المراقب شغّال"}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    يراقب: {members.find(m => m.id === config?.watchUserId)?.username || config?.watchUserId}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    يفحص كل: {config?.intervalMinutes} دقائق
                  </div>
                  {isParallel ? (
                    <div style={{ color: "#aaa", fontSize: "12px" }}>
                      الحد الأقصى: {vaultModels.length || "..."} مهام متوازية
                    </div>
                  ) : (
                    <div style={{ color: "#aaa", fontSize: "12px" }}>
                      الروبوت: {config?.robotId === "robot-1" ? "GPT-4o" : config?.robotId === "robot-2" ? "Claude" : config?.robotId === "robot-4" ? "Gemini" : "CLI"}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: config?.whatsappNotify ? "#25d366" : "#666" }}>
                    💬 واتساب: {config?.whatsappNotify ? "إشعارات تلقائية ✅" : "يدوي فقط"}
                  </div>
                </div>

                {/* عرض موديلات الخزنة في وضع التوازي */}
                {isParallel && vaultModels.length > 0 && (
                  <div style={{ marginBottom: "10px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {vaultModels.map((m, i) => (
                      <div key={m.id} style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        background: `${PROVIDER_COLOR[m.provider]}12`,
                        border: `1px solid ${PROVIDER_COLOR[m.provider]}35`,
                        borderRadius: "5px", padding: "3px 8px", fontSize: "11px",
                        color: PROVIDER_COLOR[m.provider],
                      }}>
                        {PROVIDER_ICON[m.provider]} {m.name}
                        <span style={{ color: "#444" }}>#{i + 1}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <button onClick={handleScanNow} disabled={loading} style={{
                    flex: 1, padding: "8px", borderRadius: "8px",
                    border: "1px solid #42a5f5", background: "#42a5f520",
                    color: "#42a5f5", fontSize: "12px", cursor: loading ? "not-allowed" : "pointer",
                  }}>افحص الحين</button>
                  <button onClick={handleClearCache} style={{
                    flex: 1, padding: "8px", borderRadius: "8px",
                    border: "1px solid #666", background: "transparent",
                    color: "#999", fontSize: "12px", cursor: "pointer",
                  }}>إعادة فحص الكل</button>
                  <button onClick={handleStop} disabled={loading} style={{
                    flex: 1, padding: "8px", borderRadius: "8px",
                    border: "1px solid #ef5350", background: "#ef535020",
                    color: "#ef5350", fontSize: "12px", cursor: loading ? "not-allowed" : "pointer",
                  }}>أوقف</button>
                </div>

                {/* ─── سجل التنفيذ ─── */}
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
                  const modelColor = log.modelUsed
                    ? (PROVIDER_COLOR[vaultModels.find(m => m.name === log.modelUsed)?.provider || ""] || "#888")
                    : "#888";

                  return (
                    <div key={log.id}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      style={{
                        background: "#1a1a2e", borderRadius: "10px",
                        padding: "10px", marginBottom: "6px", cursor: "pointer",
                        border: `1px solid ${statusInfo.color}30`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: "white", fontSize: "13px", marginBottom: "3px",
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: isExpanded ? "normal" : "nowrap", maxWidth: "300px",
                          }}>
                            {log.taskName}
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px" }}>
                            <span style={{ color: statusInfo.color }}>{statusInfo.icon} {statusInfo.label}</span>
                            {log.modelUsed && (
                              <>
                                <span style={{ color: "#444" }}>|</span>
                                <span style={{ color: modelColor }}>✦ {log.modelUsed}</span>
                              </>
                            )}
                            <span style={{ color: "#444" }}>|</span>
                            <span style={{ color: "#888" }}>{formatTime(log.startedAt)}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {log.status === "running" && (
                            <button
                              onClick={(e) => handleCancelLog(log.id, e)}
                              disabled={cancellingId === log.id}
                              title="أوقف هذه المهمة"
                              style={{
                                background: cancellingId === log.id ? "#333" : "#ef535025",
                                border: `1px solid ${cancellingId === log.id ? "#555" : "#ef5350"}`,
                                borderRadius: "6px",
                                padding: "3px 8px",
                                color: cancellingId === log.id ? "#888" : "#ef5350",
                                fontSize: "11px",
                                cursor: cancellingId === log.id ? "wait" : "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {cancellingId === log.id ? "..." : "⬛ إيقاف"}
                            </button>
                          )}
                          <span style={{ color: "#666", fontSize: "14px" }}>{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {isExpanded && log.result && (
                        <div style={{
                          marginTop: "8px", padding: "8px", background: "#0d0d1a",
                          borderRadius: "6px", color: "#ddd", fontSize: "12px",
                          lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word",
                          maxHeight: "150px", overflowY: "auto",
                        }}>
                          {log.result}
                        </div>
                      )}

                      {isExpanded && log.error && (
                        <div style={{
                          marginTop: "8px", padding: "8px", background: "#1a0d0d",
                          borderRadius: "6px", color: "#ef5350", fontSize: "12px",
                        }}>
                          خطأ: {log.error}
                        </div>
                      )}

                      {isExpanded && log.toolsUsed.length > 0 && (
                        <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {log.toolsUsed.map((tool, i) => (
                            <span key={i} style={{
                              background: "#ff980020", color: "#ff9800",
                              padding: "2px 6px", borderRadius: "4px", fontSize: "10px",
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
          0%, 100% { box-shadow: 0 0 5px rgba(192,132,252,0.3); }
          50%       { box-shadow: 0 0 20px rgba(192,132,252,0.7); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
