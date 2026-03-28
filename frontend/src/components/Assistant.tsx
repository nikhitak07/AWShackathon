import React, { useState, useRef, useEffect } from "react";
import type { Checklist, Message } from "@shared/types";
import { useTheme } from "../ThemeContext";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  checklist: Checklist;
  accessToken: string;
}

const SUGGESTIONS = [
  "What do my medications do?",
  "When should I call my doctor?",
  "What warning signs should I watch for?",
  "Can I resume normal activities?",
];

export const Assistant: React.FC<Props> = ({ checklist, accessToken }) => {
  const { tokens, theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [disclaimer, setDisclaimer] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
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
      if (!res.ok) throw new Error(data.error ?? "MediBuddy unavailable.");
      setDisclaimer(data.disclaimer ?? "");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e: unknown) {
      setMessages((prev) => [...prev, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong. Please try again." }]);
    } finally { setLoading(false); }
  };

  const showSuggestions = messages.length === 0;

  // Theme-derived values
  const panelBg = isDark ? "rgba(18,18,28,0.96)" : "rgba(255,255,255,0.96)";
  const headerBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const msgAreaBg = "transparent";
  const aiBubbleBg = isDark ? "rgba(255,255,255,0.07)" : "#f2f2f7";
  const aiBubbleColor = tokens.textPrimary;
  const inputBg = isDark ? "rgba(255,255,255,0.07)" : "#f2f2f7";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "#e5e5ea";
  const suggBg = isDark ? "rgba(0,122,255,0.12)" : "#e8f0fe";

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close MediBuddy" : "Open MediBuddy"}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: "50%",
          background: open ? (isDark ? "rgba(255,255,255,0.12)" : "#e5e5ea") : "linear-gradient(135deg, #007AFF, #5856d6)",
          color: open ? tokens.textMuted : "#fff",
          border: `1px solid ${tokens.border}`,
          fontSize: open ? 18 : 24,
          cursor: "pointer",
          boxShadow: open ? "none" : "0 4px 20px rgba(0,122,255,0.4)",
          zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease",
          backdropFilter: "blur(10px)",
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <span style={{ fontSize: 26, lineHeight: 1 }}>🩺</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 24,
          width: 360, maxHeight: 560,
          background: panelBg,
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderRadius: 20,
          border: `1px solid ${tokens.border}`,
          boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 8px 40px rgba(0,0,0,0.14)",
          display: "flex", flexDirection: "column",
          zIndex: 999, overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${tokens.border}`, background: headerBg }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>🩺</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.1px" }}>MediBuddy</p>
              <p style={{ margin: 0, fontSize: 11, color: tokens.textMuted }}>Your AI medical assistant</p>
            </div>
            <div style={{ width: 8, height: 8, background: "#34c759", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(52,199,89,0.25)" }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 10, background: msgAreaBg, minHeight: 200, maxHeight: 360 }}>
            {messages.length === 0 && (
              <p style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", margin: "auto 0", lineHeight: 1.5 }}>
                Hi! I'm MediBuddy. Ask me anything about your discharge instructions, medications, or recovery.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                {m.role === "assistant" && (
                  <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#007AFF,#5856d6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>🩺</span>
                  </div>
                )}
                <div style={{
                  padding: "9px 13px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? "linear-gradient(135deg,#007AFF,#0063d1)" : aiBubbleBg,
                  color: m.role === "user" ? "#fff" : aiBubbleColor,
                  fontSize: 13, lineHeight: 1.5, maxWidth: "82%", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {SUGGESTIONS.map((q) => (
                  <button key={q} onClick={() => send(q)} style={{ background: suggBg, border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#007AFF", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 500 }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#007AFF,#5856d6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>🩺</span>
                </div>
                <div style={{ padding: "9px 13px", borderRadius: "16px 16px 16px 4px", background: aiBubbleBg, display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ width: 6, height: 6, background: tokens.textMuted, borderRadius: "50%", display: "inline-block", animation: `bounce 1.2s ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {disclaimer && (
            <p style={{ fontSize: 10, color: tokens.textMuted, padding: "6px 14px", borderTop: `1px solid ${tokens.border}`, margin: 0, lineHeight: 1.4 }}>
              {disclaimer}
            </p>
          )}

          {/* Input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: `1px solid ${tokens.border}`, background: headerBg }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Ask MediBuddy…"
              disabled={loading}
              style={{ flex: 1, padding: "9px 13px", background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 10, fontSize: 13, color: tokens.textPrimary, outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, background: input.trim() && !loading ? "linear-gradient(135deg,#007AFF,#0063d1)" : (isDark ? "rgba(255,255,255,0.08)" : "#e5e5ea"), border: "none", borderRadius: 9, color: "#fff", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        input::placeholder { color: ${tokens.textMuted} !important; }
      `}</style>
    </>
  );
};
