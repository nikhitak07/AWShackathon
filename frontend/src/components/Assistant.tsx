import React, { useState, useRef, useEffect } from "react";
import type { Checklist, Message } from "@shared/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  checklist: Checklist;
  accessToken: string;
}

export const Assistant: React.FC<Props> = ({ checklist, accessToken }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [disclaimer, setDisclaimer] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sessionId: checklist.id,
          question,
          checklistContext: checklist,
          conversationHistory: messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assistant unavailable.");

      setDisclaimer(data.disclaimer);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e: unknown) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        style={s.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={s.panel}>
          <div style={s.header}>
            <span style={s.headerTitle}>AI Assistant</span>
            <span style={s.headerSub}>Ask about your discharge instructions</span>
          </div>

          <div style={s.messages}>
            {messages.length === 0 && (
              <p style={s.empty}>Ask me anything about your checklist — medications, appointments, warning signs, etc.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.aiBubble) }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ ...s.bubble, ...s.aiBubble, color: "#a0aec0" }}>Thinking…</div>
            )}
            <div ref={bottomRef} />
          </div>

          {disclaimer && (
            <p style={s.disclaimer}>{disclaimer}</p>
          )}

          <div style={s.inputRow}>
            <input
              style={s.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Ask a question…"
              disabled={loading}
            />
            <button style={s.sendBtn} onClick={send} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const s: Record<string, React.CSSProperties> = {
  fab: {
    position: "fixed",
    bottom: 24,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "fixed",
    bottom: 88,
    right: 24,
    width: 360,
    maxHeight: 520,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
    display: "flex",
    flexDirection: "column",
    zIndex: 999,
    overflow: "hidden",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    background: "#3182ce",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  headerTitle: { color: "#fff", fontWeight: 700, fontSize: 15 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 200,
    maxHeight: 320,
  },
  empty: { color: "#a0aec0", fontSize: 13, textAlign: "center", margin: "auto" },
  bubble: {
    padding: "8px 12px",
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: "85%",
    wordBreak: "break-word",
  },
  userBubble: {
    background: "#3182ce",
    color: "#fff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    background: "#f7fafc",
    color: "#2d3748",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    border: "1px solid #e2e8f0",
  },
  disclaimer: {
    fontSize: 11,
    color: "#a0aec0",
    padding: "6px 14px",
    borderTop: "1px solid #f0f0f0",
    margin: 0,
    lineHeight: 1.4,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid #e2e8f0",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    padding: "8px 14px",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
