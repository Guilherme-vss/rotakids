/**
 * Rotas de autenticação: cadastro e login de pais e motoristas.
 */
import bcrypt from "bcryptjs";
import { Router } from "express";
import { query } from "../db";
import { gerarToken } from "../middleware/auth";

const router = Router();

/** POST /api/auth/cadastro — cria a conta (tipo: 'pai' ou 'motorista'). */
router.post("/cadastro", async (req, res) => {
  const { nome, email, senha, tipo, telefone } = req.body ?? {};

  if (!nome || !email || !senha || !["pai", "motorista"].includes(tipo)) {
    return res.status(400).json({ erro: "Informe nome, email, senha e tipo (pai ou motorista)" });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres" });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const resultado = await query(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, telefone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, tipo`,
      [nome, email.toLowerCase(), senhaHash, tipo, telefone ?? null]
    );
    const usuario = resultado.rows[0];
    res.status(201).json({ token: gerarToken(usuario), usuario });
  } catch (erro: any) {
    if (erro.code === "23505") {
      return res.status(409).json({ erro: "Este email já está cadastrado" });
    }
    console.error(erro);
    res.status(500).json({ erro: "Erro interno ao cadastrar" });
  }
});

/** POST /api/auth/login — autentica e devolve o token JWT. */
router.post("/login", async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe email e senha" });
  }

  const resultado = await query(
    "SELECT id, nome, tipo, senha_hash FROM usuarios WHERE email = $1",
    [String(email).toLowerCase()]
  );
  const usuario = resultado.rows[0];

  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: "Email ou senha incorretos" });
  }

  const dados = { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
  res.json({ token: gerarToken(dados), usuario: dados });
});

export default router;
