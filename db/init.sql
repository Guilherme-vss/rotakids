-- =========================================================
-- RotaKids — esquema do banco (PostgreSQL)
-- Executado automaticamente na primeira subida do container.
-- =========================================================

-- Usuários: pais (cadastram os filhos) e motoristas (donos da van)
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL UNIQUE,
    senha_hash  VARCHAR(200) NOT NULL,
    tipo        VARCHAR(10)  NOT NULL CHECK (tipo IN ('pai', 'motorista')),
    telefone    VARCHAR(20),
    criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Alunos: cadastrados pelos pais, com casa, escola e dados de saúde
CREATE TABLE IF NOT EXISTS alunos (
    id                 SERIAL PRIMARY KEY,
    pai_id             INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome               VARCHAR(120) NOT NULL,
    avatar             VARCHAR(8) DEFAULT '🧒',  -- emoji escolhido pela criança

    casa_endereco      TEXT NOT NULL,
    casa_lat           DOUBLE PRECISION,
    casa_lng           DOUBLE PRECISION,
    escola_nome        VARCHAR(160) NOT NULL,
    escola_endereco    TEXT NOT NULL,
    escola_lat         DOUBLE PRECISION,
    escola_lng         DOUBLE PRECISION,
    problema_saude     TEXT,          -- alergias, condições, etc. (opcional)
    contato_emergencia VARCHAR(160),  -- nome + telefone de um parente
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo aluno ↔ motorista ("contrato"): o motorista só vê o endereço
-- da casa depois que AS DUAS partes confirmam.
CREATE TABLE IF NOT EXISTS vinculos (
    id                 SERIAL PRIMARY KEY,
    aluno_id           INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    motorista_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    aceito_pai         BOOLEAN NOT NULL DEFAULT FALSE,
    aceito_motorista   BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (aluno_id, motorista_id)
);

-- Presença do dia: se não houver registro, o aluno VAI à escola (ponto verde).
-- Registro com vai = FALSE exige justificativa (ponto vermelho no mapa).
CREATE TABLE IF NOT EXISTS presencas (
    id            SERIAL PRIMARY KEY,
    aluno_id      INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    data          DATE    NOT NULL DEFAULT CURRENT_DATE,
    vai           BOOLEAN NOT NULL DEFAULT TRUE,
    justificativa TEXT,
    UNIQUE (aluno_id, data)
);

CREATE INDEX IF NOT EXISTS idx_alunos_pai       ON alunos(pai_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_mot     ON vinculos(motorista_id);
CREATE INDEX IF NOT EXISTS idx_presencas_data   ON presencas(data);
