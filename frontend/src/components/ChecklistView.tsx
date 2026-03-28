import React, { useState } from "react";
import type { Checklist, ChecklistItem, Category } from "@shared/types";
import { v4 as uuidv4 } from "uuid";
import { Assistant } from "./Assistant";

const CATEGORY_META: Record<Category, { icon: string; color: string; bg: string; label: string }> = {
  Medications:           { icon: "💊", color: "#5856d6", bg: "#f0efff", label: "Medications" },
  FollowUpAppointments:  { icon: "📅", color: "#007AFF", bg: "#e8f0fe", label: "Follow-Up Appointments" },
  DietaryRestrictions:   { icon: "🥗", color: "#34c759", bg: "#edfaf1", label: "Dietary Restrictions" },
  WarningSigns:          { icon: "⚠️", color: "#ff9500", bg: "#fff5e6", label: "Warning Signs" },
  DailyActivities:       { icon: "🏃", color: "#00c7be", bg: "#e6faf9", label: "Daily Activities" },
};

const CATEGORY_ORDER: Category[] = [
  "WarningSigns", "Medications", "FollowUpAppointments", "DietaryRestrictions", "DailyActivities",
];

interface Props {
  checklist: Checklist;
  onChange: (cl: Checklist) => void;
  onNewUpload: () => void;
  username?: string;
  accessToken?: string;
}

