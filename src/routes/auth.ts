/**
 * Rotas de autenticação e cadastro completo.
 *
 * A borda é magra de propósito: ela traduz HTTP, chama a validação do domínio
 * (`domain/validacoes.ts`) e persiste. Nenhuma regra de negócio mora aqui.
 */
import bcrypt from "bcryptjs";
import { Router } from "express";
import { pool, query } from "../db";
import { gerarToken } from "../middleware/auth";
import {
  formatarPlaca,
  semErros,
  situacaoCnh,
  validarCadastroMotorista,
  validarCpf,
  validarEmail,
  validarNomeCompleto,
  validarCelular,
  validarNascimentoMotorista,
} from "../domain/validacoes";

const router = Router();

/** Deixa só os dígitos — o banco guarda CPF/celular limpos, a tela formata. */
const digitos = (texto: unknown) => String(texto ?? "").replace(/\D/g, "");

/**
 * POST /api/auth/cadastro
 *
 * Pai:       nome, email, senha, cpf, nascimento, celular
 * Motorista: tudo acima + CNH (número, categoria, validade) + veículo
 *            (placa, modelo, ano, lugares)
 *
 * Devolve TODOS os erros de uma vez em `erros` (campo → mensagem), porque
 * corrigir um erro por vez é tortura para quem está cadastrando.
 */
router.post("/cadastro", async (req, res) => {
  const dados = req.body ?? {};
  const tipo = dados.tipo;

  if (!["pai", "motorista"].includes(tipo)) {
    return res.status(400).json({ erro: "Informe o tipo da conta (pai ou motorista)" });
  }
  if (!dados.senha || String(dados.senha).length < 6) {
    return res.status(400).json({ erros: { senha: "A senha precisa ter pelo menos 6 caracteres" } });
  }

  // ----- Validação (no domínio, não aqui) -----
  let erros: Record<string, string> = {};

  if (tipo === "motorista") {
    erros = validarCadastroMotorista(dados);
  } else {
    const checar = (campo: string, erro: string | null) => {
      if (erro) erros[campo] = erro;
    };
    checar("nome", validarNomeCompleto(dados.nome ?? ""));
    checar("email", validarEmail(dados.email ?? ""));
    checar("cpf", validarCpf(dados.cpf ?? ""));
    checar("celular", validarCelular(dados.celular ?? ""));
    checar("nascimento", validarNascimentoMotorista(dados.nascimento ?? "")); // 21+: pai é adulto
  }

  if (!semErros(erros)) {
    return res.status(400).json({ erros });
  }

  // ----- Persistência (tudo ou nada) -----
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    const usuario = await cliente.query(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, tipo`,
      [
        String(dados.nome).trim(),
        String(dados.email).toLowerCase().trim(),
        senhaHash,
        tipo,
        digitos(dados.cpf),
        dados.nascimento,
        digitos(dados.celular),
      ]
    );
    const criado = usuario.rows[0];

    if (tipo === "motorista") {
      await cliente.query(
        `INSERT INTO motoristas (usuario_id, cnh_numero, cnh_categoria, cnh_validade)
         VALUES ($1, $2, $3, $4)`,
        [
          criado.id,
          digitos(dados.cnh),
          String(dados.cnhCategoria).toUpperCase().trim(),
          dados.cnhValidade,
        ]
      );
      await cliente.query(
        `INSERT INTO veiculos (motorista_id, placa, modelo, ano, lugares)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          criado.id,
          String(dados.veiculoPlaca).replace(/[\s-]/g, "").toUpperCase(),
          String(dados.veiculoModelo).trim(),
          Number(dados.veiculoAno),
          Number(dados.veiculoLugares),
        ]
      );
    }

    await cliente.query("COMMIT");

    // Aviso de CNH vencendo: o produto avisa ANTES de doer.
    const aviso =
      tipo === "motorista" ? situacaoCnh(dados.cnhValidade).aviso : null;

    return res.status(201).json({ token: gerarToken(criado), usuario: criado, aviso });
  } catch (erro: any) {
    await cliente.query("ROLLBACK");

    // Conflitos: falam a língua de quem cadastra, não a do Postgres.
    if (erro.code === "23505") {
      const detalhe = String(erro.detail ?? "");
      if (detalhe.includes("email")) {
        return res.status(409).json({ erros: { email: "Este email já está cadastrado" } });
      }
      if (detalhe.includes("cpf")) {
        return res.status(409).json({ erros: { cpf: "Este CPF já tem uma conta" } });
      }
      if (detalhe.includes("cnh")) {
        return res.status(409).json({ erros: { cnh: "Esta CNH já está cadastrada" } });
      }
      if (detalhe.includes("placa")) {
        return res.status(409).json({ erros: { veiculoPlaca: "Esta placa já está em uso" } });
      }
      return res.status(409).json({ erro: "Já existe um cadastro com esses dados" });
    }
    console.error("[cadastro]", erro);
    return res.status(500).json({ erro: "Erro interno ao cadastrar" });
  } finally {
    cliente.release();
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
    [String(email).toLowerCase().trim()]
  );
  const usuario = resultado.rows[0];

  // Mensagem propositalmente genérica: dizer "esse email não existe" entrega
  // quem tem conta no sistema para quem está tentando adivinhar.
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: "Email ou senha incorretos" });
  }

  const dados = { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
  res.json({ token: gerarToken(dados), usuario: dados });
});

/** GET /api/auth/eu — perfil completo de quem está logado (com veículo e CNH). */
router.get("/eu", async (req, res) => {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Faça login para continuar" });
  }

  try {
    const { verificarToken } = await import("../middleware/auth");
    const usuario = verificarToken(cabecalho.slice(7));

    const base = await query(
      `SELECT id, nome, email, tipo, cpf, nascimento, celular FROM usuarios WHERE id = $1`,
      [usuario.id]
    );
    if (base.rowCount === 0) return res.status(404).json({ erro: "Conta não encontrada" });

    const perfil: Record<string, unknown> = { ...base.rows[0] };

    if (usuario.tipo === "motorista") {
      const extra = await query(
        `SELECT m.cnh_numero, m.cnh_categoria, m.cnh_validade,
                v.placa, v.modelo, v.ano, v.lugares
           FROM motoristas m
           LEFT JOIN veiculos v ON v.motorista_id = m.usuario_id AND v.ativo
          WHERE m.usuario_id = $1`,
        [usuario.id]
      );
      const dados = extra.rows[0];
      if (dados) {
        perfil.cnh = {
          numero: dados.cnh_numero,
          categoria: dados.cnh_categoria,
          validade: dados.cnh_validade,
          ...situacaoCnh(String(dados.cnh_validade).slice(0, 10)),
        };
        perfil.veiculo = dados.placa
          ? {
              placa: formatarPlaca(dados.placa),
              modelo: dados.modelo,
              ano: dados.ano,
              lugares: dados.lugares,
            }
          : null;
      }
    }

    res.json(perfil);
  } catch {
    res.status(401).json({ erro: "Sessão expirada — faça login novamente" });
  }
});

export default router;
