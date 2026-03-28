import React, { useState, useCallback } from "react";
import { Uploader } from "./components/Uploader";
import { ChecklistView } from "./components/ChecklistView";
import { Login } from "./components/Login";
import { WelcomePage } from "./components/WelcomePage";
import type { Checklist } from "@shared/types";

type AppState = "welcome" | "login" | "upload" | "checklist";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function applyDailyReset(cl: Checklist): Checklist {  const today = new Date().toDateString();
  const lastUpdate = new Date(cl.updatedAt).toDateString();
  if (lastUpdate === today) return cl;
  return {
    ...cl,
    items: cl.items.map((i) => ({ ...i, completed: false })),
    updatedAt: new Date().toISOString(),
  };
}

function getDisplayName(token: string, cognitoUsername: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Cognito stores the user's full name in the "name" attribute
    return payload.name || payload.given_name || cognitoUsername;
  } catch {
    return cognitoUsername;
  }
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [saveError, setSaveError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [username, setUsername] = useState("");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = (id: string) =>
    setDeletedIds((prev) => new Set([...prev, id]));

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

  if (appState === "welcome") {
    return <WelcomePage onContinue={() => setAppState("login")} />;
  }

  if (appState === "login") {
    return (
      <Login
        onLogin={(token, user) => {
          setAccessToken(token);
          setUsername(getDisplayName(token, user));
          setAppState("upload");
        }}
      />
    );
  }

  if (appState === "upload" || !checklist) {
    return (
      <Uploader
        accessToken={accessToken}
        username={username}
        onHome={() => setAppState("welcome")}
        deletedIds={deletedIds}
        onDelete={handleDelete}
        onChecklistReady={async (cl) => {
          // New upload — apply daily reset and save to backend
          const reset = applyDailyReset(cl);
          setChecklist(reset);
          setAppState("checklist");
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
        onOpenExisting={(cl) => {
          // Reopening from history — use as-is, no reset
          setChecklist(cl);
          setAppState("checklist");
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
      <ChecklistView
        checklist={checklist}
        onChange={handleChecklistChange}
        username={username}
        accessToken={accessToken}
        onNewUpload={() => { setChecklist(null); setSaveError(""); setAppState("upload"); }}
      />
    </>
  );
};

export default App;
