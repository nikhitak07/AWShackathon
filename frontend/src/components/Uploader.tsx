import React, { useState, useRef, useEffect } from "react";
import type { Checklist } from "@shared/types";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { AsclepiusIcon } from "./Logo";

const ACCEPTED = ["image/jpeg", "image/png"];
const MAX_MB = 10;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  onChecklistReady: (checklist: Checklist) => void;
  onOpenExisting?: (checklist: Checklist) => void;
  accessToken?: string;
  username?: string;
  onHome?: () => void;
  deletedIds?: Set<string>;
  onDelete?: (id: string) => void;
}

function PastDocRow({ cl, accessToken, tokens, isDark, onOpen, onRename, onDelete }: {
  cl: Checklist;
  accessToken: string;
  tokens: ReturnType<typeof useTheme>["tokens"];
  isDark: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cl.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionableItems = cl.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments");
  const completed = actionableItems.filter((i) => i.completed).length;
  const total = actionableItems.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const date = new Date(cl.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const color = pct === 100 ? "#34c759" : pct > 50 ? "#007AFF" : "#ff9500";

  const saveRename = async () => {
    const newName = draft.trim();
    onRename(newName || date);
    setEditing(false);
    try {
      await fetch(`${API_BASE}/checklists/${cl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...cl, name: newName || undefined }),
      });
    } catch { /* silent */ }
  };

  const handleDelete = async () => {
    onDelete();
    try {
      await fetch(`${API_BASE}/checklists/${cl.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch { /* silent */ }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: tokens.cardBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${confirmDelete ? "#ff453a" : tokens.border}`, borderRadius: 14, padding: "12px 14px", transition: "border-color 0.15s" }}>
      {editing ? (
        <>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditing(false); }}
            style={{ flex: 1, padding: "6px 10px", background: tokens.fieldGroupBg, border: `1.5px solid #007AFF`, borderRadius: 8, fontSize: 14, color: tokens.textPrimary, outline: "none", fontFamily: "inherit" }} />
          <button onClick={saveRename} style={{ padding: "6px 12px", background: "#007AFF", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ padding: "6px 10px", background: tokens.btnSecondaryBg, color: tokens.textMuted, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Cancel</button>
        </>
      ) : confirmDelete ? (
        <>
          <p style={{ flex: 1, margin: 0, fontSize: 13, color: "#ff453a", fontWeight: 500 }}>Delete this checklist?</p>
          <button onClick={handleDelete} style={{ padding: "6px 12px", background: "#ff453a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Delete</button>
          <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 10px", background: tokens.btnSecondaryBg, color: tokens.textMuted, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Cancel</button>
        </>
      ) : (
        <>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? "rgba(0,122,255,0.12)" : "#e8f0fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <button onClick={onOpen} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: tokens.textPrimary }}>{cl.name ?? date}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: tokens.textMuted }}>{cl.name ? `${date} · ` : ""}{completed}/{total} items · {pct}% done</p>
          </button>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `conic-gradient(${color} ${pct * 3.6}deg, ${isDark ? "rgba(255,255,255,0.08)" : "#e5e5ea"} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: isDark ? "#0d0d18" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color }}>{pct}%</span>
            </div>
          </div>
          <button onClick={() => { setDraft(cl.name ?? ""); setEditing(true); }} title="Rename" style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: 6, display: "flex", alignItems: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: 6, display: "flex", alignItems: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

export const Uploader: React.FC<Props> = ({ onChecklistReady, onOpenExisting, accessToken = "", username = "", onHome, deletedIds = new Set(), onDelete }) => {
  const { tokens, theme } = useTheme();
  const isDark = theme === "dark";
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pastDocs, setPastDocs] = useState<Checklist[]>([]);
  const [pendingChecklist, setPendingChecklist] = useState<Checklist | null>(null);
  const [docName, setDocName] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
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
        setPastDocs(data.filter((d) => !deletedIds.has(d.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

  const handleDeleteAll = async () => {
    const ids = pastDocs.map((d) => d.id);
    setPastDocs([]);
    setConfirmDeleteAll(false);
    ids.forEach((id) => {
      onDelete?.(id);
      fetch(`${API_BASE}/checklists/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => { /* silent */ });
    });
  };

  // Stats derived from pastDocs
  const totalDocs = pastDocs.length;
  const avgPct = totalDocs
    ? Math.round(pastDocs.reduce((sum, cl) => {
        const actionable = cl.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments");
        const t = actionable.length;
        return sum + (t ? (actionable.filter((i) => i.completed).length / t) * 100 : 0);
      }, 0) / totalDocs)
    : 0;
  const fullyDone = pastDocs.filter((cl) => {
    const actionable = cl.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments");
    return actionable.length > 0 && actionable.every((i) => i.completed);
  }).length;

  return (
    <div style={{ minHeight: "100vh", background: tokens.pageBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 600, height: 600, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", borderBottom: `1px solid ${tokens.border}`, background: tokens.navBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <button onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: onHome ? "pointer" : "default", padding: 0 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,122,255,0.3)" }}>
            <AsclepiusIcon size={20} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.4px" }}>MediGuide</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ThemeToggle />
        </div>
      </nav>

      {/* Full-width greeting — integrated into nav bar */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", padding: "32px 40px 24px", boxSizing: "border-box", borderBottom: `1px solid ${tokens.border}` }}>
        <h1 style={{ margin: 0, fontSize: "clamp(38px, 4.5vw, 60px)", fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-2px", lineHeight: 1.05 }}>
          {username ? `Hello, ${username}` : "Hello."}
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: tokens.textMuted, fontWeight: 400 }}>
          Upload an official discharge document to get started, or reopen a previous one below.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "flex", gap: 24, width: "100%", padding: "28px 40px 48px", position: "relative", zIndex: 1, alignItems: "flex-start", boxSizing: "border-box" }}>

        {/* LEFT: Upload */}
        <div style={{ flex: "0 0 42%", display: "flex", flexDirection: "column", gap: 18 }}>

          {pendingChecklist ? (
            /* Name step */
            <div style={{ background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 20, padding: "28px", boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.08)" }}>
              <div style={{ width: 44, height: 44, background: "rgba(52,199,89,0.15)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, border: "1px solid rgba(52,199,89,0.25)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: tokens.textPrimary }}>Checklist ready!</h2>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>Give it a name so you can find it later, or open it right away.</p>
              <input type="text" placeholder="e.g. Hospital discharge — March 2026" value={docName}
                onChange={(e) => setDocName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onChecklistReady({ ...pendingChecklist, name: docName.trim() || undefined }); }}
                autoFocus
                style={{ width: "100%", padding: "12px 14px", background: tokens.fieldGroupBg, border: `1px solid ${tokens.border}`, borderRadius: 10, fontSize: 14, color: tokens.textPrimary, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 12 }} />
              <button style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #007AFF, #0063d1)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => onChecklistReady({ ...pendingChecklist, name: docName.trim() || undefined })}>
                {docName.trim() ? "Save & Open" : "Open without name"}
              </button>
            </div>
          ) : (
            /* Upload step */
            <div style={{ background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 20, padding: "28px", boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.08)" }}>
              <div
                style={{ border: `1.5px dashed ${dragOver ? "#007AFF" : tokens.border}`, borderRadius: 14, padding: "2.5rem 1.5rem", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease", background: dragOver ? "rgba(0,122,255,0.08)" : isDark ? "rgba(255,255,255,0.02)" : "#fafafa", minHeight: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                {preview ? (
                  <img src={preview} alt="Preview" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <>
                    <div style={{ width: 50, height: 50, background: isDark ? "rgba(0,122,255,0.15)" : "#e8f0fe", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, border: "1px solid rgba(0,122,255,0.2)" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: tokens.textSecondary, fontSize: 14 }}>Drag & drop or tap to upload</p>
                    <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted }}>PNG, JPG, or JPEG · Max 10 MB</p>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {error && <p style={{ color: "#ff453a", fontSize: 13, marginTop: 10 }}>{error}</p>}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", background: isDark ? "rgba(0,122,255,0.1)" : "#e8f0fe", borderRadius: 10 }}>
                  <span style={{ width: 14, height: 14, border: `2.5px solid ${tokens.spinnerTrack}`, borderTop: "2.5px solid #007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ color: tokens.textMuted, fontSize: 13 }}>AI is analyzing your document…</span>
                </div>
              )}
            </div>
          )}

          {/* Feature tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { icon: "🔒", title: "Private & Secure", desc: "Encrypted and never shared with third parties." },
              { icon: "🤖", title: "AI-Powered", desc: "Extracts medications, appointments & warnings." },
              { icon: "📋", title: "Personalized", desc: "Checklist tailored to your specific discharge." },
              { icon: "💬", title: "MediBuddy", desc: "Your AI medical assistant, available 24/7." },
            ].map((c) => (
              <div key={c.title} style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 16, padding: "18px 16px" }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
                <p style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 700, color: tokens.textPrimary }}>{c.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted, lineHeight: 1.5 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: History */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, paddingTop: 0 }}>

          {/* Stats row + delete all */}
          {totalDocs > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {confirmDeleteAll ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#ff453a", fontWeight: 500 }}>Delete all {pastDocs.length}?</span>
                    <button onClick={handleDeleteAll} style={{ padding: "6px 14px", background: "#ff453a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Confirm</button>
                    <button onClick={() => setConfirmDeleteAll(false)} style={{ padding: "6px 12px", background: tokens.btnSecondaryBg, color: tokens.textMuted, border: `1px solid ${tokens.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteAll(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: isDark ? "rgba(255,69,58,0.12)" : "#fff0ef", border: "1px solid rgba(255,69,58,0.25)", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#ff453a", cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete All
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Total uploads", value: totalDocs, color: "#007AFF" },
                  { label: "Avg. completion", value: `${avgPct}%`, color: "#5856d6" },
                  { label: "Fully completed", value: fullyDone, color: "#34c759" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 16, padding: "20px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: stat.color, letterSpacing: "-0.5px" }}>{stat.value}</p>
                    <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted, fontWeight: 500 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List */}
          {pastDocs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: tokens.textPrimary }}>No uploads yet</p>
              <p style={{ margin: 0, fontSize: 13, color: tokens.textMuted }}>Your past discharge documents will appear here after your first upload.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pastDocs.map((cl) => (
                <PastDocRow
                  key={cl.id}
                  cl={cl}
                  accessToken={accessToken}
                  tokens={tokens}
                  isDark={isDark}
                  onOpen={() => (onOpenExisting ?? onChecklistReady)(cl)}
                  onRename={(newName) => setPastDocs((prev) => prev.map((d) => d.id === cl.id ? { ...d, name: newName } : d))}
                  onDelete={() => {
                    setPastDocs((prev) => prev.filter((d) => d.id !== cl.id));
                    onDelete?.(cl.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
      `}</style>
    </div>
  );
};
