/**
 * trajeto.ts — o dia inteiro da van, modelado como máquina de estados.
 *
 * O ciclo real que o tio da van vive:
 *
 *   IDA        casa → casa → ... → escola   (ele PEGA as crianças)
 *   ↓ chega na escola
 *   CHAMADA    quem volta de van hoje?      (pai pode ter buscado na escola)
 *   ↓
 *   VOLTA      escola → casa → ... → fim    (ele DEIXA as crianças)
 *
 * Regras que vieram de quem faz isso todo dia (regra 1 — frente do especialista):
 *  - Na volta só existe quem realmente FOI para a escola. Quem faltou de manhã
 *    não pode aparecer na lista da tarde — seria um aluno fantasma no mapa.
 *  - A chamada é obrigatória antes de sair da escola: é o momento em que o tio
 *    confere, criança por criança, quem está dentro da van.
 *  - Enquanto a criança está na van na volta, ela é VERMELHA (responsabilidade
 *    aberta). Só vira verde quando entregue em casa e confirmada.
 *
 * Tudo aqui é função pura: recebe estado, devolve estado novo. Sem banco, sem
 * rede, sem relógio escondido — 100% testável (regra 2).
 */

export type Fase = "ida" | "chamada" | "volta" | "encerrado";

export type StatusAluno =
  | "vai" //           IDA: confirmado, esperando a van          🟢 verde
  | "falta" //         IDA: não vai hoje (com justificativa)      🔴 vermelho
  | "na_van" //        IDA: embarcou, a caminho da escola         🔵 azul
  | "na_escola" //     entregue na escola, dia letivo rolando     🟣 roxo
  | "volta_ausente" // CHAMADA: não volta de van (pai buscou)     ⚪ cinza
  | "voltando" //      VOLTA: dentro da van, indo para casa       🔴 vermelho
  | "em_casa"; //      VOLTA: entregue em casa e confirmado       🟢 verde

export interface AlunoTrajeto {
  alunoId: number;
  nome: string;
  avatar: string;
  status: StatusAluno;
  justificativa?: string | null;
  /** Casa: para onde a van vai (ida) ou de onde ela vem (volta). */
  lat: number;
  lng: number;
  /** Registro do que aconteceu e quando — é o que dá segurança ao pai. */
  embarcadoEm?: string | null;
  entregueEm?: string | null;
}

export interface Trajeto {
  fase: Fase;
  alunos: AlunoTrajeto[];
  escola: { nome: string; lat: number; lng: number };
  iniciadoEm?: string | null;
  encerradoEm?: string | null;
}

/* ==================== Cores (a linguagem visual do mapa) ==================== */

const CORES: Record<StatusAluno, string> = {
  vai: "#16a34a", // verde  — esperando a van
  falta: "#dc2626", // vermelho — não vai hoje
  na_van: "#2563eb", // azul   — dentro da van (ida)
  na_escola: "#7c3aed", // roxo   — na escola
  volta_ausente: "#94a3b8", // cinza  — não volta de van
  voltando: "#dc2626", // vermelho — dentro da van (volta): responsabilidade aberta
  em_casa: "#16a34a", // verde  — entregue em casa
};

const ROTULOS: Record<StatusAluno, string> = {
  vai: "Esperando a van",
  falta: "Falta hoje",
  na_van: "Na van, indo para a escola",
  na_escola: "Na escola",
  volta_ausente: "Não volta de van hoje",
  voltando: "Na van, indo para casa",
  em_casa: "Entregue em casa",
};

export function corDoStatus(status: StatusAluno): string {
  return CORES[status] ?? "#94a3b8";
}

export function rotuloDoStatus(status: StatusAluno): string {
  return ROTULOS[status] ?? status;
}

/* ==================== Quem aparece no mapa ==================== */

/**
 * O filtro mais importante do sistema: quem o mapa mostra em cada fase.
 *
 * Na IDA aparece todo mundo (o tio precisa ver quem falta para não ir até lá).
 * Na VOLTA aparece SÓ quem foi para a escola — quem faltou de manhã não está
 * na escola à tarde, e mostrá-lo seria mentira no mapa.
 */
export function alunosVisiveis(trajeto: Trajeto): AlunoTrajeto[] {
  if (trajeto.fase === "ida") {
    return trajeto.alunos;
  }
  // chamada / volta / encerrado: só quem realmente foi para a escola
  return trajeto.alunos.filter((a) =>
    ["na_escola", "voltando", "em_casa", "volta_ausente"].includes(a.status)
  );
}

/** As paradas que ainda faltam na fase atual, na ordem em que serão feitas. */
export function paradasPendentes(trajeto: Trajeto): AlunoTrajeto[] {
  if (trajeto.fase === "ida") {
    return trajeto.alunos.filter((a) => a.status === "vai");
  }
  if (trajeto.fase === "volta") {
    return trajeto.alunos.filter((a) => a.status === "voltando");
  }
  return [];
}

