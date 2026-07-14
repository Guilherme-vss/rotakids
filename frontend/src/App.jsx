import { useState } from "react";
import { lerSessao, limparSessao } from "./api.js";
import Login from "./components/Login.jsx";
import PainelPai from "./components/PainelPai.jsx";
import PainelMotorista from "./components/PainelMotorista.jsx";

export default function App() {
  const [sessao, setSessao] = useState(lerSessao());

  function sair() {
    limparSessao();
    setSessao(null);
  }

  if (!sessao) {
    return <Login aoEntrar={setSessao} />;
  }

  const { usuario } = sessao;
  return (
    <>
      <header className="topo">
        <div className="topo__marca">
          <img src="icone.svg" alt="" />
          <h1>RotaKids</h1>
        </div>
        <div className="topo__usuario">
          {usuario.tipo === "pai" ? "👨‍👩‍👧 Responsável" : "🚐 Motorista"}: <strong>{usuario.nome}</strong>
          <br />
          <button className="mini suave" onClick={sair}>Sair</button>
        </div>
      </header>

      <main className="conteudo">
        {usuario.tipo === "pai" ? <PainelPai /> : <PainelMotorista />}
      </main>
    </>
  );
}
