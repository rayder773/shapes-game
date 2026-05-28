type VisitorRecord = {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  public_color_id: string | null;
  public_name_id: string | null;
  best_score: number;
  public_identity_assigned_at: string | null;
  best_score_updated_at: string | null;
};

type EventRecord = {
  id: number;
  visitor_id: string;
  type: string;
  payload: string;
  client_created_at: string;
};

type KvRecord = {
  value: string;
  expiresAt: number | null;
};

type PreparedStatementLike = {
  bind(...args: unknown[]): PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: true }>;
};

export class FakeKVNamespace {
  private readonly entries = new Map<string, KvRecord>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: options?.expirationTtl ? this.now() + options.expirationTtl * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

class FakePreparedStatement {
  private args: unknown[] = [];

  constructor(
    private readonly database: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): this {
    this.args = args;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.database.executeFirst<T>(this.sql, this.args);
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.executeAll<T>(this.sql, this.args) };
  }

  async run(): Promise<{ success: true }> {
    this.database.executeRun(this.sql, this.args);
    return { success: true };
  }
}

export class FakeD1Database {
  private readonly visitors = new Map<string, VisitorRecord>();
  private readonly events: EventRecord[] = [];
  private nextEventId = 1;

  prepare(sql: string): PreparedStatementLike {
    return new FakePreparedStatement(this, sql);
  }

  async batch(statements: PreparedStatementLike[]): Promise<Array<{ success: true }>> {
    const preparedStatements = statements as unknown as FakePreparedStatement[];
    return Promise.all(preparedStatements.map((statement) => statement.run()));
  }

  seedVisitor(visitor: Partial<VisitorRecord> & Pick<VisitorRecord, "id">): void {
    const createdAt = visitor.created_at ?? new Date().toISOString();
    this.visitors.set(visitor.id, {
      id: visitor.id,
      ip: visitor.ip ?? "127.0.0.1",
      user_agent: visitor.user_agent ?? "vitest",
      created_at: createdAt,
      public_color_id: visitor.public_color_id ?? null,
      public_name_id: visitor.public_name_id ?? null,
      best_score: visitor.best_score ?? 0,
      public_identity_assigned_at: visitor.public_identity_assigned_at ?? null,
      best_score_updated_at: visitor.best_score_updated_at ?? null,
    });
  }

  executeFirst<T>(sql: string, args: unknown[]): T | null {
    const rows = this.executeAll<T>(sql, args);
    return rows[0] ?? null;
  }

  executeAll<T>(sql: string, args: unknown[]): T[] {
    const normalizedSql = normalizeSql(sql);

    if (normalizedSql.startsWith("SELECT visitors.id, visitors.ip, visitors.user_agent, visitors.created_at, COUNT(events.id) AS events_count FROM visitors LEFT JOIN events ON events.visitor_id = visitors.id GROUP BY visitors.id ORDER BY visitors.created_at DESC")) {
      return [...this.visitors.values()]
        .sort((left, right) => compareDesc(left.created_at, right.created_at))
        .map((visitor) => ({
          id: visitor.id,
          ip: visitor.ip,
          user_agent: visitor.user_agent,
          created_at: visitor.created_at,
          events_count: this.events.filter((event) => event.visitor_id === visitor.id).length,
        })) as T[];
    }

    if (normalizedSql === "SELECT id FROM visitors WHERE id = ?") {
      const visitorId = String(args[0]);
      const visitor = this.visitors.get(visitorId);
      return visitor ? [{ id: visitor.id }] as T[] : [];
    }

    if (normalizedSql === "SELECT id, public_color_id, public_name_id, best_score, best_score_updated_at FROM visitors WHERE id = ?") {
      const visitorId = String(args[0]);
      const visitor = this.visitors.get(visitorId);
      return visitor ? [{
        id: visitor.id,
        public_color_id: visitor.public_color_id,
        public_name_id: visitor.public_name_id,
        best_score: visitor.best_score,
        best_score_updated_at: visitor.best_score_updated_at,
      }] as T[] : [];
    }

    if (normalizedSql === "SELECT COUNT(*) AS count FROM visitors") {
      return [{ count: this.visitors.size }] as T[];
    }

    if (normalizedSql.startsWith("SELECT id FROM visitors WHERE public_color_id = ? AND public_name_id = ? AND id <> ? LIMIT 1")) {
      const [colorId, nameId, excludedId] = args.map(String);
      const visitor = [...this.visitors.values()].find((entry) => (
        entry.public_color_id === colorId && entry.public_name_id === nameId && entry.id !== excludedId
      ));
      return visitor ? [{ id: visitor.id }] as T[] : [];
    }

    if (normalizedSql.startsWith("SELECT id, visitor_id, type, payload, client_created_at FROM events WHERE visitor_id = ? ORDER BY id DESC LIMIT ?")) {
      const visitorId = String(args[0]);
      const limit = Number(args[1]);
      return this.events
        .filter((event) => event.visitor_id === visitorId)
        .sort((left, right) => right.id - left.id)
        .slice(0, limit) as T[];
    }

    if (normalizedSql.startsWith("SELECT id, visitor_id, type, payload, client_created_at FROM events WHERE visitor_id = ? AND id < ? ORDER BY id DESC LIMIT ?")) {
      const visitorId = String(args[0]);
      const beforeId = Number(args[1]);
      const limit = Number(args[2]);
      return this.events
        .filter((event) => event.visitor_id === visitorId && event.id < beforeId)
        .sort((left, right) => right.id - left.id)
        .slice(0, limit) as T[];
    }

    if (normalizedSql.startsWith("WITH ranked AS ( SELECT id, ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank FROM visitors WHERE best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL ) SELECT rank FROM ranked WHERE id = ?")) {
      const visitorId = String(args[0]);
      const row = this.buildRankedVisitors().find((entry) => entry.id === visitorId);
      return row ? [{ rank: row.rank }] as T[] : [];
    }

    if (normalizedSql.startsWith("WITH ranked AS ( SELECT id, best_score, public_color_id, public_name_id, ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank FROM visitors WHERE best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL ) SELECT id, best_score, public_color_id, public_name_id, rank FROM ranked ORDER BY rank ASC LIMIT ? OFFSET ?")) {
      const limit = Number(args[0]);
      const offset = Number(args[1]);
      return this.buildRankedVisitors().slice(offset, offset + limit) as T[];
    }

    throw new Error(`Unhandled fake D1 query: ${normalizedSql}`);
  }

