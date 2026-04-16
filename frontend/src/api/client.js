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
