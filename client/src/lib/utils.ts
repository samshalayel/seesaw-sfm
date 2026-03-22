import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getLocalStorage = (key: string): any =>
  JSON.parse(window.localStorage.getItem(key) || "null");
const setLocalStorage = (key: string, value: any): void =>
  window.localStorage.setItem(key, JSON.stringify(value));

export { getLocalStorage, setLocalStorage };

// --- RoomId helpers ---

let cachedRoomId: string = "default";

export function setRoomId(roomId: string) {
  cachedRoomId = roomId;
  window.localStorage.setItem("roomId", roomId);
}

export function getRoomId(): string {
  if (cachedRoomId === "default") {
    const stored = window.localStorage.getItem("roomId");
    if (stored) {
      cachedRoomId = stored;
    }
  }
  return cachedRoomId;
}

// --- JWT token helpers ---

let cachedToken: string | null = null;

export function setAuthToken(token: string) {
  cachedToken = token;
  window.localStorage.setItem("authToken", token);
}

export function getAuthToken(): string | null {
  if (!cachedToken) {
    cachedToken = window.localStorage.getItem("authToken");
  }
  return cachedToken;
}

export function clearAuthToken() {
  cachedToken = null;
  window.localStorage.removeItem("authToken");
}

// --- apiFetch: sends x-room-id and Authorization headers ---

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    "x-room-id": cachedRoomId,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}