export const ChecklistView: React.FC<Props> = ({ checklist, onChange, onNewUpload, username = "", accessToken = "" }) => {
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

  const completedCount = checklist.items.filter((i) => i.completed).length;
  const total = checklist.items.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const greeting = username ? `Hello, ${username}.` : "Hello.";

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navBrand}>
          <div style={s.navLogoIcon}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={s.navTitle}>MediGuide</span>
        </div>
        <button style={s.newBtn} onClick={onNewUpload}>New Upload</button>
      </nav>

      <div style={s.layout}>
        {/* Left: checklist */}
        <div style={s.leftCol}>
          <p style={s.greeting}>{greeting}</p>
          <h1 style={s.title}>Your Discharge Checklist</h1>

          {/* Progress card */}
          <div style={s.progressCard}>
            <div style={s.progressInfo}>
              <span style={s.progressLabel}>{completedCount} of {total} completed</span>
              <span style={s.progressPct}>{pct}%</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${pct}%` }} />
            </div>
          </div>

          {/* Categories */}
          {CATEGORY_ORDER.map((cat) => {
            const items = checklist.items
              .filter((i) => i.category === cat)
              .sort((a, b) => a.priority === b.priority ? 0 : a.priority === "High" ? -1 : 1);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];

            return (
              <div key={cat} style={s.section}>
                <div style={s.sectionHeader}>
                  <span style={{ ...s.catIconWrap, background: meta.bg }}>
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  </span>
                  <h2 style={{ ...s.catTitle, color: meta.color }}>{meta.label}</h2>
                  <span style={s.catCount}>{items.filter(i => i.completed).length}/{items.length}</span>
                </div>

                {items.map((item) => (
                  <div key={item.id} style={{ ...s.item, opacity: item.completed ? 0.55 : 1 }}>
                    <button
                      style={{ ...s.checkBtn, ...(item.completed ? { ...s.checkBtnDone, background: meta.color, borderColor: meta.color } : {}) }}
                      onClick={() => toggleComplete(item.id)}
                      aria-label={`Mark "${item.text}" as ${item.completed ? "incomplete" : "complete"}`}
                    >
                      {item.completed && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <div style={s.itemBody}>
                      {editingId === item.id ? (
                        <div style={s.editRow}>
                          <input style={s.editInput} value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus />
                          <button style={s.saveBtn} onClick={() => saveEdit(item.id)}>Save</button>
                          <button style={s.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span style={{ ...s.itemText, textDecoration: item.completed ? "line-through" : "none" }}>
                          {item.text}
                          {item.dateTime && <span style={s.dateTag}> · {item.dateTime}</span>}
                        </span>
                      )}
                      {item.priority === "High" && <span style={s.highBadge}>High Priority</span>}
                    </div>
                    <div style={s.actions}>
                      <button style={s.actionBtn} title="Toggle priority" onClick={() => togglePriority(item.id)}>
                        <span style={{ fontSize: 14 }}>{item.priority === "High" ? "🔴" : "⚪"}</span>
                      </button>
                      <button style={s.actionBtn} title="Edit" onClick={() => startEdit(item)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button style={s.actionBtn} title="Delete" onClick={() => deleteItem(item.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {addingCategory === cat ? (
                  <div style={s.addRow}>
                    <input style={s.editInput} placeholder="New item…" value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(cat); if (e.key === "Escape") setAddingCategory(null); }}
                      autoFocus />
                    <button style={s.saveBtn} onClick={() => addItem(cat)}>Add</button>
                    <button style={s.cancelBtn} onClick={() => setAddingCategory(null)}>Cancel</button>
                  </div>
                ) : (
                  <button style={s.addBtn} onClick={() => { setAddingCategory(cat); setNewItemText(""); }}>
                    + Add item
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: AI Assistant */}
        <div style={s.rightCol}>
          <Assistant checklist={checklist} accessToken={accessToken} />
        </div>
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #f2f2f7 0%, #e8eaf0 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
  },
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 40px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    position: "sticky" as const, top: 0, zIndex: 10,
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10 },
  navLogoIcon: {
    width: 34, height: 34,
    background: "linear-gradient(135deg, #007AFF, #5856d6)",
    borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
  },
  navTitle: { fontSize: 17, fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.3px" },
  newBtn: {
    padding: "9px 18px", background: "#007AFF", color: "#fff",
    border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14,
  },
  layout: {
    display: "flex", gap: 24,
    maxWidth: 1280, margin: "0 auto",
    padding: "32px 32px 48px",
    alignItems: "flex-start",
  },
  leftCol: { flex: 1, minWidth: 0 },
  rightCol: {
    width: 360, flexShrink: 0,
    position: "sticky" as const, top: 80,
  },
  greeting: { margin: "0 0 2px", fontSize: 15, color: "#8e8e93", fontWeight: 500 },
  title: { margin: "0 0 20px", fontSize: 28, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.5px" },
  progressCard: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    borderRadius: 16, padding: "16px 20px", marginBottom: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(255,255,255,0.6)",
  },
  progressInfo: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  progressLabel: { fontSize: 14, color: "#8e8e93", fontWeight: 500 },
  progressPct: { fontSize: 14, color: "#1c1c1e", fontWeight: 700 },
  progressTrack: { height: 6, background: "#e5e5ea", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", background: "#34c759", borderRadius: 3, transition: "width 0.4s ease" },
  section: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    borderRadius: 16, padding: "16px 20px", marginBottom: 14,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(255,255,255,0.6)",
  },
  sectionHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  catTitle: { margin: 0, fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: "-0.1px" },
  catCount: { fontSize: 13, color: "#8e8e93", fontWeight: 500 },
  item: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "10px 0", borderTop: "1px solid #f2f2f7", transition: "opacity 0.2s",
  },
  checkBtn: {
    width: 22, height: 22, borderRadius: 11,
    border: "2px solid #c7c7cc", background: "transparent",
    cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    marginTop: 1, padding: 0, transition: "all 0.15s",
  },
  checkBtnDone: { border: "none" },
  itemBody: { flex: 1, display: "flex", flexDirection: "column" as const, gap: 4 },
  itemText: { fontSize: 15, color: "#1c1c1e", lineHeight: 1.45 },
  dateTag: { fontSize: 13, color: "#8e8e93" },
  highBadge: {
    display: "inline-block", fontSize: 11, fontWeight: 700,
    color: "#ff9500", background: "#fff5e6", border: "1px solid #ffd59e",
    borderRadius: 6, padding: "2px 7px", width: "fit-content",
  },
  actions: { display: "flex", gap: 2, flexShrink: 0, alignItems: "center" },
  actionBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: "4px 6px", borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  editRow: { display: "flex", gap: 6, alignItems: "center" },
  addRow: { display: "flex", gap: 6, alignItems: "center", marginTop: 10 },
  editInput: {
    flex: 1, padding: "8px 12px", borderRadius: 8,
    border: "1.5px solid #007AFF", fontSize: 14, outline: "none",
    background: "#f2f2f7", color: "#1c1c1e",
  },
  saveBtn: {
    padding: "7px 14px", background: "#007AFF", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  cancelBtn: {
    padding: "7px 14px", background: "#f2f2f7", color: "#8e8e93",
    border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
  },
  addBtn: {
    marginTop: 10, background: "none", border: "none",
    color: "#007AFF", cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "4px 0",
  },
};
