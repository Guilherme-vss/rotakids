/**
 * rota.ts — o coração do RotaKids: cálculo da melhor ordem de coleta.
 *
 * Estratégia: heurística do "vizinho mais próximo" (nearest neighbor).
 * Partindo da posição atual da van, escolhemos sempre o aluno mais perto
 * ainda não coletado, e por último vamos até a escola. Para poucas paradas
 * (o caso real de uma van escolar, ~4 a 15 alunos) o resultado é ótimo ou
 * muito próximo do ótimo, com custo computacional mínimo.
 *
 * A distância usada é a de Haversine (distância real sobre a esfera da
 * Terra), suficiente para ORDENAR paradas. O traçado da rota rua a rua
 * fica por conta da API pública do OSRM (OpenStreetMap).
 */

export interface Ponto {
  lat: number;
  lng: number;
}

export interface Parada extends Ponto {
  alunoId: number;
  nome: string;
}

const RAIO_TERRA_KM = 6371;

/** Distância em km entre dois pontos geográficos (fórmula de Haversine). */
export function haversineKm(a: Ponto, b: Ponto): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/**
 * Ordena as paradas pela heurística do vizinho mais próximo.
 * Retorna as paradas na ordem em que os alunos devem ser coletados.
 */
export function ordenarParadas(origem: Ponto, paradas: Parada[]): Parada[] {
  const restantes = [...paradas];
  const ordem: Parada[] = [];
  let atual: Ponto = origem;

  while (restantes.length > 0) {
    let maisPerto = 0;
    let menorDist = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = haversineKm(atual, restantes[i]);
      if (d < menorDist) {
        menorDist = d;
        maisPerto = i;
      }
    }
    const [proxima] = restantes.splice(maisPerto, 1);
    ordem.push(proxima);
    atual = proxima;
  }

  return ordem;
}

/** Distância total (km) do trajeto origem → paradas em ordem → destino. */
export function distanciaTotalKm(origem: Ponto, paradas: Parada[], destino: Ponto): number {
  let total = 0;
  let atual: Ponto = origem;
  for (const parada of paradas) {
    total += haversineKm(atual, parada);
    atual = parada;
  }
  total += haversineKm(atual, destino);
  return Math.round(total * 100) / 100;
}

/**
 * Monta a URL da API pública do OSRM para obter o traçado da rota rua a rua.
 * OSRM usa o formato lng,lat (invertido mesmo!), separado por ";".
 */
export function montarUrlOsrm(pontos: Ponto[]): string {
  if (pontos.length < 2) {
    throw new Error("A rota precisa de pelo menos 2 pontos");
  }
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(";");
  return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
}

/**
 * Consulta o OSRM e devolve o traçado (GeoJSON) + duração/distância reais.
 * Se o serviço estiver fora do ar, devolvemos null — o app segue funcionando
 * com a ordem de coleta e as linhas retas no mapa.
 */
export async function tracarRotaOsrm(
  pontos: Ponto[]
): Promise<{ geometria: unknown; duracaoMin: number; distanciaKm: number } | null> {
  try {
    const resposta = await fetch(montarUrlOsrm(pontos));
    if (!resposta.ok) return null;
    const dados: any = await resposta.json();
    const rota = dados.routes?.[0];
    if (!rota) return null;
    return {
      geometria: rota.geometry,
      duracaoMin: Math.round(rota.duration / 60),
      distanciaKm: Math.round((rota.distance / 1000) * 100) / 100,
    };
  } catch {
    return null; // sem internet ou OSRM fora do ar: seguimos sem o traçado
  }
}
