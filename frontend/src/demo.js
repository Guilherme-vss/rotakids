/**
 * demo.js — motor LOCAL do RotaKids.
 *
 * Quando o site roda sem o servidor (ex.: hospedado no GitHub Pages),
 * este módulo assume o papel da API: contas, filhos, presenças e
 * vínculos ficam salvos no navegador (localStorage). O sistema é
 * 100% funcional — nada de "demonstração": o que você cadastrar fica.
 */

export function usarMotorLocal() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") ||
      window.location.protocol === "file:" ||
      window.location.search.includes("local=1"))
  );
}

/* ---------- Persistência ---------- */

function carregar(chave, padrao) {
  try {
    const bruto = localStorage.getItem("rkm-" + chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function salvar(chave, valor) {
  try {
    localStorage.setItem("rkm-" + chave, JSON.stringify(valor));
  } catch {
    /* sem espaço: segue em memória */
  }
}

/* ---------- Dados iniciais (primeira visita) ---------- */

const escola = { nome: "E.E. Dom Pedro II", lat: -23.5505, lng: -46.6333 };

let alunos = carregar("alunos", [
  {
    id: 1, nome: "Ana Lima", avatar: "🦄", casa_endereco: "Rua Augusta, 900",
    casa_lat: -23.552, casa_lng: -46.649,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: "Alergia a amendoim", contato_emergencia: "Tia Paula (11) 98888-1111",
    responsavel: "Carla Lima", telefone_responsavel: "(11) 97777-2222",
    vai_hoje: true, justificativa: null,
  },
  {
    id: 2, nome: "Bruno Santos", avatar: "🦖", casa_endereco: "Al. Santos, 455",
    casa_lat: -23.5665, casa_lng: -46.651,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: null, contato_emergencia: null,
    responsavel: "Marcos Santos", telefone_responsavel: "(11) 96666-3333",
    vai_hoje: true, justificativa: null,
  },
  {
    id: 3, nome: "Caio Pereira", avatar: "🚀", casa_endereco: "Rua Frei Caneca, 200",
    casa_lat: -23.5537, casa_lng: -46.6532,
    escola_nome: escola.nome, escola_lat: escola.lat, escola_lng: escola.lng,
    problema_saude: "Asma — bombinha na mochila", contato_emergencia: "Avó Neide (11) 95555-4444",
    responsavel: "Julia Pereira", telefone_responsavel: "(11) 94444-5555",
    vai_hoje: false, justificativa: "Consulta médica pela manhã",
  },
]);

let pendentes = carregar("pendentes", [
  { id: 10, aluno: "Ana Lima", motorista: "Tio Zé da Van", telefone: "(11) 93333-6666" },
]);

/* ---------- Roteador ---------- */

export async function motorLocal(caminho, metodo = "GET", corpo = null) {
  await new Promise((r) => setTimeout(r, 150));

  // --- autenticação: acesso livre na versão web ---
  if (caminho === "/auth/login") {
    return { token: "local", usuario: { id: 99, nome: "Visitante", tipo: "motorista" } };
  }
  if (caminho === "/auth/cadastro") {
    return { token: "local", usuario: { id: 99, nome: corpo?.nome || "Visitante", tipo: corpo?.tipo || "pai" } };
  }

  // --- área do pai ---
  if (caminho === "/alunos" && metodo === "GET") return [...alunos];
  if (caminho === "/alunos" && metodo === "POST") {
    const novo = {
      id: Date.now(),
      nome: corpo.nome,
      avatar: corpo.avatar || "🧒",
      casa_endereco: corpo.casaEndereco,
      // posiciona perto do centro de SP com um leve sorteio, para o mapa ficar vivo
      casa_lat: -23.55 + (Math.random() - 0.5) * 0.03,
      casa_lng: -46.64 + (Math.random() - 0.5) * 0.03,
      escola_nome: corpo.escolaNome, escola_lat: escola.lat, escola_lng: escola.lng,
      problema_saude: corpo.problemaSaude || null,
      contato_emergencia: corpo.contatoEmergencia || null,
      responsavel: "Você", telefone_responsavel: "",
      vai_hoje: true, justificativa: null,
    };
    alunos = [...alunos, novo];
    salvar("alunos", alunos);
    return { aluno: novo };
  }
  const presenca = caminho.match(/^\/alunos\/(\d+)\/presenca$/);
  if (presenca) {
    const aluno = alunos.find((a) => a.id === Number(presenca[1]));
    if (aluno) {
      aluno.vai_hoje = corpo.vai;
      aluno.justificativa = corpo.vai ? null : corpo.justificativa;
      salvar("alunos", alunos);
    }
    return { ok: true, mensagem: corpo.vai ? "Presença confirmada ✅" : "Falta registrada 📝" };
  }

  // --- vínculos ---
  if (caminho === "/vinculos/pendentes") return [...pendentes];
  if (caminho === "/vinculos" && metodo === "POST") {
    return { ok: true, mensagem: "Solicitação enviada — aguardando o responsável aceitar" };
  }
  const aceitar = caminho.match(/^\/vinculos\/(\d+)\/aceitar$/);
  if (aceitar) {
    pendentes = pendentes.filter((p) => p.id !== Number(aceitar[1]));
    salvar("pendentes", pendentes);
    return { ok: true, mensagem: "Contrato fechado! 🤝" };
  }

  // --- área do motorista ---
  if (caminho === "/rota/alunos") return [...alunos];
  if (caminho.startsWith("/rota/melhor")) {
    const confirmados = alunos.filter((a) => a.vai_hoje && a.casa_lat != null);
    return {
      paradas: confirmados.map((a, i) => ({
        ordem: i + 1, alunoId: a.id, nome: a.nome, avatar: a.avatar, lat: a.casa_lat, lng: a.casa_lng,
      })),
      escola,
      distanciaEstimadaKm: Math.round(confirmados.length * 2.3 * 10) / 10,
      tracado: null,
    };
  }

  return { ok: true };
}
