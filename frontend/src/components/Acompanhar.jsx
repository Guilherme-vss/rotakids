import { useEffect, useState } from "react";
import { api } from "../api.js";
import MapaVan from "./MapaVan.jsx";

/**
 * A tela que o pai abre 10 vezes por dia.
 *
 * Decisão de produto: a PRIMEIRA coisa é uma frase em português — "Ana está na
 * van, a caminho da escola" — não um mapa. O pai quer saber se está tudo bem em
 * 1 segundo; o mapa é para quem quer o detalhe. Informação primeiro, enfeite depois.
 *
 * A linha do tempo vem do log de eventos do servidor (append-only): é o registro
 * do que aconteceu com a criança, com hora — o que transforma "confio" em "eu vi".
 */

const ICONES = {
  ida_iniciada: "🚐",
  embarcou: "🔵",
  chegou_escola: "🏫",
  chamada_presente: "📋",
  chamada_ausente: "🚶",
  volta_iniciada: "🏠",
  entregue_em_casa: "✅",
  encerrado: "🌙",
};

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Acompanhar({ aluno, aoVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      setDados(await api(`/alunos/${aluno.id}/acompanhar`));
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    carregar();
    // O pai deixa a tela aberta: atualiza sozinho, sem ele precisar puxar.
    const timer = setInterval(carregar, 15000);
    return () => clearInterval(timer);
  }, [aluno.id]);

  if (erro) return <section className="card"><p className="msg erro">{erro}</p></section>;
  if (!dados) return <section className="card"><em>Carregando...</em></section>;

  if (!dados.emTrajeto) {
    return (
      <section className="card centro">
        <button className="mini suave" onClick={aoVoltar}>← Voltar</button>
        <h2 style={{ marginTop: "1rem" }}>{aluno.avatar} {aluno.nome}</h2>
        <p className="subtitulo">{dados.mensagem}</p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <button className="mini suave" onClick={aoVoltar}>← Meus filhos</button>

        {/* A resposta, em uma frase. */}
        <div className="situacao" style={{ borderLeftColor: dados.cor }}>
          <span className="situacao__avatar">{aluno.avatar}</span>
          <div>
            <strong style={{ color: dados.cor }}>{dados.statusRotulo}</strong>
            <p className="subtitulo">
              {dados.status === "na_van" && "A van está levando seu filho para a escola."}
              {dados.status === "na_escola" && "Chegou em segurança. Bom dia de aula!"}
              {dados.status === "voltando" && "Está voltando para casa agora."}
              {dados.status === "em_casa" && `Entregue em casa às ${hora(dados.entregueEm)}.`}
              {dados.status === "vai" && "A van ainda vai passar para buscar."}
              {dados.status === "falta" && "Marcado como falta hoje."}
              {dados.status === "volta_ausente" && "Não volta de van hoje."}
            </p>
          </div>
        </div>

        {/* Quem está com meu filho agora — o dado que acalma. */}
        <div className="motorista-cartao">
          <span>🚐</span>
          <div>
            <strong>{dados.motorista.nome}</strong>
            <p className="subtitulo">
              {dados.motorista.modelo} · placa {dados.motorista.placa}
            </p>
          </div>
          <a className="btn-ligar" href={`tel:${dados.motorista.celular}`}>📞 Ligar</a>
        </div>
      </section>

      {/* Linha do tempo: a prova, com hora. */}
      <section className="card">
        <h2>🕐 O dia de hoje</h2>
        {dados.linhaDoTempo.length === 0 && <em className="subtitulo">Nada registrado ainda.</em>}
        <ul className="timeline">
          {dados.linhaDoTempo.map((evento, i) => (
            <li key={i}>
              <span className="timeline__icone">{ICONES[evento.tipo] ?? "•"}</span>
              <div>
                <strong>{evento.detalhe ?? evento.tipo}</strong>
                <small>{hora(evento.ocorrido_em)}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* O mapa: para quem quer o detalhe. */}
      <section className="card">
        <h2>🗺️ Onde está a van</h2>
        <div className="mapa-moldura">
          <MapaVan
            alunos={[{ alunoId: aluno.id, nome: aluno.nome, avatar: aluno.avatar,
                       lat: dados.van?.lat, lng: dados.van?.lng,
                       cor: dados.cor, statusRotulo: dados.statusRotulo }]}
            escola={dados.escola}
            posicaoVan={dados.van}
            foco={dados.van ? [dados.van.lat, dados.van.lng] : null}
          />
        </div>
        {dados.van?.em && (
          <small className="subtitulo">
            Posição de {hora(dados.van.em)} · a tela atualiza sozinha
          </small>
        )}
      </section>
    </>
  );
}
