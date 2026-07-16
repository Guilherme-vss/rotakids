/** Testes dos helpers puros do front (Vitest). Rode com: npm test */
import { describe, expect, test } from "vitest";
import {
  corDoPonto,
  formatarDuracao,
  lerSessao,
  limparSessao,
  montarUrlAlternativas,
  montarUrlMelhorRota,
  resumirAlternativas,
  salvarSessao,
  validarCadastro,
} from "./api.js";

/** Armazenamento falso para testar a sessão sem navegador. */
function storageFalso() {
  const dados = new Map();
  return {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
    removeItem: (chave) => dados.delete(chave),
  };
}

describe("corDoPonto", () => {
  test("verde quando o aluno vai à escola", () => {
    expect(corDoPonto(true)).toBe("#16a34a");
  });
  test("vermelho quando falta", () => {
    expect(corDoPonto(false)).toBe("#dc2626");
  });
  test("azul quando já embarcou na van (independe da presença)", () => {
    expect(corDoPonto(true, true)).toBe("#2563eb");
  });
});

describe("formatarDuracao", () => {
  test("menos de uma hora vira minutos", () => {
    expect(formatarDuracao(1080)).toBe("18 min");
  });
  test("mais de uma hora vira XhMM", () => {
    expect(formatarDuracao(4200)).toBe("1h10");
  });
});

describe("montarUrlAlternativas", () => {
  test("usa lng,lat (formato do OSRM) e pede alternativas", () => {
    const url = montarUrlAlternativas([[-23.5, -46.6], [-23.6, -46.7]]);
    expect(url).toContain("/driving/-46.6,-23.5;-46.7,-23.6");
    expect(url).toContain("alternatives=true");
    expect(url).toContain("geometries=geojson");
  });
  test("exige pelo menos 2 pontos", () => {
    expect(() => montarUrlAlternativas([[-23.5, -46.6]])).toThrow();
  });
});

describe("resumirAlternativas", () => {
  test("ordena da rota mais rápida para a mais lenta", () => {
    const resposta = {
      routes: [
        { duration: 1500, distance: 9000, geometry: { a: 1 } },
        { duration: 1080, distance: 7200, geometry: { b: 2 } },
      ],
    };
    const opcoes = resumirAlternativas(resposta);
    expect(opcoes[0].duracaoTexto).toBe("18 min");
    expect(opcoes[0].distanciaKm).toBe(7.2);
    expect(opcoes[1].duracaoTexto).toBe("25 min");
  });
  test("resposta vazia devolve lista vazia", () => {
    expect(resumirAlternativas(null)).toEqual([]);
    expect(resumirAlternativas({ routes: [] })).toEqual([]);
  });
});

describe("montarUrlMelhorRota", () => {
  test("monta a URL com a posição da van", () => {
    expect(montarUrlMelhorRota(-23.5, -46.6)).toBe("/api/rota/melhor?lat=-23.5&lng=-46.6");
  });
  test("rejeita posição inválida", () => {
    expect(() => montarUrlMelhorRota(NaN, 0)).toThrow("Posição inválida");
    expect(() => montarUrlMelhorRota("a", "b")).toThrow();
  });
});

describe("validarCadastro", () => {
  test("aceita dados completos", () => {
    expect(validarCadastro({ nome: "Ana", email: "ana@x.com", senha: "123456" })).toBeNull();
  });
  test("aponta cada campo faltando", () => {
    expect(validarCadastro({ nome: "", email: "a@b.c", senha: "123456" })).toMatch(/nome/);
    expect(validarCadastro({ nome: "Ana", email: "sem-arroba", senha: "123456" })).toMatch(/Email/);
    expect(validarCadastro({ nome: "Ana", email: "a@b.c", senha: "123" })).toMatch(/senha/);
  });
});

describe("sessão", () => {
  test("salva, lê e limpa a sessão", () => {
    const storage = storageFalso();
    const sessao = { token: "abc", usuario: { id: 1, nome: "Ana", tipo: "pai" } };

    salvarSessao(sessao, storage);
    expect(lerSessao(storage)).toEqual(sessao);

    limparSessao(storage);
    expect(lerSessao(storage)).toBeNull();
  });

  test("sessão corrompida devolve null em vez de quebrar", () => {
    const storage = storageFalso();
    storage.setItem("rk-token", "abc");
    storage.setItem("rk-usuario", "{json quebrado");
    expect(lerSessao(storage)).toBeNull();
  });
});
