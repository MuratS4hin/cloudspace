import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDownloadUrl,
  buildPreviewUrl,
  createFolder,
  deleteFile,
  listFilesInFolder,
  listFolders,
  login,
  moveFile,
  register,
} from "./api";

function bytesToSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** idx).toFixed(1)} ${units[idx]}`;
}

function typeIcon(contentType) {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.startsWith("video/")) return "🎬";
  if (contentType === "application/pdf") return "📄";
  if (contentType.includes("word") || contentType.includes("document")) return "📝";
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "📊";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "🗜️";
  if (contentType.startsWith("audio/")) return "🎵";
  if (contentType.startsWith("text/")) return "📃";
  return "📦";
}

function buildFolderIndex(folders) {
  const index = new Map();
  folders.forEach((f) => {
    const key = f.parent_id || null;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(f);
  });
  for (const children of index.values()) {
    children.sort((a, b) => a.name.localeCompare(b.name));
  }
  return index;
}

function getFolderPath(folderId, folderById) {
  const path = [];
  let cur = folderId ? folderById.get(folderId) : null;
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id ? folderById.get(cur.parent_id) : null;
  }
  return path;
}

// ─── sidebar folder tree ────────────────────────────────────────────────────

function FolderTree({ folders, currentFolderId, onOpenFolder }) {
  const idx = useMemo(() => buildFolderIndex(folders), [folders]);

  function renderNode(folder, depth = 0) {
    const children = idx.get(folder.id) || [];
    const active = currentFolderId === folder.id;
    return (
      <div key={folder.id}>
        <button
          className={`tree-node${active ? " active" : ""}`}
          style={{ paddingLeft: `${0.9 + depth * 1.1}rem` }}
          onClick={() => onOpenFolder(folder.id)}
        >
          <span className="tree-icon">{active ? "📂" : "📁"}</span>
          <span className="tree-label">{folder.name}</span>
        </button>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = idx.get(null) || [];
  return (
    <div className="tree-root">
      <button
        className={`tree-node${currentFolderId === null ? " active" : ""}`}
        onClick={() => onOpenFolder(null)}
      >
        <span className="tree-icon">🏠</span>
        <span className="tree-label">My Drive</span>
      </button>
      {roots.map((f) => renderNode(f, 0))}
    </div>
  );
}

// ─── preview modal ──────────────────────────────────────────────────────────

function PreviewModal({ file, token, allFolders, onClose, onDelete, onMove }) {
  const previewUrl = buildPreviewUrl(file.id, token);
  const downloadUrl = buildDownloadUrl(file.id, token);
  const [moveTarget, setMoveTarget] = useState(file.folder_id || "");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleMove() {
    setMoving(true);
    await onMove(file.id, moveTarget || null);
    setMoving(false);
    onClose();
  }

  const isImage = file.content_type.startsWith("image/");
  const isVideo = file.content_type.startsWith("video/");
  const isPdf   = file.content_type === "application/pdf";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <span className="modal-title">
            <span>{typeIcon(file.content_type)}</span>
            <span>{file.original_name}</span>
          </span>
          <div className="modal-header-actions">
            <a className="btn btn-secondary" href={downloadUrl} download={file.original_name}>
              Download
            </a>
            <button className="btn btn-danger" onClick={() => { onDelete(file.id); onClose(); }}>
              Delete
            </button>
            <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="modal-body">
          {isImage && <img className="modal-media" src={previewUrl} alt={file.original_name} />}
          {isVideo && <video className="modal-media" src={previewUrl} controls />}
          {isPdf   && <iframe className="modal-pdf" src={previewUrl} title={file.original_name} />}
          {!isImage && !isVideo && !isPdf && (
            <div className="modal-no-preview">
              <span className="modal-big-icon">{typeIcon(file.content_type)}</span>
              <p>No preview available for this file type.</p>
              <a className="btn btn-primary" href={downloadUrl} download={file.original_name}>Download to open</a>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <span className="modal-meta">{bytesToSize(file.size_bytes)} · {file.content_type}</span>
          <div className="modal-move">
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
              <option value="">My Drive</option>
              {allFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={handleMove} disabled={moving}>
              {moving ? "Moving…" : "Move here"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── file icon card ─────────────────────────────────────────────────────────

function FileIcon({ file, token, onOpen }) {
  const isImage = file.content_type.startsWith("image/");
  const previewUrl = isImage ? buildPreviewUrl(file.id, token) : null;

  return (
    <button className="icon-item" onClick={onOpen}>
      <span className="icon-thumb">
        {isImage
          ? <img className="thumb-img" src={previewUrl} alt={file.original_name} loading="lazy" />
          : <span className="thumb-type-icon">{typeIcon(file.content_type)}</span>
        }
      </span>
      <span className="icon-label" title={file.original_name}>{file.original_name}</span>
      <span className="icon-size">{bytesToSize(file.size_bytes)}</span>
    </button>
  );
}

// ─── XHR upload with progress ────────────────────────────────────────────────

function uploadFileWithProgress(token, file, folderId, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("uploaded_file", file);
    if (folderId) formData.append("folder_id", folderId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(null); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).detail || "Upload failed")); }
        catch { reject(new Error("Upload failed")); }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(formData);
  });
}

// ─── main app ───────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode]               = useState("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [token, setToken]             = useState(localStorage.getItem("cloudspace_token") || "");

  const [folders, setFolders]         = useState([]);
  const [files, setFiles]             = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [newFolderName, setNewFolderName]   = useState("");
  const [error, setError]             = useState("");

  const uploadInputRef = useRef(null);
  const isAuthed = Boolean(token);

  useEffect(() => { localStorage.setItem("cloudspace_token", token); }, [token]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const currentFolder = useMemo(
    () => (currentFolderId ? folderById.get(currentFolderId) ?? null : null),
    [currentFolderId, folderById],
  );

  const breadcrumbs = useMemo(
    () => [{ id: null, name: "My Drive" }, ...getFolderPath(currentFolderId, folderById)],
    [currentFolderId, folderById],
  );

  const childFolders = useMemo(
    () => folders
      .filter((f) => (f.parent_id || null) === (currentFolderId || null))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [folders, currentFolderId],
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [folderResult, fileResult] = await Promise.all([
        listFolders(token),
        listFilesInFolder(token, currentFolderId),
      ]);
      setFolders(folderResult);
      setFiles(fileResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, currentFolderId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "register") await register(email, password);
      const result = await login(email, password);
      setToken(result.access_token);
      setEmail(""); setPassword("");
    } catch (err) { setError(err.message); }
  }

  async function handleCreateFolder() {
    if (!token || !newFolderName.trim()) return;
    setError("");
    try {
      await createFolder(token, newFolderName.trim(), currentFolderId);
      setNewFolderName("");
      await loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleUpload(e) {
    const chosen = e.target.files?.[0];
    if (!chosen || !token) return;
    setError("");
    setUploadProgress({ name: chosen.name, pct: 0 });
    try {
      await uploadFileWithProgress(token, chosen, currentFolderId, (pct) =>
        setUploadProgress({ name: chosen.name, pct }),
      );
      await loadData();
      e.target.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadProgress(null);
    }
  }

  async function handleDelete(fileId) {
    if (!token) return;
    setError("");
    try { await deleteFile(token, fileId); await loadData(); }
    catch (err) { setError(err.message); }
  }

  async function handleMove(fileId, targetFolderId) {
    if (!token) return;
    setError("");
    try { await moveFile(token, fileId, targetFolderId); await loadData(); }
    catch (err) { setError(err.message); }
  }

  function openFolder(id) { setCurrentFolderId(id); setPreviewFile(null); }

  function handleLogout() {
    setToken(""); setFolders([]); setFiles([]);
    setCurrentFolderId(null); setPreviewFile(null);
    localStorage.removeItem("cloudspace_token");
  }

  // ── auth page ──────────────────────────────────────────────────────────────

  if (!isAuthed) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">☁️</div>
          <h1>CloudSpace</h1>
          <p>Your self-hosted cloud storage.</p>
          <form onSubmit={handleAuthSubmit}>
            <input type="email" placeholder="Email address" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="btn btn-primary btn-full">
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  // ── drive page ─────────────────────────────────────────────────────────────

  return (
    <>
      <main className="app-shell">

        {/* sidebar */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <span>☁️</span>
              <span>CloudSpace</span>
            </div>
            <button className="text-button sidebar-logout" onClick={handleLogout}>Sign out</button>
          </div>

          <div className="sidebar-section-label">Favourites</div>

          <FolderTree folders={folders} currentFolderId={currentFolderId} onOpenFolder={openFolder} />

          <div className="sidebar-bottom">
            <div className="new-folder-row">
              <input
                className="new-folder-input"
                type="text"
                placeholder="New folder…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              <button className="btn-icon" title="Create folder"
                onClick={handleCreateFolder} disabled={!newFolderName.trim()}>+</button>
            </div>
          </div>
        </aside>

        {/* main content */}
        <section className="content">
          <header className="toolbar">
            <nav className="breadcrumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.id ?? "root"} className="breadcrumb-item">
                  <button className="breadcrumb-btn" onClick={() => openFolder(crumb.id)}>
                    {crumb.name}
                  </button>
                  {i < breadcrumbs.length - 1 && <span className="breadcrumb-sep">›</span>}
                </span>
              ))}
            </nav>

            <div className="toolbar-actions">
              {currentFolder && (
                <button className="btn btn-ghost"
                  onClick={() => openFolder(currentFolder.parent_id || null)}>↑ Up</button>
              )}
              <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
                {loading ? "…" : "↻ Refresh"}
              </button>
              <label className="btn btn-primary upload-label">
                ↑ Upload
                <input ref={uploadInputRef} type="file" className="upload-hidden"
                  onChange={handleUpload} disabled={!!uploadProgress} />
              </label>
            </div>
          </header>

          {uploadProgress && (
            <div className="upload-progress-wrap">
              <div className="upload-progress-info">
                <span>Uploading {uploadProgress.name}</span>
                <span>{uploadProgress.pct}%</span>
              </div>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${uploadProgress.pct}%` }} />
              </div>
            </div>
          )}

          {error && <p className="error-banner">{error}</p>}

          {/* folder grid */}
          {childFolders.length > 0 && (
            <>
              <div className="section-heading">Folders</div>
              <div className="icon-grid">
                {childFolders.map((folder) => (
                  <button key={folder.id} className="icon-item" onClick={() => openFolder(folder.id)}>
                    <span className="icon-thumb folder-thumb">📁</span>
                    <span className="icon-label">{folder.name}</span>
                    <span className="icon-size">Folder</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* file grid */}
          {files.length > 0 && (
            <>
              <div className="section-heading">Files</div>
              <div className="icon-grid">
                {files.map((file) => (
                  <FileIcon key={file.id} file={file} token={token} onOpen={() => setPreviewFile(file)} />
                ))}
              </div>
            </>
          )}

          {childFolders.length === 0 && files.length === 0 && !loading && (
            <div className="empty-state">
              <span className="empty-icon">📂</span>
              <p>This folder is empty</p>
              <label className="btn btn-primary upload-label">
                Upload a file
                <input type="file" className="upload-hidden" onChange={handleUpload} disabled={!!uploadProgress} />
              </label>
            </div>
          )}
        </section>
      </main>

      {previewFile && (
        <PreviewModal
          file={previewFile}
          token={token}
          allFolders={folders}
          onClose={() => setPreviewFile(null)}
          onDelete={handleDelete}
          onMove={handleMove}
        />
      )}
    </>
  );
}
