import { describe, expect, test } from "vitest";
import { tipoDeAvisoDePrazo } from "@/modules/notificacoes/prazos-regra";

describe("Aviso de prazo", () => {
  test("vencida avisa 'vencido'; vence hoje ou amanhã avisa 'vencendo'; o resto não avisa", () => {
    expect(tipoDeAvisoDePrazo("atrasada")).toBe("prazo_vencido");
    expect(tipoDeAvisoDePrazo("vence_hoje")).toBe("prazo_vencendo");
    expect(tipoDeAvisoDePrazo("vence_amanha")).toBe("prazo_vencendo");
    expect(tipoDeAvisoDePrazo("no_prazo")).toBeNull();
    expect(tipoDeAvisoDePrazo("sem_prazo")).toBeNull();
  });
});
