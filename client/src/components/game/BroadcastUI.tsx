import { useState, useRef, useEffect } from "react";
import { useChat } from "@/lib/stores/useChat";
import { useGame, getModelColor, getHallWorkerColor } from "@/lib/stores/useGame";

export function BroadcastUI() {
  const { isBroadcast, broadcastResults, startBroadcast, closeBroadcast, robotScreens } = useChat();
  const models      = useGame((s) => s.models);
  const hallWorkers = useGame((s) => s.hallWorkers);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const allRobots = [
    ...models.map((m, i)      => ({ id: m.id, name: m.alias || m.name, color: getModelColor(i),       type: "model"  as const })),
    ...hallWorkers.map((w, i) => ({ id: w.id, name: w.alias || w.name, color: getHallWorkerColor(i),  type: "worker" as const })),
  ];

  useEffect(() => {
    if (isBroadcast) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isBroadcast]);

  if (!isBroadcast) return null;

  const handleSend = async () => {
    if (!inputText.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const ids = allRobots.map(r => r.id);
    await startBroadcast(inputText.trim(), ids);
    sendingRef.current = false;
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") closeBroadcast();
  };

  const hasResults = Object.keys(broadcastResults).length > 0;
  const totalRobots = allRobots.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeBroadcast(); }}
    >
      <div style={{
        background: "rgba(10, 10, 30, 0.98)",
        borderRadius: "18px",
        border: "2px solid #6366f1",
        padding: "24px",
        width: "680px",
        maxWidth: "95vw",
        maxHeight: "88vh",
        overflow: "auto",
        boxShadow: "0 0 60px #6366f140",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "18px", direction: "rtl",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "#6366f120", border: "2px solid #6366f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
            }}>💬</div>
            <div>
              <div style={{ color: "white", fontSize: "20px", fontWeight: "bold" }}>محادثة جماعية</div>
              <div style={{ color: "#818cf8", fontSize: "14px" }}>
                {totalRobots} روبوت يرد عليك في آنٍ واحد
              </div>
            </div>
          </div>
          <button
            onClick={closeBroadcast}
            style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer", padding: "4px 8px" }}
          >✕</button>
        </div>

        {/* Robot chips */}
        {allRobots.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px", direction: "rtl" }}>
            {allRobots.map(r => (
              <span key={r.id} style={{
                background: `${r.color}18`,
                border: `1px solid ${r.color}50`,
                borderRadius: "20px",
                padding: "5px 14px",
                color: r.color,
                fontSize: "14px",
                fontWeight: "bold",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: r.color, display: "inline-block" }} />
                {r.name || (r.type === "model" ? "Model" : "Worker")}
              </span>
            ))}
          </div>
        )}

        {totalRobots === 0 && (
          <div style={{
            background: "#1a1a2e", borderRadius: "10px", padding: "16px",
            color: "#666", fontSize: "13px", textAlign: "center", direction: "rtl",
            marginBottom: "14px",
          }}>
            لا يوجد روبوتات — أضف موديلات من إعدادات الخزنة
          </div>
        )}

        {/* Input */}
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="اكتب رسالتك... (Enter للإرسال، Shift+Enter لسطر جديد)"
          rows={3}
          style={{
            width: "100%",
            background: "#1a1a2e",
            border: "1px solid #6366f150",
            borderRadius: "10px",
            padding: "14px 18px",
            color: "white",
            fontSize: "17px",
            resize: "vertical",
            direction: "rtl",
            outline: "none",
            fontFamily: "Inter, sans-serif",
            boxSizing: "border-box",
            lineHeight: "1.5",
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending || totalRobots === 0}
          style={{
            width: "100%",
            marginTop: "10px",
            background: sending ? "#333" : "#6366f1",
            border: "none",
            borderRadius: "10px",
            padding: "15px",
            color: "white",
            fontSize: "17px",
            fontWeight: "bold",
            cursor: !inputText.trim() || sending || totalRobots === 0 ? "not-allowed" : "pointer",
            opacity: !inputText.trim() || totalRobots === 0 ? 0.5 : 1,
            transition: "all 0.2s",
            direction: "rtl",
          }}
        >
          {sending
            ? `⏳ جاري الإرسال لـ ${totalRobots} روبوت...`
            : `💬 أرسل للكل (${totalRobots} روبوت)`}
        </button>

        {/* Results */}
        {hasResults && (
          <div style={{ marginTop: "20px" }}>
            <div style={{ color: "#6366f1", fontSize: "15px", fontWeight: "bold", marginBottom: "10px", direction: "rtl" }}>
              الردود ({Object.keys(broadcastResults).length}/{totalRobots}):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {allRobots.map((robot) => {
                const response = broadcastResults[robot.id];
                const isStreaming = robotScreens[robot.id] && !broadcastResults[robot.id];
                const content = response || robotScreens[robot.id] || "";
                if (!content) return null;
                return (
                  <div key={robot.id} style={{
                    background: "#0f0f1e",
                    borderRadius: "10px",
                    padding: "14px 18px",
                    border: `1px solid ${robot.color}40`,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      marginBottom: "8px", direction: "rtl",
                    }}>
                      <span style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: robot.color, display: "inline-block",
                        boxShadow: isStreaming ? `0 0 6px ${robot.color}` : "none",
                        animation: isStreaming ? "pulse 1s infinite" : "none",
                      }} />
                      <span style={{ color: robot.color, fontSize: "15px", fontWeight: "bold" }}>
                        {robot.name || (robot.type === "model" ? "Model" : "Worker")}
                      </span>
                      {isStreaming && (
                        <span style={{ color: "#777", fontSize: "13px" }}>يكتب...</span>
                      )}
                    </div>
                    <div style={{
                      color: "#e4e4e8", fontSize: "16px",
                      lineHeight: "1.7", direction: "rtl",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      maxHeight: "260px", overflowY: "auto",
                    }}>
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
