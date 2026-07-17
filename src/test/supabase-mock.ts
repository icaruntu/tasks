import { vi } from "vitest";

/**
 * A lightweight fake of the Supabase JS client good enough for the app's usage:
 * a thenable, chainable query builder over in-memory tables, plus stubbed
 * auth / storage / realtime channels.
 *
 * Seed tables via `seed`, e.g. { tasks: [...], profiles: [...] }.
 * Reads honour .eq/.neq/.is/.in/.gte/.order/.limit/.single/.maybeSingle and
 * head+count. Writes (insert/update/delete/upsert) mutate the in-memory table
 * and return the affected rows so `.select().single()` works.
 */
export type Rows = Record<string, unknown>[];
export type Seed = Record<string, Rows>;

type Filter = { kind: string; col: string; val: unknown };

function applyFilters(rows: Rows, filters: Filter[]): Rows {
  return rows.filter((row) =>
    filters.every((f) => {
      const v = (row as Record<string, unknown>)[f.col];
      switch (f.kind) {
        case "eq":
          return v === f.val;
        case "neq":
          return v !== f.val;
        case "is":
          return f.val === null ? v === null || v === undefined : v === f.val;
        case "not_is":
          return !(f.val === null ? v === null || v === undefined : v === f.val);
        case "in":
          return (f.val as unknown[]).includes(v);
        case "gte":
          return (v as number | string) >= (f.val as number | string);
        case "lte":
          return (v as number | string) <= (f.val as number | string);
        default:
          return true;
      }
    }),
  );
}

class QueryBuilder<T = unknown> implements PromiseLike<{ data: T; error: unknown; count?: number }> {
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Rows = [];
  private wantHead = false;
  private wantCount = false;
  private singleMode: "one" | "maybe" | null = null;

  constructor(
    private store: Seed,
    private table: string,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode !== "insert" && this.mode !== "update" && this.mode !== "upsert")
      this.mode = "select";
    if (opts?.head) this.wantHead = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(rows: Rows | Record<string, unknown>) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Record<string, unknown>) {
    this.mode = "update";
    this.payload = [patch];
    return this;
  }
  upsert(rows: Rows | Record<string, unknown>) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ kind: "is", col, val });
    return this;
  }
  not(col: string, _op: string, val: unknown) {
    this.filters.push({ kind: "not_is", col, val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ kind: "in", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ kind: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push({ kind: "lte", col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }

  private run(): { data: T; error: unknown; count?: number } {
    const table = (this.store[this.table] ??= []);
    let affected: Rows = [];

    if (this.mode === "insert") {
      const inserted = this.payload.map((r) => ({ ...r }));
      table.push(...inserted);
      affected = inserted;
    } else if (this.mode === "upsert") {
      for (const r of this.payload) {
        const idx = table.findIndex(
          (row) => (row as Record<string, unknown>).user_id === (r as Record<string, unknown>).user_id,
        );
        if (idx >= 0) table[idx] = { ...table[idx], ...r };
        else table.push({ ...r });
      }
      affected = this.payload.map((r) => ({ ...r }));
    } else if (this.mode === "update") {
      const matched = applyFilters(table, this.filters);
      for (const row of matched) Object.assign(row as object, this.payload[0]);
      affected = matched;
    } else if (this.mode === "delete") {
      const matched = applyFilters(table, this.filters);
      this.store[this.table] = table.filter((r) => !matched.includes(r));
      affected = matched;
    } else {
      affected = applyFilters(table, this.filters);
      if (this.orderCol) {
        const col = this.orderCol;
        affected = [...affected].sort((a, b) => {
          const av = (a as Record<string, unknown>)[col] as number | string;
          const bv = (b as Record<string, unknown>)[col] as number | string;
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (this.orderAsc ? 1 : -1);
        });
      }
      if (this.limitN != null) affected = affected.slice(0, this.limitN);
    }

    const count = affected.length;
    if (this.wantHead) return { data: null as T, error: null, count };

    if (this.singleMode) {
      const row = affected[0] ?? null;
      if (this.singleMode === "one" && !row)
        return { data: null as T, error: { message: "No rows" } };
      return { data: row as T, error: null, ...(this.wantCount ? { count } : {}) };
    }

    return {
      data: affected as T,
      error: null,
      ...(this.wantCount ? { count } : {}),
    };
  }

  then<R1 = { data: T; error: unknown; count?: number }, R2 = never>(
    onfulfilled?:
      | ((value: { data: T; error: unknown; count?: number }) => R1 | PromiseLike<R1>)
      | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected);
    }
  }
}

export type MockSupabase = ReturnType<typeof createSupabaseMock>;

export function createSupabaseMock(
  seed: Seed = {},
  opts: { userId?: string; email?: string } = {},
) {
  const store: Seed = {};
  for (const [k, v] of Object.entries(seed)) store[k] = v.map((r) => ({ ...r }));

  const userId = opts.userId ?? "user-1";
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  const client = {
    _store: store,
    from: vi.fn((table: string) => new QueryBuilder(store, table)),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: userId, email: opts.email ?? "me@test.dev" } },
        error: null,
      })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: "p" }, error: null })),
        remove: vi.fn(async () => ({ data: {}, error: null })),
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: "https://signed.example/x" },
          error: null,
        })),
      })),
    },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };

  return client;
}
