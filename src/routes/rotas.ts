/**
 * Rotas do MOTORISTA: o mapa do dia e o cálculo da melhor rota.
 *
 * GET /api/rota/alunos  → todos os alunos vinculados (pontos verdes/vermelhos)
 * GET /api/rota/melhor  → ordem de coleta otimizada + traçado OSRM
 */
import { Router } from "express";
import { query } from "../db";
import { exigirLogin, exigirTipo } from "../middleware/auth";
import { distanciaTotalKm, ordenarParadas, Parada, tracarRotaOsrm } from "../services/rota";

const router = Router();
router.use(exigirLogin, exigirTipo("motorista"));

/** Alunos com contrato fechado (aceito pelos dois lados) e a presença de hoje. */
async function alunosDoMotorista(motoristaId: number) {
  const resultado = await query(
    `SELECT a.id, a.nome, a.casa_endereco, a.casa_lat, a.casa_lng,
            a.escola_nome, a.escola_lat, a.escola_lng,
            a.problema_saude, a.contato_emergencia,
            u.nome AS responsavel, u.telefone AS telefone_responsavel,
            COALESCE(p.vai, TRUE) AS vai_hoje,
            p.justificativa
       FROM vinculos v
       JOIN alunos a   ON a.id = v.aluno_id
       JOIN usuarios u ON u.id = a.pai_id
       LEFT JOIN presencas p ON p.aluno_id = a.id AND p.data = CURRENT_DATE
      WHERE v.motorista_id = $1
        AND v.aceito_pai AND v.aceito_motorista
      ORDER BY a.nome`,
    [motoristaId]
  );
  return resultado.rows;
}

/**
 * GET /api/rota/alunos — o "mapa do dia".
 * vai_hoje = true  → ponto VERDE (vai à escola)
 * vai_hoje = false → ponto VERMELHO (faltará; justificativa disponível ao clicar)
 */
router.get("/alunos", async (req, res) => {
  res.json(await alunosDoMotorista(req.usuario!.id));
});

/**
 * GET /api/rota/melhor?lat=...&lng=...
 * Recebe a posição atual da van e devolve:
 *  - a ordem de coleta (1º, 2º, 3º... e por fim a escola)
 *  - a distância total estimada
 *  - o traçado rua a rua (GeoJSON do OSRM), quando disponível
 * Só entram na rota os alunos com ponto VERDE hoje.
 */
router.get("/melhor", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ erro: "Informe sua posição atual: ?lat=...&lng=..." });
  }

  const todos = await alunosDoMotorista(req.usuario!.id);
  const comCasa = todos.filter((a) => a.vai_hoje && a.casa_lat != null && a.casa_lng != null);

  if (comCasa.length === 0) {
    return res.json({ paradas: [], mensagem: "Nenhum aluno confirmado para hoje 🎉" });
  }

  const origem = { lat, lng };
  const paradas: Parada[] = comCasa.map((a) => ({
    alunoId: a.id,
    nome: a.nome,
    lat: Number(a.casa_lat),
    lng: Number(a.casa_lng),
  }));

  // A escola de destino: usamos a do primeiro aluno (uma van atende uma escola)
  const escola = comCasa.find((a) => a.escola_lat != null);
  const destino = escola
    ? { lat: Number(escola.escola_lat), lng: Number(escola.escola_lng) }
    : null;

  const ordenadas = ordenarParadas(origem, paradas);
  const pontosCompletos = destino ? [origem, ...ordenadas, destino] : [origem, ...ordenadas];
  const tracado = await tracarRotaOsrm(pontosCompletos);

  res.json({
    paradas: ordenadas.map((p, i) => ({ ordem: i + 1, ...p })),
    escola: destino ? { nome: escola!.escola_nome, ...destino } : null,
    distanciaEstimadaKm: destino ? distanciaTotalKm(origem, ordenadas, destino) : null,
    tracado, // { geometria (GeoJSON), duracaoMin, distanciaKm } ou null
  });
});

export default router;
