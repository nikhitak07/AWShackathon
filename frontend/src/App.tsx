import React, { useState, useCallback } from "react";
import { Uploader } from "./components/Uploader";
import { ChecklistView } from "./components/ChecklistView";
import { Login } from "./components/Login";
import { Assistant } from "./components/Assistant";
import { History } from "./components/History";
import type { Checklist } from "@shared/types";

type AppState = "login" | "upload" | "checklist";
type Tab = "checklist" | "history";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Resets completed flags if the checklist was last updated on a previous day */
function applyDailyReset(cl: Checklist): Checklist {
  const today = new Date().toDateString();
  const lastUpdate = new Date(cl.updatedAt).toDateString();
  if (lastUpdate === today) return cl;
  return {
    ...cl,
    items: cl.items.map((i) => ({ ...i, completed: false })),
    updatedAt: new Date().toISOString(),
  };
}

/** Decode userId (sub) from JWT token */
function getUserId(token: string): string {
  try {
    return JSON.parse(atob(token.split(".")[1])).sub as string;
  } catch {
    return "";
  }
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("login");
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [saveError, setSaveError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState<Tab>("checklist");

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const handleChecklistChange = useCallback(async (cl: Checklist) => {
    setChecklist(cl);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/checklists/${cl.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(cl),
      });
      if (res.status === 503) {
        setSaveError("Changes could not be saved — storage unavailable. Please try again.");
      }
    } catch {
      setSaveError("Changes could not be saved. Check your connection.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (appState === "login") {
    return (
      <Login
        onLogin={(token) => {
          setAccessToken(token);
          setUserId(getUserId(token));
          setAppState("upload");
        }}
      />
    );
  }

  if (appState === "upload" || !checklist) {
    return (
      <Uploader
        accessToken={accessToken}
        onChecklistReady={async (cl) => {
          const reset = applyDailyReset(cl);
          setChecklist(reset);
          setAppState("checklist");
          setTab("checklist");
          try {
            await fetch(`${API_BASE}/checklists`, {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(reset),
            });
          } catch {
            // Non-blocking
          }
        }}
      />
    );
  }

  return (
    <>
      {saveError && (
        <div style={{ background: "#fff5f5", color: "#c53030", padding: "10px 16px", textAlign: "center", fontSize: 14 }}>
          {saveError}
        </div>
      )}

      {/* Tab bar */}
      <div style={tabBar}>
        <button
          style={{ ...tabBtn, ...(tab === "checklist" ? tabBtnActive : {}) }}
          onClick={() => setTab("checklist")}
        >
          Today
        </button>
        <button
          style={{ ...tabBtn, ...(tab === "history" ? tabBtnActive : {}) }}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          style={{ ...tabBtn, marginLeft: "auto" }}
          onClick={() => {
            setChecklist(null);
            setSaveError("");
            setAppState("upload");
          }}
        >
          + New Upload
        </button>
      </div>

      {tab === "checklist" && (
        <ChecklistView
          checklist={checklist}
          onChange={handleChecklistChange}
          onNewUpload={() => {
            setChecklist(null);
            setSaveError("");
            setAppState("upload");
          }}
        />
      )}

      {tab === "history" && (
        <div style={historyWrap}>
          <History
            accessToken={accessToken}
            userId={userId}
            onOpen={(cl) => {
              setChecklist(applyDailyReset(cl));
              setTab("checklist");
            }}
          />
        </div>
      )}

      <Assistant checklist={checklist} accessToken={accessToken} />
    </>
  );
};

const tabBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderBottom: "1px solid #e5e5ea",
  position: "sticky",
  top: 0,
  zIndex: 100,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
};

const tabBtn: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  fontSize: 14,
  fontWeight: 500,
  color: "#8e8e93",
  cursor: "pointer",
};

const tabBtnActive: React.CSSProperties = {
  background: "#007AFF",
  color: "#fff",
  fontWeight: 600,
};

const historyWrap: React.CSSProperties = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "24px 16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
};

export default App;