/** A próxima criança a ser atendida (a que o motorista vê em destaque). */
export function proximaParada(trajeto: Trajeto): AlunoTrajeto | null {
  return paradasPendentes(trajeto)[0] ?? null;
}

/* ==================== Progresso ==================== */

/** Percentual concluído da fase atual — alimenta a barra que o pai acompanha. */
export function progresso(trajeto: Trajeto): number {
  if (trajeto.fase === "ida") {
    const total = trajeto.alunos.filter((a) => ["vai", "na_van", "na_escola"].includes(a.status)).length;
    if (total === 0) return 0;
    const feitos = trajeto.alunos.filter((a) => ["na_van", "na_escola"].includes(a.status)).length;
    return Math.round((feitos / total) * 100);
  }
  if (trajeto.fase === "volta" || trajeto.fase === "encerrado") {
    const total = trajeto.alunos.filter((a) => ["voltando", "em_casa"].includes(a.status)).length;
    if (total === 0) return 100;
    const feitos = trajeto.alunos.filter((a) => a.status === "em_casa").length;
    return Math.round((feitos / total) * 100);
  }
  return 0;
}

/* ==================== Transições (o dia acontecendo) ==================== */

/** Erro de regra de negócio: o motorista tentou algo que a vida não permite. */
export class ErroDeTrajeto extends Error {}

/**
 * IDA — o tio pegou a criança. 🟢 verde → 🔵 azul.
 * Só quem está "vai" pode embarcar: quem faltou não sobe na van.
 */
export function embarcar(trajeto: Trajeto, alunoId: number, agora = new Date()): Trajeto {
  if (trajeto.fase !== "ida") {
    throw new ErroDeTrajeto("Só dá para embarcar durante a ida");
  }
  const aluno = trajeto.alunos.find((a) => a.alunoId === alunoId);
  if (!aluno) throw new ErroDeTrajeto("Aluno não está nesta rota");
  if (aluno.status === "falta") {
    throw new ErroDeTrajeto(`${aluno.nome} faltou hoje — não deveria embarcar`);
  }
  if (aluno.status !== "vai") {
    throw new ErroDeTrajeto(`${aluno.nome} já está na van`);
  }

  return atualizarAluno(trajeto, alunoId, {
    status: "na_van",
    embarcadoEm: agora.toISOString(),
  });
}

/**
 * IDA concluída: a van chegou na escola e todo mundo desceu.
 * Quem estava na van passa a estar "na escola" — e é essa lista que a
 * chamada da tarde vai usar.
 */
export function concluirIda(trajeto: Trajeto): Trajeto {
  if (trajeto.fase !== "ida") {
    throw new ErroDeTrajeto("A ida não está em andamento");
  }
  const aindaNaRua = trajeto.alunos.filter((a) => a.status === "vai");
  if (aindaNaRua.length > 0) {
    const nomes = aindaNaRua.map((a) => a.nome).join(", ");
    throw new ErroDeTrajeto(`Ainda falta buscar: ${nomes}`);
  }

  return {
    ...trajeto,
    fase: "chamada",
    alunos: trajeto.alunos.map((a) =>
      a.status === "na_van" ? { ...a, status: "na_escola" as StatusAluno } : a
    ),
  };
}

/**
 * CHAMADA na escola — o momento da conferência.
 * `presente = true`  → a criança volta de van (entra na rota da tarde)
 * `presente = false` → o pai buscou / ficou na escola (fica fora do mapa da volta)
 */
export function marcarNaChamada(
  trajeto: Trajeto,
  alunoId: number,
  presente: boolean
): Trajeto {
  if (trajeto.fase !== "chamada") {
    throw new ErroDeTrajeto("A chamada acontece na escola, depois da ida");
  }
  const aluno = trajeto.alunos.find((a) => a.alunoId === alunoId);
  if (!aluno) throw new ErroDeTrajeto("Aluno não está nesta rota");
  if (!["na_escola", "voltando", "volta_ausente"].includes(aluno.status)) {
    throw new ErroDeTrajeto(`${aluno.nome} não foi para a escola hoje`);
  }

  return atualizarAluno(trajeto, alunoId, {
    status: presente ? "voltando" : "volta_ausente",
  });
}

/** Quem ainda não foi conferido na chamada (o tio não sai sem zerar isso). */
export function pendentesNaChamada(trajeto: Trajeto): AlunoTrajeto[] {
  return trajeto.alunos.filter((a) => a.status === "na_escola");
}

/**
 * VOLTA — começa depois da chamada fechada.
 * Se ninguém volta de van, o dia se encerra aqui mesmo (e está tudo certo).
 */
