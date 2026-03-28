import React, { useState, useCallback } from "react";
import { Uploader } from "./components/Uploader";
import { ChecklistView } from "./components/ChecklistView";
import { Login } from "./components/Login";
import type { Checklist } from "@shared/types";

type AppState = "login" | "upload" | "checklist";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("login");
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [saveError, setSaveError] = useState("");
  const [accessToken, setAccessToken] = useState("");

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
    return <Login onLogin={(token) => { setAccessToken(token); setAppState("upload"); }} />;
  }

  if (appState === "upload" || !checklist) {
    return (
      <Uploader
        accessToken={accessToken}
        onChecklistReady={async (cl) => {
          setChecklist(cl);
          setAppState("checklist");
          try {
            await fetch(`${API_BASE}/checklists`, {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(cl),
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
      <ChecklistView
        checklist={checklist}
        onChange={handleChecklistChange}
        onNewUpload={() => {
          setChecklist(null);
          setSaveError("");
          setAppState("upload");
        }}
      />
    </>
  );
};

export default App;
