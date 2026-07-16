import { useEffect, useState } from "react";
import { api, buscarRotasDeCarro } from "../api.js";
import { usarMotorLocal } from "../demo.js";
import MapaVan from "./MapaVan.jsx";

/**
 * Painel do motorista — o dia completo do tio da van:
 * 1. Vê o resumo (quem vai 🟢, quem falta 🔴)
 * 2. Calcula a rota → recebe OPÇÕES de caminho pelas ruas (OSRM) com o
 *    tempo de cada uma, e escolhe a que preferir
 * 3. ▶️ Inicia o trajeto: a cada parada marca "peguei" e o ponto da
 *    criança fica azul 🔵 no mapa, até chegar na escola 🏫
 */
export default function PainelMotorista() {
  const [alunos, setAlunos] = useState([]);
  const [rota, setRota] = useState(null);          // ordem de coleta + escola
  const [alternativas, setAlternativas] = useState([]);
  const [escolhida, setEscolhida] = useState(0);   // índice da alternativa escolhida
  const [emTrajeto, setEmTrajeto] = useState(false);
  const [pegos, setPegos] = useState([]);          // ids já embarcados
  const [vinculo, setVinculo] = useState({ emailPai: "", nomeAluno: "" });
  const [msgVinculo, setMsgVinculo] = useState("");
  const [msgRota, setMsgRota] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [concluido, setConcluido] = useState(false);

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

  /** Passo 1: ordem de coleta + rotas de carro alternativas. */
  async function aplicarRota(lat, lng) {
    try {
      const r = await api(`/rota/melhor?lat=${lat}&lng=${lng}`);
      const novaRota = { ...r, origem: [lat, lng] };
      setRota(novaRota);
      setPegos([]);
      setEmTrajeto(false);
      setConcluido(false);

      if (r.paradas.length === 0) {
        setAlternativas([]);
        setMsgRota(r.mensagem || "Nenhum aluno confirmado para hoje 🎉");
        return;
      }

      // Rotas PELAS RUAS, com alternativas, direto do OSRM (OpenStreetMap)
      setMsgRota("Traçando os caminhos pelas ruas...");
      const pontos = [
        [lat, lng],
        ...r.paradas.map((p) => [p.lat, p.lng]),
        ...(r.escola ? [[r.escola.lat, r.escola.lng]] : []),
      ];
      const opcoes = await buscarRotasDeCarro(pontos);
      setAlternativas(opcoes);
      setEscolhida(0);
      setMsgRota(
        opcoes.length > 1
          ? `Encontrei ${opcoes.length} caminhos — escolha o seu e inicie o trajeto! 👇`
          : opcoes.length === 1
            ? "Caminho traçado pelas ruas — pode iniciar o trajeto! 👇"
            : "O serviço de mapas está fora do ar — seguindo com a linha guia."
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

  /** Passo 2: o trajeto em si. */
  const proximaParada = rota?.paradas?.find((p) => !pegos.includes(p.alunoId)) ?? null;
  const totalParadas = rota?.paradas?.length ?? 0;

  function iniciarTrajeto() {
    setEmTrajeto(true);
    setConcluido(false);
    setMsgRota("");
  }

  function marcarPego(parada) {
    setPegos((atuais) => [...atuais, parada.alunoId]);
  }

  function finalizarTrajeto() {
    setConcluido(true);
    setEmTrajeto(false);
  }

  function cancelarTrajeto() {
    setEmTrajeto(false);
    setPegos([]);
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
            <strong>{pegos.length}</strong>
            <span>já na van 🔵</span>
          </div>
        </div>
        <div className="criancas-fila">
          {alunos.map((aluno) => (
            <span
              key={aluno.id}
              className={`crianca ${pegos.includes(aluno.id) ? "navan" : aluno.vai_hoje ? "vai" : "falta"}`}
              title={
                pegos.includes(aluno.id)
                  ? `${aluno.nome} já está na van`
                  : aluno.vai_hoje
                    ? `${aluno.nome} vai hoje`
                    : `${aluno.nome}: ${aluno.justificativa || "falta"}`
              }
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
        <h2>🗺️ Rota do dia</h2>
        <div className="legenda">
          <span className="verde">vai à escola</span>
          <span className="vermelho">falta (clique no ponto para ver o motivo)</span>
          <span className="azul">já na van</span>
        </div>

        {!emTrajeto && (
          <button onClick={calcularRota} disabled={calculando}>
            {calculando ? "Calculando..." : "📍 Calcular rota a partir da minha posição"}
          </button>
        )}
        <p className="msg">{msgRota}</p>

        {/* Opções de caminho: o tio olha o tempo e escolhe */}
        {!emTrajeto && alternativas.length > 0 && (
          <div className="alternativas">
            {alternativas.map((opcao, i) => (
              <button
                key={opcao.indice}
                className={`alternativa ${escolhida === i ? "escolhida" : ""}`}
                onClick={() => setEscolhida(i)}
              >
                <strong>{i === 0 ? "⚡ Mais rápida" : `Opção ${i + 1}`}</strong>
                <span>🕐 {opcao.duracaoTexto} · 🛣️ {opcao.distanciaKm} km</span>
              </button>
            ))}
          </div>
        )}

        {!emTrajeto && rota?.paradas?.length > 0 && !concluido && (
          <button className="iniciar" onClick={iniciarTrajeto}>
            ▶️ Iniciar trajeto ({totalParadas} paradas + escola)
          </button>
        )}

        {/* Painel do trajeto em andamento */}
        {emTrajeto && (
          <div className="trajeto-caixa">
            {proximaParada ? (
              <>
                <div className="trajeto-proxima">
                  <span className="trajeto-avatar">{proximaParada.avatar || "🧒"}</span>
                  <div>
                    <small>
                      Parada {pegos.length + 1} de {totalParadas}
                    </small>
                    <strong>Buscar: {proximaParada.nome}</strong>
                  </div>
                </div>
                <button className="pegar" onClick={() => marcarPego(proximaParada)}>
                  ✅ Peguei {proximaParada.nome.split(" ")[0]} — próxima parada!
                </button>
              </>
            ) : (
              <>
                <div className="trajeto-proxima">
                  <span className="trajeto-avatar">🏫</span>
                  <div>
                    <small>Todas as crianças na van! 🎉</small>
                    <strong>Destino final: {rota?.escola?.nome || "Escola"}</strong>
                  </div>
                </div>
                <button className="pegar" onClick={finalizarTrajeto}>
                  🏁 Cheguei na escola — finalizar trajeto
                </button>
              </>
            )}
            <button className="mini suave" onClick={cancelarTrajeto}>✖ cancelar trajeto</button>
          </div>
        )}

        {concluido && (
          <div className="trajeto-caixa concluido">
            🎉 <strong>Trajeto concluído!</strong> {pegos.length} criança(s) entregues
            na escola em segurança. Bom trabalho, tio! 🚐
          </div>
        )}

        <div className="mapa-moldura">
          <MapaVan
            alunos={alunos}
            rota={rota}
            pegos={pegos}
            geometria={alternativas[escolhida]?.geometria ?? null}
          />
        </div>

        {rota?.paradas?.length > 0 && (
          <ol className="ordem-lista">
            {rota.paradas.map((parada) => (
              <li key={parada.alunoId} className={pegos.includes(parada.alunoId) ? "feita" : ""}>
                <strong>{parada.ordem}º</strong> — {parada.avatar || "🧒"} {parada.nome}
                {pegos.includes(parada.alunoId) && " ✅"}
              </li>
            ))}
            {rota.escola && <li>🏫 Destino final: {rota.escola.nome}</li>}
          </ol>
        )}
      </section>
    </>
  );
}
