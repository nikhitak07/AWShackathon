import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { AsclepiusIcon } from "./Logo";

interface Props {
  onContinue: () => void;
}

const STEPS = [
  {
    num: "",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    title: "Upload your papers",
    desc: "Snap a photo or upload your hospital discharge document.",
  },
  {
    num: "",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5856d6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
    title: "AI builds your checklist",
    desc: "Our AI extracts medications, appointments, and warning signs automatically.",
  },
  {
    num: "",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    title: "Track & ask questions",
    desc: "Check off tasks daily and ask the AI assistant anything about your care.",
  },
];

export const WelcomePage: React.FC<Props> = ({ onContinue }) => {
  const { tokens, theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: tokens.pageBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif", overflow: "hidden", position: "relative" }}>
      {/* Orbs */}
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 600, height: 600, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 700, height: 700, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "40%", right: "20%", width: 300, height: 300, background: "radial-gradient(circle, rgba(52,199,89,0.08) 0%, transparent 65%)", borderRadius: "50%", animation: "float3 10s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

      {/* Theme toggle */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "80px 24px 60px", position: "relative", zIndex: 1, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}>
        {/* Logo */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(0,122,255,0.45)" }}>
            <AsclepiusIcon size={28} />
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.6px" }}>MediGuide</span>
        </div>

        {/* Welcome label */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: tokens.textMuted, marginBottom: 20 }}>
          <span style={{ display: "inline-block", width: 28, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
          Welcome
          <span style={{ display: "inline-block", width: 28, height: 1, background: isDark ? "#3a3a3c" : "#c7c7cc" }} />
        </div>

        {/* Headline */}
        <h1 style={{ margin: "0 0 20px", fontSize: "clamp(40px, 7vw, 64px)", fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.08, letterSpacing: "-2.5px", textAlign: "center", maxWidth: 700 }}>
          Your recovery,<br />
          <span style={{ background: "linear-gradient(135deg, #007AFF 0%, #5856d6 50%, #34c759 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            guided every step.
          </span>
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: 18, color: tokens.textMuted, lineHeight: 1.65, margin: "0 auto 44px", maxWidth: 520, textAlign: "center" }}>
          Upload your hospital discharge papers and get a clear, AI-powered checklist with a medical assistant ready to help.
        </p>

        {/* CTA */}
        <button
          style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "17px 40px", background: "linear-gradient(135deg, #007AFF, #0063d1)", color: "#fff", border: "none", borderRadius: 50, fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.2px", marginBottom: 48, animation: "ctaPulse 3s ease-in-out infinite", fontFamily: "inherit" }}
          onClick={onContinue}
        >
          Get Started
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>

        {/* How it works */}
        <div style={{ width: "100%", maxWidth: 760, marginBottom: 48 }}>
          <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: tokens.textMuted, marginBottom: 24 }}>How it works</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {STEPS.map((step) => (
              <div key={step.num} style={{ background: tokens.cardBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${tokens.border}`, borderRadius: 18, padding: "22px 20px", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, background: isDark ? "rgba(255,255,255,0.06)" : "#f2f2f7", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {step.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted, letterSpacing: "1px" }}>{step.num}</span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: tokens.textPrimary }}>{step.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "HIPAA Aware", color: "#34c759" },
            { label: "Secure & Private", color: "#007AFF" },
            { label: "AI-Powered", color: "#5856d6" },
            { label: "Free to Use", color: "#ff9500" },
          ].map((b) => (
            <div key={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 20, padding: "7px 16px", fontSize: 12, color: tokens.textMuted, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, background: b.color, borderRadius: "50%", display: "inline-block" }} />
              {b.label}
            </div>
          ))}
        </div>
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
