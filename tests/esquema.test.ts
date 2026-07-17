/**
 * Testes do ESQUEMA do banco, rodando num PostgreSQL em memória (pg-mem).
 *
 * Por que isto existe: sem Docker nesta máquina, o `init.sql` só seria
 * "verificado" por leitura — e a regra 3 diz que nada é pronto sem executar.
 * Aqui o esquema roda de verdade e as REGRAS que moram no banco (constraints)
 * são exercitadas: elas são a última linha de defesa do dado.
 *
 * Limite honesto: pg-mem não é o Postgres inteiro. Ele valida o esquema e as
 * constraints, mas o teste definitivo continua sendo o container real.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { newDb } from "pg-mem";

/** Sobe um banco limpo com o init.sql aplicado. */
function bancoNovo() {
  const db = newDb();
  const sql = readFileSync(join(__dirname, "..", "db", "init.sql"), "utf8");
  db.public.none(sql);
  return db;
}

const PAI = `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
             VALUES ('Carla Lima', 'carla@email.com', 'hash', 'pai', '52998224725', '1990-01-01', '11977772222')
             RETURNING id`;

describe("init.sql — o esquema sobe inteiro", () => {
  test("todas as tabelas do sistema são criadas", () => {
    const db = bancoNovo();
    const tabelas = db.public
      .many(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
      .map((t: any) => t.table_name)
      .sort();

    expect(tabelas).toEqual(
      [
        "alunos",
        "eventos",
        "motoristas",
        "presencas",
        "trajeto_alunos",
        "trajetos",
        "usuarios",
        "veiculos",
        "vinculos",
      ].sort()
    );
  });
});

describe("Regras que o BANCO cobra (última linha de defesa)", () => {
  test("email e CPF são únicos — uma pessoa, uma conta", () => {
    const db = bancoNovo();
    db.public.none(PAI);

    // mesmo email
    expect(() =>
      db.public.none(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
         VALUES ('Outro', 'carla@email.com', 'h', 'pai', '11144477735', '1990-01-01', '11999999999')`
      )
    ).toThrow();

    // mesmo CPF
    expect(() =>
      db.public.none(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
         VALUES ('Outro', 'outro@email.com', 'h', 'pai', '52998224725', '1990-01-01', '11999999999')`
      )
    ).toThrow();
  });

  test("tipo de conta só aceita pai ou motorista", () => {
    const db = bancoNovo();
    expect(() =>
      db.public.none(
        `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
         VALUES ('X', 'x@x.com', 'h', 'admin', '11144477735', '1990-01-01', '11999999999')`
      )
    ).toThrow();
  });

  test("CNH categoria B é REJEITADA pelo banco (transporte escolar exige D ou E)", () => {
    const db = bancoNovo();
    const id = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Joao', 'joao@email.com', 'h', 'motorista', '52998224725', '1990-01-01', '11961221800')
       RETURNING id`
    )[0].id;

    expect(() =>
      db.public.none(
        `INSERT INTO motoristas (usuario_id, cnh_numero, cnh_categoria, cnh_validade)
         VALUES (${id}, '98765432109', 'B', '2028-01-01')`
      )
    ).toThrow();

    // D passa
    db.public.none(
      `INSERT INTO motoristas (usuario_id, cnh_numero, cnh_categoria, cnh_validade)
       VALUES (${id}, '98765432109', 'D', '2028-01-01')`
    );
    expect(db.public.many(`SELECT * FROM motoristas`)).toHaveLength(1);
  });

  test("contato de emergência NÃO pode ser igual ao do responsável", () => {
    const db = bancoNovo();
    const paiId = db.public.many(PAI)[0].id;

    const inserirAluno = (emergenciaCelular: string) =>
      db.public.none(
        `INSERT INTO alunos (pai_id, nome, nascimento, casa_endereco, escola_nome, escola_endereco,
                             responsavel_nome, responsavel_celular, emergencia_nome, emergencia_celular)
         VALUES (${paiId}, 'Ana Lima', '2015-05-20', 'Rua A, 1', 'Escola', 'Rua B, 2',
                 'Carla Lima', '11977772222', 'Paula', '${emergenciaCelular}')`
      );

    expect(() => inserirAluno("11977772222")).toThrow(); // igual ao responsável
    inserirAluno("11988881111"); // diferente: passa
    expect(db.public.many(`SELECT * FROM alunos`)).toHaveLength(1);
  });

  test("falta sem justificativa é bloqueada pelo banco", () => {
    const db = bancoNovo();
    const paiId = db.public.many(PAI)[0].id;
    const alunoId = db.public.many(
      `INSERT INTO alunos (pai_id, nome, nascimento, casa_endereco, escola_nome, escola_endereco,
                           responsavel_nome, responsavel_celular, emergencia_nome, emergencia_celular)
       VALUES (${paiId}, 'Ana Lima', '2015-05-20', 'Rua A, 1', 'Escola', 'Rua B, 2',
               'Carla Lima', '11977772222', 'Paula', '11988881111')
       RETURNING id`
    )[0].id;

    // falta (vai = false) sem motivo: não entra
    expect(() =>
      db.public.none(`INSERT INTO presencas (aluno_id, vai) VALUES (${alunoId}, false)`)
    ).toThrow();

    // com motivo: entra
    db.public.none(
      `INSERT INTO presencas (aluno_id, vai, justificativa) VALUES (${alunoId}, false, 'Consulta médica')`
    );
    expect(db.public.many(`SELECT * FROM presencas`)).toHaveLength(1);
  });

  test("status do aluno no trajeto só aceita os estados do domínio", () => {
    const db = bancoNovo();
    const motoristaId = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Joao', 'joao@email.com', 'h', 'motorista', '52998224725', '1990-01-01', '11961221800')
       RETURNING id`
    )[0].id;
    const paiId = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Carla', 'c@email.com', 'h', 'pai', '11144477735', '1990-01-01', '11977772222')
       RETURNING id`
    )[0].id;
    const alunoId = db.public.many(
      `INSERT INTO alunos (pai_id, nome, nascimento, casa_endereco, escola_nome, escola_endereco,
                           responsavel_nome, responsavel_celular, emergencia_nome, emergencia_celular)
       VALUES (${paiId}, 'Ana Lima', '2015-05-20', 'Rua A, 1', 'Escola', 'Rua B, 2',
               'Carla', '11977772222', 'Paula', '11988881111')
       RETURNING id`
    )[0].id;
    const trajetoId = db.public.many(
      `INSERT INTO trajetos (motorista_id, fase) VALUES (${motoristaId}, 'ida') RETURNING id`
    )[0].id;

    // estado inventado: barrado
    expect(() =>
      db.public.none(
        `INSERT INTO trajeto_alunos (trajeto_id, aluno_id, status) VALUES (${trajetoId}, ${alunoId}, 'voando')`
      )
    ).toThrow();

    // estados do domínio: passam
    for (const status of ["vai", "falta", "na_van", "na_escola", "voltando", "em_casa"]) {
      db.public.none(`DELETE FROM trajeto_alunos`);
      db.public.none(
        `INSERT INTO trajeto_alunos (trajeto_id, aluno_id, status)
         VALUES (${trajetoId}, ${alunoId}, '${status}')`
      );
    }
    expect(db.public.many(`SELECT * FROM trajeto_alunos`)).toHaveLength(1);
  });

  test("fase do trajeto só aceita o ciclo ida → chamada → volta → encerrado", () => {
    const db = bancoNovo();
    const motoristaId = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Joao', 'joao@email.com', 'h', 'motorista', '52998224725', '1990-01-01', '11961221800')
       RETURNING id`
    )[0].id;

    expect(() =>
      db.public.none(`INSERT INTO trajetos (motorista_id, fase) VALUES (${motoristaId}, 'pausado')`)
    ).toThrow();

    for (const fase of ["ida", "chamada", "volta", "encerrado"]) {
      db.public.none(`DELETE FROM trajetos`);
      db.public.none(`INSERT INTO trajetos (motorista_id, fase) VALUES (${motoristaId}, '${fase}')`);
    }
    expect(db.public.many(`SELECT * FROM trajetos`)).toHaveLength(1);
  });

  test("veículo: ano e lugares fora da faixa são barrados", () => {
    const db = bancoNovo();
    const id = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Joao', 'joao@email.com', 'h', 'motorista', '52998224725', '1990-01-01', '11961221800')
       RETURNING id`
    )[0].id;
    db.public.none(
      `INSERT INTO motoristas (usuario_id, cnh_numero, cnh_categoria, cnh_validade)
       VALUES (${id}, '98765432109', 'D', '2028-01-01')`
    );

    expect(() =>
      db.public.none(
        `INSERT INTO veiculos (motorista_id, placa, modelo, ano, lugares)
         VALUES (${id}, 'ABC1D23', 'Sprinter', 1980, 16)`
      )
    ).toThrow();

    expect(() =>
      db.public.none(
        `INSERT INTO veiculos (motorista_id, placa, modelo, ano, lugares)
         VALUES (${id}, 'ABC1D23', 'Sprinter', 2020, 99)`
      )
    ).toThrow();

    db.public.none(
      `INSERT INTO veiculos (motorista_id, placa, modelo, ano, lugares)
       VALUES (${id}, 'ABC1D23', 'Sprinter', 2020, 16)`
    );
    expect(db.public.many(`SELECT * FROM veiculos`)).toHaveLength(1);
  });

  test("eventos: tipo desconhecido é barrado (o log é confiável por construção)", () => {
    const db = bancoNovo();
    const motoristaId = db.public.many(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, cpf, nascimento, celular)
       VALUES ('Joao', 'joao@email.com', 'h', 'motorista', '52998224725', '1990-01-01', '11961221800')
       RETURNING id`
    )[0].id;
    const trajetoId = db.public.many(
      `INSERT INTO trajetos (motorista_id) VALUES (${motoristaId}) RETURNING id`
    )[0].id;

    expect(() =>
      db.public.none(`INSERT INTO eventos (trajeto_id, tipo) VALUES (${trajetoId}, 'sei_la')`)
    ).toThrow();

    db.public.none(`INSERT INTO eventos (trajeto_id, tipo) VALUES (${trajetoId}, 'embarcou')`);
    expect(db.public.many(`SELECT * FROM eventos`)).toHaveLength(1);
  });
});
