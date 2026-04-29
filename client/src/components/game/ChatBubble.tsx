import { useChat } from "@/lib/stores/useChat";
import { useGame, getModelColor } from "@/lib/stores/useGame";
import { apiFetch } from "@/lib/utils";
import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";

export function ChatBubble() {
  const { isOpen, activeRobotId, messages, isLoading, inputText, setInputText, sendMessage, closeChat, activeProjectKey, setActiveProject, pendingImage, setPendingImage, sessionUsage } = useChat();
  const models = useGame((s) => s.models);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgSending, setBgSending] = useState(false);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showSlotsPanel, setShowSlotsPanel]     = useState(false);
  const [projectInput, setProjectInput] = useState("");
  const [projects, setProjects] = useState<Array<{ id: number; projectKey: string; name: string }>>([]);

  // Pipeline slots state
  const SLOT_NAMES = ["PD","S0","S1","S2","S3","S4","S5","S6"] as const;
  type SlotName = typeof SLOT_NAMES[number];
  const [slots, setSlots] = useState<Record<SlotName, string>>({ PD:"",S0:"",S1:"",S2:"",S3:"",S4:"",S5:"",S6:"" });
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsSaving, setSlotsSaving] = useState<SlotName | null>(null);
  const [size, setSize] = useState({ width: 420, height: 500 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; dir: string } | null>(null);

  const handleImagePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // reset so same file can be picked again
    e.target.value = "";
  };

  const sendToBackground = async () => {
    if (!inputText.trim() || bgSending) return;
    const msgText = inputText.trim();
    setBgSending(true);
    try {
      const currentMsgs = useChat.getState().messages;
      useChat.setState({
        messages: [...currentMsgs, { role: "user", content: msgText }],
        inputText: "",
      });
      setInputText("");

      const res = await apiFetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText, robotId: activeRobotId }),
      });

      if (!res.ok) throw new Error("Failed");

      useChat.setState({
        messages: [...useChat.getState().messages, { role: "assistant", content: "تم إرسال المهمة للتنفيذ بالخلفية. يمكنك إغلاق الصفحة والرجوع لاحقاً لرؤية النتيجة من زر 📋 المهام الخلفية" }],
      });
    } catch (_e) {
      useChat.setState({
        messages: [...useChat.getState().messages, { role: "assistant", content: "حدث خطأ في إرسال المهمة" }],
      });
    }
    setBgSending(false);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
      dir,
    };
  }, [size]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, button')) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isResizing && !isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragRef.current) {
        const { startX, startY, startPosX, startPosY } = dragRef.current;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        setPosition({ x: startPosX + deltaX, y: startPosY + deltaY });
      }
      if (isResizing && resizeRef.current) {
        const { startX, startY, startW, startH, dir } = resizeRef.current;
        let newW = startW;
        let newH = startH;

        if (dir.includes("e")) newW = Math.max(320, Math.min(900, startW + (e.clientX - startX)));
        if (dir.includes("w")) newW = Math.max(320, Math.min(900, startW - (e.clientX - startX)));
        if (dir.includes("s")) newH = Math.max(300, Math.min(800, startH + (e.clientY - startY)));
        if (dir.includes("n")) newH = Math.max(300, Math.min(800, startH - (e.clientY - startY)));

        setSize({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, isDragging]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (isOpen && !isLoading && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, isLoading]);

  // تحميل قائمة المشاريع
  useEffect(() => {
    if (!isOpen) return;
    apiFetch("/api/projects").then(r => r.json()).then(setProjects).catch(() => {});
  }, [isOpen, showProjectPanel]);

  // تحميل السلوتات + ملفات الريبو لما تفتح لوحة الملفات
  useEffect(() => {
    if (!showSlotsPanel || !activeProjectKey) return;
    setSlotsLoading(true);
    Promise.all([
      apiFetch(`/api/projects/${activeProjectKey}/slots`).then(r => r.json()),
      apiFetch("/api/github/repos").then(r => r.json()).catch(() => []),
    ]).then(([slotsData, _repos]) => {
      // سلوتات من الـ DB
      const raw = slotsData.slots || {};
      const filled: Record<SlotName, string> = { PD:"",S0:"",S1:"",S2:"",S3:"",S4:"",S5:"",S6:"" };
      for (const s of SLOT_NAMES) {
        filled[s] = raw[s]?.filename || "";
      }
      setSlots(filled);
    }).catch(() => {}).finally(() => setSlotsLoading(false));
  }, [showSlotsPanel, activeProjectKey]);

  // جلب ملفات مجلد الريبو (لقائمة الاختيار)
  const loadRepoFiles = async (path = "") => {
    try {
      const r = await apiFetch(`/api/github/contents?path=${encodeURIComponent(path)}`);
      if (!r.ok) return;
      const data = await r.json();
      const jsonFiles = Array.isArray(data)
        ? data.filter((f: any) => f.type === "file" && f.name.endsWith(".json")).map((f: any) => f.name)
        : [];
      setRepoFiles(jsonFiles);
    } catch { }
  };

  const saveSlot = async (slot: SlotName, filename: string) => {
    if (!activeProjectKey || !filename.trim()) return;
    setSlotsSaving(slot);
    try {
      await apiFetch(`/api/projects/${activeProjectKey}/slots/${slot}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: filename.trim(), githubPath: filename.trim() }),
      });
      setSlots(prev => ({ ...prev, [slot]: filename.trim() }));
    } catch { }
    setSlotsSaving(null);
  };

  const handleCreateProject = async () => {
    const key = projectInput.trim().toUpperCase().slice(0, 6);
    if (!key) return;
    const res = await apiFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectKey: key }),
    });
    if (res.ok) {
      const row = await res.json();
      setActiveProject(row.projectKey);
      setProjectInput("");
      setShowProjectPanel(false);
      const list = await apiFetch("/api/projects").then(r => r.json());
      setProjects(list);
    }
  };

  // استخراج صور من النص (URLs + markdown images + data URLs)
  const IMAGE_URL_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?)/gi;
  const DALLE_URL_RE = /https?:\/\/oaidalleapiprodscus\.blob\.core\.windows\.net\/\S+/gi;
  const DATA_IMG_RE  = /(data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)/g;

  function renderContent(content: string) {
    // جمّع كل الصور المستخرجة مع مواضعها
    type Segment = { type: "text" | "img"; value: string; alt?: string };
    const segments: Segment[] = [];
    const combined = new RegExp(
      `${IMAGE_URL_RE.source}|${DALLE_URL_RE.source}|${DATA_IMG_RE.source}`,
      "gi"
    );
    let last = 0;
    let m: RegExpExecArray | null;
    combined.lastIndex = 0;
    while ((m = combined.exec(content)) !== null) {
      if (m.index > last) segments.push({ type: "text", value: content.slice(last, m.index) });
      const url = m[2] || m[3] || m[0];
      const alt = m[1] || "";
      segments.push({ type: "img", value: url.trim(), alt });
      last = m.index + m[0].length;
    }
    if (last < content.length) segments.push({ type: "text", value: content.slice(last) });

    return segments.map((seg, idx) =>
      seg.type === "img" ? (
        <img
          key={idx}
          src={seg.value}
          alt={seg.alt || "image"}
          style={{ maxWidth: "100%", maxHeight: "360px", borderRadius: "10px", objectFit: "contain", display: "block", marginTop: 4 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span key={idx}>{seg.value}</span>
      )
    );
  }

  if (!isOpen) return null;

  const activeModel = models.find((m) => m.id === activeRobotId);
  const robotName = activeModel ? `Sillar ${activeModel.name}` : "Sillar AI";
  const robotColor = activeModel ? getModelColor(activeModel.index) : "#4fc3f7";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !isLoading) {
      sendMessage();
    }
    if (e.key === "Escape") {
      closeChat();
    }
  };

  const edgeStyle = (cursor: string, pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    ...pos,
    cursor,
    zIndex: 150,
    background: "rgba(255,255,255,0.1)",
    pointerEvents: "auto",
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: `calc(50% + ${position.y}px)`,
        left: `calc(50% + ${position.x}px)`,
        transform: "translate(-50%, -50%)",
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: "rgba(15, 15, 25, 0.95)",
        borderRadius: "16px",
        border: `2px solid ${robotColor}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
        zIndex: 100,
        boxShadow: `0 0 30px ${robotColor}40`,
        userSelect: isResizing || isDragging ? "none" : "auto",
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Draggable header */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${robotColor}40`,
          flexShrink: 0,
          cursor: "grab",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: robotColor,
              boxShadow: `0 0 8px ${robotColor}`,
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ color: "white", fontSize: "16px", fontWeight: "bold" }}>
              {robotName}
            </span>
            {activeModel?.modelId && (
              <span style={{ color: "#aaa", fontSize: "11px", fontWeight: "normal", direction: "ltr" }}>
                {activeModel.modelId}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Project badge */}
          <button
            onClick={() => setShowProjectPanel(p => !p)}
            title="إدارة المشروع"
            style={{
              background: activeProjectKey ? "#16a34a22" : "#1e1e2e",
              border: `1px solid ${activeProjectKey ? "#16a34a" : "#444"}`,
              borderRadius: "8px",
              padding: "3px 10px",
              color: activeProjectKey ? "#4ade80" : "#666",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
              letterSpacing: "0.08em",
              direction: "ltr",
            }}
          >
            {activeProjectKey ? `◈ ${activeProjectKey}` : "+ مشروع"}
          </button>
          {activeProjectKey && (
            <button
              onClick={() => { setShowSlotsPanel(p => !p); setShowProjectPanel(false); if (!showSlotsPanel) loadRepoFiles(); }}
              title="ملفات المراحل"
              style={{
                background: showSlotsPanel ? "#0369a122" : "#1e1e2e",
                border: `1px solid ${showSlotsPanel ? "#0369a1" : "#444"}`,
                borderRadius: "8px",
                padding: "3px 10px",
                color: showSlotsPanel ? "#38bdf8" : "#666",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              📂 ملفات
            </button>
          )}
          <button
            onClick={closeChat}
            style={{ background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer", padding: "0 4px" }}
          >
            X
          </button>
        </div>
      </div>

      {/* Project panel */}
      {showProjectPanel && (
        <div style={{
          background: "#0d0d1a",
          borderBottom: `1px solid #333`,
          padding: "12px 16px",
          flexShrink: 0,
          direction: "rtl",
        }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>اختر مشروع أو أنشئ جديد (max 6 أحرف)</div>
          {/* قائمة المشاريع */}
          {projects.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProject(p.projectKey); setShowProjectPanel(false); }}
                  style={{
                    background: activeProjectKey === p.projectKey ? "#16a34a22" : "#1e1e2e",
                    border: `1px solid ${activeProjectKey === p.projectKey ? "#16a34a" : "#444"}`,
                    borderRadius: "6px",
                    padding: "3px 10px",
                    color: activeProjectKey === p.projectKey ? "#4ade80" : "#aaa",
                    fontSize: "12px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    direction: "ltr",
                  }}
                >
                  {p.projectKey}
                </button>
              ))}
              <button
                onClick={() => setActiveProject(null)}
                style={{ background: "#1e1e2e", border: "1px solid #555", borderRadius: "6px", padding: "3px 10px", color: "#888", fontSize: "11px", cursor: "pointer" }}
              >
                بدون مشروع
              </button>
            </div>
          )}
          {/* إنشاء مشروع جديد */}
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              value={projectInput}
              onChange={e => setProjectInput(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") handleCreateProject(); }}
              placeholder="SUPRT"
              style={{
                background: "#1a1a2e", border: "1px solid #444", borderRadius: "6px",
                padding: "5px 10px", color: "#fff", fontSize: "13px", fontWeight: "bold",
                width: "90px", letterSpacing: "0.1em", direction: "ltr",
              }}
            />
            <button
              onClick={handleCreateProject}
              style={{
                background: "#6366f115", border: "1px solid #6366f1", borderRadius: "6px",
                padding: "5px 12px", color: "#818cf8", fontSize: "12px", cursor: "pointer",
              }}
            >
              + جديد
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Slots panel */}
      {showSlotsPanel && activeProjectKey && (
        <div style={{
          background: "#080d1a",
          borderBottom: "1px solid #1e3a5f",
          padding: "10px 14px",
          flexShrink: 0,
          direction: "rtl",
          maxHeight: "320px",
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 600 }}>
              📂 ملفات المشروع {activeProjectKey} — 8 مراحل
            </span>
            <button
              onClick={() => loadRepoFiles()}
              style={{ fontSize: "10px", background: "none", border: "1px solid #1e3a5f", borderRadius: "4px", color: "#64748b", cursor: "pointer", padding: "2px 6px" }}
            >
              🔄 تحديث
            </button>
          </div>

          {slotsLoading ? (
            <div style={{ fontSize: "12px", color: "#64748b", textAlign: "center", padding: "10px" }}>جاري التحميل...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {SLOT_NAMES.map(slot => (
                <div key={slot} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {/* اسم المرحلة */}
                  <span style={{
                    minWidth: "28px", fontSize: "11px", fontWeight: 700,
                    color: slots[slot] ? "#38bdf8" : "#475569",
                    direction: "ltr",
                  }}>
                    {slot}
                  </span>

                  {/* قائمة الملفات من الريبو */}
                  {repoFiles.length > 0 ? (
                    <select
                      value={slots[slot]}
                      onChange={e => setSlots(prev => ({ ...prev, [slot]: e.target.value }))}
                      style={{
                        flex: 1, background: "#0f172a", border: "1px solid #1e3a5f",
                        borderRadius: "5px", color: slots[slot] ? "#e2e8f0" : "#475569",
                        padding: "3px 6px", fontSize: "11px", direction: "ltr",
                      }}
                    >
                      <option value="">(لم يُحدَّد بعد)</option>
                      {repoFiles.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={slots[slot]}
                      onChange={e => setSlots(prev => ({ ...prev, [slot]: e.target.value }))}
                      placeholder="اسم الملف .json"
                      style={{
                        flex: 1, background: "#0f172a", border: "1px solid #1e3a5f",
                        borderRadius: "5px", color: "#e2e8f0", padding: "3px 8px",
                        fontSize: "11px", direction: "ltr", outline: "none",
                      }}
                    />
                  )}

                  {/* زر حفظ */}
                  <button
                    onClick={() => saveSlot(slot, slots[slot])}
                    disabled={slotsSaving === slot || !slots[slot].trim()}
                    style={{
                      background: slots[slot].trim() ? "#0369a1" : "#1e293b",
                      border: "none", borderRadius: "5px", color: "#fff",
                      padding: "3px 8px", fontSize: "10px", cursor: slots[slot].trim() ? "pointer" : "not-allowed",
                      opacity: slotsSaving === slot ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {slotsSaving === slot ? "⏳" : "✓"}
                  </button>

                  {/* مؤشر المحفوظ */}
                  {slots[slot] && slotsSaving !== slot && (
                    <span style={{ fontSize: "10px", color: "#22c55e" }}>●</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "8px", fontSize: "10px", color: "#334155", direction: "rtl" }}>
            💡 اكتب اسم الملف أو اختره من القائمة ثم اضغط ✓ لحفظه في المرحلة
          </div>
        </div>
      )}

      {/* Resize handles */}
      <div onMouseDown={(e) => handleMouseDown(e, "e")} style={edgeStyle("ew-resize", { top: 0, right: -4, width: 8, height: "100%" })} />
      <div onMouseDown={(e) => handleMouseDown(e, "w")} style={edgeStyle("ew-resize", { top: 0, left: -4, width: 8, height: "100%" })} />
      <div onMouseDown={(e) => handleMouseDown(e, "s")} style={edgeStyle("ns-resize", { bottom: -4, left: 0, width: "100%", height: 8 })} />
      <div onMouseDown={(e) => handleMouseDown(e, "n")} style={edgeStyle("ns-resize", { top: -4, left: 0, width: "100%", height: 8 })} />
      <div onMouseDown={(e) => handleMouseDown(e, "se")} style={edgeStyle("nwse-resize", { bottom: -4, right: -4, width: 14, height: 14 })} />
      <div onMouseDown={(e) => handleMouseDown(e, "sw")} style={edgeStyle("nesw-resize", { bottom: -4, left: -4, width: 14, height: 14 })} />
      <div onMouseDown={(e) => handleMouseDown(e, "ne")} style={edgeStyle("nesw-resize", { top: -4, right: -4, width: 14, height: 14 })} />
      <div onMouseDown={(e) => handleMouseDown(e, "nw")} style={edgeStyle("nwse-resize", { top: -4, left: -4, width: 14, height: 14 })} />

      {/* Corner resize indicator */}
      <div style={{
        position: "absolute",
        bottom: 4,
        right: 8,
        color: `${robotColor}60`,
        fontSize: "12px",
        pointerEvents: "none",
        zIndex: 111,
      }}>⟋</div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#666", textAlign: "center", fontSize: "13px", marginTop: "20px", direction: "rtl" }}>
            اكتب رسالة للتحدث مع {robotName}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#2563eb" : "#333",
              color: "white",
              padding: "8px 14px",
              borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              maxWidth: "85%",
              fontSize: "14px",
              lineHeight: "1.5",
              direction: "rtl",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="uploaded"
                style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "8px", objectFit: "contain" }}
              />
            )}
            {msg.content && renderContent(msg.content)}
            {msg.role === "assistant" && msg.cost !== undefined && (
              <div style={{ fontSize: "11px", color: "#888", textAlign: "left", marginTop: "4px", direction: "ltr" }}>
                💵 ${msg.cost < 0.0001 ? "<0.0001" : msg.cost.toFixed(4)} · {((msg.inputTokens || 0) + (msg.outputTokens || 0)).toLocaleString()} tokens
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              alignSelf: "flex-start",
              background: "#333",
              color: "#aaa",
              padding: "8px 14px",
              borderRadius: "14px 14px 14px 4px",
              fontSize: "14px",
            }}
          >
            ...يكتب
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image preview strip */}
      {pendingImage && (
        <div style={{
          padding: "6px 16px",
          borderTop: `1px solid ${robotColor}40`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
          background: "#0d0d1a",
        }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={pendingImage}
              alt="preview"
              style={{ height: "56px", borderRadius: "6px", border: `1px solid ${robotColor}60`, objectFit: "cover" }}
            />
            <button
              onClick={() => setPendingImage(null)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: "#e53e3e",
                border: "none",
                borderRadius: "50%",
                width: "18px",
                height: "18px",
                color: "white",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >×</button>
          </div>
          <span style={{ color: "#888", fontSize: "12px", direction: "rtl" }}>صورة جاهزة للإرسال</span>
        </div>
      )}

      <div
        style={{
          padding: "12px 16px",
          borderTop: pendingImage ? "none" : `1px solid ${robotColor}40`,
          display: "flex",
          gap: "8px",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        {/* Image attach button */}
        <button
          onClick={handleImagePick}
          disabled={isLoading}
          title="إرفاق صورة"
          style={{
            background: pendingImage ? `${robotColor}30` : "#1a1a2e",
            border: `1px solid ${pendingImage ? robotColor : "#444"}`,
            borderRadius: "8px",
            padding: "10px 10px",
            color: pendingImage ? robotColor : "#888",
            fontSize: "16px",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          📎
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingImage ? "...أضف وصفاً (اختياري)" : "...اكتب رسالتك"}
          disabled={isLoading}
          style={{
            flex: 1,
            background: "#1a1a2e",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "white",
            fontSize: "14px",
            outline: "none",
            direction: "rtl",
          }}
        />
        <button
          onClick={sendToBackground}
          disabled={isLoading || bgSending || (!inputText.trim() && !pendingImage)}
          title="نفذ بالخلفية - يشتغل حتى لو سكرت الصفحة"
          style={{
            background: "#7c4dff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 10px",
            color: "white",
            fontSize: "12px",
            cursor: isLoading || bgSending || (!inputText.trim() && !pendingImage) ? "not-allowed" : "pointer",
            opacity: isLoading || bgSending || (!inputText.trim() && !pendingImage) ? 0.5 : 1,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {bgSending ? "..." : "📋 خلفية"}
        </button>
        <button
          onClick={sendMessage}
          disabled={isLoading || (!inputText.trim() && !pendingImage)}
          style={{
            background: robotColor,
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "white",
            fontSize: "14px",
            cursor: isLoading || (!inputText.trim() && !pendingImage) ? "not-allowed" : "pointer",
            opacity: isLoading || (!inputText.trim() && !pendingImage) ? 0.5 : 1,
            fontWeight: "bold",
          }}
        >
          ارسل
        </button>
      </div>
      {sessionUsage.cost > 0 && (
        <div style={{
          padding: "4px 12px",
          background: "#111",
          borderTop: "1px solid #333",
          fontSize: "11px",
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
          direction: "ltr",
        }}>
          <span>💰 ${sessionUsage.cost.toFixed(4)} · {(sessionUsage.input + sessionUsage.output).toLocaleString()} tokens</span>
          <span style={{ color: "#555" }}>{sessionUsage.model}</span>
        </div>
      )}
    </div>
  );
}