export function iniciarVolta(trajeto: Trajeto): Trajeto {
  if (trajeto.fase !== "chamada") {
    throw new ErroDeTrajeto("Faça a chamada antes de iniciar a volta");
  }
  const pendentes = pendentesNaChamada(trajeto);
  if (pendentes.length > 0) {
    const nomes = pendentes.map((a) => a.nome).join(", ");
    throw new ErroDeTrajeto(`Confira na chamada: ${nomes}`);
  }

  const voltando = trajeto.alunos.filter((a) => a.status === "voltando");
  return { ...trajeto, fase: voltando.length === 0 ? "encerrado" : "volta" };
}

/**
 * VOLTA — criança entregue em casa e confirmada. 🔴 vermelho → 🟢 verde.
 * É a transição mais importante do sistema: é ela que fecha a
 * responsabilidade do motorista sobre aquela criança.
 */
export function entregarEmCasa(trajeto: Trajeto, alunoId: number, agora = new Date()): Trajeto {
  if (trajeto.fase !== "volta") {
    throw new ErroDeTrajeto("Só dá para entregar durante a volta");
  }
  const aluno = trajeto.alunos.find((a) => a.alunoId === alunoId);
  if (!aluno) throw new ErroDeTrajeto("Aluno não está nesta rota");
  if (aluno.status === "em_casa") {
    throw new ErroDeTrajeto(`${aluno.nome} já foi entregue`);
  }
  if (aluno.status !== "voltando") {
    throw new ErroDeTrajeto(`${aluno.nome} não está na van`);
  }

  const novo = atualizarAluno(trajeto, alunoId, {
    status: "em_casa",
    entregueEm: agora.toISOString(),
  });

  // Última criança entregue = dia encerrado.
  const aindaNaVan = novo.alunos.some((a) => a.status === "voltando");
  return aindaNaVan
    ? novo
    : { ...novo, fase: "encerrado", encerradoEm: agora.toISOString() };
}

/* ==================== Montagem ==================== */

/**
 * Monta o trajeto do dia a partir da lista de alunos vinculados.
 * Quem tem falta registrada já entra como "falta" (vermelho no mapa) —
 * o tio vê de cara que não precisa passar lá.
 */
export function montarIda(
  alunos: Array<{
    id: number;
    nome: string;
    avatar?: string;
    vai_hoje: boolean;
    justificativa?: string | null;
    casa_lat: number;
    casa_lng: number;
  }>,
  escola: { nome: string; lat: number; lng: number },
  agora = new Date()
): Trajeto {
  return {
    fase: "ida",
    escola,
    iniciadoEm: agora.toISOString(),
    alunos: alunos.map((a) => ({
      alunoId: a.id,
      nome: a.nome,
      avatar: a.avatar || "🧒",
      status: (a.vai_hoje ? "vai" : "falta") as StatusAluno,
      justificativa: a.justificativa ?? null,
      lat: Number(a.casa_lat),
      lng: Number(a.casa_lng),
      embarcadoEm: null,
      entregueEm: null,
    })),
  };
}

/**
 * Os pontos que a rota precisa ligar, na ordem certa da fase:
 *  - IDA:   posição da van → casas pendentes → escola
 *  - VOLTA: escola → casas de quem está voltando
 */
export function pontosDaRota(
  trajeto: Trajeto,
  posicaoVan: { lat: number; lng: number }
): Array<[number, number]> {
  const casas = paradasPendentes(trajeto).map(
    (a) => [a.lat, a.lng] as [number, number]
  );

  if (trajeto.fase === "ida") {
    return [[posicaoVan.lat, posicaoVan.lng], ...casas, [trajeto.escola.lat, trajeto.escola.lng]];
  }
  if (trajeto.fase === "volta") {
    return [[posicaoVan.lat, posicaoVan.lng], ...casas];
  }
  return [];
}

/** Resumo em uma frase — é o que o pai lê antes de qualquer detalhe. */
export function resumoParaOPai(trajeto: Trajeto, aluno: AlunoTrajeto): string {
  switch (aluno.status) {
    case "vai":
      return `A van está a caminho para buscar ${aluno.nome}.`;
    case "falta":
      return `${aluno.nome} está marcado como falta hoje.`;
    case "na_van":
      return `${aluno.nome} está na van, a caminho da escola. 🚐`;
    case "na_escola":
      return `${aluno.nome} chegou na escola em segurança. ✅`;
    case "volta_ausente":
      return `${aluno.nome} não volta de van hoje.`;
    case "voltando":
      return `${aluno.nome} está na van, voltando para casa. 🚐`;
    case "em_casa":
      return `${aluno.nome} foi entregue em casa. ✅`;
    default:
      return "Sem informação no momento.";
  }
}

/* ==================== apoio ==================== */

function atualizarAluno(
  trajeto: Trajeto,
  alunoId: number,
  mudanca: Partial<AlunoTrajeto>
): Trajeto {
  return {
    ...trajeto,
    alunos: trajeto.alunos.map((a) => (a.alunoId === alunoId ? { ...a, ...mudanca } : a)),
  };
}
