import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onContinue: () => void;
}

export const WelcomePage: React.FC<Props> = ({ onContinue }) => {
  const { tokens, theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const isDark = theme === "dark";

  return (
    <div style={{
      minHeight: "100vh",
      background: tokens.pageBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      overflow: "hidden", position: "relative" as const, padding: 24,
    }}>
      {/* Orbs */}
      <div style={{ position: "absolute" as const, top: "-10%", left: "-5%", width: 600, height: 600, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" as const }} />
      <div style={{ position: "absolute" as const, bottom: "-15%", right: "-10%", width: 700, height: 700, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" as const }} />
      <div style={{ position: "absolute" as const, top: "40%", right: "20%", width: 300, height: 300, background: "radial-gradient(circle, rgba(52,199,89,0.08) 0%, transparent 65%)", borderRadius: "50%", animation: "float3 10s ease-in-out infinite", pointerEvents: "none" as const }} />
      {/* Grid */}
      <div style={{ position: "absolute" as const, inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" as const }} />

      {/* Theme toggle */}
      <div style={{ position: "absolute" as const, top: 20, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div style={{ position: "relative" as const, zIndex: 1, textAlign: "center" as const, maxWidth: 600, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}>
        {/* Logo */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,122,255,0.4)" }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>MediGuide</span>
        </div>

        {/* Welcome label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 12, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase" as const, color: tokens.textMuted, marginBottom: 20 }}>
          <span style={{ display: "inline-block", width: 24, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
          Welcome
          <span style={{ display: "inline-block", width: 24, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
        </div>

        {/* Headline */}
        <h1 style={{ margin: "0 0 20px", fontSize: 58, fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.1, letterSpacing: "-2px" }}>
          Your recovery,<br />
          <span style={{ background: "linear-gradient(135deg, #007AFF 0%, #5856d6 50%, #34c759 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            guided every step.
          </span>
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: 17, color: tokens.textMuted, lineHeight: 1.65, margin: "0 auto 40px", maxWidth: 480 }}>
          Turn your hospital discharge papers into a personalized checklist with an AI assistant at your service!
        </p>

        {/* CTA */}
        <button style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 36px", background: "linear-gradient(135deg, #007AFF, #0063d1)", color: "#fff", border: "none", borderRadius: 50, fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.2px", marginBottom: 40, animation: "ctaPulse 3s ease-in-out infinite" }} onClick={onContinue}>
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>

        {/* Trust badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" as const }}>
          {["HIPAA Aware", "Secure & Private", "AI-Powered"].map((b) => (
            <div key={b} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: tokens.textMuted, fontWeight: 500 }}>
              <span style={{ width: 5, height: 5, background: "#34c759", borderRadius: "50%", display: "inline-block" }} />
              {b}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,25px)}}
        @keyframes ctaPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,122,255,0.4)}50%{box-shadow:0 0 0 14px rgba(0,122,255,0)}}
      `}</style>
    </div>
  );
};
