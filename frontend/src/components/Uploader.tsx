import React, { useState, useRef } from "react";
import type { Checklist } from "@shared/types";
import { getMockChecklist } from "../utils/parser";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const MAX_MB = 10;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  onChecklistReady: (checklist: Checklist) => void;
  accessToken?: string;
}

export const Uploader: React.FC<Props> = ({ onChecklistReady, accessToken = "" }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError("");
    if (!ACCEPTED.includes(file.type)) {
      setError("Only JPEG, PNG, or PDF files are accepted.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB} MB.`);
      return;
    }
    if (file.type !== "application/pdf") {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
    processFile(file);
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setError("");
    try {
      // Step 1: get a pre-signed upload URL
      const uploadRes = await fetch(`${API_BASE}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": accessToken },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!uploadRes.ok) throw new Error("Failed to get upload URL.");
      const { uploadId, uploadUrl } = await uploadRes.json();

      // Step 2: PUT the file directly to S3
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Failed to upload file.");

      // Step 3: call the Extractor Lambda
      const extractRes = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": accessToken },
        body: JSON.stringify({ uploadId, contentType: file.type }),
      });
      if (!extractRes.ok) {
        const { error } = await extractRes.json().catch(() => ({}));
        throw new Error(error ?? "Text extraction failed. Please check the image quality and try again.");
      }
      const { rawText } = await extractRes.json();

      // Step 4: call the Parser Lambda
      const parseRes = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": accessToken },
        body: JSON.stringify({ rawText }),
      });
      if (!parseRes.ok) {
        const { error } = await parseRes.json().catch(() => ({}));
        throw new Error(error ?? "Failed to generate checklist.");
      }
      const checklist = await parseRes.json();
      onChecklistReady(checklist);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to process file.");
    } finally {
      setLoading(false);
    }
  };

  const useMockData = () => {
    setLoading(true);
    setTimeout(() => {
      onChecklistReady(getMockChecklist("demo-user"));
      setLoading(false);
    }, 800);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Discharge Checklist</h1>
        <p style={styles.subtitle}>Upload your discharge papers to generate an interactive checklist.</p>

        <div
          style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <span style={styles.uploadIcon}>📄</span>
          <p style={styles.dropText}>Drag & drop or click to upload</p>
          <p style={styles.dropHint}>JPEG, PNG, or PDF · Max 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {preview && (
          <img src={preview} alt="Preview" style={styles.preview} />
        )}

        {error && <p style={styles.error}>{error}</p>}

        {loading && (
          <div style={styles.loading}>
            <span style={styles.spinner} />
            Extracting checklist items...
          </div>
        )}

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        <button style={styles.mockBtn} onClick={useMockData} disabled={loading}>
          Load sample discharge data
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4f8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: 16,
  },
  container: {
    background: "#fff",
    borderRadius: 12,
    padding: "2rem",
    width: "100%",
    maxWidth: 520,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  title: { margin: 0, fontSize: 24, color: "#1a202c" },
  subtitle: { color: "#718096", marginTop: 6, marginBottom: 24 },
  dropzone: {
    border: "2px dashed #cbd5e0",
    borderRadius: 10,
    padding: "2rem",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  dropzoneActive: { borderColor: "#3182ce", background: "#ebf8ff" },
  uploadIcon: { fontSize: 40 },
  dropText: { margin: "8px 0 4px", fontWeight: 600, color: "#2d3748" },
  dropHint: { margin: 0, fontSize: 13, color: "#a0aec0" },
  preview: { width: "100%", borderRadius: 8, marginTop: 16, maxHeight: 240, objectFit: "cover" },
  error: { color: "#e53e3e", fontSize: 14, marginTop: 12 },
  loading: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, color: "#4a5568" },
  spinner: {
    width: 18, height: 18,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #3182ce",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  divider: { textAlign: "center", margin: "20px 0", position: "relative" },
  dividerText: { background: "#fff", padding: "0 12px", color: "#a0aec0", fontSize: 13 },
  mockBtn: {
    width: "100%",
    padding: "11px",
    background: "#edf2f7",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#4a5568",
    cursor: "pointer",
  },
};
