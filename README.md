# 🚐 RotaKids — sua van escolar, organizada

O RotaKids nasceu de um problema real: o "tio da van" perde tempo todo dia decidindo
a ordem de coleta das crianças, ligando para os pais para saber quem vai à escola e
anotando contatos em papelzinho. Este sistema automatiza tudo isso.

## 💡 Como funciona

**Para os pais (responsáveis):**
- Criam a conta e cadastram os filhos no próprio perfil: endereço de casa, escola,
  problemas de saúde (alergias, condições) e contato de emergência.
- O endereço digitado vira coordenada no mapa **automaticamente** (geocoding via
  Nominatim/OpenStreetMap) — ninguém precisa saber o que é latitude.
- Todo dia podem marcar se o filho **vai** ou **não vai** à escola. Falta **exige
  justificativa** — regra de negócio do sistema, não só um campo opcional.

**Para o motorista (tio da van):**
- Solicita vínculo com o aluno pelo email do responsável. O endereço da casa **só
  aparece depois que as duas partes confirmam** (o "contrato fechado") — privacidade
  das crianças em primeiro lugar.
- Vê o **mapa do dia**: cada aluno é um ponto 🟢 **verde** (vai à escola) ou 🔴
  **vermelho** (falta). Clicando no ponto vermelho, aparece a justificativa da falta;
  clicando em qualquer ponto, os contatos do responsável e os dados de saúde.
- Com um clique, calcula a **melhor rota**: partindo da posição atual da van (GPS),
  o sistema ordena os alunos (1º, 2º, 3º...) e termina na escola, desenhando o
  trajeto rua a rua no mapa.

## 🧠 O algoritmo de rota

A ordem de coleta usa a heurística do **vizinho mais próximo** sobre a distância de
**Haversine** (distância real na superfície da Terra). Para o tamanho de uma van
escolar (4 a 15 paradas) o resultado é ótimo ou quase ótimo, calculado em
milissegundos. O traçado rua a rua e o tempo estimado vêm da API pública do
**OSRM** (OpenStreetMap) — e se ela estiver fora do ar, o app segue funcionando
com a ordem de coleta e linhas retas no mapa (degradação graciosa).

## 🛠️ Stack

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| Front-end | **React 18 + Vite** (pasta `frontend/`) | O framework mais usado do mercado; componentes para pai e motorista |
| Back-end | Node.js + **TypeScript** + Express | Tipagem forte + o ecossistema mais usado do mercado para APIs |
| Banco | **PostgreSQL** | Relacionamentos claros (pais → alunos → vínculos → presenças) |
| Mapa | Leaflet + react-leaflet + OpenStreetMap | Grátis, sem chave de API |
| Rotas/Geocoding | OSRM + Nominatim | APIs públicas do OpenStreetMap |
| Autenticação | JWT + bcrypt | Padrão de mercado, senhas nunca em texto puro |
| Testes | Jest + ts-jest | Testes do algoritmo de rota e geocoding |

## 🚀 Como rodar

### Com Docker (recomendado — um comando)
```bash
docker compose up -d --build
# acesse http://localhost:3000
```
O PostgreSQL sobe junto e as tabelas são criadas automaticamente (`db/init.sql`).

### Manualmente (desenvolvimento)
```bash
# 1. suba um PostgreSQL e rode db/init.sql nele
# 2. copie .env.example para .env e ajuste a DATABASE_URL
npm install
npm run dev            # API em http://localhost:3000

# em outro terminal — o front React com recarga automática:
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxy para a API)
```

## 🧪 Testes

```bash
npm test               # back-end: rota, geocoding (Jest) — 14 testes
cd frontend && npm test  # front-end: sessão, validação, cores do mapa (Vitest) — 8 testes
```

## 🔌 API (resumo)

| Método | Rota | Quem usa | O que faz |
|--------|------|----------|-----------|
| POST | `/api/auth/cadastro` | todos | cria conta (pai ou motorista) |
| POST | `/api/auth/login` | todos | autentica e devolve o JWT |
| POST | `/api/alunos` | pai | cadastra filho (geocodifica endereços) |
| GET | `/api/alunos` | pai | lista filhos + presença de hoje |
| POST | `/api/alunos/:id/presenca` | pai | marca ida/falta (falta exige motivo) |
| POST | `/api/vinculos` | motorista | solicita vínculo com um aluno |
| GET | `/api/vinculos/pendentes` | pai | vê solicitações aguardando |
| POST | `/api/vinculos/:id/aceitar` | pai | fecha o contrato |
| GET | `/api/rota/alunos` | motorista | mapa do dia (pontos verdes/vermelhos) |
| GET | `/api/rota/melhor?lat=&lng=` | motorista | ordem de coleta + traçado OSRM |

## 📁 Estrutura

```
rotakids/
├── src/
│   ├── index.ts              # sobe o servidor
│   ├── app.ts                # montagem do Express (testável)
│   ├── db.ts                 # conexão PostgreSQL
│   ├── middleware/auth.ts    # JWT + controle por tipo de usuário
│   ├── routes/               # auth, alunos, vinculos, rotas
│   └── services/
│       ├── rota.ts           # Haversine + vizinho mais próximo + OSRM
│       └── geocode.ts        # endereço → coordenadas (Nominatim)
├── frontend/                 # React 18 + Vite (Login, PainelPai, PainelMotorista, MapaVan)
├── db/init.sql               # esquema do banco
├── tests/rota.test.ts        # testes unitários do back
├── Dockerfile                # build em 3 etapas (front + back + imagem final)
├── docker-compose.yml        # app + PostgreSQL
└── Jenkinsfile               # CI: deps → testes → build → imagem
```

## 🔒 Decisões de segurança

- Senhas com **bcrypt** (nunca em texto puro).
- Todas as consultas SQL **parametrizadas** (proteção contra SQL injection).
- Endereço da casa só visível ao motorista **após dupla confirmação**.
- Pai só altera presença **dos próprios filhos** (checagem de dono em toda rota).
