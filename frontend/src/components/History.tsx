import React, { useEffect, useState } from "react";
import type { Checklist } from "@shared/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  accessToken: string;
  userId: string;
  onOpen: (checklist: Checklist) => void;
}

// ---------------------------------------------------------------------------
// Day-by-day completion log for a single checklist
// ---------------------------------------------------------------------------
function ChecklistDetail({ cl, onBack }: { cl: Checklist; onBack: () => void }) {
  const createdAt = new Date(cl.createdAt);
  createdAt.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build day range from creation to today
  const days: Date[] = [];
  const cursor = new Date(createdAt);
  while (cursor <= today) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  // completedDates: set of "YYYY-MM-DD" strings where items were completed
  // We use updatedAt as a proxy — if updatedAt is on that day and items are completed
  const completedDates = new Set<string>();
  const updatedDay = cl.updatedAt.slice(0, 10);
  const completedCount = cl.items.filter((i) => i.completed).length;
  if (completedCount > 0) completedDates.add(updatedDay);

  return (
    <div>
      <button onClick={onBack} style={s.backBtn}>← Back to documents</button>
      <div style={s.detailHeader}>
        <span style={s.date}>
          Uploaded {createdAt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </span>
        <span style={{ fontSize: 13, color: "#8e8e93" }}>{cl.items.filter(i => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments").length} checklist items</span>
      </div>

      <div style={s.list}>
        {days.map((day) => {
          const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const isToday = day.getTime() === today.getTime();
          const done = completedDates.has(ds);
          const label = isToday ? "Today" : day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

          return (
            <div key={ds} style={{ ...s.dayRow, borderLeft: `3px solid ${done ? "#34c759" : isToday ? "#007AFF" : "#e5e5ea"}` }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? "#007AFF" : "#1c1c1e" }}>{label}</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: done ? "rgba(52,199,89,0.12)" : isToday ? "rgba(0,122,255,0.1)" : "#f2f2f7",
                color: done ? "#34c759" : isToday ? "#007AFF" : "#8e8e93",
              }}>
                {done ? "✓ Completed" : isToday ? "In progress" : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------
export const History: React.FC<Props> = ({ accessToken, userId, onOpen }) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Checklist | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/checklists?userId=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load history.");
        const data = await res.json();
        setChecklists(
          (data as Checklist[]).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
      } catch {
        setError("Could not load past checklists.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken, userId]);

  if (loading) return <div style={s.center}>Loading history…</div>;
  if (error) return <div style={s.center}>{error}</div>;
  if (checklists.length === 0) return <div style={s.center}>No past documents yet.</div>;

  if (selected) {
    return <ChecklistDetail cl={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#1c1c1e" }}>Your Documents</p>
      <div style={s.list}>
        {checklists.map((cl) => {
          const completed = cl.items.filter((i) => i.completed && i.category !== "WarningSigns" && i.category !== "FollowUpAppointments").length;
          const total = cl.items.filter((i) => i.category !== "WarningSigns" && i.category !== "FollowUpAppointments").length;
          const pct = total ? Math.round((completed / total) * 100) : 0;
          const date = new Date(cl.createdAt).toLocaleDateString(undefined, {
            month: "short", day: "numeric", year: "numeric",
          });

          return (
            <div key={cl.id} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.date}>{date}</span>
                <span style={{ ...s.pct, color: pct === 100 ? "#34c759" : pct > 50 ? "#007AFF" : "#ff9500" }}>
                  {pct}%
                </span>
              </div>
              <div style={s.track}>
                <div style={{ ...s.fill, width: `${pct}%`, background: pct === 100 ? "#34c759" : "#007AFF" }} />
              </div>
              <p style={s.sub}>{completed} of {total} items completed</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={s.btnPrimary} onClick={() => setSelected(cl)}>View progress</button>
                <button style={s.btnSecondary} onClick={() => onOpen(cl)}>Open checklist</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  center: { textAlign: "center", color: "#8e8e93", padding: "40px 0", fontSize: 15 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 14,
    padding: "14px 18px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    border: "1px solid rgba(255,255,255,0.6)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  date: { fontSize: 15, fontWeight: 600, color: "#1c1c1e" },
  pct: { fontSize: 15, fontWeight: 700 },
  track: { height: 5, background: "#e5e5ea", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  fill: { height: "100%", borderRadius: 3 },
  sub: { margin: 0, fontSize: 13, color: "#8e8e93" },
  btnPrimary: {
    padding: "7px 16px", background: "#007AFF", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  btnSecondary: {
    padding: "7px 16px", background: "#f2f2f7", color: "#007AFF",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  backBtn: {
    background: "none", border: "none", color: "#007AFF", cursor: "pointer",
    fontSize: 14, fontWeight: 600, padding: "0 0 16px", fontFamily: "inherit",
    display: "block",
  },
  detailHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  dayRow: {
    display: "flex", alignItems: "center", gap: 12,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 8,
    boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
  },
};
