/**
 * auth.ts — middleware de autenticação com JWT.
 * Cada requisição protegida precisa do cabeçalho: Authorization: Bearer <token>
 */
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "troque-esta-chave-em-producao";

export interface UsuarioToken {
  id: number;
  nome: string;
  tipo: "pai" | "motorista";
}

// Estende o Request do Express para carregar o usuário autenticado
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export function gerarToken(usuario: UsuarioToken): string {
  return jwt.sign(usuario, JWT_SECRET, { expiresIn: "7d" });
}

/** Verifica um token cru. Lança se for inválido ou expirado. */
export function verificarToken(token: string): UsuarioToken {
  return jwt.verify(token, JWT_SECRET) as UsuarioToken;
}

export function exigirLogin(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Faça login para continuar" });
  }
  try {
    req.usuario = jwt.verify(cabecalho.slice(7), JWT_SECRET) as UsuarioToken;
    next();
  } catch {
    return res.status(401).json({ erro: "Sessão expirada — faça login novamente" });
  }
}

/** Restringe a rota a um tipo de usuário ('pai' ou 'motorista'). */
export function exigirTipo(tipo: "pai" | "motorista") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.usuario?.tipo !== tipo) {
      return res.status(403).json({ erro: `Apenas perfis do tipo "${tipo}" podem acessar` });
    }
    next();
  };
}
