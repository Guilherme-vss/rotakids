/**
 * Testes do dia da van: ida → chamada → volta.
 *
 * Aqui mora a regra que protege criança, então o teste não cobre só o caminho
 * feliz: cobre o tio tentando fazer o que a vida não permite (regra 3).
 */
import {
  alunosVisiveis,
  concluirIda,
  corDoStatus,
  embarcar,
  entregarEmCasa,
  ErroDeTrajeto,
  iniciarVolta,
  marcarNaChamada,
  montarIda,
  pendentesNaChamada,
  pontosDaRota,
  progresso,
  proximaParada,
  resumoParaOPai,
  Trajeto,
} from "../src/domain/trajeto";

const ESCOLA = { nome: "E.E. Dom Pedro II", lat: -23.55, lng: -46.63 };

const ALUNOS = [
  { id: 1, nome: "Ana Lima", avatar: "🦄", vai_hoje: true, casa_lat: -23.552, casa_lng: -46.649 },
  { id: 2, nome: "Bruno Santos", avatar: "🦖", vai_hoje: true, casa_lat: -23.566, casa_lng: -46.651 },
  { id: 3, nome: "Caio Pereira", avatar: "🚀", vai_hoje: false, justificativa: "Consulta médica", casa_lat: -23.553, casa_lng: -46.653 },
];

const AGORA = new Date("2026-07-16T07:00:00");

function idaCompleta(): Trajeto {
  let t = montarIda(ALUNOS, ESCOLA, AGORA);
  t = embarcar(t, 1, AGORA);
  t = embarcar(t, 2, AGORA);
  return concluirIda(t);
}

describe("montarIda", () => {
  test("quem vai fica verde e quem falta já entra vermelho", () => {
    const t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(t.fase).toBe("ida");
    expect(t.alunos[0].status).toBe("vai");
    expect(t.alunos[2].status).toBe("falta");
    expect(t.alunos[2].justificativa).toBe("Consulta médica");
  });

  test("as cores traduzem o status para o mapa", () => {
    expect(corDoStatus("vai")).toBe("#16a34a"); // verde
    expect(corDoStatus("falta")).toBe("#dc2626"); // vermelho
    expect(corDoStatus("na_van")).toBe("#2563eb"); // azul
    expect(corDoStatus("voltando")).toBe("#dc2626"); // vermelho na volta
    expect(corDoStatus("em_casa")).toBe("#16a34a"); // verde ao entregar
  });
});

describe("IDA — embarcar", () => {
  test("pegar a criança leva de verde para azul e registra a hora", () => {
    const t = embarcar(montarIda(ALUNOS, ESCOLA, AGORA), 1, AGORA);
    const ana = t.alunos.find((a) => a.alunoId === 1)!;
    expect(ana.status).toBe("na_van");
    expect(ana.embarcadoEm).toBe(AGORA.toISOString());
  });

  test("não deixa embarcar quem faltou hoje", () => {
    const t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(() => embarcar(t, 3, AGORA)).toThrow(/faltou hoje/);
  });

  test("não deixa embarcar duas vezes a mesma criança", () => {
    const t = embarcar(montarIda(ALUNOS, ESCOLA, AGORA), 1, AGORA);
    expect(() => embarcar(t, 1, AGORA)).toThrow(/já está na van/);
  });

  test("aluno que não é da rota é recusado", () => {
    const t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(() => embarcar(t, 999, AGORA)).toThrow(ErroDeTrajeto);
  });

  test("a próxima parada anda conforme as crianças sobem", () => {
    let t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(proximaParada(t)!.nome).toBe("Ana Lima");
    t = embarcar(t, 1, AGORA);
    expect(proximaParada(t)!.nome).toBe("Bruno Santos"); // Caio faltou: nem entra
    t = embarcar(t, 2, AGORA);
    expect(proximaParada(t)).toBeNull();
  });
});

describe("IDA — concluir", () => {
  test("não deixa chegar na escola com criança esperando na rua", () => {
    const t = embarcar(montarIda(ALUNOS, ESCOLA, AGORA), 1, AGORA);
    expect(() => concluirIda(t)).toThrow(/Ainda falta buscar: Bruno Santos/);
  });

  test("com todos a bordo, a ida fecha e abre a chamada", () => {
    const t = idaCompleta();
    expect(t.fase).toBe("chamada");
    expect(t.alunos.find((a) => a.alunoId === 1)!.status).toBe("na_escola");
    expect(t.alunos.find((a) => a.alunoId === 3)!.status).toBe("falta"); // quem faltou não muda
  });
});

