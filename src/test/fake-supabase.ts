/* eslint-disable @typescript-eslint/no-explicit-any -- dublê de teste do cliente Supabase */
/** Supabase em memória para testes das funções de servidor (subconjunto usado pelo app). */
type Row = Record<string, any>;

export function criarFakeSupabase(tabelas: Record<string, Row[]> = {}) {
  const db: Record<string, Row[]> = tabelas;
  const arquivos = new Map<string, Uint8Array>();
  let seq = 0;

  function from(tabela: string) {
    db[tabela] ??= [];
    const filtros: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let head = false;
    let contar = false;
    let retornar = false;

    const linhas = () => db[tabela]!.filter((r) => filtros.every((f) => f(r)));
    function executar() {
      if (op === "insert") {
        const novos = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({
          id: p.id ?? `id-${++seq}`,
          criado_em: new Date().toISOString(),
          data_hora: new Date().toISOString(),
          ...p,
        }));
        db[tabela]!.push(...novos);
        return { data: novos, error: null, count: null };
      }
      if (op === "update") {
        const alvo = linhas();
        alvo.forEach((r) => Object.assign(r, payload));
        return { data: alvo, error: null, count: null };
      }
      if (op === "delete") {
        const alvo = linhas();
        db[tabela] = db[tabela]!.filter((r) => !alvo.includes(r));
        return { data: alvo, error: null, count: null };
      }
      const r = linhas();
      return { data: head ? null : r, error: null, count: contar ? r.length : null };
    }

    const q: any = {
      select: (_c?: string, o?: { count?: string; head?: boolean }) => {
        if (op !== "select") retornar = true;
        if (o?.count) contar = true;
        if (o?.head) head = true;
        return q;
      },
      insert: (p: Row | Row[]) => {
        op = "insert";
        payload = p;
        return q;
      },
      update: (p: Row) => {
        op = "update";
        payload = p;
        return q;
      },
      delete: () => {
        op = "delete";
        return q;
      },
      upsert: (p: Row) => {
        op = "insert";
        payload = p;
        return q;
      },
      eq: (c: string, v: unknown) => {
        filtros.push((r) => r[c] === v);
        return q;
      },
      neq: (c: string, v: unknown) => {
        filtros.push((r) => r[c] !== v);
        return q;
      },
      in: (c: string, v: unknown[]) => {
        filtros.push((r) => v.includes(r[c]));
        return q;
      },
      is: (c: string, v: unknown) => {
        filtros.push((r) => (r[c] ?? null) === v);
        return q;
      },
      not: (c: string, _op: string, v: unknown) => {
        filtros.push((r) => (r[c] ?? null) !== v);
        return q;
      },
      gte: (c: string, v: string) => {
        filtros.push((r) => String(r[c]) >= String(v));
        return q;
      },
      lte: (c: string, v: string) => {
        filtros.push((r) => String(r[c]) <= String(v));
        return q;
      },
      lt: (c: string, v: string) => {
        filtros.push((r) => String(r[c]) < String(v));
        return q;
      },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => {
        const r = executar();
        return { data: (r.data as Row[] | null)?.[0] ?? null, error: null };
      },
      single: async () => {
        const r = executar();
        const d = (r.data as Row[] | null)?.[0];
        return d ? { data: d, error: null } : { data: null, error: { message: "not found" } };
      },
      then: (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => {
        try {
          const r = executar();
          return Promise.resolve(retornar || op === "select" ? r : { ...r, data: null }).then(
            ok,
            err,
          );
        } catch (e) {
          return Promise.reject(e).then(ok, err);
        }
      },
    };
    return q;
  }

  const storage = {
    from: () => ({
      upload: async (path: string, bytes: Uint8Array) => {
        arquivos.set(path, bytes);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        paths.forEach((p) => arquivos.delete(p));
        return { data: null, error: null };
      },
      download: async (path: string) => {
        const b = arquivos.get(path);
        return b
          ? { data: { arrayBuffer: async () => b.buffer }, error: null }
          : { data: null, error: { message: "not found" } };
      },
      list: async (pasta: string) => ({
        data: [...arquivos.keys()]
          .filter((k) => k.startsWith(`${pasta}/`))
          .map((k) => ({ name: k.slice(pasta.length + 1) })),
        error: null,
      }),
    }),
  };

  const auth = {
    admin: {
      createUser: async () => ({ data: { user: { id: `user-${++seq}` } }, error: null }),
      deleteUser: async () => ({ data: null, error: null }),
      updateUserById: async () => ({ data: null, error: null }),
    },
  };

  return { from, storage, auth, db, arquivos };
}
