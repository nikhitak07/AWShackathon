import React, { useState } from "react";
import type { Checklist, ChecklistItem, Category } from "@shared/types";
import { v4 as uuidv4 } from "uuid";

const CATEGORY_META: Record<Category, { icon: string; color: string; label: string }> = {
  Medications:           { icon: "💊", color: "#553c9a", label: "Medications" },
  FollowUpAppointments:  { icon: "📅", color: "#2b6cb0", label: "Follow-Up Appointments" },
  DietaryRestrictions:   { icon: "🍴", color: "#276749", label: "Dietary Restrictions" },
  WarningSigns:          { icon: "⚠️", color: "#c05621", label: "Warning Signs" },
  DailyActivities:       { icon: "🏃", color: "#2c7a7b", label: "Daily Activities" },
};

const CATEGORY_ORDER: Category[] = [
  "WarningSigns",
  "Medications",
  "FollowUpAppointments",
  "DietaryRestrictions",
  "DailyActivities",
];

interface Props {
  checklist: Checklist;
  onChange: (cl: Checklist) => void;
  onNewUpload: () => void;
}

export const ChecklistView: React.FC<Props> = ({ checklist, onChange, onNewUpload }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [addingCategory, setAddingCategory] = useState<Category | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const update = (items: ChecklistItem[]) => {
    onChange({ ...checklist, items, updatedAt: new Date().toISOString() });
  };

  const toggleComplete = (id: string) => {
    update(checklist.items.map((i) => i.id === id ? { ...i, completed: !i.completed } : i));
  };

  const deleteItem = (id: string) => {
    update(checklist.items.filter((i) => i.id !== id));
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEdit = (id: string) => {
    update(checklist.items.map((i) => i.id === id ? { ...i, text: editText } : i));
    setEditingId(null);
  };

  const togglePriority = (id: string) => {
    update(checklist.items.map((i) =>
      i.id === id ? { ...i, priority: i.priority === "High" ? "Routine" : "High" } : i
    ));
  };

  const addItem = (category: Category) => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: uuidv4(),
      text: newItemText.trim(),
      category,
      priority: "Routine",
      completed: false,
    };
    update([...checklist.items, newItem]);
    setNewItemText("");
    setAddingCategory(null);
  };

  const completedCount = checklist.items.filter((i) => i.completed).length;
  const total = checklist.items.length;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Discharge Checklist</h1>
            <p style={styles.progress}>{completedCount} of {total} items completed</p>
          </div>
          <button style={styles.newBtn} onClick={onNewUpload}>+ New Upload</button>
        </div>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${total ? (completedCount / total) * 100 : 0}%` }} />
        </div>

        {/* Categories */}
        {CATEGORY_ORDER.map((cat) => {
          const items = checklist.items
            .filter((i) => i.category === cat)
            .sort((a, b) => {
              if (a.priority === b.priority) return 0;
              return a.priority === "High" ? -1 : 1;
            });

          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat];

          return (
            <div key={cat} style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={{ ...styles.catIcon, background: meta.color + "18", fontSize: 22, minWidth: 36, minHeight: 36 }}>
                  {meta.icon}
                </span>
                <h2 style={{ ...styles.catTitle, color: meta.color }}>{meta.label}</h2>
                <span style={styles.catCount}>{items.filter(i => i.completed).length}/{items.length}</span>
              </div>

              {items.map((item) => (
                <div key={item.id} style={{ ...styles.item, opacity: item.completed ? 0.6 : 1 }}>
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleComplete(item.id)}
                    style={styles.checkbox}
                    aria-label={`Mark "${item.text}" as complete`}
                  />
                  <div style={styles.itemBody}>
                    {editingId === item.id ? (
                      <div style={styles.editRow}>
                        <input
                          style={styles.editInput}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <button style={styles.saveBtn} onClick={() => saveEdit(item.id)}>Save</button>
                        <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <span style={{ ...styles.itemText, textDecoration: item.completed ? "line-through" : "none" }}>
                        {item.text}
                        {item.dateTime && <span style={styles.dateTag}> 📆 {item.dateTime}</span>}
                      </span>
                    )}
                    {item.priority === "High" && (
                      <span style={styles.highBadge}>High Priority</span>
                    )}
                  </div>
                  <div style={styles.actions}>
                    <button style={styles.actionBtn} title="Toggle priority" onClick={() => togglePriority(item.id)}>
                      {item.priority === "High" ? "🔴" : "⚪"}
                    </button>
                    <button style={styles.actionBtn} title="Edit" onClick={() => startEdit(item)}>✏️</button>
                    <button style={styles.actionBtn} title="Delete" onClick={() => deleteItem(item.id)}>🗑️</button>
                  </div>
                </div>
              ))}

              {/* Add item row */}
              {addingCategory === cat ? (
                <div style={styles.addRow}>
                  <input
                    style={styles.editInput}
                    placeholder="New item..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addItem(cat); if (e.key === "Escape") setAddingCategory(null); }}
                    autoFocus
                  />
                  <button style={styles.saveBtn} onClick={() => addItem(cat)}>Add</button>
                  <button style={styles.cancelBtn} onClick={() => setAddingCategory(null)}>Cancel</button>
                </div>
              ) : (
                <button style={styles.addBtn} onClick={() => { setAddingCategory(cat); setNewItemText(""); }}>
                  + Add item
                </button>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    fontFamily: "system-ui, sans-serif",
    padding: "24px 16px",
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 26, color: "#1a202c" },
  progress: { margin: "4px 0 0", color: "#718096", fontSize: 14 },
  newBtn: {
    padding: "8px 16px",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 3,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#48bb78",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  section: {
    background: "#fff",
    borderRadius: 12,
    padding: "16px",
    marginBottom: 16,
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  catIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: 4,
  },
  catTitle: { margin: 0, fontSize: 16, fontWeight: 700, flex: 1 },
  catCount: { fontSize: 13, color: "#a0aec0" },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 0",
    borderTop: "1px solid #f7fafc",
  },
  checkbox: { marginTop: 3, width: 18, height: 18, cursor: "pointer", flexShrink: 0 },
  itemBody: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  itemText: { fontSize: 15, color: "#2d3748", lineHeight: 1.4 },
  dateTag: { fontSize: 12, color: "#718096" },
  highBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color: "#c05621",
    background: "#fffaf0",
    border: "1px solid #fbd38d",
    borderRadius: 4,
    padding: "1px 6px",
    width: "fit-content",
  },
  actions: { display: "flex", gap: 4, flexShrink: 0 },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 4px",
    borderRadius: 4,
  },
  editRow: { display: "flex", gap: 6, alignItems: "center" },
  addRow: { display: "flex", gap: 6, alignItems: "center", marginTop: 8 },
  editInput: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #cbd5e0",
    fontSize: 14,
    outline: "none",
  },
  saveBtn: {
    padding: "6px 12px",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: {
    padding: "6px 12px",
    background: "#edf2f7",
    color: "#4a5568",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  addBtn: {
    marginTop: 8,
    background: "none",
    border: "none",
    color: "#3182ce",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    padding: "4px 0",
  },
};
