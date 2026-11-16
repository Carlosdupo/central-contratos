import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

type Claims = { sub: string; aal?: string; app_metadata?: Record<string, unknown> } | null;
let claims: Claims = null;
let papeis: { papel: string }[] = [];
let tipo: "interno" | "externo" = "interno";

vi.mock("@/lib/supabase/server", () => ({
  criarClienteServidor: async () => ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: tabela === "usuarios" ? { id: "u1", nome: "Ana", email: "ana@x.com", tipo, ativo: true } : null, error: null }),
          then: (r: (v: unknown) => void) => r({ data: tabela === "usuario_papeis" ? papeis : [], error: null }),
        }),
      }),
    }),
  }),
}));

const { exigirInterno, exigirExterno, exigirPapel } = await import("@/modules/acesso/sessao");
const para = async (f: () => Promise<unknown>) => f().then(() => "sem redirecionar", (e: Error) => e.message);

beforeEach(() => {
  claims = { sub: "u1", aal: "aal1" };
  papeis = [{ papel: "coordenador_obra" }];
  tipo = "interno";
});

describe("Troca obrigatória da senha provisória", () => {
  test("com a marca no token (app_metadata), qualquer tela interna manda para /definir-senha", async () => {
    claims = { sub: "u1", aal: "aal1", app_metadata: { trocar_senha: true } };
    expect(await para(() => exigirInterno())).toBe("REDIRECT:/definir-senha");
    expect(await para(() => exigirPapel("coordenador_obra"))).toBe("REDIRECT:/definir-senha");
  });

  test("o portal da empresa também", async () => {
    tipo = "externo";
    claims = { sub: "u1", aal: "aal1", app_metadata: { trocar_senha: true } };
    expect(await para(() => exigirExterno())).toBe("REDIRECT:/definir-senha");
  });

  test("a troca vem antes da verificação em duas etapas, que continua valendo depois dela", async () => {
    papeis = [{ papel: "admin" }];
    claims = { sub: "u1", aal: "aal1", app_metadata: { trocar_senha: true } };
    expect(await para(() => exigirInterno())).toBe("REDIRECT:/definir-senha");
    claims = { sub: "u1", aal: "aal1" };
    expect(await para(() => exigirInterno())).toBe("REDIRECT:/verificacao");
    claims = { sub: "u1", aal: "aal2" };
    expect(await para(() => exigirInterno())).toBe("sem redirecionar");
  });

  test("sem a marca (ou com a marca já tirada), a pessoa entra normalmente", async () => {
    expect(await para(() => exigirInterno())).toBe("sem redirecionar");
    claims = { sub: "u1", aal: "aal1", app_metadata: { trocar_senha: null } };
    expect(await para(() => exigirInterno())).toBe("sem redirecionar");
  });

  test("a marca no user_metadata (que a própria pessoa consegue alterar) não conta nem libera nada", async () => {
    claims = { sub: "u1", aal: "aal1", app_metadata: {}, ...({ user_metadata: { trocar_senha: false } } as object) };
    expect(await para(() => exigirInterno())).toBe("sem redirecionar");
  });

  test("só a marca verdadeira vale (texto ou número não passam por marca)", async () => {
    claims = { sub: "u1", aal: "aal1", app_metadata: { trocar_senha: "true" } };
    expect(await para(() => exigirInterno())).toBe("sem redirecionar");
  });
});
