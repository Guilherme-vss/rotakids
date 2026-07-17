/**
 * Rotas do TRAJETO — o dia do tio da van acontecendo.
 *
 *   POST /api/trajeto/iniciar          monta a ida com quem vai hoje
 *   GET  /api/trajeto/hoje             o estado atual (mapa + próxima parada)
 *   POST /api/trajeto/embarcar/:id     pegou a criança          🟢 → 🔵
 *   POST /api/trajeto/concluir-ida     chegou na escola         🔵 → 🟣
 *   POST /api/trajeto/chamada/:id      confere quem volta de van
 *   POST /api/trajeto/iniciar-volta    sai da escola
 *   POST /api/trajeto/entregar/:id     entregou em casa         🔴 → 🟢
 *   POST /api/trajeto/posicao          onde a van está (o pai vê isso)
 *
 * A regra vive em `domain/trajeto.ts`. Aqui só carregamos o estado do banco,
 * pedimos a transição ao domínio e gravamos o resultado + o evento de auditoria.
 */
import { Router } from "express";
import { pool, query } from "../db";
import { exigirLogin, exigirTipo } from "../middleware/auth";
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
  rotuloDoStatus,
  StatusAluno,
  Trajeto,
} from "../domain/trajeto";

const router = Router();
router.use(exigirLogin, exigirTipo("motorista"));

/* ==================== Carregar / salvar o estado ==================== */

/** Lê o trajeto de hoje do banco e remonta o objeto do domínio. */
async function carregarTrajetoDeHoje(motoristaId: number): Promise<{ id: number; trajeto: Trajeto } | null> {
  const cabecalho = await query(
    `SELECT id, fase, escola_nome, escola_lat, escola_lng, iniciado_em, encerrado_em
       FROM trajetos WHERE motorista_id = $1 AND data = CURRENT_DATE`,
    [motoristaId]
  );
  if (cabecalho.rowCount === 0) return null;
  const t = cabecalho.rows[0];

  const alunos = await query(
    `SELECT ta.aluno_id, ta.status, ta.justificativa, ta.embarcado_em, ta.entregue_em,
            a.nome, a.avatar, a.casa_lat, a.casa_lng
       FROM trajeto_alunos ta
       JOIN alunos a ON a.id = ta.aluno_id
      WHERE ta.trajeto_id = $1
      ORDER BY ta.id`,
    [t.id]
  );

  return {
    id: t.id,
    trajeto: {
      fase: t.fase,
      escola: { nome: t.escola_nome, lat: Number(t.escola_lat), lng: Number(t.escola_lng) },
      iniciadoEm: t.iniciado_em,
      encerradoEm: t.encerrado_em,
      alunos: alunos.rows.map((a) => ({
        alunoId: a.aluno_id,
        nome: a.nome,
        avatar: a.avatar || "🧒",
        status: a.status as StatusAluno,
        justificativa: a.justificativa,
        lat: Number(a.casa_lat),
        lng: Number(a.casa_lng),
        embarcadoEm: a.embarcado_em,
        entregueEm: a.entregue_em,
      })),
    },
  };
}

/** Grava o estado novo + o evento de auditoria, tudo ou nada. */
async function salvarTrajeto(
  trajetoId: number,
  trajeto: Trajeto,
  evento?: { tipo: string; alunoId?: number; detalhe?: string }
) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    await cliente.query(`UPDATE trajetos SET fase = $1, encerrado_em = $2 WHERE id = $3`, [
      trajeto.fase,
      trajeto.encerradoEm ?? null,
      trajetoId,
    ]);

    for (const aluno of trajeto.alunos) {
      await cliente.query(
        `UPDATE trajeto_alunos
            SET status = $1, embarcado_em = $2, entregue_em = $3
          WHERE trajeto_id = $4 AND aluno_id = $5`,
        [aluno.status, aluno.embarcadoEm ?? null, aluno.entregueEm ?? null, trajetoId, aluno.alunoId]
      );
    }

    if (evento) {
      await cliente.query(
        `INSERT INTO eventos (trajeto_id, aluno_id, tipo, detalhe) VALUES ($1, $2, $3, $4)`,
        [trajetoId, evento.alunoId ?? null, evento.tipo, evento.detalhe ?? null]
      );
    }

    await cliente.query("COMMIT");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Monta a resposta que a tela do motorista consome. */
function paraTela(trajetoId: number, trajeto: Trajeto) {
  const proxima = proximaParada(trajeto);
  return {
    trajetoId,
    fase: trajeto.fase,
    progresso: progresso(trajeto),
    escola: trajeto.escola,
    proximaParada: proxima,
    pendentesNaChamada: pendentesNaChamada(trajeto),
    alunos: alunosVisiveis(trajeto).map((a) => ({
      ...a,
      cor: corDoStatus(a.status),
      statusRotulo: rotuloDoStatus(a.status),
    })),
  };
}

