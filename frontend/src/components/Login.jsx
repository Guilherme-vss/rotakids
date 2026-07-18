import { useState } from "react";
import { api, salvarSessao, validarCadastro } from "../api.js";
import { usarMotorLocal } from "../motor-local.js";
import CadastroMotorista from "./CadastroMotorista.jsx";
import Campo from "./Campo.jsx";

/**
 * Entrada do RotaKids.
 *
 * O motorista tem um cadastro longo (CPF, CNH, veículo) e o pai tem um curto.
 * Misturar os dois num formulário só faria o pai ver campos de CNH — então a
 * primeira pergunta é "quem é você", e o resto se adapta.
 */
export default function Login({ aoEntrar }) {
  const [tela, setTela] = useState("entrar"); // entrar | escolher | criar-pai | criar-motorista
  const [form, setForm] = useState({
    nome: "", email: "", senha: "", cpf: "", nascimento: "", celular: "", tipo: "pai",
  });
  const [erros, setErros] = useState({});
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  const mudar = (nome, valor) => {
    setForm((f) => ({ ...f, [nome]: valor }));
    setErros((e) => ({ ...e, [nome]: undefined }));
  };

  async function entrar(e) {
    e.preventDefault();
    setMsg("");
    setCarregando(true);
    try {
      const dados = await api("/auth/login", {
        metodo: "POST",
        corpo: { email: form.email, senha: form.senha },
      });
      salvarSessao(dados);
      aoEntrar(dados);
    } catch (erro) {
      setMsg(erro.message);
    } finally {
      setCarregando(false);
    }
  }

  async function criarContaPai(e) {
    e.preventDefault();
    setMsg("");
    const erro = validarCadastro(form);
    if (erro) return setMsg(erro);

    setCarregando(true);
    try {
      const dados = await api("/auth/cadastro", {
        metodo: "POST",
        corpo: { ...form, tipo: "pai" },
      });
      salvarSessao(dados);
      aoEntrar(dados);
    } catch (falha) {
      if (falha.erros) setErros(falha.erros);
      setMsg(falha.message);
    } finally {
      setCarregando(false);
    }
  }

  if (tela === "criar-motorista") {
    return (
      <div className="login-palco">
        <div className="login-caixa larga">
          <Marca />
          <CadastroMotorista aoEntrar={aoEntrar} aoVoltar={() => setTela("escolher")} />
        </div>
      </div>
    );
  }

  return (
    <div className="login-palco">
      <div className="login-caixa">
        <Marca />

        {tela === "entrar" && (
          <form className="card" onSubmit={entrar}>
            <h3>Entrar</h3>
            <Campo rotulo="Email" nome="email" tipo="email" valor={form.email} aoMudar={mudar}
                   placeholder="voce@email.com" />
            <Campo rotulo="Senha" nome="senha" tipo="password" valor={form.senha} aoMudar={mudar}
                   placeholder="sua senha" />
            <button disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</button>
            <p className="msg erro">{msg}</p>
            <p className="rodape-login">
              Ainda não tem conta?{" "}
              <button type="button" className="link" onClick={() => setTela("escolher")}>
                Criar agora
              </button>
            </p>
          </form>
        )}

        {tela === "escolher" && (
          <div className="card">
            <h3>Quem é você?</h3>
            <p className="subtitulo">Cada perfil tem um cadastro diferente.</p>

            <button className="escolha" onClick={() => setTela("criar-pai")}>
              <span className="escolha__icone">👨‍👩‍👧</span>
              <span>
                <strong>Sou responsável</strong>
                <small>Quero cadastrar meu filho e acompanhar a van</small>
              </span>
            </button>

            <button className="escolha" onClick={() => setTela("criar-motorista")}>
              <span className="escolha__icone">🚐</span>
              <span>
                <strong>Sou motorista</strong>
                <small>Tenho van escolar — precisamos da sua CNH e do veículo</small>
              </span>
            </button>

            <button type="button" className="link" onClick={() => setTela("entrar")}>
              ← Já tenho conta
            </button>
          </div>
        )}

        {tela === "criar-pai" && (
          <form className="card" onSubmit={criarContaPai}>
            <h3>👨‍👩‍👧 Criar conta de responsável</h3>
            <Campo rotulo="Nome completo" nome="nome" valor={form.nome} aoMudar={mudar}
                   erro={erros.nome} placeholder="Carla Lima" />
            <div className="duas-colunas">
              <Campo rotulo="CPF" nome="cpf" valor={form.cpf} aoMudar={mudar} erro={erros.cpf}
                     placeholder="000.000.000-00" />
              <Campo rotulo="Nascimento" nome="nascimento" tipo="date" valor={form.nascimento}
                     aoMudar={mudar} erro={erros.nascimento} />
            </div>
            <Campo rotulo="Celular" nome="celular" valor={form.celular} aoMudar={mudar}
                   erro={erros.celular} placeholder="(11) 97777-2222" />
            <Campo rotulo="Email" nome="email" tipo="email" valor={form.email} aoMudar={mudar}
                   erro={erros.email} placeholder="voce@email.com" />
            <Campo rotulo="Senha" nome="senha" tipo="password" valor={form.senha} aoMudar={mudar}
                   erro={erros.senha} placeholder="mínimo 6 caracteres" />
            <div className="acoes">
              <button type="button" className="suave" onClick={() => setTela("escolher")}>← Voltar</button>
              <button disabled={carregando}>{carregando ? "Criando..." : "Criar conta"}</button>
            </div>
            <p className="msg erro">{msg}</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Marca() {
  return (
    <div className="login-logo">
      <img src="icone.svg" alt="Logo do RotaKids" />
      <h1>RotaKids</h1>
      <p>Sua van escolar, organizada.</p>
      {usarMotorLocal() && (
        <p className="acesso-livre">
          🔓 Versão web: entre com qualquer email e senha para explorar
        </p>
      )}
    </div>
  );
}
