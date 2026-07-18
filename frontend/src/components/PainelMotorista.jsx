import { useEffect, useState } from "react";
import { api, buscarRotasDeCarro } from "../api.js";
import { usarMotorLocal, GARAGEM } from "../motor-local.js";
import MapaVan from "./MapaVan.jsx";

/**
 * Painel do motorista — o dia inteiro numa tela só.
 *
 * O fluxo real do tio da van:
 *   IDA      buscar criança por criança          🟢 → 🔵
 *   CHAMADA  na escola: quem volta de van hoje?
 *   VOLTA    deixar criança por criança          🔴 → 🟢
 *
 * Decisão de usabilidade: o motorista está DIRIGINDO. A tela mostra UMA ação
 * grande por vez (a próxima parada), não uma lista onde ele precisa caçar o
 * nome certo. Tudo que não é "o que eu faço agora" fica secundário.
 */
export default function PainelMotorista() {
  const [estado, setEstado] = useState(null);
  const [alternativas, setAlternativas] = useState([]);
  const [escolhida, setEscolhida] = useState(0);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api("/trajeto/hoje").then(setEstado).catch(() => {});
  }, []);

  /** Toda ação passa por aqui: chama a API, atualiza o estado, traduz o erro. */
  async function acao(caminho, corpo = null, metodo = "POST") {
    setErro("");
    setOcupado(true);
    try {
      const novo = await api(caminho, { metodo, corpo });
      setEstado(novo);
      return novo;
    } catch (e) {
      // Erro de regra (409) é orientação, não falha: "ainda falta buscar o Bruno"
      setErro(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  const posicaoVan = () => (usarMotorLocal() ? GARAGEM : { lat: -23.558, lng: -46.66 });

  /** Traça o caminho pelas ruas para a fase atual (OSRM, com alternativas). */
  async function tracarRota(atual) {
    const alvo = atual ?? estado;
    if (!alvo?.alunos?.length) return;

    const van = posicaoVan();
    const pendentes = alvo.alunos.filter((a) =>
      alvo.fase === "ida" ? a.status === "vai" : a.status === "voltando"
    );
    if (pendentes.length === 0) {
      setAlternativas([]);
      return;
    }

    const pontos = [
      [van.lat, van.lng],
      ...pendentes.map((a) => [a.lat, a.lng]),
      ...(alvo.fase === "ida" ? [[alvo.escola.lat, alvo.escola.lng]] : []),
    ];
    setMsg("Traçando o caminho pelas ruas...");
    const opcoes = await buscarRotasDeCarro(pontos);
    setAlternativas(opcoes);
    setEscolhida(0);
    setMsg(
      opcoes.length > 1
        ? `${opcoes.length} caminhos possíveis — escolha o seu 👇`
        : opcoes.length === 1
          ? "Caminho traçado pelas ruas 👇"
          : "O serviço de mapas está fora do ar — seguindo com a linha guia."
    );
  }

  async function iniciar() {
    const novo = await acao("/trajeto/iniciar");
    if (novo) tracarRota(novo);
  }

  async function embarcar(aluno) {
    const novo = await acao(`/trajeto/embarcar/${aluno.alunoId}`);
    if (novo) tracarRota(novo);
  }

  async function entregar(aluno) {
    const novo = await acao(`/trajeto/entregar/${aluno.alunoId}`);
    if (novo) tracarRota(novo);
  }

  async function chamada(aluno, presente) {
    await acao(`/trajeto/chamada/${aluno.alunoId}`, { presente });
  }

  async function iniciarVolta() {
    const novo = await acao("/trajeto/iniciar-volta");
    if (novo) tracarRota(novo);
  }

  async function reiniciar() {
    await api("/trajeto/reiniciar", { metodo: "POST" }).catch(() => {});
    const novo = await api("/trajeto/hoje");
    setEstado(novo);
    setAlternativas([]);
  }

  /* ---------- Telas por fase ---------- */

  if (!estado) return <section className="card"><em>Carregando o dia...</em></section>;

  if (!estado.iniciado) {
    return (
      <section className="card centro">
        <h2>🌅 Bom dia, tio!</h2>
        <p className="subtitulo">
          Vamos começar? Eu monto a rota com quem confirmou presença hoje e deixo
          quem faltou fora do caminho — você não perde viagem.
        </p>
        <button className="grande" onClick={iniciar} disabled={ocupado}>
          {ocupado ? "Montando..." : "▶️ Iniciar o dia"}
        </button>
        <p className="msg erro">{erro}</p>
      </section>
    );
  }

  const proxima = estado.proximaParada;
  const naVan = estado.alunos.filter((a) => ["na_van", "voltando"].includes(a.status)).length;

  return (
    <>
      {/* ---- Faixa de situação ---- */}
      <section className="card">
        <div className="fase-faixa">
          {[
            { id: "ida", rotulo: "🚐 Buscando" },
            { id: "chamada", rotulo: "📋 Chamada" },
            { id: "volta", rotulo: "🏠 Levando" },
            { id: "encerrado", rotulo: "✅ Fim" },
          ].map((f) => (
            <span key={f.id} className={`fase-item ${estado.fase === f.id ? "atual" : ""}`}>
              {f.rotulo}
            </span>
          ))}
        </div>
        <div className="progresso"><div style={{ width: `${estado.progresso}%` }} /></div>
        <small className="subtitulo">
          {estado.progresso}% da fase · {naVan} criança(s) na van agora
        </small>
      </section>

      {/* ---- A AÇÃO DE AGORA (o que o motorista realmente olha) ---- */}
      {estado.fase === "ida" && proxima && (
        <section className="card acao-agora">
          <small>Próxima parada · {estado.alunos.filter((a) => a.status === "vai").length} restante(s)</small>
          <div className="acao-agora__aluno">
            <span className="acao-agora__avatar">{proxima.avatar}</span>
            <div>
              <strong>{proxima.nome}</strong>
              <p className="subtitulo">Buscar em casa</p>
            </div>
          </div>
          <button className="grande verde" onClick={() => embarcar(proxima)} disabled={ocupado}>
            ✅ Peguei {proxima.nome.split(" ")[0]}
          </button>
        </section>
      )}

      {estado.fase === "ida" && !proxima && (
        <section className="card acao-agora">
          <div className="acao-agora__aluno">
            <span className="acao-agora__avatar">🏫</span>
            <div>
              <strong>Todos a bordo!</strong>
              <p className="subtitulo">Rumo à {estado.escola.nome}</p>
            </div>
          </div>
          <button className="grande" onClick={() => acao("/trajeto/concluir-ida")} disabled={ocupado}>
            🏫 Cheguei na escola
          </button>
        </section>
      )}

      {/* ---- CHAMADA ---- */}
      {estado.fase === "chamada" && (
        <section className="card">
          <h2>📋 Chamada na escola</h2>
          <p className="subtitulo">
            Quem volta de van hoje? Marque criança por criança — se o pai já buscou,
            é só dizer que ela não volta. <strong>Só saímos com a chamada completa.</strong>
          </p>

          {estado.alunos
            .filter((a) => ["na_escola", "voltando", "volta_ausente"].includes(a.status))
            .map((aluno) => (
              <div className="chamada-linha" key={aluno.alunoId}>
                <span className="chamada-aluno">
                  <em>{aluno.avatar}</em> {aluno.nome}
                </span>
                <span className="chamada-botoes">
                  <button
                    className={`mini ${aluno.status === "voltando" ? "verde" : "suave"}`}
                    onClick={() => chamada(aluno, true)}
                    disabled={ocupado}
                  >
                    🚐 Volta
                  </button>
                  <button
                    className={`mini ${aluno.status === "volta_ausente" ? "cinza-forte" : "suave"}`}
                    onClick={() => chamada(aluno, false)}
                    disabled={ocupado}
                  >
                    🚶 Não volta
                  </button>
                </span>
              </div>
            ))}

          <button
            className="grande"
            onClick={iniciarVolta}
            disabled={ocupado || estado.pendentesNaChamada.length > 0}
          >
            {estado.pendentesNaChamada.length > 0
              ? `Faltam ${estado.pendentesNaChamada.length} na chamada`
              : "▶️ Iniciar a volta"}
          </button>
        </section>
      )}

      {/* ---- VOLTA ---- */}
      {estado.fase === "volta" && proxima && (
        <section className="card acao-agora">
          <small>Levando para casa · {estado.alunos.filter((a) => a.status === "voltando").length} na van</small>
          <div className="acao-agora__aluno">
            <span className="acao-agora__avatar">{proxima.avatar}</span>
            <div>
              <strong>{proxima.nome}</strong>
              <p className="subtitulo">Deixar em casa</p>
            </div>
          </div>
          <button className="grande verde" onClick={() => entregar(proxima)} disabled={ocupado}>
            🏠 Entreguei {proxima.nome.split(" ")[0]} em casa
          </button>
        </section>
      )}

      {estado.fase === "encerrado" && (
        <section className="card centro encerrado">
          <h2>🎉 Dia concluído!</h2>
          <p>
            {estado.alunos.filter((a) => a.status === "em_casa").length} criança(s)
            entregues em casa em segurança. Bom descanso, tio! 🚐
          </p>
          <button className="suave" onClick={reiniciar}>🔄 Recomeçar o dia (demonstração)</button>
        </section>
      )}

      <p className="msg erro">{erro}</p>

      {/* ---- Mapa ---- */}
      <section className="card">
        <h2>🗺️ O mapa do dia</h2>
        <div className="legenda">
          {estado.fase === "ida" || estado.fase === "encerrado" ? (
            <>
              <span className="verde">esperando / entregue</span>
              <span className="vermelho">falta hoje</span>
              <span className="azul">na van</span>
            </>
          ) : (
            <>
              <span className="vermelho">na van (indo pra casa)</span>
              <span className="verde">entregue em casa</span>
              <span className="roxo">na escola</span>
            </>
          )}
        </div>

        {alternativas.length > 0 && (
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
        <p className="msg">{msg}</p>

        <div className="mapa-moldura">
          <MapaVan
            alunos={estado.alunos}
            escola={estado.escola}
            posicaoVan={posicaoVan()}
            geometria={alternativas[escolhida]?.geometria ?? null}
          />
        </div>

        {estado.alunos.length > 0 && (
          <ol className="ordem-lista">
            {estado.alunos.map((a) => (
              <li key={a.alunoId} style={{ opacity: ["na_escola", "em_casa", "volta_ausente"].includes(a.status) ? 0.55 : 1 }}>
                {a.avatar} <strong>{a.nome}</strong> — <span style={{ color: a.cor }}>{a.statusRotulo}</span>
                {a.justificativa && <em className="subtitulo"> ({a.justificativa})</em>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
