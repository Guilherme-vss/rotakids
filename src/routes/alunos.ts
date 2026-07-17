/**
 * Rotas dos alunos — usadas pelos PAIS:
 *  - cadastrar o filho (cadastro completo; endereço vira coordenada sozinho)
 *  - listar os filhos
 *  - marcar se o filho VAI ou NÃO VAI à escola hoje (falta exige motivo)
 *  - acompanhar o filho no trajeto de hoje (a linha do tempo do dia)
 */
import { Router } from "express";
import { query } from "../db";
import { exigirLogin, exigirTipo } from "../middleware/auth";
import { geocodificar } from "../services/geocode";
import { semErros, validarCadastroAluno } from "../domain/validacoes";
import { corDoStatus, rotuloDoStatus, StatusAluno } from "../domain/trajeto";

const router = Router();
const digitos = (texto: unknown) => String(texto ?? "").replace(/\D/g, "");

router.use(exigirLogin, exigirTipo("pai"));

/**
 * POST /api/alunos — cadastra um filho no perfil do pai logado.
 * Cadastro completo: sem responsável e contato de emergência, não passa.
 */
router.post("/", async (req, res) => {
  const dados = req.body ?? {};

  const erros = validarCadastroAluno(dados);
  if (!semErros(erros)) {
    return res.status(400).json({ erros });
  }

  // Automação: o endereço digitado vira coordenada no mapa sem esforço do usuário
  const [casa, escola] = await Promise.all([
    geocodificar(dados.casaEndereco),
    geocodificar(dados.escolaEndereco),
  ]);

  const resultado = await query(
    `INSERT INTO alunos
       (pai_id, nome, avatar, nascimento,
        casa_endereco, casa_lat, casa_lng,
        escola_nome, escola_endereco, escola_lat, escola_lng,
        problema_saude,
        responsavel_nome, responsavel_celular,
        emergencia_nome, emergencia_celular,
        autorizado_descer_sozinho)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      req.usuario!.id,
      String(dados.nome).trim(),
      dados.avatar || "🧒",
      dados.nascimento,
      dados.casaEndereco,
      casa?.lat ?? null,
      casa?.lng ?? null,
      dados.escolaNome,
      dados.escolaEndereco,
      escola?.lat ?? null,
      escola?.lng ?? null,
      dados.problemaSaude || null,
      String(dados.responsavelNome).trim(),
      digitos(dados.responsavelCelular),
      String(dados.emergenciaNome).trim(),
      digitos(dados.emergenciaCelular),
      Boolean(dados.autorizadoDescerSozinho),
    ]
  );

  res.status(201).json({
    aluno: resultado.rows[0],
    aviso: !casa
      ? "Não encontrei o endereço da casa no mapa — confira se está completo (rua, número, cidade)."
      : undefined,
  });
});

/** GET /api/alunos — lista os filhos do pai logado com a presença de hoje. */
router.get("/", async (req, res) => {
  const resultado = await query(
    `SELECT a.*,
            COALESCE(p.vai, TRUE) AS vai_hoje,
            p.justificativa
       FROM alunos a
       LEFT JOIN presencas p ON p.aluno_id = a.id AND p.data = CURRENT_DATE
      WHERE a.pai_id = $1
      ORDER BY a.nome`,
    [req.usuario!.id]
  );
  res.json(resultado.rows);
});

/**
 * POST /api/alunos/:id/presenca — marca a presença de HOJE.
 * Regra: falta SEMPRE exige justificativa — o motorista precisa saber
 * por que não vai passar naquela casa.
 */
router.post("/:id/presenca", async (req, res) => {
  const { vai, justificativa } = req.body ?? {};
  const alunoId = Number(req.params.id);

  if (typeof vai !== "boolean") {
    return res.status(400).json({ erro: "Informe se o aluno vai (true) ou não vai (false)" });
  }
  if (!vai && !String(justificativa ?? "").trim()) {
    return res.status(400).json({ erro: "Para marcar falta é obrigatório informar o motivo" });
  }

  // Garante que o aluno é mesmo filho de quem está pedindo
  const dono = await query("SELECT id FROM alunos WHERE id = $1 AND pai_id = $2", [
    alunoId,
    req.usuario!.id,
  ]);
  if (dono.rowCount === 0) {
    return res.status(404).json({ erro: "Aluno não encontrado no seu perfil" });
  }

  // Depois que a van saiu, mudar a presença só confunde o motorista.
  const emCurso = await query(
    `SELECT t.fase FROM trajeto_alunos ta
       JOIN trajetos t ON t.id = ta.trajeto_id
      WHERE ta.aluno_id = $1 AND t.data = CURRENT_DATE AND t.fase <> 'encerrado'`,
    [alunoId]
  );
  if ((emCurso.rowCount ?? 0) > 0) {
    return res.status(409).json({
      erro: "A van já saiu — fale direto com o motorista para avisar sobre hoje",
    });
  }

  await query(
    `INSERT INTO presencas (aluno_id, data, vai, justificativa)
     VALUES ($1, CURRENT_DATE, $2, $3)
     ON CONFLICT (aluno_id, data)
     DO UPDATE SET vai = EXCLUDED.vai, justificativa = EXCLUDED.justificativa`,
    [alunoId, vai, vai ? null : String(justificativa).trim()]
  );

  res.json({ ok: true, mensagem: vai ? "Presença confirmada ✅" : "Falta registrada 📝" });
});

/**
 * GET /api/alunos/:id/acompanhar — a tela que o pai mais abre.
 *
 * Devolve onde a criança está agora, a posição da van e a linha do tempo do
 * dia (embarcou, chegou na escola, entregue em casa) — vinda do log de eventos.
 */
router.get("/:id/acompanhar", async (req, res) => {
  const alunoId = Number(req.params.id);

  const aluno = await query(
    `SELECT id, nome, avatar FROM alunos WHERE id = $1 AND pai_id = $2`,
    [alunoId, req.usuario!.id]
  );
  if (aluno.rowCount === 0) {
    return res.status(404).json({ erro: "Aluno não encontrado no seu perfil" });
  }

  const trajeto = await query(
    `SELECT t.id, t.fase, t.van_lat, t.van_lng, t.van_em,
            t.escola_nome, t.escola_lat, t.escola_lng,
            ta.status, ta.embarcado_em, ta.entregue_em,
            u.nome AS motorista_nome, u.celular AS motorista_celular,
            v.placa, v.modelo
       FROM trajeto_alunos ta
       JOIN trajetos t   ON t.id = ta.trajeto_id
       JOIN usuarios u   ON u.id = t.motorista_id
       LEFT JOIN veiculos v ON v.id = t.veiculo_id
      WHERE ta.aluno_id = $1 AND t.data = CURRENT_DATE`,
    [alunoId]
  );

  if (trajeto.rowCount === 0) {
    return res.json({
      aluno: aluno.rows[0],
      emTrajeto: false,
      mensagem: "A van ainda não iniciou a rota de hoje.",
      linhaDoTempo: [],
    });
  }

  const t = trajeto.rows[0];
  const eventos = await query(
    `SELECT tipo, detalhe, ocorrido_em FROM eventos
      WHERE trajeto_id = $1 AND (aluno_id = $2 OR aluno_id IS NULL)
      ORDER BY ocorrido_em`,
    [t.id, alunoId]
  );

  res.json({
    aluno: aluno.rows[0],
    emTrajeto: true,
    fase: t.fase,
    status: t.status,
    statusRotulo: rotuloDoStatus(t.status as StatusAluno),
    cor: corDoStatus(t.status as StatusAluno),
    embarcadoEm: t.embarcado_em,
    entregueEm: t.entregue_em,
    van: t.van_lat ? { lat: t.van_lat, lng: t.van_lng, em: t.van_em } : null,
    escola: t.escola_lat ? { nome: t.escola_nome, lat: t.escola_lat, lng: t.escola_lng } : null,
    motorista: { nome: t.motorista_nome, celular: t.motorista_celular, placa: t.placa, modelo: t.modelo },
    linhaDoTempo: eventos.rows,
  });
});

export default router;
