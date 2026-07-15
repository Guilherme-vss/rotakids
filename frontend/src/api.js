/**
 * api.js — comunicação com o backend e helpers puros.
 *
 * As funções puras (cores, URLs, sessão) ficam aqui para serem testadas
 * com Vitest sem precisar de navegador nem de servidor.
 */

/** Cor do ponto no mapa: verde = vai à escola, vermelho = falta. */
export function corDoPonto(vaiHoje) {
  return vaiHoje ? "#16a34a" : "#dc2626";
}

/** Monta a URL do cálculo de rota a partir da posição da van. */
export function montarUrlMelhorRota(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error("Posição inválida");
  }
  return `/api/rota/melhor?lat=${lat}&lng=${lng}`;
}

/** Valida os campos do cadastro antes de bater no servidor. */
export function validarCadastro({ nome, email, senha }) {
  if (!nome?.trim()) return "Informe seu nome";
  if (!email?.includes("@")) return "Email inválido";
  if (!senha || senha.length < 6) return "A senha precisa de pelo menos 6 caracteres";
  return null; // tudo certo
}

/* ---------- Sessão (token JWT no armazenamento do navegador) ---------- */

const CHAVE_TOKEN = "rk-token";
const CHAVE_USUARIO = "rk-usuario";

export function salvarSessao({ token, usuario }, storage = localStorage) {
  storage.setItem(CHAVE_TOKEN, token);
  storage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

export function lerSessao(storage = localStorage) {
  const token = storage.getItem(CHAVE_TOKEN);
  const bruto = storage.getItem(CHAVE_USUARIO);
  if (!token || !bruto) return null;
  try {
    return { token, usuario: JSON.parse(bruto) };
  } catch {
    return null;
  }
}

export function limparSessao(storage = localStorage) {
  storage.removeItem(CHAVE_TOKEN);
  storage.removeItem(CHAVE_USUARIO);
}

/* ---------- Chamadas à API ---------- */

import { motorLocal, usarMotorLocal } from "./demo.js";

export async function api(caminho, { metodo = "GET", corpo = null } = {}) {
  // Sem servidor (ex.: GitHub Pages), o motor local assume — os dados
  // ficam salvos no próprio navegador e tudo continua funcionando.
  if (usarMotorLocal()) {
    return motorLocal(caminho, metodo, corpo);
  }

  const sessao = lerSessao();
  const resposta = await fetch("/api" + caminho, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : null,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Erro inesperado — tente de novo");
  return dados;
}
