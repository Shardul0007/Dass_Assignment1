const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3500";

const joinUrl = (base, path) => {
  const trimmedBase = String(base || "").replace(/\/+$/, "");
  const trimmedPath = String(path || "").replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
};

export const api_requests = async (url, method = "GET", body = null) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(joinUrl(API_BASE, url), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (response.status === 401) {
    localStorage.clear();
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let data = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      (data && data.message) || response.statusText || "API request failed",
    );
  }
  return data;
};
