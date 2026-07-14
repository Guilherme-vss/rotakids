/**
 * geocode.ts — transforma endereço digitado em coordenadas (lat/lng)
 * usando a API pública do Nominatim (OpenStreetMap).
 *
 * Assim os pais só digitam o endereço normalmente e o sistema resolve
 * a posição no mapa sozinho — automação em primeiro lugar.
 */

export interface Coordenadas {
  lat: number;
  lng: number;
}

export function montarUrlNominatim(endereco: string): string {
  if (!endereco || !endereco.trim()) {
    throw new Error("Endereço vazio");
  }
  const query = encodeURIComponent(endereco.trim());
  return `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`;
}

/** Extrai as coordenadas da resposta do Nominatim (ou null se não achou). */
export function extrairCoordenadas(resposta: unknown): Coordenadas | null {
  if (!Array.isArray(resposta) || resposta.length === 0) return null;
  const lat = parseFloat(resposta[0].lat);
  const lng = parseFloat(resposta[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/** Geocodifica um endereço. Devolve null se o serviço não encontrar. */
export async function geocodificar(endereco: string): Promise<Coordenadas | null> {
  try {
    const resposta = await fetch(montarUrlNominatim(endereco), {
      // O Nominatim pede um User-Agent identificável em sua política de uso
      headers: { "User-Agent": "RotaKids/1.0 (projeto de portfolio)" },
    });
    if (!resposta.ok) return null;
    return extrairCoordenadas(await resposta.json());
  } catch {
    return null;
  }
}
