import React from "react";

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: "Smart Extraction",
    desc: "Upload any discharge document and we'll pull out the key instructions automatically.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5856d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    title: "Interactive Checklist",
    desc: "Track medications, appointments, and warning signs with a tap.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
        <path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
    title: "AI Assistant",
    desc: "Ask questions about your care in plain language — available 24/7.",
  },
];

export const HeroSection: React.FC = () => (
  <div style={s.hero}>
    {/* Background blobs */}
    <div style={s.blob1} />
    <div style={s.blob2} />

    <div style={s.inner}>
      <div style={s.badge}>
        <span style={s.badgeDot} />
        Discharge Care Platform
      </div>
      <h1 style={s.headline}>
        Your recovery,<br />
        <span style={s.accent}>simplified.</span>
      </h1>
      <p style={s.sub}>
        Upload your hospital discharge papers and get a clear, personalized checklist — plus an AI assistant to answer your questions along the way.
      </p>

      <div style={s.features}>
        {FEATURES.map((f) => (
          <div key={f.title} style={s.featureCard}>
            <div style={s.featureIcon}>{f.icon}</div>
            <div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const s: Record<string, React.CSSProperties> = {
  hero: {
    position: "relative" as const,
    overflow: "hidden",
    padding: "64px 48px 56px",
    display: "flex",
    alignItems: "center",
  },
  blob1: {
    position: "absolute" as const,
    top: -80, left: -80,
    width: 320, height: 320,
    background: "radial-gradient(circle, rgba(0,122,255,0.12) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none" as const,
  },
  blob2: {
    position: "absolute" as const,
    bottom: -60, right: -60,
    width: 260, height: 260,
    background: "radial-gradient(circle, rgba(88,86,214,0.10) 0%, transparent 70%)",
    borderRadius: "50%",
    pointerEvents: "none" as const,
  },
  inner: { position: "relative" as const, zIndex: 1 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,122,255,0.1)",
    color: "#007AFF",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.2px",
    marginBottom: 20,
  },
  badgeDot: {
    width: 6, height: 6,
    background: "#007AFF",
    borderRadius: "50%",
    display: "inline-block",
  },
  headline: {
    margin: "0 0 16px",
    fontSize: 42,
    fontWeight: 800,
    color: "#1c1c1e",
    lineHeight: 1.15,
    letterSpacing: "-1px",
  },
  accent: {
    background: "linear-gradient(135deg, #007AFF 0%, #5856d6 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  sub: {
    fontSize: 16,
    color: "#636366",
    lineHeight: 1.6,
    maxWidth: 420,
    margin: "0 0 36px",
  },
  features: { display: "flex", flexDirection: "column" as const, gap: 16 },
  featureCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    background: "rgba(255,255,255,0.7)",
    borderRadius: 14,
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.8)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  featureIcon: {
    width: 40, height: 40,
    background: "#f2f2f7",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTitle: { fontSize: 14, fontWeight: 700, color: "#1c1c1e", marginBottom: 3 },
  featureDesc: { fontSize: 13, color: "#8e8e93", lineHeight: 1.45 },
};
