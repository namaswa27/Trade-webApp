// src/auth/api.ts
const API_URL = "http://localhost:5000";

let accessToken: string | null = localStorage.getItem("access_token");

export function setAccessToken(t: string | null) {
  accessToken = t;
  if (t) localStorage.setItem("access_token", t);
  else localStorage.removeItem("access_token");
}

// Prevent multiple simultaneous refresh calls
let refreshing: Promise<any> | null = null;

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any).message || "Refresh failed");
        setAccessToken((data as any).accessToken);
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiFetch(
  path: string,
  opts: { method?: string; body?: any; retry?: boolean } = {}
) {
  const { method = "GET", body, retry = true } = opts;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // If access token expired, refresh once then retry one time
  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return apiFetch(path, { method, body, retry: false });
    } catch (e) {
      // Refresh failed => session is truly expired
      setAccessToken(null);
      throw e instanceof Error ? e : new Error("Session expired. Please login again.");
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).message || "Request failed");
  return data;
}
