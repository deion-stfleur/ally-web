import axios from "axios";

const baseURL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

/**
 * @param {string | null} sessionToken
 */
export function setAuthHeader(sessionToken) {
  if (sessionToken) {
    api.defaults.headers.common.Authorization = `Bearer ${sessionToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

const SESSION_TOKEN_KEY = "ally_session_token";

function clearStaleSession() {
  setAuthHeader(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    window.dispatchEvent(new CustomEvent("ally:session-expired"));
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    const stale =
      status === 401 &&
      (detail === "Session not found" ||
        detail === "Invalid or expired session" ||
        detail === "Not authenticated");
    if (stale) {
      clearStaleSession();
    }
    return Promise.reject(err);
  }
);
