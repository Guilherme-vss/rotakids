/**
 * Testes unitários do cálculo de rota — o coração do RotaKids.
 * Rode com: npm test
 */
import {
  distanciaTotalKm,
  haversineKm,
  montarUrlOsrm,
  ordenarParadas,
  Parada,
} from "../src/services/rota";
import { extrairCoordenadas, montarUrlNominatim } from "../src/services/geocode";

describe("haversineKm", () => {
  test("distância de um ponto até ele mesmo é zero", () => {
    const p = { lat: -23.5505, lng: -46.6333 };
    expect(haversineKm(p, p)).toBe(0);
  });

  test("São Paulo → Rio de Janeiro dá aproximadamente 360 km", () => {
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };
    const distancia = haversineKm(sp, rj);
    expect(distancia).toBeGreaterThan(340);
    expect(distancia).toBeLessThan(380);
  });

  test("é simétrica: A→B tem a mesma distância de B→A", () => {
    const a = { lat: -23.5, lng: -46.6 };
    const b = { lat: -23.6, lng: -46.7 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe("ordenarParadas (vizinho mais próximo)", () => {
  // Quatro alunos em linha: a van parte da esquerda, então a ordem
  // natural é pegar do mais perto para o mais longe.
  const alunos: Parada[] = [
    { alunoId: 3, nome: "Carla", lat: 0, lng: 3 },
    { alunoId: 1, nome: "Ana", lat: 0, lng: 1 },
    { alunoId: 4, nome: "Davi", lat: 0, lng: 4 },
    { alunoId: 2, nome: "Bruno", lat: 0, lng: 2 },
  ];

  test("ordena os alunos do mais próximo ao mais distante da van", () => {
    const ordem = ordenarParadas({ lat: 0, lng: 0 }, alunos);
    expect(ordem.map((p) => p.nome)).toEqual(["Ana", "Bruno", "Carla", "Davi"]);
  });

  test("partindo do outro lado, a ordem inverte", () => {
    const ordem = ordenarParadas({ lat: 0, lng: 5 }, alunos);
    expect(ordem.map((p) => p.nome)).toEqual(["Davi", "Carla", "Bruno", "Ana"]);
  });

  test("não modifica a lista original", () => {
    const copia = [...alunos];
    ordenarParadas({ lat: 0, lng: 0 }, alunos);
    expect(alunos).toEqual(copia);
  });

  test("lista vazia devolve rota vazia", () => {
    expect(ordenarParadas({ lat: 0, lng: 0 }, [])).toEqual([]);
  });
});

describe("distanciaTotalKm", () => {
  test("soma as pernas do trajeto incluindo o destino final (escola)", () => {
    const origem = { lat: 0, lng: 0 };
    const paradas: Parada[] = [{ alunoId: 1, nome: "Ana", lat: 0, lng: 1 }];
    const escola = { lat: 0, lng: 2 };
    const total = distanciaTotalKm(origem, paradas, escola);
    // 2 graus de longitude no equador ≈ 222 km
    expect(total).toBeGreaterThan(220);
    expect(total).toBeLessThan(224);
  });
});

describe("montarUrlOsrm", () => {
  test("usa o formato lng,lat exigido pelo OSRM", () => {
    const url = montarUrlOsrm([
      { lat: -23.5, lng: -46.6 },
      { lat: -23.6, lng: -46.7 },
    ]);
    expect(url).toContain("/driving/-46.6,-23.5;-46.7,-23.6");
    expect(url).toContain("geometries=geojson");
  });

  test("exige pelo menos dois pontos", () => {
    expect(() => montarUrlOsrm([{ lat: 0, lng: 0 }])).toThrow();
  });
});

describe("geocode (Nominatim)", () => {
  test("monta a URL de busca restrita ao Brasil", () => {
    const url = montarUrlNominatim("Av. Paulista, 1000, São Paulo");
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("countrycodes=br");
  });

  test("rejeita endereço vazio", () => {
    expect(() => montarUrlNominatim("   ")).toThrow("Endereço vazio");
  });

  test("extrai lat/lng da resposta da API", () => {
    const coords = extrairCoordenadas([{ lat: "-23.55", lon: "-46.63" }]);
    expect(coords).toEqual({ lat: -23.55, lng: -46.63 });
  });

  test("devolve null para resposta vazia ou inválida", () => {
    expect(extrairCoordenadas([])).toBeNull();
    expect(extrairCoordenadas(null)).toBeNull();
    expect(extrairCoordenadas([{ lat: "abc", lon: "def" }])).toBeNull();
  });
});
