import React, { useState, useRef } from "react";
import type { Checklist } from "@shared/types";
import { getMockChecklist } from "../utils/parser";
import { AssistantChat } from "./AssistantChat";
import { HeroSection } from "./HeroSection";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_MB = 10;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  onChecklistReady: (checklist: Checklist) => void;
  accessToken?: string;
  username?: string;
}

export const Uploader: React.FC<Props> = ({ onChecklistReady, accessToken = "", username = "" }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError("");
    if (!ACCEPTED.includes(file.type)) { setError("Only JPEG, PNG, or PDF files are accepted."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`File must be under ${MAX_MB} MB.`); return; }
    setPreview(file.type !== "application/pdf" ? URL.createObjectURL(file) : null);
    processFile(file);
  };

  const processFile = async (file: File) => {
    setLoading(true); setError("");
    try {
      const uploadRes = await fetch(`${API_BASE}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!uploadRes.ok) throw new Error("Failed to get upload URL.");
      const { uploadId, uploadUrl } = await uploadRes.json();

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error("Failed to upload file.");

      const extractRes = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ uploadId, contentType: file.type }),
      });
      if (!extractRes.ok) {
        const { error } = await extractRes.json().catch(() => ({}));
        throw new Error(error ?? "Text extraction failed. Please check the image quality and try again.");
      }
      const { rawText } = await extractRes.json();

      const parseRes = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ rawText }),
      });
      if (!parseRes.ok) {
        const { error } = await parseRes.json().catch(() => ({}));
        throw new Error(error ?? "Failed to generate checklist.");
      }
      onChecklistReady(await parseRes.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to process file.");
    } finally { setLoading(false); }
  };

  const useMockData = () => {
    setLoading(true);
    setTimeout(() => { onChecklistReady(getMockChecklist("demo-user")); setLoading(false); }, 800);
  };

  return (
    <div style={s.page}>
      {/* Nav bar */}
      <nav style={s.nav}>
        <div style={s.navBrand}>
          <div style={s.navLogo}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#007AFF"/>
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={s.navTitle}>CareHome</span>
        </div>
        {username && <span style={s.navGreeting}>Hello, {username}</span>}
      </nav>

      {/* Main two-column layout */}
      <div style={s.layout}>
        {/* Left: Hero */}
        <div style={s.leftCol}>
          <HeroSection />
        </div>

        {/* Right: Upload + Chat stacked */}
        <div style={s.rightCol}>
          {/* Upload card */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Upload Documents</h2>
            <p style={s.cardSub}>Drag in your discharge papers to get started.</p>

            <div
              style={{ ...s.dropzone, ...(dragOver ? s.dropzoneActive : {}) }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <div style={s.uploadIconWrap}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p style={s.dropText}>Drag & drop or tap to upload</p>
              <p style={s.dropHint}>JPEG, PNG, or PDF · Max 10 MB</p>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {preview && <img src={preview} alt="Preview" style={s.preview} />}
            {error && <p style={s.error}>{error}</p>}

            {loading && (
              <div style={s.loadingRow}>
                <span style={s.spinner} />
                <span style={s.loadingText}>Extracting checklist items…</span>
              </div>
            )}

            <div style={s.orRow}>
              <div style={s.orLine} /><span style={s.orLabel}>or</span><div style={s.orLine} />
            </div>

            <button style={{ ...s.ghostBtn, ...(loading ? s.ghostBtnDisabled : {}) }} onClick={useMockData} disabled={loading}>
              Load sample discharge data
            </button>
          </div>

          {/* AI Chat card */}
          <AssistantChat accessToken={accessToken} />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .upload-layout { flex-direction: column !important; }
          .upload-left { display: none !important; }
          .upload-right { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #f2f2f7 0%, #e5e8f0 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 40px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10 },
  navLogo: {
    width: 32, height: 32,
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: { fontSize: 17, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.3px" },
  navGreeting: { fontSize: 14, color: "#8e8e93", fontWeight: 500 },
  layout: {
    display: "flex",
    gap: 0,
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px 48px",
    alignItems: "flex-start",
  },
  leftCol: {
    flex: "0 0 45%",
    maxWidth: "45%",
    position: "sticky" as const,
    top: 80,
  },
  rightCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
    paddingTop: 40,
    paddingLeft: 24,
  },
  card: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 20,
    padding: "28px 28px 24px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
    border: "1px solid rgba(255,255,255,0.6)",
  },
  cardTitle: { margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.3px" },
  cardSub: { margin: "0 0 20px", fontSize: 14, color: "#8e8e93" },
  dropzone: {
    border: "1.5px dashed #c7c7cc",
    borderRadius: 16,
    padding: "2rem 1.5rem",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "#fafafa",
  },
  dropzoneActive: { borderColor: "#007AFF", background: "#f0f7ff" },
  uploadIconWrap: {
    width: 52, height: 52,
    background: "#e8f0fe",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 10px",
  },
  dropText: { margin: "0 0 4px", fontWeight: 600, color: "#1c1c1e", fontSize: 14 },
  dropHint: { margin: 0, fontSize: 12, color: "#8e8e93" },
  preview: { width: "100%", borderRadius: 12, marginTop: 14, maxHeight: 200, objectFit: "cover" as const },
  error: { color: "#ff3b30", fontSize: 13, marginTop: 10 },
  loadingRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 16 },
  spinner: {
    width: 16, height: 16,
    border: "2.5px solid #e5e5ea",
    borderTop: "2.5px solid #007AFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
    flexShrink: 0,
  },
  loadingText: { color: "#8e8e93", fontSize: 13 },
  orRow: { display: "flex", alignItems: "center", gap: 10, margin: "20px 0" },
  orLine: { flex: 1, height: 1, background: "#e5e5ea" },
  orLabel: { color: "#8e8e93", fontSize: 12 },
  ghostBtn: {
    width: "100%",
    padding: "12px",
    background: "#f2f2f7",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: "#007AFF",
    cursor: "pointer",
  },
  ghostBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
};
