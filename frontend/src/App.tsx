import React, { useState } from "react";
import { Uploader } from "./components/Uploader";
import { ChecklistView } from "./components/ChecklistView";
import { Login } from "./components/Login";
import type { Checklist } from "@shared/types";

type AppState = "login" | "upload" | "checklist";

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("login");
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  if (appState === "login") {
    return <Login onLogin={() => setAppState("upload")} />;
  }

  if (appState === "upload" || !checklist) {
    return (
      <Uploader
        onChecklistReady={(cl) => {
          setChecklist(cl);
          setAppState("checklist");
        }}
      />
    );
  }

  return (
    <ChecklistView
      checklist={checklist}
      onChange={setChecklist}
      onNewUpload={() => {
        setChecklist(null);
        setAppState("upload");
      }}
    />
  );
};

export default App;
