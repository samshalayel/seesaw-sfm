import { create } from "zustand";
import { apiFetch } from "../utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string; // base64 data URL للعرض
}

interface ChatState {
  isOpen: boolean;
  activeRobotId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  inputText: string;
  pendingImage: string | null; // base64 data URL
  chatHistory: Record<string, ChatMessage[]>;
  robotScreens: Record<string, string>;
  isBroadcast: boolean;
  broadcastResults: Record<string, string>;
  activeProjectKey: string | null;
  wavingRobotId: string | null;

  openChat: (robotId: string, startS0?: boolean) => void;
  triggerRobotWave: (robotId: string) => void;
  closeChat: () => void;
  setInputText: (text: string) => void;
  setPendingImage: (img: string | null) => void;
  sendMessage: () => void;
  clearAllChats: () => void;
  setRobotScreen: (robotId: string, content: string) => void;
  startBroadcast: (message: string, workerIds: string[]) => Promise<void>;
  closeBroadcast: () => void;
  setActiveProject: (key: string | null) => void;
}

export const useChat = create<ChatState>((set, get) => ({
  isOpen: false,
  activeRobotId: null,
  messages: [],
  isLoading: false,
  inputText: "",
  pendingImage: null,
  chatHistory: {},
  robotScreens: {},
  isBroadcast: false,
  broadcastResults: {},
  activeProjectKey: null,
  wavingRobotId: null,

  openChat: (robotId: string, startS0: boolean = false) => {
    const { chatHistory, activeRobotId, messages } = get();
    const updated = { ...chatHistory };
    if (activeRobotId && messages.length > 0) {
      updated[activeRobotId] = messages;
    }
    const restored = updated[robotId] || [];
    
    let finalMessages: ChatMessage[];
    
    if (startS0) {
      finalMessages = [
        {
          role: "assistant",
          content: `جيد 👍\nسنبدأ الآن بمرحلة S0.\nلن نبني النظام بعد.\n\nأولاً سنغلق المشكلة نفسها.\nمعظم المشاريع تفشل ليس بسبب الكود…\nبل لأن المشكلة لم تُفهم بدقة.\n\nسأسألك بضعة أسئلة قصيرة فقط.\n\n1) ما الذي تحاول بناءه؟\n(صفه بجملة واحدة)`,
        },
      ];
      updated[robotId] = [];
    } else {
      finalMessages = restored.length > 0 ? restored : [];
    }
    
    set({ isOpen: true, activeRobotId: robotId, messages: finalMessages, inputText: "", chatHistory: updated, isLoading: false });
  },

  closeChat: () => {
    const { activeRobotId, messages, chatHistory } = get();
    const updated = { ...chatHistory };
    if (activeRobotId && messages.length > 0) {
      updated[activeRobotId] = messages;
    }
    const newRobotScreens = { ...get().robotScreens };
    if (activeRobotId) {
      delete newRobotScreens[activeRobotId];
    }
    set({ isOpen: false, activeRobotId: null, messages: [], inputText: "", isLoading: false, chatHistory: updated, robotScreens: newRobotScreens });
  },

  setInputText: (text: string) => {
    set({ inputText: text });
  },

  setPendingImage: (img: string | null) => {
    set({ pendingImage: img });
  },

  clearAllChats: () => {
    set({ chatHistory: {}, messages: [], activeRobotId: null, isOpen: false, inputText: "", isLoading: false, robotScreens: {} });
  },

  setRobotScreen: (robotId: string, content: string) => {
    set((state) => ({
      robotScreens: { ...state.robotScreens, [robotId]: content },
    }));
  },

  startBroadcast: async (message: string, workerIds: string[]) => {
    // guard ضد النداءات المتعددة المتزامنة
    if (get().isLoading) return;
    set({ isBroadcast: true, broadcastResults: {}, inputText: message, isLoading: true });
    
    for (const workerId of workerIds) {
      set((state) => ({
        robotScreens: { ...state.robotScreens, [workerId]: "... جاري الإرسال" },
      }));
    }
    
    const decoder = new TextDecoder();
    const responses: Record<string, string> = {};
    
    try {
      const response = await apiFetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, workerIds }),
      });

      if (!response.ok) {
        throw new Error("Response not OK: " + response.status);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      let buffer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.robotId && parsed.content) {
                responses[parsed.robotId] = (responses[parsed.robotId] || "") + parsed.content;
                set((state) => ({
                  robotScreens: { ...state.robotScreens, [parsed.robotId]: responses[parsed.robotId] },
                  broadcastResults: { ...responses },
                }));
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      console.error("Broadcast error:", err);
      for (const workerId of workerIds) {
        set((state) => ({
          robotScreens: { ...state.robotScreens, [workerId]: "حدث خطأ" },
        }));
      }
    } finally {
      set({ isLoading: false });
    }
  },

  closeBroadcast: () => {
    set({ isBroadcast: false, broadcastResults: {}, robotScreens: {} });
  },

  setActiveProject: (key: string | null) => {
    set({ activeProjectKey: key });
  },

  triggerRobotWave: (robotId: string) => {
    set({ wavingRobotId: robotId });
    setTimeout(() => {
      set((s) => (s.wavingRobotId === robotId ? { wavingRobotId: null } : {}));
    }, 2600);
  },

  sendMessage: async () => {
    const { inputText, messages, activeRobotId, isLoading, pendingImage } = get();
    if (!inputText.trim() && !pendingImage || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputText.trim() || "حلّل هذه الصورة",
      ...(pendingImage ? { imageUrl: pendingImage } : {}),
    };
    set({ messages: [...messages, userMessage], inputText: "", pendingImage: null, isLoading: true });

    try {
      const currentMessages = get().messages;
      const history = currentMessages
        .filter(m => m.content.trim().length > 0)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          robotId: activeRobotId,
          history,
          projectKey: get().activeProjectKey,
          ...(pendingImage ? { imageBase64: pendingImage } : {}),
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader");
      }

      set((state) => ({
        messages: [...state.messages, { role: "assistant" as const, content: "" }],
        isLoading: false,
      }));

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                set((state) => {
                  const msgs = [...state.messages];
                  const lastMsg = msgs[msgs.length - 1];
                  let newContent = "";
                  if (lastMsg && lastMsg.role === "assistant") {
                    newContent = lastMsg.content + parsed.content;
                    msgs[msgs.length - 1] = {
                      ...lastMsg,
                      content: newContent,
                    };
                  }
                  if (activeRobotId) {
                    return { messages: msgs, robotScreens: { ...state.robotScreens, [activeRobotId]: newContent } };
                  }
                  return { messages: msgs };
                });
              }
            } catch {
            }
          }
        }
      }

      const finalMessages = get().messages;
      if (activeRobotId) {
        set((state) => ({
          chatHistory: { ...state.chatHistory, [activeRobotId]: finalMessages },
        }));
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      set((state) => ({
        messages: [...state.messages, { role: "assistant" as const, content: "حدث خطأ، حاول مرة أخرى" }],
        isLoading: false,
      }));
    }
  },
}));