/** Traduz o erro do domínio em resposta HTTP — regra de negócio é 409, não 500. */
function responderErro(res: any, erro: unknown) {
  if (erro instanceof ErroDeTrajeto) {
    return res.status(409).json({ erro: erro.message });
  }
  console.error("[trajeto]", erro);
  return res.status(500).json({ erro: "Erro interno no trajeto" });
}

/* ==================== Rotas ==================== */

/**
 * POST /api/trajeto/iniciar — começa o dia.
 * Monta a ida com os alunos vinculados (contrato aceito pelos dois lados),
 * já marcando quem faltou. Idempotente: se o dia já começou, devolve ele.
 */
router.post("/iniciar", async (req, res) => {
  const motoristaId = req.usuario!.id;

  const existente = await carregarTrajetoDeHoje(motoristaId);
  if (existente) {
    return res.json({ ...paraTela(existente.id, existente.trajeto), jaExistia: true });
  }

  const alunos = await query(
    `SELECT a.id, a.nome, a.avatar, a.casa_lat, a.casa_lng,
            a.escola_nome, a.escola_lat, a.escola_lng,
            COALESCE(p.vai, TRUE) AS vai_hoje, p.justificativa
       FROM vinculos v
       JOIN alunos a ON a.id = v.aluno_id
       LEFT JOIN presencas p ON p.aluno_id = a.id AND p.data = CURRENT_DATE
      WHERE v.motorista_id = $1 AND v.aceito_pai AND v.aceito_motorista
      ORDER BY a.nome`,
    [motoristaId]
  );

  if (alunos.rowCount === 0) {
    return res.status(400).json({ erro: "Você ainda não tem alunos vinculados para hoje" });
  }
  const semCoordenada = alunos.rows.filter((a) => a.casa_lat == null);
  if (semCoordenada.length === alunos.rowCount) {
    return res.status(400).json({ erro: "Nenhum aluno tem endereço localizado no mapa" });
  }

  const primeira = alunos.rows.find((a) => a.escola_lat != null) ?? alunos.rows[0];
  const escola = {
    nome: primeira.escola_nome,
    lat: Number(primeira.escola_lat),
    lng: Number(primeira.escola_lng),
  };

  const trajeto = montarIda(
    alunos.rows.filter((a) => a.casa_lat != null),
    escola
  );

  const veiculo = await query(
    `SELECT id FROM veiculos WHERE motorista_id = $1 AND ativo LIMIT 1`,
    [motoristaId]
  );

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const criado = await cliente.query(
      `INSERT INTO trajetos (motorista_id, veiculo_id, escola_nome, escola_lat, escola_lng, fase)
       VALUES ($1, $2, $3, $4, $5, 'ida') RETURNING id`,
      [motoristaId, veiculo.rows[0]?.id ?? null, escola.nome, escola.lat, escola.lng]
    );
    const trajetoId = criado.rows[0].id;

    for (const aluno of trajeto.alunos) {
      await cliente.query(
        `INSERT INTO trajeto_alunos (trajeto_id, aluno_id, status, justificativa)
         VALUES ($1, $2, $3, $4)`,
        [trajetoId, aluno.alunoId, aluno.status, aluno.justificativa ?? null]
      );
    }
    await cliente.query(
      `INSERT INTO eventos (trajeto_id, tipo, detalhe) VALUES ($1, 'ida_iniciada', $2)`,
      [trajetoId, `${trajeto.alunos.filter((a) => a.status === "vai").length} aluno(s) para buscar`]
    );
    await cliente.query("COMMIT");

    res.status(201).json(paraTela(trajetoId, trajeto));
  } catch (erro: any) {
    await cliente.query("ROLLBACK");
    if (erro.code === "23505") {
      return res.status(409).json({ erro: "O trajeto de hoje já foi iniciado" });
    }
    responderErro(res, erro);
  } finally {
    cliente.release();
  }
});

/** GET /api/trajeto/hoje — o estado atual do dia. */
router.get("/hoje", async (req, res) => {
  const atual = await carregarTrajetoDeHoje(req.usuario!.id);
  if (!atual) {
    return res.json({ iniciado: false, mensagem: "O trajeto de hoje ainda não começou." });
  }
  res.json({ iniciado: true, ...paraTela(atual.id, atual.trajeto) });
});

/**
 * GET /api/trajeto/rota?lat=&lng= — os pontos que a rota deve ligar agora.
 * O traçado pelas ruas é desenhado no front (OSRM); aqui só dizemos POR ONDE
 * a van precisa passar, na ordem certa da fase.
 */
router.get("/rota", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ erro: "Informe a posição da van: ?lat=...&lng=..." });
  }

  const atual = await carregarTrajetoDeHoje(req.usuario!.id);
  if (!atual) return res.status(404).json({ erro: "O trajeto de hoje ainda não começou" });

  res.json({
    fase: atual.trajeto.fase,
    pontos: pontosDaRota(atual.trajeto, { lat, lng }),
    paradas: proximaParada(atual.trajeto) ? [proximaParada(atual.trajeto)] : [],
  });
});

