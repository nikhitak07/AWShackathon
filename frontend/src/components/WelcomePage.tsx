import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { AsclepiusIcon } from "./Logo";

interface Props {
  onContinue: () => void;
}

export const WelcomePage: React.FC<Props> = ({ onContinue }) => {
  const { tokens, theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      height: "100vh",
      overflow: "hidden",
      background: tokens.pageBg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 600, height: 600, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 700, height: 700, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "40%", right: "20%", width: 300, height: 300, background: "radial-gradient(circle, rgba(52,199,89,0.08) 0%, transparent 65%)", borderRadius: "50%", animation: "float3 10s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

      {/* Theme toggle */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      {/* Centered content */}
      <div style={{
        position: "relative",
        zIndex: 1,
        textAlign: "center",
        padding: "0 24px",
        maxWidth: 640,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}>
        {/* Logo */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(0,122,255,0.45)" }}>
            <AsclepiusIcon size={28} />
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.6px" }}>MediGuide</span>
        </div>

        {/* Welcome label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 11, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase" as const, color: tokens.textMuted, marginBottom: 20 }}>
          <span style={{ display: "inline-block", width: 28, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
          Welcome
          <span style={{ display: "inline-block", width: 28, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
        </div>

        {/* Headline */}
        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(40px, 7vw, 64px)", fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.08, letterSpacing: "-2.5px" }}>
          Your recovery,<br />
          <span style={{ background: "linear-gradient(135deg, #007AFF 0%, #5856d6 50%, #34c759 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            guided every step.
          </span>
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: 18, color: tokens.textMuted, lineHeight: 1.65, margin: "0 auto 44px", maxWidth: 480 }}>
          Upload your hospital discharge papers and get a clear, AI-powered checklist with a medical assistant ready to help.
        </p>

        {/* CTA */}
        <button
          style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 40px", background: "linear-gradient(135deg, #007AFF, #0063d1)", color: "#fff", border: "none", borderRadius: 50, fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.2px", animation: "ctaPulse 3s ease-in-out infinite", fontFamily: "inherit" }}
          onClick={onContinue}
        >
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,25px)}}
        @keyframes ctaPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,122,255,0.4)}50%{box-shadow:0 0 0 16px rgba(0,122,255,0)}}
      `}</style>
    </div>
  );
};
