/**
 * demo.js — modo demonstração do RotaKids.
 *
 * Quando o site roda no GitHub Pages (sem backend), este módulo responde
 * as chamadas da API com dados fictícios que ficam na memória — dá para
 * navegar, marcar falta, ver o mapa e calcular a rota como se fosse real.
 */

export function estaEmDemo() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") ||
      window.location.search.includes("demo=1"))
  );
}

/** Faixa fixa avisando que é uma demonstração. */
export function mostrarFaixaDemo() {
  if (!estaEmDemo() || document.getElementById("faixa-demo")) return;
  const faixa = document.createElement("div");
  faixa.id = "faixa-demo";
  faixa.textContent = "🧪 Demonstração com dados fictícios — entre com qualquer email e senha. O sistema completo roda com Docker (veja o código).";
  faixa.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1e3a8a;color:#fff;" +
    "text-align:center;font:600 12px 'Segoe UI',sans-serif;padding:7px 12px;opacity:0.95";
  document.body.appendChild(faixa);
}

/* ---------- Dados fictícios (mutáveis: a demo "funciona") ---------- */

const escola = { nome: "E.E. Dom Pedro II", lat: -23.5505, lng: -46.6333 };

const alunosDoMotorista = [
  {
    id: 1, nome: "Ana Lima", casa_endereco: "Rua Augusta, 900", casa_lat: -23.552, casa_lng: -46.649,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: "Alergia a amendoim", contato_emergencia: "Tia Paula (11) 98888-1111",
    responsavel: "Carla Lima", telefone_responsavel: "(11) 97777-2222",
    vai_hoje: true, justificativa: null,
  },
  {
    id: 2, nome: "Bruno Santos", casa_endereco: "Al. Santos, 455", casa_lat: -23.5665, casa_lng: -46.6510,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: null, contato_emergencia: null,
    responsavel: "Marcos Santos", telefone_responsavel: "(11) 96666-3333",
    vai_hoje: true, justificativa: null,
  },
  {
    id: 3, nome: "Caio Pereira", casa_endereco: "Rua Frei Caneca, 200", casa_lat: -23.5537, casa_lng: -46.6532,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: "Asma — bombinha na mochila", contato_emergencia: "Avó Neide (11) 95555-4444",
    responsavel: "Julia Pereira", telefone_responsavel: "(11) 94444-5555",
    vai_hoje: false, justificativa: "Consulta médica pela manhã",
  },
];

const filhosDoPai = [
  { id: 1, nome: "Ana Lima", escola_nome: escola.nome, vai_hoje: true, justificativa: null },
  { id: 3, nome: "Caio Pereira", escola_nome: escola.nome, vai_hoje: false, justificativa: "Consulta médica pela manhã" },
];

let pendentes = [
  { id: 10, aluno: "Ana Lima", motorista: "Tio Zé da Van", telefone: "(11) 93333-6666" },
];

/* ---------- Roteador das respostas fictícias ---------- */

export async function respostaDemo(caminho, metodo = "GET", corpo = null) {
  await new Promise((r) => setTimeout(r, 250)); // sensação de rede

  // --- autenticação: qualquer credencial entra ---
  if (caminho === "/auth/login") {
    return { token: "demo", usuario: { id: 99, nome: "Visitante", tipo: "motorista" } };
  }
  if (caminho === "/auth/cadastro") {
    return { token: "demo", usuario: { id: 99, nome: corpo?.nome || "Visitante", tipo: corpo?.tipo || "pai" } };
  }

  // --- área do pai ---
  if (caminho === "/alunos" && metodo === "GET") return [...filhosDoPai];
  if (caminho === "/alunos" && metodo === "POST") {
    const novo = { id: Date.now(), nome: corpo.nome, escola_nome: corpo.escolaNome, vai_hoje: true, justificativa: null };
    filhosDoPai.push(novo);
    return { aluno: novo };
  }
  const presenca = caminho.match(/^\/alunos\/(\d+)\/presenca$/);
  if (presenca) {
    const alvo = Number(presenca[1]);
    for (const lista of [filhosDoPai, alunosDoMotorista]) {
      const aluno = lista.find((a) => a.id === alvo);
      if (aluno) {
        aluno.vai_hoje = corpo.vai;
        aluno.justificativa = corpo.vai ? null : corpo.justificativa;
      }
    }
    return { ok: true, mensagem: corpo.vai ? "Presença confirmada ✅" : "Falta registrada 📝" };
  }

  // --- vínculos ---
  if (caminho === "/vinculos/pendentes") return [...pendentes];
  if (caminho === "/vinculos" && metodo === "POST") {
    return { ok: true, mensagem: "Solicitação enviada — aguardando o responsável aceitar (demo)" };
  }
  const aceitar = caminho.match(/^\/vinculos\/(\d+)\/aceitar$/);
  if (aceitar) {
    pendentes = pendentes.filter((p) => p.id !== Number(aceitar[1]));
    return { ok: true, mensagem: "Contrato fechado! 🤝" };
  }

  // --- área do motorista ---
  if (caminho === "/rota/alunos") return [...alunosDoMotorista];
  if (caminho.startsWith("/rota/melhor")) {
    const confirmados = alunosDoMotorista.filter((a) => a.vai_hoje);
    return {
      paradas: confirmados.map((a, i) => ({ ordem: i + 1, alunoId: a.id, nome: a.nome, lat: a.casa_lat, lng: a.casa_lng })),
      escola,
      distanciaEstimadaKm: 6.8,
      tracado: null, // a linha tracejada de reserva mostra o trajeto
    };
  }

  return { ok: true };
}
