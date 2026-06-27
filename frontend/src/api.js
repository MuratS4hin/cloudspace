const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, { method = "GET", token, body, formData } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const parsed = await response.json();
      detail = parsed.detail || detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function register(email, password) {
  return request("/api/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export async function login(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function listFiles(token) {
  return request("/api/files", { token });
}

export async function listFilesInFolder(token, folderId) {
  const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : "";
  return request(`/api/files${query}`, { token });
}

export async function listFolders(token) {
  return request("/api/folders", { token });
}

export async function createFolder(token, name, parentId = null) {
  return request("/api/folders", {
    method: "POST",
    token,
    body: { name, parent_id: parentId },
  });
}

export async function uploadFile(token, file, folderId = null) {
  const formData = new FormData();
  formData.append("uploaded_file", file);
  if (folderId) {
    formData.append("folder_id", folderId);
  }
  return request("/api/files", { method: "POST", token, formData });
}

export async function deleteFile(token, fileId) {
  return request(`/api/files/${fileId}`, { method: "DELETE", token });
}

export async function moveFile(token, fileId, folderId = null) {
  const formData = new FormData();
  if (folderId) {
    formData.append("folder_id", folderId);
  }
  return request(`/api/files/${fileId}/move`, { method: "PATCH", token, formData });
}

export function buildPreviewUrl(fileId, token) {
  const query = new URLSearchParams({ token }).toString();
  return `${API_BASE}/api/files/${fileId}/preview?${query}`;
}

export function buildDownloadUrl(fileId, token) {
  const query = new URLSearchParams({ token }).toString();
  return `${API_BASE}/api/files/${fileId}/download?${query}`;
}