describe("CHAMADA na escola", () => {
  test("quem faltou de manhã NÃO aparece na chamada (não está na escola)", () => {
    const t = idaCompleta();
    const nomes = pendentesNaChamada(t).map((a) => a.nome);
    expect(nomes).toEqual(["Ana Lima", "Bruno Santos"]);
    expect(nomes).not.toContain("Caio Pereira");
  });

  test("marcar presente coloca a criança na volta; ausente tira do mapa", () => {
    let t = idaCompleta();
    t = marcarNaChamada(t, 1, true);
    t = marcarNaChamada(t, 2, false); // o pai buscou o Bruno na escola
    expect(t.alunos.find((a) => a.alunoId === 1)!.status).toBe("voltando");
    expect(t.alunos.find((a) => a.alunoId === 2)!.status).toBe("volta_ausente");
  });

  test("não dá para chamar quem não foi para a escola", () => {
    const t = idaCompleta();
    expect(() => marcarNaChamada(t, 3, true)).toThrow(/não foi para a escola/);
  });

  test("não sai da escola com chamada pela metade", () => {
    let t = idaCompleta();
    t = marcarNaChamada(t, 1, true);
    expect(() => iniciarVolta(t)).toThrow(/Confira na chamada: Bruno Santos/);
  });
});

describe("VOLTA", () => {
  function voltaEmCurso(): Trajeto {
    let t = idaCompleta();
    t = marcarNaChamada(t, 1, true);
    t = marcarNaChamada(t, 2, true);
    return iniciarVolta(t);
  }

  test("só quem foi para a escola aparece no mapa da volta", () => {
    const t = voltaEmCurso();
    const nomes = alunosVisiveis(t).map((a) => a.nome);
    expect(nomes).toEqual(["Ana Lima", "Bruno Santos"]);
    expect(nomes).not.toContain("Caio Pereira"); // faltou de manhã: não existe à tarde
  });

  test("na van a criança é vermelha; entregue em casa fica verde", () => {
    let t = voltaEmCurso();
    expect(corDoStatus(t.alunos[0].status)).toBe("#dc2626"); // vermelho: na van
    t = entregarEmCasa(t, 1, AGORA);
    expect(corDoStatus(t.alunos[0].status)).toBe("#16a34a"); // verde: entregue
    expect(t.alunos[0].entregueEm).toBe(AGORA.toISOString());
  });

  test("entregar a última criança encerra o dia sozinho", () => {
    let t = voltaEmCurso();
    t = entregarEmCasa(t, 1, AGORA);
    expect(t.fase).toBe("volta"); // ainda tem o Bruno
    t = entregarEmCasa(t, 2, AGORA);
    expect(t.fase).toBe("encerrado");
    expect(t.encerradoEm).toBe(AGORA.toISOString());
  });

  test("não entrega duas vezes nem entrega quem não está na van", () => {
    let t = voltaEmCurso();
    t = entregarEmCasa(t, 1, AGORA);
    expect(() => entregarEmCasa(t, 1, AGORA)).toThrow(/já foi entregue/);
    expect(() => entregarEmCasa(t, 3, AGORA)).toThrow(/não está na van/);
  });

  test("se ninguém volta de van, o dia encerra na própria escola", () => {
    let t = idaCompleta();
    t = marcarNaChamada(t, 1, false);
    t = marcarNaChamada(t, 2, false);
    expect(iniciarVolta(t).fase).toBe("encerrado");
  });
});

describe("pontosDaRota", () => {
  const van = { lat: -23.558, lng: -46.66 };

  test("na ida: van → casas pendentes → escola", () => {
    const t = montarIda(ALUNOS, ESCOLA, AGORA);
    const pontos = pontosDaRota(t, van);
    expect(pontos[0]).toEqual([-23.558, -46.66]); // van
    expect(pontos).toHaveLength(4); // van + Ana + Bruno + escola (Caio faltou)
    expect(pontos[pontos.length - 1]).toEqual([ESCOLA.lat, ESCOLA.lng]);
  });

  test("na volta: escola (posição da van) → casas, sem voltar para a escola", () => {
    let t = idaCompleta();
    t = marcarNaChamada(t, 1, true);
    t = marcarNaChamada(t, 2, true);
    t = iniciarVolta(t);
    const pontos = pontosDaRota(t, ESCOLA);
    expect(pontos).toHaveLength(3); // escola + 2 casas
    expect(pontos[pontos.length - 1]).not.toEqual([ESCOLA.lat, ESCOLA.lng]);
  });
});

describe("progresso e resumo para o pai", () => {
  test("a barra da ida anda conforme as crianças embarcam", () => {
    let t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(progresso(t)).toBe(0);
    t = embarcar(t, 1, AGORA);
    expect(progresso(t)).toBe(50); // 1 de 2 (o que faltou não conta)
    t = embarcar(t, 2, AGORA);
    expect(progresso(t)).toBe(100);
  });

  test("o pai recebe uma frase clara em cada fase — nunca um código", () => {
    let t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(resumoParaOPai(t, t.alunos[0])).toMatch(/a caminho para buscar/);
    t = embarcar(t, 1, AGORA);
    expect(resumoParaOPai(t, t.alunos[0])).toMatch(/na van, a caminho da escola/i);
    t = concluirIda(t === t ? embarcar(t, 2, AGORA) : t);
    expect(resumoParaOPai(t, t.alunos[0])).toMatch(/chegou na escola/);
  });

  test("quem faltou tem a frase do dia dele, não um erro", () => {
    const t = montarIda(ALUNOS, ESCOLA, AGORA);
    expect(resumoParaOPai(t, t.alunos[2])).toMatch(/marcado como falta/);
  });
});
