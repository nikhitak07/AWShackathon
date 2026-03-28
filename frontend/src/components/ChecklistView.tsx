import React, { useState } from "react";
import type { Checklist, ChecklistItem, Category } from "@shared/types";
import { v4 as uuidv4 } from "uuid";
import { Assistant } from "./Assistant";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

const CATEGORY_META: Record<Category, { icon: string; color: string; bg: string; darkBg: string; label: string }> = {
  Medications:           { icon: "💊", color: "#5856d6", bg: "#f0efff", darkBg: "rgba(88,86,214,0.15)", label: "Medications" },
  FollowUpAppointments:  { icon: "📅", color: "#007AFF", bg: "#e8f0fe", darkBg: "rgba(0,122,255,0.15)", label: "Follow-Up Appointments" },
  DietaryRestrictions:   { icon: "🥗", color: "#34c759", bg: "#edfaf1", darkBg: "rgba(52,199,89,0.15)", label: "Dietary Restrictions" },
  WarningSigns:          { icon: "⚠️", color: "#ff9500", bg: "#fff5e6", darkBg: "rgba(255,149,0,0.15)", label: "Warning Signs" },
  DailyActivities:       { icon: "🏃", color: "#00c7be", bg: "#e6faf9", darkBg: "rgba(0,199,190,0.15)", label: "Daily Activities" },
};

const CATEGORY_ORDER: Category[] = [
  "DailyActivities", "WarningSigns", "Medications", "FollowUpAppointments", "DietaryRestrictions",
];

interface Props {
  checklist: Checklist;
  onChange: (cl: Checklist) => void;
  onNewUpload: () => void;
  username?: string;
  accessToken?: string;
}

