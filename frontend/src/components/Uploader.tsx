import React, { useState, useRef, useEffect } from "react";
import type { Checklist } from "@shared/types";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

const ACCEPTED = ["image/jpeg", "image/png"];
const MAX_MB = 10;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  onChecklistReady: (checklist: Checklist) => void;
  accessToken?: string;
  username?: string;
  onHome?: () => void;
}

export const Uploader: React.FC<Props> = ({ onChecklistReady, accessToken = "", username = "", onHome }) => {
  const { tokens, theme } = useTheme();
  const isDark = theme === "dark";
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pastDocs, setPastDocs] = useState<Checklist[]>([]);
  const [pendingChecklist, setPendingChecklist] = useState<Checklist | null>(null);
  const [docName, setDocName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    const fetchDocs = async () => {
      try {
        const uid = JSON.parse(atob(accessToken.split(".")[1])).sub as string;
        const res = await fetch(`${API_BASE}/checklists?userId=${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const data = await res.json() as Checklist[];
        setPastDocs(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch { /* silent */ }
    };
    fetchDocs();
  }, [accessToken]);

  const handleFile = (file: File) => {
    setError("");
    if (!ACCEPTED.includes(file.type)) { setError("Only JPEG, PNG, or JPG images are accepted."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`File must be under ${MAX_MB} MB.`); return; }
    setPreview(URL.createObjectURL(file));
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

      const userId = JSON.parse(atob(accessToken.split(".")[1])).sub as string;

      const extractRes = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ uploadId, contentType: file.type, userId }),
      });
      if (!extractRes.ok) {
        const { error } = await extractRes.json().catch(() => ({}));
        throw new Error(error ?? "Text extraction failed. Please check the image quality and try again.");
      }
      const { rawText } = await extractRes.json();

      const parseRes = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ rawText, userId }),
      });
      if (!parseRes.ok) {
        const { error } = await parseRes.json().catch(() => ({}));
        throw new Error(error ?? "Failed to generate checklist.");
      }
      const cl = await parseRes.json() as Checklist;
      setPendingChecklist(cl);
      setDocName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to process file.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: tokens.pageBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 600, height: 600, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

      <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: `1px solid ${tokens.border}`, background: tokens.navBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <button onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: onHome ? "pointer" : "default", padding: 0 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,122,255,0.3)" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.4px" }}>MediGuide</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {username && <span style={{ fontSize: 14, color: tokens.textMuted, fontWeight: 500 }}>Hello, {username}</span>}
          <ThemeToggle />
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", zIndex: 1 }}>
        {pendingChecklist ? (
          /* Step 2: name the document */
          <div style={{ background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 24, padding: "36px 36px 32px", width: "100%", maxWidth: 520, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.10)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.3px" }}>Name your document</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>Give this checklist a name so you can find it easily later. You can skip this.</p>
            <input
              type="text"
              placeholder="e.g. Hospital discharge — March 2026"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onChecklistReady({ ...pendingChecklist, name: docName.trim() || undefined }); }}
              autoFocus
              style={{ width: "100%", padding: "13px 16px", background: tokens.fieldGroupBg, border: `1px solid ${tokens.border}`, borderRadius: 12, fontSize: 15, color: tokens.textPrimary, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg, #007AFF, #0063d1)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => onChecklistReady({ ...pendingChecklist, name: docName.trim() || undefined })}
              >
                {docName.trim() ? "Save & Open" : "Open without name"}
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: upload */
          <div style={{ background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 24, padding: "36px 36px 32px", width: "100%", maxWidth: 520, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.10)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, background: "rgba(0,122,255,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(0,122,255,0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.3px" }}>Upload Discharge Document</h2>
                <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>We'll extract your instructions and build a personalized checklist.</p>
              </div>
            </div>

            <div
              style={{ border: `1.5px dashed ${dragOver ? "#007AFF" : tokens.border}`, borderRadius: 16, padding: "2.5rem 1.5rem", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease", background: dragOver ? "rgba(0,122,255,0.08)" : tokens.sectionBg, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
              ) : (
                <>
                  <div style={{ width: 56, height: 56, background: tokens.fieldGroupBg, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "#007AFF" : tokens.textMuted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: tokens.textSecondary, fontSize: 14 }}>Drag & drop or tap to upload</p>
                  <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>PNG, JPG, or JPEG · Max 10 MB</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {error && <p style={{ color: "#ff453a", fontSize: 13, marginTop: 12 }}>{error}</p>}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
                <span style={{ width: 16, height: 16, border: `2.5px solid ${tokens.spinnerTrack}`, borderTop: "2.5px solid #007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
                <span style={{ color: tokens.textMuted, fontSize: 13 }}>Analyzing document and building your checklist…</span>
              </div>
            )}
          </div>
        )}

        {/* Previous documents */}
        {pastDocs.length > 0 && (
          <div style={{ width: "100%", maxWidth: 520, marginTop: 20 }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: tokens.textMuted }}>Previous documents</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pastDocs.map((cl) => {
                const completed = cl.items.filter((i) => i.completed && i.category !== "WarningSigns" && i.category !== "FollowUpAppointments").length;
                const total = cl.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments").length;
                const pct = total ? Math.round((completed / total) * 100) : 0;
                const date = new Date(cl.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                return (
                  <button
                    key={cl.id}
                    onClick={() => onChecklistReady(cl)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%", boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 10px rgba(0,0,0,0.06)" }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: tokens.textPrimary }}>{cl.name ?? date}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: tokens.textMuted }}>{cl.name ? date + " · " : ""}{completed}/{total} items completed</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? "#34c759" : pct > 50 ? "#007AFF" : "#ff9500" }}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
      `}</style>
    </div>
  );
};
