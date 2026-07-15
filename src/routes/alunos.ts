/**
 * Rotas dos alunos — usadas pelos PAIS:
 *  - cadastrar o filho (endereço vira coordenada automaticamente via Nominatim)
 *  - listar os filhos
 *  - marcar se o filho VAI ou NÃO VAI à escola hoje (com justificativa)
 */
import { Router } from "express";
import { query } from "../db";
import { exigirLogin, exigirTipo } from "../middleware/auth";
import { geocodificar } from "../services/geocode";

const router = Router();
router.use(exigirLogin, exigirTipo("pai"));

/** POST /api/alunos — cadastra um filho no perfil do pai logado. */
router.post("/", async (req, res) => {
  const { nome, avatar, casaEndereco, escolaNome, escolaEndereco, problemaSaude, contatoEmergencia } =
    req.body ?? {};

  if (!nome || !casaEndereco || !escolaNome || !escolaEndereco) {
    return res
      .status(400)
      .json({ erro: "Informe nome, endereço da casa, nome e endereço da escola" });
  }

  // Automação: o endereço digitado vira coordenada no mapa sem esforço do usuário
  const [casa, escola] = await Promise.all([
    geocodificar(casaEndereco),
    geocodificar(escolaEndereco),
  ]);

  const resultado = await query(
    `INSERT INTO alunos
       (pai_id, nome, avatar, casa_endereco, casa_lat, casa_lng,
        escola_nome, escola_endereco, escola_lat, escola_lng,
        problema_saude, contato_emergencia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      req.usuario!.id, nome, avatar || "🧒", casaEndereco, casa?.lat ?? null, casa?.lng ?? null,
      escolaNome, escolaEndereco, escola?.lat ?? null, escola?.lng ?? null,
      problemaSaude ?? null, contatoEmergencia ?? null,
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
 * body: { vai: boolean, justificativa?: string }
 * Regra de negócio: falta (vai=false) SEMPRE exige justificativa,
 * para o motorista saber o motivo ao clicar no ponto vermelho.
 */
router.post("/:id/presenca", async (req, res) => {
  const { vai, justificativa } = req.body ?? {};
  const alunoId = Number(req.params.id);

  if (typeof vai !== "boolean") {
    return res.status(400).json({ erro: "Informe se o aluno vai (true) ou não vai (false)" });
  }
  if (!vai && (!justificativa || !String(justificativa).trim())) {
    return res.status(400).json({ erro: "Para marcar falta é obrigatório informar o motivo" });
  }

  // Garante que o aluno é mesmo filho do pai logado
  const dono = await query("SELECT id FROM alunos WHERE id = $1 AND pai_id = $2", [
    alunoId,
    req.usuario!.id,
  ]);
  if (dono.rowCount === 0) {
    return res.status(404).json({ erro: "Aluno não encontrado no seu perfil" });
  }

  await query(
    `INSERT INTO presencas (aluno_id, data, vai, justificativa)
     VALUES ($1, CURRENT_DATE, $2, $3)
     ON CONFLICT (aluno_id, data)
     DO UPDATE SET vai = EXCLUDED.vai, justificativa = EXCLUDED.justificativa`,
    [alunoId, vai, vai ? null : justificativa]
  );

  res.json({ ok: true, mensagem: vai ? "Presença confirmada ✅" : "Falta registrada 📝" });
});

export default router;
