import { useEffect, useState } from "react";
import { api } from "../api.js";
import { validarCadastroAluno } from "../../../src/domain/validacoes";
import Campo from "./Campo.jsx";
import Acompanhar from "./Acompanhar.jsx";

/**
 * Painel do responsável.
 *
 * Ordem proposital: primeiro "onde meu filho está" (o que ele abre o app para
 * ver), depois presença, e só então o cadastro. Formulário é o que ele faz uma
 * vez; acompanhar é o que ele faz todo dia.
 */

const AVATARES = ["🧒", "👧", "🦄", "🦖", "🚀", "⚽", "🐱", "🐶", "🦁", "🌸", "🎮", "🎨"];

export default function PainelPai() {
  const [filhos, setFilhos] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [acompanhando, setAcompanhando] = useState(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [form, setForm] = useState(formVazio());
  const [erros, setErros] = useState({});
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  function formVazio() {
    return {
      nome: "", avatar: "🧒", nascimento: "",
      casaEndereco: "", escolaNome: "", escolaEndereco: "",
      responsavelNome: "", responsavelCelular: "",
      emergenciaNome: "", emergenciaCelular: "",
      problemaSaude: "", autorizadoDescerSozinho: false,
    };
  }

  async function recarregar() {
    const [lista, solicitacoes] = await Promise.all([
      api("/alunos"),
      api("/vinculos/pendentes").catch(() => []),
    ]);
    setFilhos(lista);
    setPendentes(solicitacoes);
  }

  useEffect(() => { recarregar().catch(() => {}); }, []);

  const mudar = (nome, valor) => {
    setForm((f) => ({ ...f, [nome]: valor }));
    setErros((e) => ({ ...e, [nome]: undefined }));
  };

  async function cadastrar(e) {
    e.preventDefault();
    setMsg("");

    // Mesma validação do servidor: avisa antes de enviar.
    const problemas = validarCadastroAluno(form);
    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      setMsg("Confira os campos destacados.");
      return;
    }

    setSalvando(true);
    try {
      const r = await api("/alunos", { metodo: "POST", corpo: form });
      setMsg(r.aviso || "Filho cadastrado! ✅");
      setForm(formVazio());
      setCadastrando(false);
      recarregar();
    } catch (erro) {
      if (erro.erros) setErros(erro.erros);
      setMsg(erro.message);
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPresenca(filho, vai) {
    let justificativa;
    if (!vai) {
      justificativa = window.prompt(
        `Por que ${filho.nome.split(" ")[0]} não vai hoje?\n\nO motorista vê esse motivo e não passa na sua casa à toa.`
      );
      if (!justificativa) return;
    }
    try {
      await api(`/alunos/${filho.id}/presenca`, { metodo: "POST", corpo: { vai, justificativa } });
      recarregar();
    } catch (erro) {
      setMsg(erro.message); // ex.: "A van já saiu — fale com o motorista"
    }
  }

  if (acompanhando) {
    return <Acompanhar aluno={acompanhando} aoVoltar={() => setAcompanhando(null)} />;
  }

  return (
    <>
      {/* ---- Meus filhos: o que ele abre para ver ---- */}
      <section className="card">
        <h2>👨‍👩‍👧 Meus filhos</h2>
        {filhos.length === 0 && !cadastrando && (
          <p className="subtitulo">Cadastre seu primeiro filho para começar. 👇</p>
        )}

        {filhos.map((filho) => (
          <div className="filho-cartao" key={filho.id}>
            <span className="filho-avatar">{filho.avatar || "🧒"}</span>
            <div className="filho-info">
              <strong>{filho.nome}</strong>
              <small className="subtitulo">{filho.escola_nome}</small>
              {filho.problema_saude && (
                <small className="alerta-saude">🏥 {filho.problema_saude}</small>
              )}
            </div>
            <span className={`selo ${filho.vai_hoje ? "verde" : "vermelho"}`}>
              {filho.vai_hoje ? "VAI HOJE" : "FALTA"}
            </span>
            <div className="filho-acoes">
              <button className="mini" onClick={() => setAcompanhando(filho)}>
                📍 Acompanhar
              </button>
              {filho.vai_hoje ? (
                <button className="mini perigo" onClick={() => marcarPresenca(filho, false)}>
                  Avisar falta
                </button>
              ) : (
                <button className="mini verde" onClick={() => marcarPresenca(filho, true)}>
                  Vai hoje
                </button>
              )}
            </div>
          </div>
        ))}
        <p className="msg">{msg}</p>

        {!cadastrando && (
          <button onClick={() => setCadastrando(true)}>➕ Cadastrar filho</button>
        )}
      </section>

      {/* ---- Solicitações de motoristas ---- */}
      {pendentes.length > 0 && (
        <section className="card">
          <h2>🤝 Um motorista quer transportar seu filho</h2>
          <p className="subtitulo">
            O endereço da sua casa só é liberado depois que você aceitar.
            Confira os dados antes de decidir:
          </p>
          {pendentes.map((p) => (
            <div className="vinculo-cartao" key={p.id}>
              <div>
                <strong>🚐 {p.motorista}</strong> quer levar <strong>{p.aluno}</strong>
                <small className="subtitulo">
                  {p.modelo && `${p.modelo} ${p.ano} · placa ${p.placa} · ${p.lugares} lugares`}
                  {p.cnh_categoria && ` · CNH ${p.cnh_categoria}`}
                  {p.telefone && ` · ${p.telefone}`}
                </small>
              </div>
              <button
                className="mini"
                onClick={async () => { await api(`/vinculos/${p.id}/aceitar`, { metodo: "POST" }); recarregar(); }}
              >
                Aceitar 🤝
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ---- Cadastro completo ---- */}
      {cadastrando && (
        <form className="card cadastro" onSubmit={cadastrar}>
          <h2>👧 Cadastrar filho</h2>

          <h3>Sobre a criança</h3>
          <Campo rotulo="Nome completo" nome="nome" valor={form.nome} aoMudar={mudar}
                 erro={erros.nome} placeholder="Ana Lima" />
          <div className="duas-colunas">
            <Campo rotulo="Data de nascimento" nome="nascimento" tipo="date" valor={form.nascimento}
                   aoMudar={mudar} erro={erros.nascimento} dica="Atendemos de 1 a 17 anos" />
            <div className="campo">
              <label>Avatar (deixe a criança escolher! 🎉)</label>
              <div className="avatares">
                {AVATARES.map((emoji) => (
                  <button type="button" key={emoji}
                          className={`avatar-opcao ${form.avatar === emoji ? "escolhido" : ""}`}
                          onClick={() => mudar("avatar", emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Campo rotulo="Problema de saúde (opcional)" nome="problemaSaude" valor={form.problemaSaude}
                 aoMudar={mudar} placeholder="Alergia a amendoim, asma..."
                 dica="O motorista vê isso — pode salvar uma vida" />

          <h3>Endereços</h3>
          <Campo rotulo="Endereço de casa" nome="casaEndereco" valor={form.casaEndereco} aoMudar={mudar}
                 erro={erros.casaEndereco} placeholder="Rua, número, cidade" />
          <div className="duas-colunas">
            <Campo rotulo="Escola" nome="escolaNome" valor={form.escolaNome} aoMudar={mudar}
                   erro={erros.escolaNome} placeholder="E.E. Dom Pedro II" />
            <Campo rotulo="Endereço da escola" nome="escolaEndereco" valor={form.escolaEndereco}
                   aoMudar={mudar} erro={erros.escolaEndereco} placeholder="Rua, número, cidade" />
          </div>

          <h3>Contatos</h3>
          <p className="subtitulo">
            Pedimos <strong>dois</strong> contatos de propósito: se você não atender,
            alguém precisa atender. Por isso o de emergência tem que ser diferente.
          </p>
          <div className="duas-colunas">
            <Campo rotulo="Responsável" nome="responsavelNome" valor={form.responsavelNome}
                   aoMudar={mudar} erro={erros.responsavelNome} placeholder="Carla Lima" />
            <Campo rotulo="Celular do responsável" nome="responsavelCelular" valor={form.responsavelCelular}
                   aoMudar={mudar} erro={erros.responsavelCelular} placeholder="(11) 97777-2222" />
          </div>
          <div className="duas-colunas">
            <Campo rotulo="Contato de emergência" nome="emergenciaNome" valor={form.emergenciaNome}
                   aoMudar={mudar} erro={erros.emergenciaNome} placeholder="Avó, tia, vizinho..." />
            <Campo rotulo="Celular de emergência" nome="emergenciaCelular" valor={form.emergenciaCelular}
                   aoMudar={mudar} erro={erros.emergenciaCelular} placeholder="(11) 98888-1111" />
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={form.autorizadoDescerSozinho}
                   onChange={(e) => mudar("autorizadoDescerSozinho", e.target.checked)} />
            Autorizo meu filho a descer sozinho em casa
            <small className="subtitulo">Se desmarcado, o motorista só entrega para um adulto</small>
          </label>

          <div className="acoes">
            <button type="button" className="suave" onClick={() => { setCadastrando(false); setErros({}); }}>
              Cancelar
            </button>
            <button disabled={salvando}>{salvando ? "Salvando..." : "Cadastrar"}</button>
          </div>
          <p className="msg erro">{msg}</p>
        </form>
      )}
    </>
  );
}