  executeRun(sql: string, args: unknown[]): void {
    const normalizedSql = normalizeSql(sql);

    if (normalizedSql === "INSERT INTO visitors (id, ip, user_agent, created_at) VALUES (?, ?, ?, ?)") {
      const [id, ip, userAgent, createdAt] = args.map(String);
      this.seedVisitor({ id, ip, user_agent: userAgent, created_at: createdAt });
      return;
    }

    if (normalizedSql === "INSERT INTO events (visitor_id, type, payload, client_created_at) VALUES (?, ?, ?, ?)") {
      const [visitorId, type, payload, clientCreatedAt] = args;
      this.events.push({
        id: this.nextEventId,
        visitor_id: String(visitorId),
        type: String(type),
        payload: String(payload),
        client_created_at: String(clientCreatedAt),
      });
      this.nextEventId += 1;
      return;
    }

    if (normalizedSql === "UPDATE visitors SET best_score = ?, best_score_updated_at = ? WHERE id = ?") {
      const [bestScore, updatedAt, visitorId] = args;
      const visitor = this.requireVisitor(String(visitorId));
      visitor.best_score = Number(bestScore);
      visitor.best_score_updated_at = String(updatedAt);
      return;
    }

    if (normalizedSql.startsWith("UPDATE visitors SET public_color_id = ?, public_name_id = ?, public_identity_assigned_at = COALESCE(public_identity_assigned_at, ?) WHERE id = ?")) {
      const [publicColorId, publicNameId, assignedAt, visitorId] = args;
      const visitor = this.requireVisitor(String(visitorId));
      visitor.public_color_id = String(publicColorId);
      visitor.public_name_id = String(publicNameId);
      visitor.public_identity_assigned_at ??= String(assignedAt);
      return;
    }

    if (normalizedSql === "DELETE FROM events WHERE visitor_id = ?") {
      const visitorId = String(args[0]);
      for (let index = this.events.length - 1; index >= 0; index -= 1) {
        if (this.events[index]?.visitor_id === visitorId) {
          this.events.splice(index, 1);
        }
      }
      return;
    }

    if (normalizedSql === "DELETE FROM visitors WHERE id = ?") {
      this.visitors.delete(String(args[0]));
      return;
    }

    throw new Error(`Unhandled fake D1 run query: ${normalizedSql}`);
  }

  private buildRankedVisitors(): Array<{
    id: string;
    best_score: number;
    public_color_id: string;
    public_name_id: string;
    rank: number;
  }> {
    return [...this.visitors.values()]
      .filter((visitor) => (
        visitor.best_score > 0 && visitor.public_color_id !== null && visitor.public_name_id !== null
      ))
      .sort((left, right) => {
        if (left.best_score !== right.best_score) {
          return right.best_score - left.best_score;
        }

        const createdAtOrder = compareAsc(left.created_at, right.created_at);
        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }

        return left.id.localeCompare(right.id);
      })
      .map((visitor, index) => ({
        id: visitor.id,
        best_score: visitor.best_score,
        public_color_id: visitor.public_color_id!,
        public_name_id: visitor.public_name_id!,
        rank: index + 1,
      }));
  }

  private requireVisitor(visitorId: string): VisitorRecord {
    const visitor = this.visitors.get(visitorId);

    if (!visitor) {
      throw new Error(`Missing fake visitor ${visitorId}`);
    }

    return visitor;
  }
}

export function createApiTestEnv(overrides: Record<string, unknown> = {}) {
  const DB = (overrides.DB as FakeD1Database | undefined) ?? new FakeD1Database();
  const RATE_LIMIT_KV = (overrides.RATE_LIMIT_KV as FakeKVNamespace | undefined) ?? new FakeKVNamespace();

  return {
    APP_ENV: "test",
    ANALYTICS_MAX_BATCH_SIZE: "50",
    CORS_ALLOWED_ORIGINS: "https://antimatch.example",
    ADMIN_API_TOKEN: "test-admin-token",
    DB,
    RATE_LIMIT_KV,
    ...overrides,
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function compareAsc(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareDesc(left: string, right: string): number {
  return right.localeCompare(left);
}