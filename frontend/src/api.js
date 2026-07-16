/**
 * api.js — comunicação com o backend e helpers puros.
 *
 * As funções puras (cores, URLs, sessão) ficam aqui para serem testadas
 * com Vitest sem precisar de navegador nem de servidor.
 */

/**
 * Cor do ponto no mapa:
 * 🔵 azul = já embarcou na van | 🟢 verde = vai à escola | 🔴 vermelho = falta.
 */
export function corDoPonto(vaiHoje, jaEmbarcou = false) {
  if (jaEmbarcou) return "#2563eb";
  return vaiHoje ? "#16a34a" : "#dc2626";
}

/** Duração em segundos → texto amigável: 1080 → "18 min", 4200 → "1h10". */
export function formatarDuracao(segundos) {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas}h${String(minutos % 60).padStart(2, "0")}`;
}

/**
 * URL do OSRM (OpenStreetMap) com ROTAS ALTERNATIVAS de carro.
 * Chamada direto do navegador — o servidor público do OSRM aceita CORS,
 * então funciona igual no GitHub Pages e no modo com backend.
 * Atenção: o OSRM usa o formato lng,lat (invertido mesmo).
 */
export function montarUrlAlternativas(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 2) {
    throw new Error("A rota precisa de pelo menos 2 pontos");
  }
  const coords = pontos.map(([lat, lng]) => `${lng},${lat}`).join(";");
  return `https://router.project-osrm.org/route/v1/driving/${coords}?alternatives=true&overview=full&geometries=geojson`;
}

/** Converte a resposta do OSRM em opções simples, da mais rápida à mais lenta. */
export function resumirAlternativas(resposta) {
  const rotas = resposta?.routes;
  if (!Array.isArray(rotas) || rotas.length === 0) return [];
  return rotas
    .map((rota, indice) => ({
      indice,
      duracaoSeg: rota.duration,
      duracaoTexto: formatarDuracao(rota.duration),
      distanciaKm: Math.round((rota.distance / 1000) * 10) / 10,
      geometria: rota.geometry,
    }))
    .sort((a, b) => a.duracaoSeg - b.duracaoSeg);
}

/** Busca as rotas de carro (pelas ruas!) no OSRM. Devolve [] se estiver fora do ar. */
export async function buscarRotasDeCarro(pontos) {
  try {
    const resposta = await fetch(montarUrlAlternativas(pontos));
    if (!resposta.ok) return [];
    return resumirAlternativas(await resposta.json());
  } catch {
    return [];
  }
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
