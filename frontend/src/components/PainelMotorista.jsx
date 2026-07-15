import { useEffect, useState } from "react";
import { api, montarUrlMelhorRota } from "../api.js";
import { usarMotorLocal } from "../demo.js";
import MapaVan from "./MapaVan.jsx";

/**
 * Painel do motorista: vincular alunos, ver o mapa do dia
 * (pontos verdes/vermelhos) e calcular a melhor rota.
 */
export default function PainelMotorista() {
  const [alunos, setAlunos] = useState([]);
  const [rota, setRota] = useState(null);
  const [vinculo, setVinculo] = useState({ emailPai: "", nomeAluno: "" });
  const [msgVinculo, setMsgVinculo] = useState("");
  const [msgRota, setMsgRota] = useState("");
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    api("/rota/alunos").then(setAlunos).catch(() => {});
  }, []);

  async function solicitarVinculo(e) {
    e.preventDefault();
    setMsgVinculo("");
    try {
      const r = await api("/vinculos", { metodo: "POST", corpo: vinculo });
      setMsgVinculo(r.mensagem);
      setVinculo({ emailPai: "", nomeAluno: "" });
    } catch (erro) {
      setMsgVinculo(erro.message);
    }
  }

  async function aplicarRota(lat, lng) {
    try {
      const r = await api(montarUrlMelhorRota(lat, lng).replace("/api", ""));
      setRota({ ...r, origem: [lat, lng] });
      setMsgRota(
        r.paradas.length === 0
          ? r.mensagem || "Nenhum aluno confirmado para hoje 🎉"
          : r.tracado
            ? `Rota de ${r.tracado.distanciaKm} km, cerca de ${r.tracado.duracaoMin} min. Boa viagem! 🚐`
            : `Ordem calculada (~${r.distanciaEstimadaKm} km em linha reta).`
      );
    } catch (erro) {
      setMsgRota(erro.message);
    } finally {
      setCalculando(false);
    }
  }

  function calcularRota() {
    setCalculando(true);

    // Na versão web não pedimos GPS: partimos da garagem da van
    if (usarMotorLocal()) {
      setMsgRota("Calculando a partir da garagem da van...");
      aplicarRota(-23.558, -46.66);
      return;
    }

    setMsgRota("Pegando sua localização...");
    navigator.geolocation.getCurrentPosition(
      (pos) => aplicarRota(pos.coords.latitude, pos.coords.longitude),
      () => {
        setMsgRota("Não consegui sua localização — libere o GPS no navegador.");
        setCalculando(false);
      }
    );
  }

  const confirmados = alunos.filter((a) => a.vai_hoje);
  const faltas = alunos.filter((a) => !a.vai_hoje);

  return (
    <>
      <section className="card">
        <h2>🌞 Resumo de hoje</h2>
        <div className="resumo-dia">
          <div className="resumo-chip verde-fundo">
            <strong>{confirmados.length}</strong>
            <span>vão à escola 🟢</span>
          </div>
          <div className="resumo-chip vermelho-fundo">
            <strong>{faltas.length}</strong>
            <span>faltam hoje 🔴</span>
          </div>
          <div className="resumo-chip azul-fundo">
            <strong>{alunos.length}</strong>
            <span>crianças na van 🚐</span>
          </div>
        </div>
        <div className="criancas-fila">
          {alunos.map((aluno) => (
            <span
              key={aluno.id}
              className={`crianca ${aluno.vai_hoje ? "vai" : "falta"}`}
              title={aluno.vai_hoje ? `${aluno.nome} vai hoje` : `${aluno.nome}: ${aluno.justificativa || "falta"}`}
            >
              <em>{aluno.avatar || "🧒"}</em>
              {aluno.nome.split(" ")[0]}
            </span>
          ))}
          {alunos.length === 0 && <em className="subtitulo">Vincule seus primeiros alunos abaixo. 👇</em>}
        </div>
      </section>

      <section className="card">
        <h2>➕ Vincular aluno</h2>
        <p className="subtitulo">
          Peça o vínculo pelo email do responsável. O endereço da casa só aparece
          depois que a família aceitar — privacidade em primeiro lugar.
        </p>
        <form onSubmit={solicitarVinculo} className="duas-colunas">
          <div>
            <label>Email do responsável</label>
            <input
              value={vinculo.emailPai}
              onChange={(e) => setVinculo({ ...vinculo, emailPai: e.target.value })}
              placeholder="mae@email.com"
            />
          </div>
          <div>
            <label>Nome do aluno</label>
            <input
              value={vinculo.nomeAluno}
              onChange={(e) => setVinculo({ ...vinculo, nomeAluno: e.target.value })}
              placeholder="João da Silva"
            />
          </div>
          <div>
            <button>Solicitar vínculo</button>
          </div>
        </form>
        <p className="msg">{msgVinculo}</p>
      </section>

      <section className="card">
        <h2>🗺️ Mapa do dia</h2>
        <div className="legenda">
          <span className="verde">vai à escola</span>
          <span className="vermelho">falta (clique no ponto para ver o motivo)</span>
        </div>

        <button onClick={calcularRota} disabled={calculando}>
          {calculando ? "Calculando..." : "📍 Calcular melhor rota a partir da minha posição"}
        </button>
        <p className="msg">{msgRota}</p>

        <div className="mapa-moldura">
          <MapaVan alunos={alunos} rota={rota} />
        </div>

        {rota?.paradas?.length > 0 && (
          <ol className="ordem-lista">
            {rota.paradas.map((parada) => (
              <li key={parada.alunoId}>
                <strong>{parada.ordem}º</strong> — {parada.nome}
              </li>
            ))}
            {rota.escola && <li>🏫 Destino final: {rota.escola.nome}</li>}
          </ol>
        )}
      </section>
    </>
  );
}
