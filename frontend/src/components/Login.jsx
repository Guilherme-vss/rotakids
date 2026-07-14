import { useState } from "react";
import { api, salvarSessao, validarCadastro } from "../api.js";

/** Tela de entrada: login ou criação de conta (pai ou motorista). */
export default function Login({ aoEntrar }) {
  const [modo, setModo] = useState("entrar"); // "entrar" | "criar"
  const [form, setForm] = useState({ nome: "", email: "", senha: "", tipo: "pai", telefone: "" });
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  function campo(nome) {
    return {
      value: form[nome],
      onChange: (e) => setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function enviar(e) {
    e.preventDefault();
    setMsg("");

    if (modo === "criar") {
      const erro = validarCadastro(form);
      if (erro) return setMsg(erro);
    }

    setCarregando(true);
    try {
      const rota = modo === "criar" ? "/auth/cadastro" : "/auth/login";
      const dados = await api(rota, { metodo: "POST", corpo: form });
      salvarSessao(dados);
      aoEntrar(dados);
    } catch (erro) {
      setMsg(erro.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-palco">
      <div className="login-caixa">
        <div className="login-logo">
          <img src="icone.svg" alt="Logo do RotaKids" />
          <h1>RotaKids</h1>
          <p>Sua van escolar, organizada.</p>
        </div>

        <form className="card" onSubmit={enviar}>
          <div className="abas">
            <button type="button" className={modo === "entrar" ? "ativa" : ""} onClick={() => setModo("entrar")}>
              Entrar
            </button>
            <button type="button" className={modo === "criar" ? "ativa" : ""} onClick={() => setModo("criar")}>
              Criar conta
            </button>
          </div>

          {modo === "criar" && (
            <>
              <label>Seu nome</label>
              <input placeholder="Maria da Silva" {...campo("nome")} />
              <label>Tipo de conta</label>
              <select {...campo("tipo")}>
                <option value="pai">👨‍👩‍👧 Responsável (pai/mãe)</option>
                <option value="motorista">🚐 Motorista (tio da van)</option>
              </select>
              <label>Telefone (opcional)</label>
              <input placeholder="(11) 90000-0000" {...campo("telefone")} />
            </>
          )}

          <label>Email</label>
          <input type="email" placeholder="voce@email.com" {...campo("email")} />
          <label>Senha</label>
          <input type="password" placeholder="mínimo 6 caracteres" {...campo("senha")} />

          <button disabled={carregando}>
            {carregando ? "Aguarde..." : modo === "criar" ? "Criar minha conta" : "Entrar"}
          </button>
          <p className="msg erro">{msg}</p>
        </form>
      </div>
    </div>
  );
}
