import React, { useState, useEffect } from "react";
import type { Checklist, ChecklistItem, Category } from "@shared/types";
import { v4 as uuidv4 } from "uuid";
import { AsclepiusIcon } from "./Logo";
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

// Parse how many times per day a medication is taken from its text
function getDoseTimes(text: string): Date[] {
  const lower = text.toLowerCase();
  const now = new Date();
  const times: Date[] = [];

  const make = (h: number, m = 0) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // push to tomorrow if already passed
    return d;
  };

  if (lower.includes("three times") || lower.includes("3 times") || lower.includes("thrice") || lower.includes("tid")) {
    times.push(make(8), make(14), make(20));
  } else if (lower.includes("twice") || lower.includes("two times") || lower.includes("2 times") || lower.includes("bid")) {
    times.push(make(8), make(20));
  } else if (lower.includes("four times") || lower.includes("4 times") || lower.includes("qid")) {
    times.push(make(8), make(12), make(16), make(20));
  } else if (lower.includes("every 8") || lower.includes("q8")) {
    times.push(make(8), make(16), make(0));
  } else if (lower.includes("every 6") || lower.includes("q6")) {
    times.push(make(6), make(12), make(18), make(0));
  } else {
    // once daily — morning
    times.push(make(8));
  }
  return times;
}

function formatCountdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
  const appointments = checklist.items.filter((i) => i.category === "FollowUpAppointments");
  const checklistItems = checklist.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments");

  const completedCount = checklistItems.filter((i) => i.completed).length;
  const total = checklistItems.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const greeting = username ? `Hello, ${username}.` : "Hello.";

  // Countdown timer
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msLeft = midnight.getTime() - now.getTime();
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);
  const resetCountdown = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;

  // Completion calendar
  const startDate = new Date(checklist.createdAt);
  startDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const calDays: Date[] = [];
  const cur = new Date(startDate);
  while (cur <= today) { calDays.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

  // Today's completions
  const todayKey = today.toISOString().slice(0, 10);
  const log = { ...(checklist.completionLog ?? {}) };
  if (completedCount > 0) log[todayKey] = completedCount;

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
            <AsclepiusIcon size={20} />
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

          {/* Counters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: tokens.textMuted, fontWeight: 500 }}>Checklist resets in</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#007AFF", letterSpacing: "-0.5px" }}>{resetCountdown}</p>
            </div>
          </div>

          {/* Completion Calendar */}
          {calDays.length > 0 && (
            <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>Recovery Calendar</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {calDays.map((day) => {
                  const ds = day.toISOString().slice(0, 10);
                  const isToday = ds === todayKey;
                  const done = (log[ds] ?? 0) > 0;
                  return (
                    <div key={ds} title={day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: done ? "#34c759" : isToday ? "rgba(0,122,255,0.12)" : isDark ? "rgba(255,255,255,0.06)" : "#f2f2f7", border: isToday ? "2px solid #007AFF" : "2px solid transparent", cursor: "default" }}>
                      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: done ? "#fff" : isToday ? "#007AFF" : tokens.textMuted, lineHeight: 1 }}>{day.getDate()}</span>
                      {done && <span style={{ fontSize: 7, color: "rgba(255,255,255,0.8)", lineHeight: 1 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: tokens.textMuted }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#34c759", marginRight: 4 }} />Completed</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, border: "2px solid #007AFF", marginRight: 4 }} />Today</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: isDark ? "rgba(255,255,255,0.06)" : "#f2f2f7", marginRight: 4 }} />Pending</span>
              </div>
            </div>
          )}
          {warningSigns.length > 0 && (
            <div style={{ background: isDark ? "rgba(255,149,0,0.12)" : "#fff8ed", border: "1.5px solid rgba(255,149,0,0.4)", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
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

          {/* Follow-Up Appointments Banner */}
          {appointments.length > 0 && (
            <div style={{ background: isDark ? "rgba(0,122,255,0.12)" : "#eef5ff", border: "1.5px solid rgba(0,122,255,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>📅</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#007AFF" }}>Follow-Up Appointments</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                {appointments.map((item) => (
                  <li key={item.id} style={{ fontSize: 14, color: isDark ? "#64b5f6" : "#003d80", lineHeight: 1.5 }}>
                    {item.text}{item.dateTime && <span style={{ color: tokens.textMuted }}> · {item.dateTime}</span>}
                  </li>
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
          {CATEGORY_ORDER.filter(cat => cat !== "WarningSigns" && cat !== "FollowUpAppointments").map((cat) => {
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
                      {item.category === "Medications" && !item.completed && (() => {
                        const doses = getDoseTimes(item.text);
                        if (doses.length <= 1) return null;
                        // Sort doses by time ascending (soonest first)
                        const sorted = [...doses].sort((a, b) => a.getTime() - b.getTime());
                        const dosesTaken = item.dosesTaken ?? Array(sorted.length).fill(false);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                            {sorted.map((t, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <button
                                  onClick={() => {
                                    const next = [...dosesTaken];
                                    next[i] = !next[i];
                                    const allDone = next.every(Boolean);
                                    update(checklist.items.map((ci) =>
                                      ci.id === item.id ? { ...ci, dosesTaken: next, completed: allDone } : ci
                                    ));
                                  }}
                                  style={{ width: 18, height: 18, borderRadius: 5, border: dosesTaken[i] ? "none" : `2px solid ${isDark ? "rgba(255,255,255,0.3)" : "#c7c7cc"}`, background: dosesTaken[i] ? "#5856d6" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                  aria-label={`Mark dose ${i + 1} as ${dosesTaken[i] ? "not taken" : "taken"}`}
                                >
                                  {dosesTaken[i] && <svg width="9" height="7" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                                <span style={{ fontSize: 12, color: dosesTaken[i] ? tokens.textMuted : "#5856d6", fontWeight: 600, textDecoration: dosesTaken[i] ? "line-through" : "none" }}>
                                  Dose {i + 1} · {t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {formatCountdown(t, now)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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