export const ChecklistView: React.FC<Props> = ({ checklist, onChange, onNewUpload, username = "", accessToken = "" }) => {
  const { tokens, theme } = useTheme();
  const isDark = theme === "dark";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [addingCategory, setAddingCategory] = useState<Category | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const update = (items: ChecklistItem[]) =>
    onChange({ ...checklist, items, updatedAt: new Date().toISOString() });

  const toggleComplete = (id: string) =>
    update(checklist.items.map((i) => i.id === id ? { ...i, completed: !i.completed } : i));

  const deleteItem = (id: string) => update(checklist.items.filter((i) => i.id !== id));
  const startEdit = (item: ChecklistItem) => { setEditingId(item.id); setEditText(item.text); };
  const saveEdit = (id: string) => {
    update(checklist.items.map((i) => i.id === id ? { ...i, text: editText } : i));
    setEditingId(null);
  };
  const togglePriority = (id: string) =>
    update(checklist.items.map((i) =>
      i.id === id ? { ...i, priority: i.priority === "High" ? "Routine" : "High" } : i
    ));
  const addItem = (category: Category) => {
    if (!newItemText.trim()) return;
    update([...checklist.items, { id: uuidv4(), text: newItemText.trim(), category, priority: "Routine", completed: false }]);
    setNewItemText(""); setAddingCategory(null);
  };

  const warningSigns = checklist.items.filter((i) => i.category === "WarningSigns");
  const checklistItems = checklist.items.filter((i) => i.category !== "WarningSigns");

  const completedCount = checklistItems.filter((i) => i.completed).length;
  const total = checklistItems.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const greeting = username ? `Hello, ${username}.` : "Hello.";

  const editInputStyle: React.CSSProperties = {
    flex: 1, padding: "8px 12px", borderRadius: 8,
    border: "1.5px solid #007AFF", fontSize: 14, outline: "none",
    background: tokens.fieldGroupBg, color: tokens.textPrimary, fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: tokens.pageBg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", borderBottom: `1px solid ${tokens.border}`, background: tokens.navBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onNewUpload} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.3px" }}>MediGuide</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          <button style={{ padding: "9px 18px", background: "#007AFF", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }} onClick={onNewUpload}>New Upload</button>
        </div>
      </nav>

      <div style={{ display: "flex", gap: 24, maxWidth: 1280, margin: "0 auto", padding: "32px 32px 48px", alignItems: "flex-start" }}>
        {/* Left: checklist */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, color: tokens.textMuted, fontWeight: 500 }}>{greeting}</p>
          <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>Your Discharge Checklist</h1>

          {/* Warning Signs Banner */}
          {warningSigns.length > 0 && (
            <div style={{ background: isDark ? "rgba(255,149,0,0.12)" : "#fff8ed", border: "1.5px solid rgba(255,149,0,0.4)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#ff9500" }}>Warning Signs — Seek immediate care if you experience:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                {warningSigns.map((item) => (
                  <li key={item.id} style={{ fontSize: 14, color: isDark ? "#ffb340" : "#7a4500", lineHeight: 1.5 }}>{item.text}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress */}
          <div style={{ background: tokens.cardBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 16, padding: "16px 20px", marginBottom: 20, boxShadow: isDark ? "0 2px 20px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${tokens.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: tokens.textMuted, fontWeight: 500 }}>{completedCount} of {total} completed</span>
              <span style={{ fontSize: 14, color: tokens.textPrimary, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: tokens.progressTrack, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#34c759", borderRadius: 3, transition: "width 0.4s ease", width: `${pct}%` }} />
            </div>
          </div>

          {/* Categories */}
          {CATEGORY_ORDER.filter(cat => cat !== "WarningSigns").map((cat) => {
            const items = checklistItems
              .filter((i) => i.category === cat)
              .sort((a, b) => a.priority === b.priority ? 0 : a.priority === "High" ? -1 : 1);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const iconBg = isDark ? meta.darkBg : meta.bg;

            return (
              <div key={cat} style={{ background: tokens.cardBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 16, padding: "16px 20px", marginBottom: 14, boxShadow: isDark ? "0 2px 20px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${tokens.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>{meta.icon}</span>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: "-0.1px", color: meta.color }}>{meta.label}</h2>
                  <span style={{ fontSize: 13, color: tokens.textMuted, fontWeight: 500 }}>{items.filter(i => i.completed).length}/{items.length}</span>
                </div>

                {items.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderTop: `1px solid ${tokens.itemDivider}`, transition: "opacity 0.2s", opacity: item.completed ? 0.55 : 1 }}>
                    <button
                      style={{ width: 22, height: 22, borderRadius: 11, border: item.completed ? "none" : `2px solid ${isDark ? "rgba(255,255,255,0.3)" : "#c7c7cc"}`, background: item.completed ? meta.color : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, padding: 0, transition: "all 0.15s" }}
                      onClick={() => toggleComplete(item.id)}
                      aria-label={`Mark "${item.text}" as ${item.completed ? "incomplete" : "complete"}`}
                    >
                      {item.completed && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      {editingId === item.id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input style={editInputStyle} value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                          <button style={{ padding: "7px 14px", background: "#007AFF", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }} onClick={() => saveEdit(item.id)}>Save</button>
                          <button style={{ padding: "7px 14px", background: tokens.btnSecondaryBg, color: tokens.textMuted, border: `1px solid ${tokens.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 15, color: tokens.textSecondary, lineHeight: 1.45, textDecoration: item.completed ? "line-through" : "none" }}>
                          {item.text}
                          {item.dateTime && <span style={{ fontSize: 13, color: tokens.textMuted }}> · {item.dateTime}</span>}
                        </span>
                      )}
                      {item.priority === "High" && (
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#ff9500", background: isDark ? "rgba(255,149,0,0.15)" : "#fff5e6", border: "1px solid rgba(255,149,0,0.3)", borderRadius: 6, padding: "2px 7px", width: "fit-content" }}>High Priority</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0, alignItems: "center" }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }} title="Toggle priority" onClick={() => togglePriority(item.id)}>
                        {item.priority === "High" ? "🔴" : "⚪"}
                      </button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }} title="Edit" onClick={() => startEdit(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }} title="Delete" onClick={() => deleteItem(item.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {addingCategory === cat ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
                    <input style={editInputStyle} placeholder="New item…" value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(cat); if (e.key === "Escape") setAddingCategory(null); }} autoFocus />
                    <button style={{ padding: "7px 14px", background: "#007AFF", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }} onClick={() => addItem(cat)}>Add</button>
                    <button style={{ padding: "7px 14px", background: tokens.btnSecondaryBg, color: tokens.textMuted, border: `1px solid ${tokens.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }} onClick={() => setAddingCategory(null)}>Cancel</button>
                  </div>
                ) : (
                  <button style={{ marginTop: 10, background: "none", border: "none", color: "#007AFF", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "4px 0", fontFamily: "inherit" }} onClick={() => { setAddingCategory(cat); setNewItemText(""); }}>
                    + Add item
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: AI Assistant */}
        <div style={{ width: 360, flexShrink: 0, position: "sticky", top: 80 }}>
          <Assistant checklist={checklist} accessToken={accessToken} />
        </div>
      </div>
    </div>
  );
};
