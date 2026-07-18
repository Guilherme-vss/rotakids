import { useState } from "react";
import { api, salvarSessao } from "../api.js";
import { validarCadastroMotorista } from "../../../src/domain/validacoes";
import Campo from "./Campo.jsx";

/**
 * Cadastro do motorista — em 3 passos, não num formulário de 12 campos.
 *
 * Por que 3 passos: um pai só entrega o filho para quem tem documento em dia,
 * então precisamos de MUITO dado (CPF, CNH, categoria, validade, veículo).
 * Pedir tudo de uma vez faz a pessoa desistir. Dividir em blocos com sentido
 * ("quem é você" → "sua habilitação" → "sua van") mantém o cadastro completo
 * e a pessoa até o fim.
 *
 * A validação é a MESMA do servidor (importada do domínio) — a tela avisa antes
 * de enviar, o servidor confere de novo. Nunca confiar só no cliente.
 */
export default function CadastroMotorista({ aoEntrar, aoVoltar }) {
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState({
    tipo: "motorista",
    nome: "", cpf: "", nascimento: "", celular: "", email: "", senha: "",
    cnh: "", cnhCategoria: "D", cnhValidade: "",
    veiculoPlaca: "", veiculoModelo: "", veiculoAno: "", veiculoLugares: "",
  });
  const [erros, setErros] = useState({});
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  const mudar = (nome, valor) => {
    setForm((f) => ({ ...f, [nome]: valor }));
    setErros((e) => ({ ...e, [nome]: undefined })); // some o erro assim que a pessoa corrige
  };

  /** Valida só os campos do passo atual — não adianta reclamar do que ainda não pedi. */
  function validarPasso(numero) {
    const todos = validarCadastroMotorista(form);
    const camposDoPasso = {
      1: ["nome", "cpf", "nascimento", "celular", "email"],
      2: ["cnh", "cnhCategoria", "cnhValidade"],
      3: ["veiculoPlaca", "veiculoModelo", "veiculoAno", "veiculoLugares"],
    }[numero];

    const doPasso = {};
    for (const campo of camposDoPasso) {
      if (todos[campo]) doPasso[campo] = todos[campo];
    }
    if (numero === 1 && (!form.senha || form.senha.length < 6)) {
      doPasso.senha = "A senha precisa ter pelo menos 6 caracteres";
    }
    return doPasso;
  }

  function avancar() {
    const problemas = validarPasso(passo);
    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      return;
    }
    setErros({});
    setPasso(passo + 1);
  }

  async function enviar(e) {
    e.preventDefault();
    setMsg("");

    const problemas = { ...validarPasso(1), ...validarPasso(2), ...validarPasso(3) };
    if (Object.keys(problemas).length > 0) {
      setErros(problemas);
      setMsg("Confira os campos destacados.");
      return;
    }

    setEnviando(true);
    try {
      const dados = await api("/auth/cadastro", { metodo: "POST", corpo: form });
      salvarSessao(dados);
      aoEntrar(dados);
    } catch (erro) {
      // O servidor pode reprovar o que a tela deixou passar (CPF já cadastrado)
      if (erro.erros) {
        setErros(erro.erros);
        setPasso(Object.keys(erro.erros).some((c) => c.startsWith("veiculo")) ? 3 : 1);
      }
      setMsg(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  const anoAtual = new Date().getFullYear();

  return (
    <form className="card cadastro" onSubmit={enviar}>
      <div className="passos">
        {["Você", "Habilitação", "Sua van"].map((rotulo, i) => (
          <div key={rotulo} className={`passo ${passo === i + 1 ? "ativo" : passo > i + 1 ? "feito" : ""}`}>
            <span className="passo__bolinha">{passo > i + 1 ? "✓" : i + 1}</span>
            {rotulo}
          </div>
        ))}
      </div>

      {passo === 1 && (
        <>
          <h3>👤 Quem é você</h3>
          <Campo rotulo="Nome completo" nome="nome" valor={form.nome} aoMudar={mudar}
                 erro={erros.nome} placeholder="João da Silva" />
          <div className="duas-colunas">
            <Campo rotulo="CPF" nome="cpf" valor={form.cpf} aoMudar={mudar} erro={erros.cpf}
                   placeholder="000.000.000-00" dica="Conferimos o CPF de verdade" />
            <Campo rotulo="Data de nascimento" nome="nascimento" tipo="date"
                   valor={form.nascimento} aoMudar={mudar} erro={erros.nascimento}
                   dica="Transporte escolar exige 21+" />
          </div>
          <div className="duas-colunas">
            <Campo rotulo="Celular" nome="celular" valor={form.celular} aoMudar={mudar}
                   erro={erros.celular} placeholder="(11) 96122-1800" />
            <Campo rotulo="Email" nome="email" tipo="email" valor={form.email} aoMudar={mudar}
                   erro={erros.email} placeholder="voce@email.com" />
          </div>
          <Campo rotulo="Senha" nome="senha" tipo="password" valor={form.senha} aoMudar={mudar}
                 erro={erros.senha} placeholder="mínimo 6 caracteres" />
        </>
      )}

      {passo === 2 && (
        <>
          <h3>🪪 Sua habilitação</h3>
          <p className="subtitulo">
            Por lei, transporte escolar exige CNH categoria <strong>D</strong> ou
            <strong> E</strong>. É essa exigência que dá segurança aos pais — e nós
            conferimos o número de verdade.
          </p>
          <Campo rotulo="Número da CNH" nome="cnh" valor={form.cnh} aoMudar={mudar}
                 erro={erros.cnh} placeholder="11 dígitos" dica="Está na frente do documento" />
          <div className="duas-colunas">
            <Campo rotulo="Categoria" nome="cnhCategoria" valor={form.cnhCategoria} aoMudar={mudar}
                   erro={erros.cnhCategoria}
                   opcoes={[
                     { valor: "D", rotulo: "D — ônibus e vans" },
                     { valor: "E", rotulo: "E — carreta / articulado" },
                     { valor: "AD", rotulo: "AD — moto + D" },
                     { valor: "AE", rotulo: "AE — moto + E" },
                     { valor: "B", rotulo: "B — carro de passeio" },
                   ]} />
            <Campo rotulo="Validade da CNH" nome="cnhValidade" tipo="date" valor={form.cnhValidade}
                   aoMudar={mudar} erro={erros.cnhValidade} dica="Avisamos antes de vencer" />
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          <h3>🚐 Sua van</h3>
          <div className="duas-colunas">
            <Campo rotulo="Placa" nome="veiculoPlaca" valor={form.veiculoPlaca} aoMudar={mudar}
                   erro={erros.veiculoPlaca} placeholder="ABC1D23" dica="Antiga ou Mercosul" />
            <Campo rotulo="Modelo" nome="veiculoModelo" valor={form.veiculoModelo} aoMudar={mudar}
                   erro={erros.veiculoModelo} placeholder="Sprinter, Master, Ducato..." />
          </div>
          <div className="duas-colunas">
            <Campo rotulo="Ano" nome="veiculoAno" tipo="number" valor={form.veiculoAno} aoMudar={mudar}
                   erro={erros.veiculoAno} placeholder={String(anoAtual)} min="1990" max={anoAtual + 1} />
            <Campo rotulo="Lugares" nome="veiculoLugares" tipo="number" valor={form.veiculoLugares}
                   aoMudar={mudar} erro={erros.veiculoLugares} placeholder="16" min="4" max="30"
                   dica="Quantas crianças cabem" />
          </div>
        </>
      )}

      <div className="acoes">
        {passo > 1 ? (
          <button type="button" className="suave" onClick={() => setPasso(passo - 1)}>
            ← Voltar
          </button>
        ) : (
          <button type="button" className="suave" onClick={aoVoltar}>
            ← Cancelar
          </button>
        )}

        {passo < 3 ? (
          <button type="button" onClick={avancar}>Continuar →</button>
        ) : (
          <button disabled={enviando}>{enviando ? "Cadastrando..." : "🚐 Criar minha conta"}</button>
        )}
      </div>

      <p className="msg erro">{msg}</p>
    </form>
  );
}
