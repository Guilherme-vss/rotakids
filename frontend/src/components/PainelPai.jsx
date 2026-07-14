import { useEffect, useState } from "react";
import { api } from "../api.js";

/**
 * Painel do responsável: cadastrar filhos, marcar presença/falta do dia
 * e aceitar solicitações de motoristas.
 */
export default function PainelPai() {
  const [filhos, setFilhos] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [form, setForm] = useState({
    nome: "", casaEndereco: "", escolaNome: "", escolaEndereco: "",
    problemaSaude: "", contatoEmergencia: "",
  });
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    const [listaFilhos, listaPendentes] = await Promise.all([
      api("/alunos"),
      api("/vinculos/pendentes"),
    ]);
    setFilhos(listaFilhos);
    setPendentes(listaPendentes);
  }

  useEffect(() => { recarregar().catch(() => {}); }, []);

  function campo(nome, placeholder) {
    return {
      placeholder,
      value: form[nome],
      onChange: (e) => setForm({ ...form, [nome]: e.target.value }),
    };
  }

  async function cadastrarFilho(e) {
    e.preventDefault();
    setSalvando(true);
    setMsg("");
    try {
      const r = await api("/alunos", { metodo: "POST", corpo: form });
      setMsg(r.aviso || "Aluno cadastrado! ✅");
      setForm({ nome: "", casaEndereco: "", escolaNome: "", escolaEndereco: "", problemaSaude: "", contatoEmergencia: "" });
      recarregar();
    } catch (erro) {
      setMsg(erro.message);
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPresenca(id, vai) {
    let justificativa;
    if (!vai) {
      justificativa = window.prompt("Qual o motivo da falta? (o motorista verá essa justificativa)");
      if (!justificativa) return;
    }
    await api(`/alunos/${id}/presenca`, { metodo: "POST", corpo: { vai, justificativa } });
    recarregar();
  }

  async function aceitarVinculo(id) {
    await api(`/vinculos/${id}/aceitar`, { metodo: "POST" });
    recarregar();
  }

  return (
    <>
      <div className="duas-colunas">
        <section className="card">
          <h2>👧 Cadastrar filho(a)</h2>
          <form onSubmit={cadastrarFilho}>
            <label>Nome do aluno</label>
            <input {...campo("nome", "João da Silva")} />
            <label>Endereço da casa</label>
            <input {...campo("casaEndereco", "Rua, número, cidade")} />
            <label>Nome da escola</label>
            <input {...campo("escolaNome", "E.E. Dom Pedro II")} />
            <label>Endereço da escola</label>
            <input {...campo("escolaEndereco", "Rua, número, cidade")} />
            <label>Problema de saúde (opcional)</label>
            <input {...campo("problemaSaude", "alergias, condições...")} />
            <label>Contato de emergência (opcional)</label>
            <input {...campo("contatoEmergencia", "nome e telefone de um parente")} />
            <button disabled={salvando}>{salvando ? "Salvando..." : "Cadastrar"}</button>
            <p className="msg">{msg}</p>
          </form>
        </section>

        <section className="card">
          <h2>📅 Presença de hoje</h2>
          <p className="subtitulo">
            Se seu filho não for à escola hoje, marque a falta com o motivo —
            o motorista verá um ponto vermelho no mapa.
          </p>
          {filhos.length === 0 && <em>Nenhum filho cadastrado ainda.</em>}
          {filhos.map((filho) => (
            <div className="item" key={filho.id}>
              <span>
                <strong>{filho.nome}</strong>
                <br />
                <small>{filho.escola_nome}</small>
              </span>
              <span className={`selo ${filho.vai_hoje ? "verde" : "vermelho"}`}>
                {filho.vai_hoje ? "VAI HOJE" : "FALTA"}
              </span>
              <span>
                <button className="mini" onClick={() => marcarPresenca(filho.id, true)}>Vai ✅</button>{" "}
                <button className="mini perigo" onClick={() => marcarPresenca(filho.id, false)}>Falta ❌</button>
              </span>
            </div>
          ))}
        </section>
      </div>

      <section className="card">
        <h2>🤝 Solicitações de motoristas</h2>
        {pendentes.length === 0 && <em>Nenhuma solicitação pendente.</em>}
        {pendentes.map((p) => (
          <div className="item" key={p.id}>
            <span>
              🚐 <strong>{p.motorista}</strong> quer transportar <strong>{p.aluno}</strong>
              {p.telefone && <small> — tel: {p.telefone}</small>}
            </span>
            <button className="mini" onClick={() => aceitarVinculo(p.id)}>Aceitar 🤝</button>
          </div>
        ))}
      </section>
    </>
  );
}
