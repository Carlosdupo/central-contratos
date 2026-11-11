import { describe, expect, it } from "vitest";
import {
  agoraNoFuso,
  diasCorridosEntre,
  diasUteisEntre,
  ehDiaUtil,
  formatarData,
  proximoDiaUtil,
  situacaoPrazo,
  somarDias,
} from "@/lib/datas";

const semFeriados = new Set<string>();
const comConscienciaNegra = new Set(["2026-11-20"]); // sexta-feira

describe("agoraNoFuso", () => {
  it("converte UTC para o horário de São Paulo (UTC-3)", () => {
    expect(agoraNoFuso(new Date("2026-11-10T21:30:00Z"))).toEqual({ data: "2026-11-10", hora: 18, minuto: 30 });
  });
  it("não vira o dia antes da meia-noite de São Paulo", () => {
    expect(agoraNoFuso(new Date("2026-11-11T02:00:00Z"))).toEqual({ data: "2026-11-10", hora: 23, minuto: 0 });
  });
});

describe("aritmética de datas", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("conta dias corridos", () => {
    expect(diasCorridosEntre("2026-11-02", "2026-11-09")).toBe(7);
  });
  it("rejeita data inválida", () => {
    expect(() => somarDias("2026-02-30", 1)).toThrow();
    expect(() => somarDias("10/11/2026", 1)).toThrow();
  });
  it("formata no padrão brasileiro", () => {
    expect(formatarData("2026-11-05")).toBe("05/11/2026");
  });
});

describe("dias úteis", () => {
  it("sábado, domingo e feriado não são úteis", () => {
    expect(ehDiaUtil("2026-11-14", semFeriados)).toBe(false);
    expect(ehDiaUtil("2026-11-15", semFeriados)).toBe(false);
    expect(ehDiaUtil("2026-11-20", comConscienciaNegra)).toBe(false);
    expect(ehDiaUtil("2026-11-19", comConscienciaNegra)).toBe(true);
  });
  it("conta úteis sem contar o dia de início", () => {
    // sexta 13 → segunda 16: só a segunda conta
    expect(diasUteisEntre("2026-11-13", "2026-11-16", semFeriados)).toBe(1);
    // quinta 19 → terça 24, com feriado na sexta 20: segunda e terça
    expect(diasUteisEntre("2026-11-19", "2026-11-24", comConscienciaNegra)).toBe(2);
    expect(diasUteisEntre("2026-11-10", "2026-11-10", semFeriados)).toBe(0);
  });
  it("próximo dia útil pula fim de semana e feriado", () => {
    expect(proximoDiaUtil("2026-11-13", semFeriados)).toBe("2026-11-16");
    expect(proximoDiaUtil("2026-11-19", comConscienciaNegra)).toBe("2026-11-23");
    expect(proximoDiaUtil("2026-11-19", comConscienciaNegra, 2)).toBe("2026-11-24");
  });
});

describe("situacaoPrazo (regra do protótipo)", () => {
  const base = { inicio: "2026-11-02", feriados: semFeriados };
  it("sem prazo definido", () => {
    expect(situacaoPrazo({ ...base, hoje: "2026-11-05", prazo: null })).toEqual({ tipo: "sem_prazo", usados: 3 });
  });
  it("etapa 7: 7 dias corridos", () => {
    const prazo = { dias: 7, uteis: false };
    expect(situacaoPrazo({ ...base, hoje: "2026-11-04", prazo }).tipo).toBe("no_prazo");
    expect(situacaoPrazo({ ...base, hoje: "2026-11-08", prazo }).tipo).toBe("vence_amanha");
    expect(situacaoPrazo({ ...base, hoje: "2026-11-09", prazo }).tipo).toBe("vence_hoje");
    expect(situacaoPrazo({ ...base, hoje: "2026-11-11", prazo })).toEqual({ tipo: "atrasada", usados: 9, restantes: -2 });
  });
  it("análise do RH: 2 dias úteis atravessando fim de semana", () => {
    const prazo = { dias: 2, uteis: true };
    // enviado sexta 13; segunda 16 = 1 útil usado; terça 17 = vence hoje; quarta 18 = atrasada
    expect(situacaoPrazo({ inicio: "2026-11-13", hoje: "2026-11-16", prazo, feriados: semFeriados }).tipo).toBe("vence_amanha");
    expect(situacaoPrazo({ inicio: "2026-11-13", hoje: "2026-11-17", prazo, feriados: semFeriados }).tipo).toBe("vence_hoje");
    expect(situacaoPrazo({ inicio: "2026-11-13", hoje: "2026-11-18", prazo, feriados: semFeriados }).tipo).toBe("atrasada");
  });
});
