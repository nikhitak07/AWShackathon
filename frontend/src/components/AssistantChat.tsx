import React, { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  accessToken?: string;
}

const SUGGESTIONS = [
  "What do my discharge instructions mean?",
  "When should I call my doctor?",
  "Can I eat normally after discharge?",
  "What are common warning signs to watch for?",
];

export const AssistantChat: React.FC<Props> = ({ accessToken = "" }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your medical assistant. I can help explain your discharge instructions, answer questions about your medications, or clarify anything from your documents. How can I help?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Message = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error("Assistant unavailable.");
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Sorry, I couldn't get a response." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const showSuggestions = messages.length === 1;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
            <path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
        </div>
        <div>
          <div style={s.headerTitle}>Medical Assistant</div>
          <div style={s.headerSub}>Ask anything about your care</div>
        </div>
        <div style={s.onlineDot} />
      </div>

      <div style={s.messages}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...s.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={s.avatar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
                  <path d="M12 16v-4"/><path d="M12 8h.01"/>
                </svg>
              </div>
            )}
            <div style={m.role === "user" ? s.userBubble : s.aiBubble}>
              {m.content}
            </div>
          </div>
        ))}

        {showSuggestions && (
          <div style={s.suggestions}>
            {SUGGESTIONS.map((q) => (
              <button key={q} style={s.suggestionBtn} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
            <div style={s.avatar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
                <path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
            </div>
            <div style={s.aiBubble}>
              <span style={s.dot} /><span style={{ ...s.dot, animationDelay: "0.2s" }} /><span style={{ ...s.dot, animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.inputRow}>
        <textarea
          ref={inputRef}
          style={s.textarea}
          placeholder="Ask a question…"
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          style={{ ...s.sendBtn, ...((!input.trim() || loading) ? s.sendBtnDisabled : {}) }}
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 20,
    boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
    border: "1px solid rgba(255,255,255,0.6)",
    overflow: "hidden",
    height: "100%",
    minHeight: 520,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.5)",
  },
  headerIcon: {
    width: 36, height: 36,
    background: "linear-gradient(135deg, #007AFF, #5856d6)",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: { fontSize: 15, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.1px" },
  headerSub: { fontSize: 12, color: "#8e8e93", marginTop: 1 },
  onlineDot: {
    width: 8, height: 8,
    background: "#34c759",
    borderRadius: "50%",
    marginLeft: "auto",
    boxShadow: "0 0 0 2px rgba(52,199,89,0.25)",
  },
  messages: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 8 },
  avatar: {
    width: 28, height: 28,
    background: "#e8f0fe",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiBubble: {
    background: "#f2f2f7",
    color: "#1c1c1e",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: "80%",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  userBubble: {
    background: "linear-gradient(135deg, #007AFF, #0063d1)",
    color: "#fff",
    borderRadius: "16px 16px 4px 16px",
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: "80%",
  },
  dot: {
    display: "inline-block",
    width: 6, height: 6,
    background: "#8e8e93",
    borderRadius: "50%",
    animation: "bounce 1.2s infinite",
  },
  suggestions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginTop: 4,
  },
  suggestionBtn: {
    background: "#f2f2f7",
    border: "none",
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 13,
    color: "#007AFF",
    cursor: "pointer",
    textAlign: "left" as const,
    fontWeight: 500,
    transition: "background 0.15s",
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.5)",
  },
  textarea: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1.5px solid #e5e5ea",
    fontSize: 14,
    outline: "none",
    resize: "none" as const,
    fontFamily: "inherit",
    background: "#f2f2f7",
    color: "#1c1c1e",
    lineHeight: 1.5,
  },
  sendBtn: {
    width: 38, height: 38,
    background: "linear-gradient(135deg, #007AFF, #0063d1)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
};
