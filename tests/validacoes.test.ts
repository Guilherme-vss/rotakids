/**
 * Testes da camada de confiança do RotaKids.
 *
 * Cada bloco cobre os três cenários que a regra 3 exige:
 * o caso feliz, o caso de BORDA e o caso de ERRO.
 */
import {
  calcularIdade,
  formatarCelular,
  formatarPlaca,
  semErros,
  situacaoCnh,
  validarCadastroAluno,
  validarCadastroMotorista,
  validarCategoriaCnh,
  validarCelular,
  validarCnh,
  validarCpf,
  validarEmail,
  validarNascimentoAluno,
  validarNascimentoMotorista,
  validarNomeCompleto,
  validarPlaca,
} from "../src/domain/validacoes";

// "Hoje" fixo: teste que depende do relógio real quebra sozinho amanhã.
const HOJE = new Date("2026-07-16T12:00:00");

describe("validarCpf", () => {
  test("aceita CPF válido, com e sem máscara", () => {
    expect(validarCpf("52998224725")).toBeNull();
    expect(validarCpf("529.982.247-25")).toBeNull();
  });

  test("rejeita dígito verificador errado", () => {
    expect(validarCpf("52998224724")).toMatch(/inválido/);
  });

  test("rejeita os falsos clássicos (todos os dígitos iguais)", () => {
    // 111.111.111-11 passa na conta do dígito, mas não existe na Receita
    expect(validarCpf("11111111111")).toMatch(/não existe/);
    expect(validarCpf("00000000000")).toMatch(/não existe/);
  });

  test("rejeita tamanho errado e vazio", () => {
    expect(validarCpf("123")).toMatch(/11 dígitos/);
    expect(validarCpf("")).toMatch(/Informe/);
  });
});

describe("validarCnh", () => {
  test("aceita CNH válida", () => {
    expect(validarCnh("98765432109")).toBeNull();
  });

  test("rejeita dígito verificador errado", () => {
    expect(validarCnh("98765432100")).toMatch(/inválida/);
  });

  test("rejeita repetidos e tamanho errado", () => {
    expect(validarCnh("11111111111")).toMatch(/não existe/);
    expect(validarCnh("123")).toMatch(/11 dígitos/);
    expect(validarCnh("")).toMatch(/Informe/);
  });
});

describe("validarCategoriaCnh", () => {
  test("aceita D e E (as que a lei exige para escolar)", () => {
    expect(validarCategoriaCnh("D")).toBeNull();
    expect(validarCategoriaCnh("E")).toBeNull();
    expect(validarCategoriaCnh("ad")).toBeNull(); // combinada, minúscula
  });

  test("recusa categoria B explicando a lei", () => {
    const erro = validarCategoriaCnh("B");
    expect(erro).toMatch(/categoria D ou E/);
  });

  test("recusa categoria inexistente", () => {
    expect(validarCategoriaCnh("Z")).toMatch(/inválida/);
    expect(validarCategoriaCnh("")).toMatch(/Informe/);
  });
});

describe("validarPlaca", () => {
  test("aceita formato antigo e Mercosul", () => {
    expect(validarPlaca("ABC1234")).toBeNull();
    expect(validarPlaca("abc-1234")).toBeNull();
    expect(validarPlaca("ABC1D23")).toBeNull();
  });

  test("recusa formatos que não existem", () => {
    expect(validarPlaca("AB1234")).toMatch(/inválida/);
    expect(validarPlaca("ABCD123")).toMatch(/inválida/);
    expect(validarPlaca("")).toMatch(/Informe/);
  });

  test("formata a placa antiga com hífen e deixa a Mercosul intacta", () => {
    expect(formatarPlaca("abc1234")).toBe("ABC-1234");
    expect(formatarPlaca("abc1d23")).toBe("ABC1D23");
  });
});

describe("validarCelular", () => {
  test("aceita celular com DDD e 9 na frente", () => {
    expect(validarCelular("11961221800")).toBeNull();
    expect(validarCelular("(11) 96122-1800")).toBeNull();
  });

  test("recusa fixo (sem o 9) e DDD inválido", () => {
    expect(validarCelular("1132221800")).toMatch(/DDD \+ 9 dígitos/); // 10 dígitos
    expect(validarCelular("11812221800")).toMatch(/começar com 9/);
    expect(validarCelular("01961221800")).toMatch(/DDD inválido/);
  });

  test("formata para leitura humana", () => {
    expect(formatarCelular("11961221800")).toBe("(11) 96122-1800");
  });
});

describe("validarEmail e validarNomeCompleto", () => {
  test("email válido passa, inválido não", () => {
    expect(validarEmail("guilherme@email.com")).toBeNull();
    expect(validarEmail("sem-arroba")).toMatch(/inválido/);
    expect(validarEmail("")).toMatch(/Informe/);
  });

  test("nome exige sobrenome e recusa número", () => {
    expect(validarNomeCompleto("Guilherme Souza")).toBeNull();
    expect(validarNomeCompleto("Ana")).toMatch(/sobrenome|curto/);
    expect(validarNomeCompleto("Ana Silva 2")).toMatch(/números/);
  });
});

describe("calcularIdade", () => {
  test("conta certo antes e depois do aniversário no ano", () => {
    expect(calcularIdade("2000-01-10", HOJE)).toBe(26); // já fez
    expect(calcularIdade("2000-12-10", HOJE)).toBe(25); // ainda não fez
  });

  test("no dia exato do aniversário já conta o ano novo", () => {
    expect(calcularIdade("2000-07-16", HOJE)).toBe(26);
  });

  test("data inválida devolve null", () => {
    expect(calcularIdade("não é data", HOJE)).toBeNull();
  });
});

