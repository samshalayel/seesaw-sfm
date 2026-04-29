import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY!, vertexai: true });

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'مرحباً! أنا Seesaw، نموذج ذكاء اصطناعي متخصص من شركة سيلار للإنتاج الرقمي. أنا هنا لمساعدتك في كل ما يخص دورة حياة تطوير البرمجيات (SDLC) ومنهجيات Agile. كيف يمكنني مساعدتك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are Seesaw, an AI model developed by Sellar Digital Production. You are an expert in SDLC and Agile methodologies. Provide concise, professional, and actionable advice in the language the user uses. If the user speaks Arabic, respond in Arabic. Always maintain your identity as Seesaw from Sellar Digital Production.'
      }
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || 'عذراً، لم أتمكن من توليد رد.' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-xl border-x border-slate-200">
      <header className="p-6 border-b border-slate-100 bg-indigo-600 text-white">
        <h1 className="text-2xl font-bold">Seesaw | سيلار للإنتاج الرقمي</h1>
        <p className="text-indigo-100 text-sm">خبيرك المتخصص في SDLC و Agile</p>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 shadow-sm'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse">جاري التفكير...</div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="اسأل Seesaw عن Agile أو SDLC..."
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}