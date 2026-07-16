/**
 * validacoes.ts — a camada de CONFIANÇA do RotaKids.
 *
 * Transportar criança é o serviço mais sensível que existe: nenhum pai entrega
 * um filho para um cadastro meia-boca. Por isso aqui não tem "if (campo != '')" —
 * cada documento é validado pelo algoritmo oficial (dígito verificador), do jeito
 * que o Detran e a Receita validam.
 *
 * Tudo é função pura: sem banco, sem rede, testável sozinha (regra 2).
 */

/** Resultado padrão: null = válido; string = o erro em português, ensinando a corrigir. */
export type Erro = string | null;

/* ==================== Documentos ==================== */

/**
 * CPF pelo algoritmo oficial da Receita Federal (2 dígitos verificadores).
 * Rejeita os "falsos clássicos" (111.111.111-11), que passam na conta mas não existem.
 */
export function validarCpf(entrada: string): Erro {
  const cpf = (entrada || "").replace(/\D/g, "");

  if (!cpf) return "Informe o CPF";
  if (cpf.length !== 11) return "O CPF precisa ter 11 dígitos";
  if (/^(\d)\1{10}$/.test(cpf)) return "Esse CPF não existe (todos os dígitos iguais)";

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  if (digito(9) !== Number(cpf[9]) || digito(10) !== Number(cpf[10])) {
    return "CPF inválido — confira os números";
  }
  return null;
}

/**
 * CNH pelo algoritmo do Denatran (11 dígitos, 2 verificadores).
 * É o documento que autoriza dirigir — sem ele validado, não há van.
 */
export function validarCnh(entrada: string): Erro {
  const cnh = (entrada || "").replace(/\D/g, "");

  if (!cnh) return "Informe o número da CNH";
  if (cnh.length !== 11) return "A CNH precisa ter 11 dígitos";
  if (/^(\d)\1{10}$/.test(cnh)) return "Essa CNH não existe (todos os dígitos iguais)";

  let soma = 0;
  for (let i = 0, peso = 9; i < 9; i++, peso--) {
    soma += Number(cnh[i]) * peso;
  }
  let primeiro = soma % 11;
  let deslocamento = 0;
  if (primeiro >= 10) {
    primeiro = 0;
    deslocamento = 2;
  }

  soma = 0;
  for (let i = 0, peso = 1; i < 9; i++, peso++) {
    soma += Number(cnh[i]) * peso;
  }
  let segundo = soma % 11;
  segundo = segundo >= 10 ? 0 : segundo - deslocamento;
  if (segundo < 0) segundo += 11;

  if (primeiro !== Number(cnh[9]) || segundo !== Number(cnh[10])) {
    return "CNH inválida — confira o número na frente do documento";
  }
  return null;
}

/**
 * Categoria da CNH: transporte escolar exige **D** (ou E) por lei —
 * categoria B não pode conduzir van escolar. Essa regra existe para
 * proteger a criança, então o sistema não deixa passar.
 */
export function validarCategoriaCnh(categoria: string): Erro {
  const c = (categoria || "").trim().toUpperCase();
  if (!c) return "Informe a categoria da CNH";
  if (!["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"].includes(c)) {
    return "Categoria inválida (use A, B, C, D, E ou combinações como AD)";
  }
  if (!c.includes("D") && !c.includes("E")) {
    return "Transporte escolar exige CNH categoria D ou E — a sua é " + c;
  }
  return null;
}

/** Placa nos dois formatos válidos hoje: antigo (ABC1234) e Mercosul (ABC1D23). */
export function validarPlaca(entrada: string): Erro {
  const placa = (entrada || "").replace(/[\s-]/g, "").toUpperCase();

  if (!placa) return "Informe a placa do veículo";
  const antigo = /^[A-Z]{3}\d{4}$/;
  const mercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  if (!antigo.test(placa) && !mercosul.test(placa)) {
    return "Placa inválida — use ABC1234 (antiga) ou ABC1D23 (Mercosul)";
  }
  return null;
}

