import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { clearAdminSession, getAdminSessionToken, setAdminSessionToken } from "./adminSession";

const TIMEOUT_MS = {
  adminLogin: 15_000,
  adminLogout: 10_000,
  getAdminDashboard: 120_000,
  listAdminUsers: 60_000,
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

async function callAdmin(functionName, data = {}, timeoutMs = TIMEOUT_MS.getAdminDashboard) {
  const fn = httpsCallable(functions, functionName);
  const sessionToken = getAdminSessionToken();
  const payload = sessionToken ? { ...data, sessionToken } : data;
  const result = await withTimeout(fn(payload), timeoutMs, functionName);
  return result;
}

export async function adminLogin(email, password) {
  const fn = httpsCallable(functions, "adminLogin");
  const result = await withTimeout(fn({ email, password }), TIMEOUT_MS.adminLogin, "adminLogin");
  const token = result.data?.sessionToken;
  if (!token) throw new Error("Login failed.");
  setAdminSessionToken(token);
  return result.data;
}

export async function adminLogout() {
  const token = getAdminSessionToken();
  if (token) {
    try {
      const fn = httpsCallable(functions, "adminLogout");
      await withTimeout(fn({ sessionToken: token }), TIMEOUT_MS.adminLogout, "adminLogout");
    } catch {
      /* clear local session anyway */
    }
  }
  clearAdminSession();
}

export const getAdminDashboard = () => callAdmin("getAdminDashboard", {}, TIMEOUT_MS.getAdminDashboard);
export const listAdminUsers = (data) => callAdmin("listAdminUsers", data, TIMEOUT_MS.listAdminUsers);

export function hasAdminSession() {
  return Boolean(getAdminSessionToken());
}