describe("validarNascimentoAluno", () => {
  test("aceita criança dentro da faixa escolar", () => {
    expect(validarNascimentoAluno("2015-05-20", HOJE)).toBeNull(); // 11 anos
  });

  test("borda: 17 anos passa, 18 não", () => {
    expect(validarNascimentoAluno("2009-01-01", HOJE)).toBeNull(); // 17
    expect(validarNascimentoAluno("2008-01-01", HOJE)).toMatch(/até 17 anos/); // 18
  });

  test("recusa data no futuro", () => {
    expect(validarNascimentoAluno("2030-01-01", HOJE)).toMatch(/futuro/);
  });
});

describe("validarNascimentoMotorista", () => {
  test("aceita motorista maior de 21", () => {
    expect(validarNascimentoMotorista("1990-03-10", HOJE)).toBeNull();
  });

  test("borda: 21 passa, 20 não (exigência do transporte escolar)", () => {
    expect(validarNascimentoMotorista("2005-01-01", HOJE)).toBeNull(); // 21
    expect(validarNascimentoMotorista("2006-01-01", HOJE)).toMatch(/21 anos ou mais/);
  });
});

describe("situacaoCnh", () => {
  test("CNH com folga: válida e sem aviso", () => {
    const s = situacaoCnh("2027-07-16", HOJE);
    expect(s.valida).toBe(true);
    expect(s.aviso).toBeNull();
  });

  test("vencendo em 30 dias: válida MAS avisa (o produto avisa antes de doer)", () => {
    const s = situacaoCnh("2026-08-10", HOJE);
    expect(s.valida).toBe(true);
    expect(s.aviso).toMatch(/vence em 25 dia/);
  });

  test("vencida: inválida e diz o que fazer", () => {
    const s = situacaoCnh("2026-01-01", HOJE);
    expect(s.valida).toBe(false);
    expect(s.aviso).toMatch(/vencida/);
    expect(s.diasRestantes).toBeLessThan(0);
  });
});

describe("validarCadastroMotorista", () => {
  const valido = {
    nome: "João da Silva",
    cpf: "52998224725",
    nascimento: "1990-03-10",
    celular: "11961221800",
    email: "joao@email.com",
    cnh: "98765432109",
    cnhCategoria: "D",
    cnhValidade: "2028-05-01",
    veiculoPlaca: "ABC1D23",
    veiculoModelo: "Sprinter",
    veiculoAno: 2020,
    veiculoLugares: 16,
  };

  test("cadastro completo e correto passa sem erros", () => {
    expect(semErros(validarCadastroMotorista(valido, HOJE))).toBe(true);
  });

  test("devolve TODOS os erros de uma vez (não um por vez)", () => {
    const erros = validarCadastroMotorista(
      { ...valido, cpf: "123", celular: "abc", veiculoPlaca: "XX" },
      HOJE
    );
    expect(Object.keys(erros).sort()).toEqual(["celular", "cpf", "veiculoPlaca"]);
  });

  test("CNH categoria B reprova o motorista (regra legal)", () => {
    const erros = validarCadastroMotorista({ ...valido, cnhCategoria: "B" }, HOJE);
    expect(erros.cnhCategoria).toMatch(/D ou E/);
  });

  test("CNH vencida reprova o cadastro", () => {
    const erros = validarCadastroMotorista({ ...valido, cnhValidade: "2020-01-01" }, HOJE);
    expect(erros.cnhValidade).toMatch(/vencida/);
  });

  test("veículo: ano e lugares fora da faixa reprovam", () => {
    const erros = validarCadastroMotorista(
      { ...valido, veiculoAno: 1980, veiculoLugares: 99 },
      HOJE
    );
    expect(erros.veiculoAno).toMatch(/Ano inválido/);
    expect(erros.veiculoLugares).toMatch(/lugares inválida/);
  });
});

describe("validarCadastroAluno", () => {
  const valido = {
    nome: "Ana Lima",
    nascimento: "2015-05-20",
    escolaNome: "E.E. Dom Pedro II",
    escolaEndereco: "Rua da Escola, 100",
    casaEndereco: "Rua Augusta, 900",
    responsavelNome: "Carla Lima",
    responsavelCelular: "11977772222",
    emergenciaNome: "Paula Lima",
    emergenciaCelular: "11988881111",
  };

  test("cadastro completo passa", () => {
    expect(semErros(validarCadastroAluno(valido, HOJE))).toBe(true);
  });

  test("exige contato de emergência DIFERENTE do responsável (é o plano B)", () => {
    const erros = validarCadastroAluno(
      { ...valido, emergenciaCelular: valido.responsavelCelular },
      HOJE
    );
    expect(erros.emergenciaCelular).toMatch(/diferente do responsável/);
  });

  test("endereços são obrigatórios (sem eles não há rota)", () => {
    const erros = validarCadastroAluno({ ...valido, casaEndereco: "", escolaEndereco: "" }, HOJE);
    expect(erros.casaEndereco).toBeDefined();
    expect(erros.escolaEndereco).toBeDefined();
  });

  test("criança fora da faixa etária reprova", () => {
    const erros = validarCadastroAluno({ ...valido, nascimento: "2000-01-01" }, HOJE);
    expect(erros.nascimento).toMatch(/até 17 anos/);
  });
});