/** Deixa a placa no formato de exibição padrão (ABC-1234 / ABC1D23). */
export function formatarPlaca(entrada: string): string {
  const placa = (entrada || "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z]{3}\d{4}$/.test(placa) ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}

/* ==================== Contato ==================== */

/**
 * Celular brasileiro: DDD válido (11–99) + 9 dígitos começando com 9.
 * O telefone é a linha de emergência entre o motorista e a família —
 * um número errado aqui custa caro.
 */
export function validarCelular(entrada: string): Erro {
  const numero = (entrada || "").replace(/\D/g, "");

  if (!numero) return "Informe um celular para contato";
  if (numero.length !== 11) return "O celular precisa ter DDD + 9 dígitos (ex.: 11 96122-1800)";

  const ddd = Number(numero.slice(0, 2));
  if (ddd < 11 || ddd > 99) return "DDD inválido";
  if (numero[2] !== "9") return "Celular deve começar com 9 depois do DDD";

  return null;
}

export function formatarCelular(entrada: string): string {
  const n = (entrada || "").replace(/\D/g, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : entrada;
}

export function validarEmail(entrada: string): Erro {
  const email = (entrada || "").trim();
  if (!email) return "Informe o email";
  // Proposital: simples e permissivo. Validação real de email é o envio, não a regex.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Email inválido";
  return null;
}

/* ==================== Pessoa ==================== */

/** Nome completo: exige nome e sobrenome (a criança tem que ser identificável). */
export function validarNomeCompleto(entrada: string): Erro {
  const nome = (entrada || "").trim().replace(/\s+/g, " ");
  if (!nome) return "Informe o nome completo";
  if (nome.length < 5) return "Nome muito curto";
  if (!nome.includes(" ")) return "Informe o nome e o sobrenome";
  if (/\d/.test(nome)) return "Nome não pode conter números";
  return null;
}

/** Idade a partir da data de nascimento (ISO AAAA-MM-DD). */
export function calcularIdade(nascimentoIso: string, hoje: Date = new Date()): number | null {
  const nascimento = new Date(nascimentoIso + "T00:00:00");
  if (Number.isNaN(nascimento.getTime())) return null;

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

/**
 * Data de nascimento do ALUNO: transporte escolar atende de 1 a 17 anos.
 * A faixa não é frescura — define o tipo de cadeirinha e a responsabilidade legal.
 */
export function validarNascimentoAluno(nascimentoIso: string, hoje: Date = new Date()): Erro {
  if (!nascimentoIso) return "Informe a data de nascimento";
  const idade = calcularIdade(nascimentoIso, hoje);
  if (idade === null) return "Data de nascimento inválida";
  if (idade < 0) return "A data de nascimento está no futuro";
  if (idade > 17) return "O transporte escolar atende até 17 anos";
  if (idade < 1) return "Confira a data — a criança precisa ter pelo menos 1 ano";
  return null;
}

/** Data de nascimento do MOTORISTA: exige maioridade (e sanidade da data). */
export function validarNascimentoMotorista(nascimentoIso: string, hoje: Date = new Date()): Erro {
  if (!nascimentoIso) return "Informe a data de nascimento";
  const idade = calcularIdade(nascimentoIso, hoje);
  if (idade === null) return "Data de nascimento inválida";
  if (idade < 21) return "Transporte escolar exige motorista com 21 anos ou mais";
  if (idade > 90) return "Confira a data de nascimento";
  return null;
}

/**
 * Validade da CNH: documento vencido = van parada. O sistema avisa ANTES
 * de virar problema (o aviso de 30 dias é do produto, não da lei).
 */
export function situacaoCnh(validadeIso: string, hoje: Date = new Date()): {
  valida: boolean;
  diasRestantes: number;
  aviso: Erro;
} {
  const validade = new Date(validadeIso + "T00:00:00");
  if (Number.isNaN(validade.getTime())) {
    return { valida: false, diasRestantes: 0, aviso: "Data de validade inválida" };
  }
  const dia = 1000 * 60 * 60 * 24;
  const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / dia);

  if (diasRestantes < 0) {
    return { valida: false, diasRestantes, aviso: "CNH vencida — regularize antes de rodar" };
  }
  if (diasRestantes <= 30) {
    return {
      valida: true,
      diasRestantes,
      aviso: `Sua CNH vence em ${diasRestantes} dia(s) — já agende a renovação`,
    };
  }
  return { valida: true, diasRestantes, aviso: null };
}

/* ==================== Cadastros completos ==================== */

export interface CadastroMotorista {
  nome: string;
  cpf: string;
  nascimento: string;
  celular: string;
  email: string;
  cnh: string;
  cnhCategoria: string;
  cnhValidade: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  veiculoAno: number | string;
  veiculoLugares: number | string;
}

/**
 * Valida o cadastro inteiro do motorista e devolve TODOS os erros de uma vez,
 * campo a campo — porque corrigir um erro por vez é tortura para o usuário
 * (regra 1, frente do usuário).
 */
export function validarCadastroMotorista(
  dados: Partial<CadastroMotorista>,
  hoje: Date = new Date()
): Record<string, string> {
  const erros: Record<string, string> = {};
  const anoAtual = hoje.getFullYear();

  const checar = (campo: string, erro: Erro) => {
    if (erro) erros[campo] = erro;
  };

  checar("nome", validarNomeCompleto(dados.nome ?? ""));
  checar("cpf", validarCpf(dados.cpf ?? ""));
  checar("nascimento", validarNascimentoMotorista(dados.nascimento ?? "", hoje));
  checar("celular", validarCelular(dados.celular ?? ""));
  checar("email", validarEmail(dados.email ?? ""));
  checar("cnh", validarCnh(dados.cnh ?? ""));
  checar("cnhCategoria", validarCategoriaCnh(dados.cnhCategoria ?? ""));
  checar("veiculoPlaca", validarPlaca(dados.veiculoPlaca ?? ""));

  if (!dados.cnhValidade) {
    erros.cnhValidade = "Informe a validade da CNH";
  } else {
    const situacao = situacaoCnh(dados.cnhValidade, hoje);
    if (!situacao.valida) erros.cnhValidade = situacao.aviso ?? "CNH vencida";
  }

  if (!String(dados.veiculoModelo ?? "").trim()) {
    erros.veiculoModelo = "Informe o modelo da van";
  }

  const ano = Number(dados.veiculoAno);
  if (!ano) {
    erros.veiculoAno = "Informe o ano do veículo";
  } else if (ano < 1990 || ano > anoAtual + 1) {
    erros.veiculoAno = `Ano inválido (entre 1990 e ${anoAtual + 1})`;
  }

  const lugares = Number(dados.veiculoLugares);
  if (!lugares) {
    erros.veiculoLugares = "Informe quantos lugares a van tem";
  } else if (lugares < 4 || lugares > 30) {
    erros.veiculoLugares = "Quantidade de lugares inválida (entre 4 e 30)";
  }

  return erros;
}

export interface CadastroAluno {
  nome: string;
  nascimento: string;
  escolaNome: string;
  escolaEndereco: string;
  casaEndereco: string;
  responsavelNome: string;
  responsavelCelular: string;
  emergenciaNome: string;
  emergenciaCelular: string;
  problemaSaude?: string;
  autorizadoDescerSozinho?: boolean;
}

/**
 * Valida o cadastro da criança. Note o que é OBRIGATÓRIO: um segundo contato
 * de emergência. Se o responsável não atender, alguém precisa atender —
 * essa é a regra que um motorista de van pediria.
 */
export function validarCadastroAluno(
  dados: Partial<CadastroAluno>,
  hoje: Date = new Date()
): Record<string, string> {
  const erros: Record<string, string> = {};
  const checar = (campo: string, erro: Erro) => {
    if (erro) erros[campo] = erro;
  };

  checar("nome", validarNomeCompleto(dados.nome ?? ""));
  checar("nascimento", validarNascimentoAluno(dados.nascimento ?? "", hoje));
  checar("responsavelNome", validarNomeCompleto(dados.responsavelNome ?? ""));
  checar("responsavelCelular", validarCelular(dados.responsavelCelular ?? ""));
  checar("emergenciaNome", validarNomeCompleto(dados.emergenciaNome ?? ""));
  checar("emergenciaCelular", validarCelular(dados.emergenciaCelular ?? ""));

  if (!String(dados.escolaNome ?? "").trim()) erros.escolaNome = "Informe a escola";
  if (!String(dados.escolaEndereco ?? "").trim()) {
    erros.escolaEndereco = "Informe o endereço da escola";
  }
  if (!String(dados.casaEndereco ?? "").trim()) {
    erros.casaEndereco = "Informe o endereço de casa (rua, número, cidade)";
  }

  // Os dois contatos não podem ser o mesmo número: emergência é PLANO B.
  const r = (dados.responsavelCelular ?? "").replace(/\D/g, "");
  const e = (dados.emergenciaCelular ?? "").replace(/\D/g, "");
  if (r && e && r === e) {
    erros.emergenciaCelular = "O contato de emergência deve ser diferente do responsável";
  }

  return erros;
}

/** Atalho: o cadastro está válido? */
export function semErros(erros: Record<string, string>): boolean {
  return Object.keys(erros).length === 0;
}
