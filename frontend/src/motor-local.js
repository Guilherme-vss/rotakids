/**
 * motor-local.js — o RotaKids rodando inteiro no navegador.
 *
 * DECISÃO DE ARQUITETURA: este arquivo **importa o mesmo domínio do servidor**
 * (`src/domain/*.ts`) em vez de reescrever as regras em JavaScript. A máquina de
 * estados que valida "não embarque quem faltou" é literalmente a mesma classe,
 * rodando nos dois lados. Duplicar a regra seria criar dois sistemas com o mesmo
 * nome — e um dia eles discordariam sobre onde uma criança está.
 *
 * Aqui só existe o que é responsabilidade da borda: guardar o estado
 * (localStorage) e traduzir chamadas HTTP em transições do domínio.
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
  progresso,
  proximaParada,
  rotuloDoStatus,
} from "../../src/domain/trajeto";
import {
  semErros,
  situacaoCnh,
  validarCadastroAluno,
  validarCadastroMotorista,
} from "../../src/domain/validacoes";

export function usarMotorLocal() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") ||
      window.location.protocol === "file:" ||
      window.location.search.includes("local=1"))
  );
}

/* ---------- Persistência ---------- */

const CHAVE = "rk3-";

function carregar(chave, padrao) {
  try {
    const bruto = localStorage.getItem(CHAVE + chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function salvar(chave, valor) {
  try {
    localStorage.setItem(CHAVE + chave, JSON.stringify(valor));
  } catch {
    /* sem espaço: segue em memória */
  }
}

/* ---------- Dados iniciais ---------- */

const ESCOLA = { nome: "E.E. Dom Pedro II", lat: -23.5505, lng: -46.6333 };

const ALUNOS_INICIAIS = [
  {
    id: 1, nome: "Ana Lima", avatar: "🦄", nascimento: "2015-05-20",
    casa_endereco: "Rua Augusta, 900 — São Paulo", casa_lat: -23.552, casa_lng: -46.649,
    escola_nome: ESCOLA.nome, escola_lat: ESCOLA.lat, escola_lng: ESCOLA.lng,
    problema_saude: "Alergia a amendoim",
    responsavel_nome: "Carla Lima", responsavel_celular: "11977772222",
    emergencia_nome: "Paula Lima", emergencia_celular: "11988881111",
    autorizado_descer_sozinho: false,
    vai_hoje: true, justificativa: null,
  },
  {
    id: 2, nome: "Bruno Santos", avatar: "🦖", nascimento: "2013-09-02",
    casa_endereco: "Al. Santos, 455 — São Paulo", casa_lat: -23.5665, casa_lng: -46.651,
    escola_nome: ESCOLA.nome, escola_lat: ESCOLA.lat, escola_lng: ESCOLA.lng,
    problema_saude: null,
    responsavel_nome: "Marcos Santos", responsavel_celular: "11966663333",
    emergencia_nome: "Rita Santos", emergencia_celular: "11955554444",
    autorizado_descer_sozinho: true,
    vai_hoje: true, justificativa: null,
  },
  {
    id: 3, nome: "Caio Pereira", avatar: "🚀", nascimento: "2016-01-11",
    casa_endereco: "Rua Frei Caneca, 200 — São Paulo", casa_lat: -23.5537, casa_lng: -46.6532,
    escola_nome: ESCOLA.nome, escola_lat: ESCOLA.lat, escola_lng: ESCOLA.lng,
    problema_saude: "Asma — bombinha na mochila",
    responsavel_nome: "Julia Pereira", responsavel_celular: "11944445555",
    emergencia_nome: "Neide Pereira", emergencia_celular: "11933336666",
    autorizado_descer_sozinho: false,
    vai_hoje: false, justificativa: "Consulta médica pela manhã",
  },
];

let alunos = carregar("alunos", ALUNOS_INICIAIS);
let trajeto = carregar("trajeto", null);
let eventos = carregar("eventos", []);
let posicaoVan = carregar("van", { lat: -23.558, lng: -46.66 });

/** A garagem: de onde a van sai de manhã (na versão web não pedimos GPS). */
export const GARAGEM = { lat: -23.558, lng: -46.66 };

function registrarEvento(tipo, alunoId, detalhe) {
  eventos = [...eventos, { tipo, aluno_id: alunoId ?? null, detalhe, ocorrido_em: new Date().toISOString() }];
  salvar("eventos", eventos);
}

function persistir() {
  salvar("trajeto", trajeto);
  salvar("alunos", alunos);
}

/** Resposta que a tela do motorista consome (espelha `paraTela` do servidor). */
function paraTela() {
  return {
    iniciado: true,
    trajetoId: 1,
    fase: trajeto.fase,
    progresso: progresso(trajeto),
    escola: trajeto.escola,
    proximaParada: proximaParada(trajeto),
    pendentesNaChamada: pendentesNaChamada(trajeto),
    alunos: alunosVisiveis(trajeto).map((a) => ({
      ...a,
      cor: corDoStatus(a.status),
      statusRotulo: rotuloDoStatus(a.status),
    })),
  };
}

/* ---------- Roteador ---------- */

export async function motorLocal(caminho, metodo = "GET", corpo = null) {
  await new Promise((r) => setTimeout(r, 120));

  /* ----- autenticação ----- */
  if (caminho === "/auth/login") {
    const perfil = carregar("perfil", null);
    return {
      token: "local",
      usuario: perfil?.usuario ?? { id: 99, nome: "Visitante", tipo: "motorista" },
    };
  }

  if (caminho === "/auth/cadastro") {
    // A MESMA validação do servidor roda aqui — inclusive CPF/CNH oficiais.
    const erros =
      corpo.tipo === "motorista"
        ? validarCadastroMotorista(corpo)
        : (() => {
            const e = {};
            if (!corpo.nome?.trim()) e.nome = "Informe o nome completo";
            if (!corpo.email?.includes("@")) e.email = "Email inválido";
            return e;
          })();

    if (!semErros(erros)) {
      const erro = new Error("Confira os campos destacados");
      erro.erros = erros;
      throw erro;
    }

    const usuario = { id: 99, nome: corpo.nome, tipo: corpo.tipo };
    salvar("perfil", { usuario, dados: corpo });
    return {
      token: "local",
      usuario,
      aviso: corpo.tipo === "motorista" ? situacaoCnh(corpo.cnhValidade).aviso : null,
    };
  }

  if (caminho === "/auth/eu") {
    const perfil = carregar("perfil", null);
    if (!perfil) return { nome: "Visitante", tipo: "motorista" };
    const d = perfil.dados;
    return {
      ...perfil.usuario,
      email: d.email,
      celular: d.celular,
      cnh: d.cnh ? { numero: d.cnh, categoria: d.cnhCategoria, validade: d.cnhValidade, ...situacaoCnh(d.cnhValidade) } : null,
      veiculo: d.veiculoPlaca
        ? { placa: d.veiculoPlaca, modelo: d.veiculoModelo, ano: d.veiculoAno, lugares: d.veiculoLugares }
        : null,
    };
  }

  /* ----- alunos (pai) ----- */
  if (caminho === "/alunos" && metodo === "GET") return [...alunos];

  if (caminho === "/alunos" && metodo === "POST") {
    const erros = validarCadastroAluno(corpo);
    if (!semErros(erros)) {
      const erro = new Error("Confira os campos destacados");
      erro.erros = erros;
      throw erro;
    }
    const novo = {
      id: Date.now(),
      nome: corpo.nome,
      avatar: corpo.avatar || "🧒",
      nascimento: corpo.nascimento,
      casa_endereco: corpo.casaEndereco,
      // sem geocoding no navegador: posiciona perto do centro para o mapa viver
      casa_lat: -23.55 + (Math.random() - 0.5) * 0.03,
      casa_lng: -46.64 + (Math.random() - 0.5) * 0.03,
      escola_nome: corpo.escolaNome, escola_lat: ESCOLA.lat, escola_lng: ESCOLA.lng,
      problema_saude: corpo.problemaSaude || null,
      responsavel_nome: corpo.responsavelNome, responsavel_celular: corpo.responsavelCelular,
      emergencia_nome: corpo.emergenciaNome, emergencia_celular: corpo.emergenciaCelular,
      autorizado_descer_sozinho: Boolean(corpo.autorizadoDescerSozinho),
      vai_hoje: true, justificativa: null,
    };
    alunos = [...alunos, novo];
    salvar("alunos", alunos);
    return { aluno: novo };
  }

  const presenca = caminho.match(/^\/alunos\/(\d+)\/presenca$/);
  if (presenca) {
    if (trajeto && trajeto.fase !== "encerrado") {
      throw new Error("A van já saiu — fale direto com o motorista para avisar sobre hoje");
    }
    const aluno = alunos.find((a) => a.id === Number(presenca[1]));
    if (aluno) {
      aluno.vai_hoje = corpo.vai;
      aluno.justificativa = corpo.vai ? null : corpo.justificativa;
      salvar("alunos", alunos);
    }
    return { ok: true, mensagem: corpo.vai ? "Presença confirmada ✅" : "Falta registrada 📝" };
  }

  /* ----- acompanhamento (pai) ----- */
  const acompanhar = caminho.match(/^\/alunos\/(\d+)\/acompanhar$/);
  if (acompanhar) {
    const alunoId = Number(acompanhar[1]);
    const aluno = alunos.find((a) => a.id === alunoId);
    if (!trajeto) {
      return { aluno, emTrajeto: false, mensagem: "A van ainda não iniciou a rota de hoje.", linhaDoTempo: [] };
    }
    const noTrajeto = trajeto.alunos.find((a) => a.alunoId === alunoId);
    if (!noTrajeto) {
      return { aluno, emTrajeto: false, mensagem: "Seu filho não está na rota de hoje.", linhaDoTempo: [] };
    }
    return {
      aluno,
      emTrajeto: true,
      fase: trajeto.fase,
      status: noTrajeto.status,
      statusRotulo: rotuloDoStatus(noTrajeto.status),
      cor: corDoStatus(noTrajeto.status),
      embarcadoEm: noTrajeto.embarcadoEm,
      entregueEm: noTrajeto.entregueEm,
      van: { lat: posicaoVan.lat, lng: posicaoVan.lng, em: new Date().toISOString() },
      escola: trajeto.escola,
      motorista: { nome: "Tio Zé da Van", celular: "11933336666", placa: "ABC-1D23", modelo: "Sprinter" },
      linhaDoTempo: eventos.filter((e) => e.aluno_id === alunoId || e.aluno_id === null),
    };
  }

  /* ----- trajeto (motorista) ----- */
  if (caminho === "/trajeto/hoje") {
    if (!trajeto) return { iniciado: false, mensagem: "O trajeto de hoje ainda não começou." };
    return paraTela();
  }

  if (caminho === "/trajeto/iniciar") {
    if (trajeto) return { ...paraTela(), jaExistia: true };
    trajeto = montarIda(alunos, ESCOLA);
    eventos = [];
    posicaoVan = { ...GARAGEM };
    salvar("van", posicaoVan);
    registrarEvento("ida_iniciada", null, `${trajeto.alunos.filter((a) => a.status === "vai").length} aluno(s) para buscar`);
    persistir();
    return paraTela();
  }

  if (caminho === "/trajeto/reiniciar") {
    trajeto = null;
    eventos = [];
    alunos = ALUNOS_INICIAIS.map((a) => ({ ...a }));
    persistir();
    salvar("eventos", eventos);
    return { ok: true };
  }

  const embarcarM = caminho.match(/^\/trajeto\/embarcar\/(\d+)$/);
  if (embarcarM) {
    const alunoId = Number(embarcarM[1]);
    trajeto = embarcar(trajeto, alunoId);
    const nome = trajeto.alunos.find((a) => a.alunoId === alunoId)?.nome;
    posicaoVan = { lat: trajeto.alunos.find((a) => a.alunoId === alunoId).lat, lng: trajeto.alunos.find((a) => a.alunoId === alunoId).lng };
    salvar("van", posicaoVan);
    registrarEvento("embarcou", alunoId, `${nome} entrou na van`);
    persistir();
    return paraTela();
  }

  if (caminho === "/trajeto/concluir-ida") {
    trajeto = concluirIda(trajeto);
    posicaoVan = { lat: trajeto.escola.lat, lng: trajeto.escola.lng };
    salvar("van", posicaoVan);
    registrarEvento("chegou_escola", null, `${trajeto.alunos.filter((a) => a.status === "na_escola").length} criança(s) entregues na escola`);
    persistir();
    return paraTela();
  }

  const chamadaM = caminho.match(/^\/trajeto\/chamada\/(\d+)$/);
  if (chamadaM) {
    const alunoId = Number(chamadaM[1]);
    trajeto = marcarNaChamada(trajeto, alunoId, corpo.presente);
    registrarEvento(
      corpo.presente ? "chamada_presente" : "chamada_ausente",
      alunoId,
      corpo.presente ? "Volta de van hoje" : "Não volta de van hoje"
    );
    persistir();
    return paraTela();
  }

  if (caminho === "/trajeto/iniciar-volta") {
    trajeto = iniciarVolta(trajeto);
    registrarEvento(
      trajeto.fase === "encerrado" ? "encerrado" : "volta_iniciada",
      null,
      trajeto.fase === "encerrado"
        ? "Ninguém volta de van hoje — dia encerrado na escola"
        : `${trajeto.alunos.filter((a) => a.status === "voltando").length} criança(s) na volta`
    );
    persistir();
    return paraTela();
  }

  const entregarM = caminho.match(/^\/trajeto\/entregar\/(\d+)$/);
  if (entregarM) {
    const alunoId = Number(entregarM[1]);
    trajeto = entregarEmCasa(trajeto, alunoId);
    const alvo = trajeto.alunos.find((a) => a.alunoId === alunoId);
    posicaoVan = { lat: alvo.lat, lng: alvo.lng };
    salvar("van", posicaoVan);
    registrarEvento("entregue_em_casa", alunoId, `${alvo.nome} foi entregue em casa`);
    if (trajeto.fase === "encerrado") registrarEvento("encerrado", null, "Dia encerrado");
    persistir();
    return paraTela();
  }

  if (caminho === "/trajeto/posicao") {
    posicaoVan = { lat: corpo.lat, lng: corpo.lng };
    salvar("van", posicaoVan);
    return { ok: true };
  }

  if (caminho.startsWith("/trajeto/rota")) {
    return { fase: trajeto?.fase ?? null, pontos: [] };
  }

  /* ----- vínculos ----- */
  if (caminho === "/vinculos/pendentes") return [];
  if (caminho === "/vinculos") {
    return { ok: true, mensagem: "Solicitação enviada — aguardando o responsável aceitar" };
  }

  return { ok: true };
}

/** A posição atual da van (o mapa do pai e do motorista leem daqui). */
export function posicaoAtualDaVan() {
  return posicaoVan;
}

export { ErroDeTrajeto };
