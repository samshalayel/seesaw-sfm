import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { Card, PageTitle, Empty } from "../components/ui";

interface Robot { id: string; name: string; alias?: string; modelId?: string }
interface Msg {
  role: "user" | "assistant";
  content: string;
  cost?: number; inputTokens?: number; outputTokens?: number;
}

export function Chat() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState("");
  const [usage, setUsage] = useState({ input: 0, output: 0, cost: 0 });

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/models");
        const d = await r.json().catch(() => null);
        if (Array.isArray(d) && d.length) {
          setRobots(d);
          setActive(d[0].id);
        } else setErr("لا توجد موديلات — أضفها من الإعدادات");
      } catch { setErr("تعذّر تحميل الموديلات"); }
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // تبديل الروبوت يبدأ محادثة نظيفة — السياق خاص بكل موديل
  const switchRobot = (id: string) => {
    if (streaming) return;
    setActive(id);
    setMessages([]);
    setUsage({ input: 0, output: 0, cost: 0 });
  };

  const stop = () => { abortRef.current?.abort(); setStreaming(false); };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !active) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setErr("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, robotId: active, history }),
        signal: ac.signal,
      } as RequestInit);

      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `خطأ ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: finished } = await reader.read();
        done = finished;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n").filter((l) => l.startsWith("data: "))) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") { done = true; break; }
            try {
              const p = JSON.parse(raw);
              if (p.content) {
                setMessages((m) => {
                  const c = [...m];
                  const last = c[c.length - 1];
                  if (last?.role === "assistant") c[c.length - 1] = { ...last, content: last.content + p.content };
                  return c;
                });
              }
              if (p.usage) {
                const { input: i, output: o, cost } = p.usage;
                setMessages((m) => {
                  const c = [...m];
                  const last = c[c.length - 1];
                  if (last?.role === "assistant") c[c.length - 1] = { ...last, cost, inputTokens: i, outputTokens: o };
                  return c;
                });
                setUsage((u) => ({ input: u.input + i, output: u.output + o, cost: u.cost + cost }));
              }
              if (p.error) setErr(p.error);
            } catch { }
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErr(e?.message || "خطأ في الاتصال");
        setMessages((m) => {
          const c = [...m];
          if (c[c.length - 1]?.role === "assistant" && !c[c.length - 1].content) c.pop();
          return c;
        });
      }
    }
    setStreaming(false);
    abortRef.current = null;
  };

  const current = robots.find((r) => r.id === active);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageTitle
        title="الروبوتات"
        subtitle={current ? `${current.alias || current.name}${current.modelId ? ` · ${current.modelId}` : ""}` : "اختر موديلاً"}
        action={
          usage.cost > 0 ? (
            <span className="text-[11px] text-slate-500">
              {usage.input + usage.output} توكن · ${usage.cost.toFixed(4)}
            </span>
          ) : undefined
        }
      />

      {/* robot tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {robots.map((r) => (
          <button
            key={r.id}
            onClick={() => switchRobot(r.id)}
            disabled={streaming}
            className={`rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors disabled:opacity-40 ${
              active === r.id
                ? "border-cyan-400/50 bg-cyan-400/12 text-cyan-300"
                : "border-white/8 text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            {r.alias || r.name}
          </button>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && <Empty>ابدأ المحادثة</Empty>}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "border border-cyan-400/25 bg-cyan-400/10 text-cyan-50"
                    : "border border-white/8 bg-white/[0.03] text-slate-200"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {m.content || (streaming && i === messages.length - 1 ? "▍" : "")}
                </div>
                {m.cost != null && (
                  <div className="mt-1.5 text-[10px] text-slate-500">
                    {(m.inputTokens ?? 0) + (m.outputTokens ?? 0)} توكن · ${m.cost.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {err && (
          <div className="border-t border-red-400/20 bg-red-400/5 px-5 py-2.5 text-[12px] text-red-400">{err}</div>
        )}

        <div className="flex gap-2.5 border-t border-white/5 p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={robots.length ? "اكتب رسالتك…  (Enter للإرسال، Shift+Enter لسطر جديد)" : "لا توجد موديلات"}
            rows={2}
            disabled={!robots.length}
            dir="rtl"
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px]
                       text-slate-200 outline-none transition-colors focus:border-cyan-400/50
                       placeholder:text-slate-600 disabled:opacity-50"
          />
          {streaming ? (
            <button
              onClick={stop}
              className="shrink-0 self-end rounded-lg border border-red-400/40 bg-red-400/10 px-5 py-2.5 text-[12px] font-bold text-red-300 hover:bg-red-400/20"
            >
              إيقاف
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim() || !active}
              className="shrink-0 self-end rounded-lg border border-cyan-400/50 bg-cyan-400/15 px-5 py-2.5 text-[12px]
                         font-bold text-cyan-300 transition-colors hover:bg-cyan-400/25 disabled:opacity-40"
            >
              إرسال
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
