/** Testes dos helpers puros do front (Vitest). Rode com: npm test */
import { describe, expect, test } from "vitest";
import {
  corDoPonto,
  lerSessao,
  limparSessao,
  montarUrlMelhorRota,
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
