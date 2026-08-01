import { identityService, type GameUser } from "./identity-service.ts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

type AuthPayload = {
  ok: boolean;
  token?: string;
  session_id?: string;
  user?: { id: string; display_name: string; avatar_url: string | null; best_score: number };
};

function toUser(value: NonNullable<AuthPayload["user"]>): GameUser {
  return { id: value.id, displayName: value.display_name, avatarUrl: value.avatar_url, bestScore: value.best_score };
}

export async function signInWithGoogle(credential: string, localBestScore: number): Promise<GameUser> {
  const response = await fetch(`${apiBaseUrl}/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential, client_id: identityService.currentVisitorId, local_best_score: localBestScore }),
  });
  const body = await response.json() as AuthPayload;
  if (!response.ok || !body.ok || !body.token || !body.session_id || !body.user) throw new Error("sign_in_failed");
  const user = toUser(body.user);
  identityService.setSession({ token: body.token, sessionId: body.session_id, user });
  return user;
}

export async function restoreSession(): Promise<GameUser | null> {
  if (!identityService.token) return null;
  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, { headers: authHeaders() });
    const body = await response.json() as AuthPayload;
    if (!response.ok || !body.ok || !body.user || !body.session_id) {
      identityService.clearSessionAndRotateVisitor();
      return null;
    }
    const user = toUser(body.user);
    identityService.setSession({ token: identityService.token!, sessionId: body.session_id, user });
    return user;
  } catch { return identityService.user; }
}

export async function logout(): Promise<void> {
  try { await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", headers: authHeaders() }); } finally {
    identityService.clearSessionAndRotateVisitor();
  }
}

export async function deleteOwnAccount(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/account`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) throw new Error("delete_failed");
  identityService.clearSessionAndRotateVisitor();
}

export function authHeaders(): HeadersInit {
  return identityService.token ? { authorization: `Bearer ${identityService.token}` } : {};
}