/** Fábrica das rotas de transição: todas seguem o mesmo ritual. */
function rotaDeTransicao(
  caminho: string,
  aplicar: (trajeto: Trajeto, alunoId: number, corpo: any) => Trajeto,
  evento: (trajeto: Trajeto, alunoId: number, corpo: any) => { tipo: string; alunoId?: number; detalhe?: string }
) {
  router.post(caminho, async (req, res) => {
    const alunoId = Number(req.params.id);
    const atual = await carregarTrajetoDeHoje(req.usuario!.id);
    if (!atual) return res.status(404).json({ erro: "O trajeto de hoje ainda não começou" });

    try {
      const novo = aplicar(atual.trajeto, alunoId, req.body ?? {});
      await salvarTrajeto(atual.id, novo, evento(novo, alunoId, req.body ?? {}));
      res.json(paraTela(atual.id, novo));
    } catch (erro) {
      responderErro(res, erro);
    }
  });
}

// 🟢 → 🔵 pegou a criança
rotaDeTransicao(
  "/embarcar/:id",
  (trajeto, alunoId) => embarcar(trajeto, alunoId),
  (trajeto, alunoId) => ({
    tipo: "embarcou",
    alunoId,
    detalhe: `${trajeto.alunos.find((a) => a.alunoId === alunoId)?.nome} entrou na van`,
  })
);

// 🔴 → 🟢 entregou em casa
rotaDeTransicao(
  "/entregar/:id",
  (trajeto, alunoId) => entregarEmCasa(trajeto, alunoId),
  (trajeto, alunoId) => ({
    tipo: "entregue_em_casa",
    alunoId,
    detalhe: `${trajeto.alunos.find((a) => a.alunoId === alunoId)?.nome} foi entregue em casa`,
  })
);

// chamada na escola: quem volta de van?
rotaDeTransicao(
  "/chamada/:id",
  (trajeto, alunoId, corpo) => {
    if (typeof corpo.presente !== "boolean") {
      throw new ErroDeTrajeto("Informe se o aluno está presente (true) ou não (false)");
    }
    return marcarNaChamada(trajeto, alunoId, corpo.presente);
  },
  (trajeto, alunoId, corpo) => ({
    tipo: corpo.presente ? "chamada_presente" : "chamada_ausente",
    alunoId,
    detalhe: corpo.presente ? "Volta de van hoje" : "Não volta de van hoje",
  })
);

/** POST /api/trajeto/concluir-ida — chegou na escola; abre a chamada. */
router.post("/concluir-ida", async (req, res) => {
  const atual = await carregarTrajetoDeHoje(req.usuario!.id);
  if (!atual) return res.status(404).json({ erro: "O trajeto de hoje ainda não começou" });

  try {
    const novo = concluirIda(atual.trajeto);
    await salvarTrajeto(atual.id, novo, {
      tipo: "chegou_escola",
      detalhe: `${novo.alunos.filter((a) => a.status === "na_escola").length} criança(s) entregues na escola`,
    });
    res.json(paraTela(atual.id, novo));
  } catch (erro) {
    responderErro(res, erro);
  }
});

/** POST /api/trajeto/iniciar-volta — sai da escola rumo às casas. */
router.post("/iniciar-volta", async (req, res) => {
  const atual = await carregarTrajetoDeHoje(req.usuario!.id);
  if (!atual) return res.status(404).json({ erro: "O trajeto de hoje ainda não começou" });

  try {
    const novo = iniciarVolta(atual.trajeto);
    await salvarTrajeto(atual.id, novo, {
      tipo: novo.fase === "encerrado" ? "encerrado" : "volta_iniciada",
      detalhe:
        novo.fase === "encerrado"
          ? "Ninguém volta de van hoje — dia encerrado na escola"
          : `${novo.alunos.filter((a) => a.status === "voltando").length} criança(s) na volta`,
    });
    res.json(paraTela(atual.id, novo));
  } catch (erro) {
    responderErro(res, erro);
  }
});

/**
 * POST /api/trajeto/posicao — a van avisa onde está.
 * É o que alimenta o mapa do pai. Chamada com frequência: proposital que
 * seja a rota mais barata do sistema (um UPDATE, sem transação).
 */
router.post("/posicao", async (req, res) => {
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ erro: "Informe lat e lng numéricos" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ erro: "Coordenada fora do planeta" });
  }

  const resultado = await query(
    `UPDATE trajetos SET van_lat = $1, van_lng = $2, van_em = now()
      WHERE motorista_id = $3 AND data = CURRENT_DATE AND fase <> 'encerrado'
      RETURNING id`,
    [lat, lng, req.usuario!.id]
  );
  if (resultado.rowCount === 0) {
    return res.status(404).json({ erro: "Nenhum trajeto em andamento hoje" });
  }
  res.json({ ok: true });
});

export default router;
