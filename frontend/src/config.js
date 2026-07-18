/**
 * config.js — de onde vem a chave do mapa de trânsito (TomTom).
 *
 * SEGURANÇA (importante entender): chave de mapa é sempre client-side — todo
 * site de mapa (Google, Mapbox, TomTom) precisa dela no navegador. Esconder a
 * chave é impossível; o que protege é RESTRINGIR a chave ao seu domínio no
 * painel do TomTom. Por isso a chave real nunca entra no código-fonte nem no
 * Git: ela é lida de duas fontes, nesta ordem:
 *
 *   1. window.__TOMTOM_KEY__  → definido por `public/config.local.js`
 *      (arquivo GITIGNORADO; você cria com a sua chave; nunca vai para o Git).
 *   2. import.meta.env.VITE_TOMTOM_KEY → variável de ambiente do Vite
 *      (arquivo `.env.local`, também gitignorado) — atalho para desenvolvimento.
 *
 * A leitura é PREGUIÇOSA (função, não constante): o config.local.js é carregado
 * de forma assíncrona, então só consultamos a chave na hora de desenhar o mapa,
 * quando ela já chegou. Sem chave, o app funciona igual — só não há trânsito
 * (degradação graciosa — regra 2).
 */

/** A chave atual, ou "" se não houver. Lida na hora (nunca em cache). */
export function chaveTomTom() {
  if (typeof window !== "undefined" && window.__TOMTOM_KEY__ && window.__TOMTOM_KEY__ !== "COLE_SUA_CHAVE_DO_TOMTOM_AQUI") {
    return window.__TOMTOM_KEY__;
  }
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_TOMTOM_KEY) {
    return import.meta.env.VITE_TOMTOM_KEY;
  }
  return "";
}

export function temTransito() {
  return Boolean(chaveTomTom());
}

/** URL das telhas de trânsito do TomTom (fluxo relativo: verde→vermelho). */
export function urlTransito() {
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${chaveTomTom()}`;
}
