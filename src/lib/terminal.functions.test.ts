import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ compare: vi.fn(), admin: { from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, middleware: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("./face.server", () => ({ compararRostos: mocks.compare, sha256: async () => "hash", bytesToDataUrl: () => "data:image/jpeg;base64,ref" }));
import { identificarRosto } from "./terminal.functions";

const identify = identificarRosto as unknown as (args: { data: { cnpj: string; senha: string; imagem: string } }) => Promise<{ encontrado: { id: string } | null }>;
const input = { data: { cnpj: "company", senha: "password", imagem: "data:image/jpeg;base64,selfie" } };

function employees(rows: { id: string; foto_path: string }[]) {
  mocks.admin.from.mockImplementation((table: string) => {
    if (table === "empresas") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "company", senha_mestra_leitura: "hash" } }) }) }) };
    if (table === "terminal_logs") return { insert: vi.fn().mockResolvedValue({ error: null }) };
    const query = { select: () => query, eq: () => query, not: async () => ({ data: rows, error: null }) };
    return query;
  });
}

describe("identificação facial no terminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    employees([{ id: "employee", foto_path: "ref.jpg" }]);
    mocks.admin.storage.from.mockReturnValue({ download: async () => ({ data: { arrayBuffer: async () => new ArrayBuffer(1) }, error: null }) });
  });
  it("não apresenta falha do serviço como rosto desconhecido", async () => {
    mocks.compare.mockRejectedValue(new Error("Reconhecimento facial indisponível no momento (limite de uso da IA)."));
    await expect(identify(input)).rejects.toThrow("Reconhecimento facial indisponível");
  });
  it("avisa quando não há rostos cadastrados", async () => {
    employees([]);
    await expect(identify(input)).rejects.toThrow("Nenhum funcionário ativo tem rosto cadastrado");
    expect(mocks.compare).not.toHaveBeenCalled();
  });
  it("mantém aprovação somente a partir de 70%", async () => {
    mocks.compare.mockResolvedValue({ rosto_real: true, mesma_pessoa: true, confianca: 0.69 });
    expect((await identify(input)).encontrado).toBeNull();
    mocks.compare.mockResolvedValue({ rosto_real: true, mesma_pessoa: true, confianca: 0.7 });
    expect((await identify(input)).encontrado?.id).toBe("employee");
  });
  it("rejeita outra pessoa mesmo com pontuação alta", async () => {
    mocks.compare.mockResolvedValue({ rosto_real: true, mesma_pessoa: false, confianca: 0.99 });
    expect((await identify(input)).encontrado).toBeNull();
  });
});