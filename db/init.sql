-- =========================================================
-- RotaKids — esquema do banco (PostgreSQL)
-- Executado automaticamente na primeira subida do container.
--
-- Duas decisões que valem explicar (regra 2 — banco é decisão, não hábito):
--
-- 1. PostgreSQL e não NoSQL: aqui TUDO é relação de verdade
--    (pai → alunos → vínculos → trajetos → eventos). Integridade referencial
--    não é luxo quando o dado é "qual criança está em qual van agora".
--
-- 2. A tabela `eventos` é um log APPEND-ONLY (só insere, nunca altera).
--    É ela que responde "que horas minha filha embarcou?" — e é ela que
--    transforma o app em algo confiável. Estado se sobrescreve; história, não.
-- =========================================================

-- ---------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------

-- Conta: pais (cadastram os filhos) e motoristas (donos da van).
-- CPF é único: uma pessoa, uma conta — não existe motorista duplicado.
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL UNIQUE,
    senha_hash  VARCHAR(200) NOT NULL,
    tipo        VARCHAR(10)  NOT NULL CHECK (tipo IN ('pai', 'motorista')),
    cpf         VARCHAR(11)  NOT NULL UNIQUE,   -- só dígitos; validado no domínio
    nascimento  DATE         NOT NULL,
    celular     VARCHAR(11)  NOT NULL,          -- só dígitos (DDD + 9 dígitos)
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Dados que SÓ o motorista tem. Separado de `usuarios` porque um pai não
-- tem CNH — coluna que nunca se preenche é cheiro de modelagem preguiçosa.
CREATE TABLE IF NOT EXISTS motoristas (
    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    cnh_numero     VARCHAR(11) NOT NULL UNIQUE,
    -- A lei exige D ou E para transporte escolar. O banco também cobra:
    -- validação no domínio protege o fluxo; a constraint protege o dado.
    cnh_categoria  VARCHAR(2)  NOT NULL CHECK (cnh_categoria IN ('D', 'E', 'AD', 'AE')),
    cnh_validade   DATE        NOT NULL,
    aprovado_em    TIMESTAMPTZ,   -- reservado: futura conferência de documentos
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A van. Tabela própria porque um motorista pode trocar de veículo
-- (e a placa velha precisa continuar no histórico dos trajetos).
CREATE TABLE IF NOT EXISTS veiculos (
    id            SERIAL PRIMARY KEY,
    motorista_id  INTEGER NOT NULL REFERENCES motoristas(usuario_id) ON DELETE CASCADE,
    placa         VARCHAR(8)   NOT NULL,   -- ABC1234 ou ABC1D23 (sem hífen)
    modelo        VARCHAR(80)  NOT NULL,
    ano           INTEGER      NOT NULL CHECK (ano BETWEEN 1990 AND 2100),
    lugares       INTEGER      NOT NULL CHECK (lugares BETWEEN 4 AND 30),
    ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Placa é única entre os veículos EM USO. Um veículo desativado pode ter a
-- mesma placa de um novo registro (troca de dono, recadastro).
CREATE UNIQUE INDEX IF NOT EXISTS idx_veiculo_placa_ativa
    ON veiculos(placa) WHERE ativo;

-- ---------------------------------------------------------
-- Alunos
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS alunos (
    id                 SERIAL PRIMARY KEY,
    pai_id             INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome               VARCHAR(120) NOT NULL,
    avatar             VARCHAR(8) DEFAULT '🧒',   -- emoji escolhido pela criança
    nascimento         DATE NOT NULL,             -- faixa 1–17 validada no domínio

    casa_endereco      TEXT NOT NULL,
    casa_lat           DOUBLE PRECISION,
    casa_lng           DOUBLE PRECISION,
    escola_nome        VARCHAR(160) NOT NULL,
    escola_endereco    TEXT NOT NULL,
    escola_lat         DOUBLE PRECISION,
    escola_lng         DOUBLE PRECISION,

    problema_saude     TEXT,   -- alergias, condições (opcional, mas vital quando existe)

    -- Contato: o responsável e o PLANO B. Os dois são obrigatórios —
    -- se o pai não atender, alguém precisa atender.
    responsavel_nome     VARCHAR(120) NOT NULL,
    responsavel_celular  VARCHAR(11)  NOT NULL,
    emergencia_nome      VARCHAR(120) NOT NULL,
    emergencia_celular   VARCHAR(11)  NOT NULL,
    CONSTRAINT emergencia_diferente CHECK (emergencia_celular <> responsavel_celular),

    -- Criança pequena não desce sozinha: precisa de alguém esperando na porta.
    autorizado_descer_sozinho BOOLEAN NOT NULL DEFAULT FALSE,

    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo aluno ↔ motorista ("contrato"): o motorista só vê o endereço
-- da casa depois que AS DUAS partes confirmam. Privacidade da criança primeiro.
CREATE TABLE IF NOT EXISTS vinculos (
    id                 SERIAL PRIMARY KEY,
    aluno_id           INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    motorista_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    aceito_pai         BOOLEAN NOT NULL DEFAULT FALSE,
    aceito_motorista   BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (aluno_id, motorista_id)
);

-- Presença do dia: sem registro, o aluno VAI (ponto verde).
-- Registro com vai = FALSE exige justificativa — e o banco cobra isso.
CREATE TABLE IF NOT EXISTS presencas (
    id            SERIAL PRIMARY KEY,
    aluno_id      INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    data          DATE    NOT NULL DEFAULT CURRENT_DATE,
    vai           BOOLEAN NOT NULL DEFAULT TRUE,
    justificativa TEXT,
    CONSTRAINT falta_precisa_de_motivo CHECK (vai OR justificativa IS NOT NULL),
    UNIQUE (aluno_id, data)
);

-- ---------------------------------------------------------
-- O dia da van
-- ---------------------------------------------------------

-- Um trajeto = um dia de um motorista. A `fase` percorre o ciclo
-- ida → chamada → volta → encerrado (a máquina de estados do domínio).
CREATE TABLE IF NOT EXISTS trajetos (
    id            SERIAL PRIMARY KEY,
    motorista_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    veiculo_id    INTEGER REFERENCES veiculos(id),
    data          DATE NOT NULL DEFAULT CURRENT_DATE,
    fase          VARCHAR(12) NOT NULL DEFAULT 'ida'
                  CHECK (fase IN ('ida', 'chamada', 'volta', 'encerrado')),
    escola_nome   VARCHAR(160),
    escola_lat    DOUBLE PRECISION,
    escola_lng    DOUBLE PRECISION,
    -- Última posição conhecida da van: é o que o pai vê no mapa.
    van_lat       DOUBLE PRECISION,
    van_lng       DOUBLE PRECISION,
    van_em        TIMESTAMPTZ,
    iniciado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    encerrado_em  TIMESTAMPTZ,
    -- Um motorista tem UM trajeto por dia. Sem isso, um clique duplo
    -- criaria dois dias paralelos e o pai veria a van em dois lugares.
    UNIQUE (motorista_id, data)
);

-- O estado de cada criança dentro do trajeto do dia.
CREATE TABLE IF NOT EXISTS trajeto_alunos (
    id            SERIAL PRIMARY KEY,
    trajeto_id    INTEGER NOT NULL REFERENCES trajetos(id) ON DELETE CASCADE,
    aluno_id      INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    status        VARCHAR(16) NOT NULL
                  CHECK (status IN ('vai', 'falta', 'na_van', 'na_escola',
                                    'volta_ausente', 'voltando', 'em_casa')),
    justificativa TEXT,
    embarcado_em  TIMESTAMPTZ,
    entregue_em   TIMESTAMPTZ,
    UNIQUE (trajeto_id, aluno_id)
);

-- ---------------------------------------------------------
-- Auditoria — o coração da confiança
-- ---------------------------------------------------------

-- Log APPEND-ONLY: nunca se altera, nunca se apaga.
-- É o que responde ao pai "que horas minha filha embarcou?" e o que protege
-- o motorista ("entreguei às 17:38, está registrado"). Se um dia houver
-- dúvida ou incidente, é aqui que está a verdade.
CREATE TABLE IF NOT EXISTS eventos (
    id          BIGSERIAL PRIMARY KEY,
    trajeto_id  INTEGER NOT NULL REFERENCES trajetos(id) ON DELETE CASCADE,
    aluno_id    INTEGER REFERENCES alunos(id) ON DELETE SET NULL,
    tipo        VARCHAR(24) NOT NULL
                CHECK (tipo IN ('ida_iniciada', 'embarcou', 'chegou_escola',
                                'chamada_presente', 'chamada_ausente',
                                'volta_iniciada', 'entregue_em_casa', 'encerrado')),
    detalhe     TEXT,
    lat         DOUBLE PRECISION,   -- onde a van estava quando aconteceu
    lng         DOUBLE PRECISION,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Índices — onde há busca, há índice
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_alunos_pai        ON alunos(pai_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_mot      ON vinculos(motorista_id);
CREATE INDEX IF NOT EXISTS idx_presencas_data    ON presencas(data);
CREATE INDEX IF NOT EXISTS idx_veiculos_mot      ON veiculos(motorista_id);
CREATE INDEX IF NOT EXISTS idx_trajetos_mot_data ON trajetos(motorista_id, data);
CREATE INDEX IF NOT EXISTS idx_traj_alunos_traj  ON trajeto_alunos(trajeto_id);
-- O pai abre a linha do tempo do filho: essa é a consulta mais quente do app.
CREATE INDEX IF NOT EXISTS idx_eventos_aluno     ON eventos(aluno_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_trajeto   ON eventos(trajeto_id, ocorrido_em);
