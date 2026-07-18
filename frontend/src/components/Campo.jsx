/**
 * Campo.jsx — o campo de formulário do RotaKids.
 *
 * Existe por um motivo de usabilidade: erro de cadastro tem que aparecer
 * EMBAIXO DO CAMPO errado, não numa faixa vermelha genérica no topo que
 * obriga a pessoa a caçar o problema. Quem cadastra 3 filhos às 22h com
 * sono não merece isso.
 */
export default function Campo({
  rotulo,
  nome,
  valor,
  aoMudar,
  erro,
  dica,
  tipo = "text",
  placeholder,
  opcoes,
  ...resto
}) {
  const id = `campo-${nome}`;
  const temErro = Boolean(erro);

  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>

      {opcoes ? (
        <select
          id={id}
          value={valor ?? ""}
          onChange={(e) => aoMudar(nome, e.target.value)}
          className={temErro ? "invalido" : ""}
          aria-invalid={temErro}
          {...resto}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={tipo}
          value={valor ?? ""}
          placeholder={placeholder}
          onChange={(e) => aoMudar(nome, e.target.value)}
          className={temErro ? "invalido" : ""}
          aria-invalid={temErro}
          aria-describedby={temErro ? `${id}-erro` : undefined}
          {...resto}
        />
      )}

      {temErro ? (
        <small className="campo__erro" id={`${id}-erro`}>
          ⚠️ {erro}
        </small>
      ) : (
        dica && <small className="campo__dica">{dica}</small>
      )}
    </div>
  );
}
