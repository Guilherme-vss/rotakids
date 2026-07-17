/**
 * Rotas de vínculo (o "contrato" entre pai e motorista).
 *
 * Fluxo: o motorista solicita o vínculo pelo email do pai + nome do aluno →
 * o pai aceita → só então o motorista passa a ver a localização da casa.
 * Privacidade em primeiro lugar: sem as duas confirmações, nada de endereço.
 */
import { Router } from "express";
import { query } from "../db";
import { exigirLogin, exigirTipo } from "../middleware/auth";

const router = Router();
router.use(exigirLogin);

/** POST /api/vinculos — motorista solicita vínculo com um aluno. */
router.post("/", exigirTipo("motorista"), async (req, res) => {
  const { emailPai, nomeAluno } = req.body ?? {};
  if (!emailPai || !nomeAluno) {
    return res.status(400).json({ erro: "Informe o email do responsável e o nome do aluno" });
  }

  const aluno = await query(
    `SELECT a.id FROM alunos a
      JOIN usuarios u ON u.id = a.pai_id
     WHERE u.email = $1 AND LOWER(a.nome) = LOWER($2)`,
    [String(emailPai).toLowerCase(), nomeAluno]
  );
  if (aluno.rowCount === 0) {
    return res.status(404).json({ erro: "Aluno não encontrado com esse responsável" });
  }

  try {
    await query(
      `INSERT INTO vinculos (aluno_id, motorista_id, aceito_motorista)
       VALUES ($1, $2, TRUE)`,
      [aluno.rows[0].id, req.usuario!.id]
    );
    res.status(201).json({ ok: true, mensagem: "Solicitação enviada — aguardando o responsável aceitar" });
  } catch (erro: any) {
    if (erro.code === "23505") {
      return res.status(409).json({ erro: "Já existe uma solicitação para esse aluno" });
    }
    throw erro;
  }
});

/** GET /api/vinculos/pendentes — pai vê solicitações aguardando resposta. */
router.get("/pendentes", exigirTipo("pai"), async (req, res) => {
  const resultado = await query(
    // O pai decide com informação na mão: quem é o motorista, a van dele e a CNH.
    `SELECT v.id, a.nome AS aluno,
            u.nome AS motorista, u.celular AS telefone,
            m.cnh_categoria, m.cnh_validade,
            ve.placa, ve.modelo, ve.ano, ve.lugares
       FROM vinculos v
       JOIN alunos a      ON a.id = v.aluno_id
       JOIN usuarios u    ON u.id = v.motorista_id
       LEFT JOIN motoristas m ON m.usuario_id = u.id
       LEFT JOIN veiculos ve  ON ve.motorista_id = u.id AND ve.ativo
      WHERE a.pai_id = $1 AND v.aceito_pai = FALSE`,
    [req.usuario!.id]
  );
  res.json(resultado.rows);
});

/** POST /api/vinculos/:id/aceitar — pai confirma o contrato. */
router.post("/:id/aceitar", exigirTipo("pai"), async (req, res) => {
  const resultado = await query(
    `UPDATE vinculos v SET aceito_pai = TRUE
      FROM alunos a
     WHERE v.id = $1 AND a.id = v.aluno_id AND a.pai_id = $2
     RETURNING v.id`,
    [Number(req.params.id), req.usuario!.id]
  );
  if (resultado.rowCount === 0) {
    return res.status(404).json({ erro: "Solicitação não encontrada" });
  }
  res.json({ ok: true, mensagem: "Contrato fechado! O motorista já pode ver a rota. 🤝" });
});

export default router;
