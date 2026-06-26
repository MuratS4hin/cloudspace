import { useEffect, useMemo, useState } from "react";

import { buildDownloadUrl, buildPreviewUrl, deleteFile, listFiles, login, register, uploadFile } from "./api";

function bytesToSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** idx).toFixed(1)} ${units[idx]}`;
}

function fileTypeLabel(contentType) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "application/pdf") return "pdf";
  return "file";
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("cloudspace_token") || "");

  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState("");

  const isAuthed = Boolean(token);

  useEffect(() => {
    localStorage.setItem("cloudspace_token", token);
  }, [token]);

  async function loadFiles() {
    if (!token) return;
    setLoadingFiles(true);
    setError("");
    try {
      const result = await listFiles(token);
      setFiles(result);
      if (!selected && result.length > 0) {
        setSelected(result[0]);
      }
      if (selected) {
        const match = result.find((file) => file.id === selected.id);
        setSelected(match || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingFiles(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [token]);

  const previewUrl = useMemo(() => {
    if (!selected || !token) return "";
    return buildPreviewUrl(selected.id, token);
  }, [selected, token]);

  const downloadUrl = useMemo(() => {
    if (!selected || !token) return "";
    return buildDownloadUrl(selected.id, token);
  }, [selected, token]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "register") {
        await register(email, password);
      }
      const result = await login(email, password);
      setToken(result.access_token);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpload(event) {
    const chosen = event.target.files?.[0];
    if (!chosen || !token) return;
    setUploading(true);
    setError("");
    try {
      await uploadFile(token, chosen);
      await loadFiles();
      event.target.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId) {
    if (!token) return;
    setError("");
    try {
      await deleteFile(token, fileId);
      if (selected?.id === fileId) {
        setSelected(null);
      }
      await loadFiles();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    setToken("");
    setFiles([]);
    setSelected(null);
    localStorage.removeItem("cloudspace_token");
  }

  if (!isAuthed) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>CloudSpace</h1>
          <p>Self-hosted cloud storage for your files.</p>
          <form onSubmit={handleAuthSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit">{mode === "login" ? "Login" : "Create account"}</button>
          </form>
          <button className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}> 
            {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h2>Your Files</h2>
          <button className="text-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <label className="upload-button">
          {uploading ? "Uploading..." : "Upload file"}
          <input type="file" onChange={handleUpload} disabled={uploading} />
        </label>

        <button className="secondary-button" onClick={loadFiles} disabled={loadingFiles}>
          {loadingFiles ? "Refreshing..." : "Refresh list"}
        </button>

        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id} className={selected?.id === file.id ? "active" : ""}>
              <button className="file-entry" onClick={() => setSelected(file)}>
                <strong>{file.original_name}</strong>
                <span>
                  {fileTypeLabel(file.content_type)} • {bytesToSize(file.size_bytes)}
                </span>
              </button>
              <button className="danger-button" onClick={() => handleDelete(file.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="preview-area">
        {!selected && <p>Select a file to preview.</p>}

        {selected && (
          <>
            <header className="preview-header">
              <div>
                <h3>{selected.original_name}</h3>
                <p>
                  {selected.content_type} • {bytesToSize(selected.size_bytes)}
                </p>
              </div>
              <a className="secondary-button" href={downloadUrl}>
                Download
              </a>
            </header>

            {selected.content_type.startsWith("image/") && <img className="media-preview" src={previewUrl} alt={selected.original_name} />}

            {selected.content_type.startsWith("video/") && <video className="media-preview" src={previewUrl} controls />}

            {selected.content_type === "application/pdf" && <iframe className="pdf-preview" src={previewUrl} title={selected.original_name} />}

            {!selected.content_type.startsWith("image/") &&
              !selected.content_type.startsWith("video/") &&
              selected.content_type !== "application/pdf" && (
                <p>
                  This type cannot be previewed inline. Use the download button.
                </p>
              )}
          </>
        )}

        {error && <p className="error-text">{error}</p>}
      </section>
    </main>
  );
}
