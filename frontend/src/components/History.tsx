import React, { useEffect, useState } from "react";
import type { Checklist } from "@shared/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  accessToken: string;
  userId: string;
  onOpen: (checklist: Checklist) => void;
}

// ---------------------------------------------------------------------------
// Calendar — shows completion status from discharge start to end date
// ---------------------------------------------------------------------------

function CompletionCalendar({ checklists }: { checklists: Checklist[] }) {
  if (checklists.length === 0) return null;

  // Start = earliest checklist creation date
  const startDate = new Date(
    Math.min(...checklists.map((cl) => new Date(cl.createdAt).getTime()))
  );
  startDate.setHours(0, 0, 0, 0);

  // End = latest dateTime found across all items (e.g. "follow up in 4 weeks")
  // Fall back to 30 days from start
  let endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);

  for (const cl of checklists) {
    for (const item of cl.items) {
      if (item.dateTime) {
        const d = new Date(item.dateTime);
        if (!isNaN(d.getTime()) && d > endDate) endDate = d;
      }
    }
  }

  // Build set of dates where at least one item was completed
  const completedDates = new Set<string>();
  for (const cl of checklists) {
    const completed = cl.items.filter((i) => i.completed).length;
    if (completed > 0) completedDates.add(cl.updatedAt.slice(0, 10));
  }

  // Generate all days in range
  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group days by month for display
  const months: { label: string; days: (Date | null)[] }[] = [];
  let currentMonth = -1;
  let currentGroup: (Date | null)[] = [];

  for (const day of days) {
    const m = day.getMonth();
    if (m !== currentMonth) {
      if (currentGroup.length > 0) months.push({ label: months.length > 0 ? "" : "", days: currentGroup });
      currentMonth = m;
      currentGroup = Array(day.getDay()).fill(null); // pad start
      months.push({
        label: day.toLocaleString("default", { month: "long", year: "numeric" }),
        days: currentGroup,
      });
    }
    currentGroup.push(day);
  }

  const totalDays = days.length;
  const completedCount = days.filter((d) => {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return completedDates.has(ds);
  }).length;
  const pastDays = days.filter((d) => d <= today).length;
  const streak = (() => {
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d > today) continue;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (completedDates.has(ds)) s++;
      else break;
    }
    return s;
  })();

  return (
    <div style={cal.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={cal.title}>Recovery Calendar</p>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={cal.stat}><b>{streak}</b> day streak 🔥</span>
          <span style={cal.stat}><b>{completedCount}</b>/{pastDays} days</span>
        </div>
      </div>

      {months.map((month, mi) => (
        <div key={mi} style={{ marginBottom: 16 }}>
          {month.label && <p style={cal.monthLabel}>{month.label}</p>}
          <div style={cal.grid}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} style={cal.dayLabel}>{d}</div>
            ))}
            {month.days.map((day, i) => {
              if (!day) return <div key={`e-${mi}-${i}`} />;
              const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const isToday = day.getTime() === today.getTime();
              const isPast = day < today;
              const done = completedDates.has(ds);
              const isFuture = day > today;

              return (
                <div
                  key={ds}
                  style={{
                    ...cal.cell,
                    background: done ? "#34c759" : isPast ? "#ffecec" : "transparent",
                    color: done ? "#fff" : isToday ? "#007AFF" : isFuture ? "#c7c7cc" : "#ff3b30",
                    fontWeight: isToday ? 700 : 400,
                    border: isToday ? "2px solid #007AFF" : "2px solid transparent",
                    opacity: isFuture ? 0.4 : 1,
                  }}
                  title={done ? "Completed ✓" : isPast ? "Missed" : isToday ? "Today" : "Upcoming"}
                >
                  {day.getDate()}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={cal.legend}>
        <span style={dot("#34c759")} /> Completed
        <span style={{ ...dot("#ffecec"), marginLeft: 12, border: "1px solid #ffb3b3" }} /> Missed
        <span style={{ ...dot("transparent"), marginLeft: 12, border: "2px solid #007AFF" }} /> Today
      </div>

      <p style={cal.range}>
        {startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
        {endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        {" "}· {totalDays} day recovery plan
      </p>
    </div>
  );
}

const cal: Record<string, React.CSSProperties> = {
  wrap: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 16,
    padding: "16px 18px",
    marginBottom: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    border: "1px solid rgba(255,255,255,0.6)",
  },
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: "#1c1c1e" },
  monthLabel: { margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#8e8e93" },
  stat: { fontSize: 13, color: "#8e8e93" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  dayLabel: { fontSize: 11, color: "#8e8e93", textAlign: "center", fontWeight: 600, paddingBottom: 4 },
  cell: {
    aspectRatio: "1",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    cursor: "default",
  },
  legend: { display: "flex", alignItems: "center", marginTop: 10, fontSize: 12, color: "#8e8e93", flexWrap: "wrap", gap: 4 },
  range: { margin: "8px 0 0", fontSize: 12, color: "#8e8e93", textAlign: "center" },
};

const dot = (color: string): React.CSSProperties => ({
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: color,
  marginRight: 5,
});

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

export const History: React.FC<Props> = ({ accessToken, userId, onOpen }) => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <CompletionCalendar checklists={checklists} />

      {checklists.length === 0 ? (
        <div style={s.center}>No past checklists yet.</div>
      ) : (
        <div style={s.list}>
          {checklists.map((cl) => {
            const completed = cl.items.filter((i) => i.completed).length;
            const total = cl.items.length;
            const pct = total ? Math.round((completed / total) * 100) : 0;
            const date = new Date(cl.createdAt).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            });

            return (
              <div key={cl.id} style={s.card} onClick={() => onOpen(cl)}>
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
              </div>
            );
          })}
        </div>
      )}
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
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    border: "1px solid rgba(255,255,255,0.6)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  date: { fontSize: 15, fontWeight: 600, color: "#1c1c1e" },
  pct: { fontSize: 15, fontWeight: 700 },
  track: { height: 5, background: "#e5e5ea", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  fill: { height: "100%", borderRadius: 3 },
  sub: { margin: 0, fontSize: 13, color: "#8e8e93" },
};
