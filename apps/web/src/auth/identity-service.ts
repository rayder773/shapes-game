export type GameUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
};

type StoredSession = { token: string; sessionId: string; user: GameUser };
type IdentityListener = () => void;
type IdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const VISITOR_KEY = "shapes-game.identity.visitorId";
const SESSION_KEY = "shapes-game.identity.session";
const LEGACY_VISITOR_KEY = "shapes-game.analytics.clientId";
const listeners = new Set<IdentityListener>();

function uuid(): string {
  return crypto.randomUUID();
}

export class IdentityService {
  private session: StoredSession | null;
  private visitorId: string;

  constructor(private readonly storage: IdentityStorage = window.localStorage) {
    this.visitorId = storage.getItem(VISITOR_KEY) ?? storage.getItem(LEGACY_VISITOR_KEY) ?? uuid();
    storage.setItem(VISITOR_KEY, this.visitorId);
    storage.removeItem(LEGACY_VISITOR_KEY);
    this.session = this.readSession();
  }

  get currentVisitorId(): string { return this.visitorId; }
  get token(): string | null { return this.session?.token ?? null; }
  get sessionId(): string | null { return this.session?.sessionId ?? null; }
  get user(): GameUser | null { return this.session?.user ?? null; }
  get scoreScope(): string { return this.user ? `user:${this.user.id}` : `visitor:${this.visitorId}`; }

  setSession(session: StoredSession): void {
    this.session = session;
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    this.publish();
  }

  updateUser(user: GameUser): void {
    if (!this.session) return;
    this.setSession({ ...this.session, user });
  }

  clearSessionAndRotateVisitor(): void {
    this.session = null;
    this.storage.removeItem(SESSION_KEY);
    this.visitorId = uuid();
    this.storage.setItem(VISITOR_KEY, this.visitorId);
    this.publish();
  }

  subscribe(listener: IdentityListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  private publish(): void { for (const listener of listeners) listener(); }

  private readSession(): StoredSession | null {
    try {
      const value = JSON.parse(this.storage.getItem(SESSION_KEY) ?? "null") as Partial<StoredSession> | null;
      if (!value || typeof value.token !== "string" || typeof value.sessionId !== "string" || !value.user) return null;
      if (typeof value.user.id !== "string" || typeof value.user.displayName !== "string") return null;
      return value as StoredSession;
    } catch { return null; }
  }
}

export const identityService = new IdentityService();
