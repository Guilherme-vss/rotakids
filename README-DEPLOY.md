# 🚀 Colocar o RotaKids ao vivo

Dois passos independentes: o **trânsito no mapa** (TomTom) e o **backend ao vivo**
(Render). Cada um funciona sozinho — faça um, os dois, ou nenhum (a demo com o
motor local continua no ar de qualquer jeito).

---

## 🚦 Parte 1 — Trânsito no mapa (TomTom)

1. No painel do TomTom, copie sua **API Key**.
2. **Restrinja a chave** (passo de segurança — não pule): na Key → *Domain
   restriction* → adicione `localhost` e `guilherme-vss.github.io`. Assim, mesmo
   visível no navegador (toda chave de mapa é), ela só funciona nos SEUS sites.
3. Em `rotakids/frontend/public/`, copie `config.local.js.exemplo` para
   **`config.local.js`** e cole a chave em `window.__TOMTOM_KEY__`.
   > Esse arquivo é ignorado pelo Git — sua chave nunca vai para o GitHub.
4. Rode `npm run dev` na pasta `frontend` e abra o painel do motorista: o mapa
   agora tem a camada de trânsito (verde = fluindo, vermelho = parado).

Para publicar com o trânsito, me avise que eu injeto o `config.local.js` no
deploy do GitHub Pages (a chave entra só no site publicado, nunca no repositório).

---

## ☁️ Parte 2 — Backend ao vivo (Render)

Isto liga o **rastreamento entre dispositivos**: o pai vê, no celular dele, a van
que o motorista está dirigindo no aparelho dele — algo que o motor local (preso a
um navegador) não faz.

### Deploy (uma vez)

1. No [Render](https://dashboard.render.com) → **New** → **Blueprint**.
2. Conecte o repositório **Guilherme-vss/rotakids**.
3. O Render lê o [`render.yaml`](render.yaml) e mostra o que vai criar:
   - **rotakids-api** (web service Node)
   - **rotakids-db** (PostgreSQL free)
4. Clique em **Apply**. Em alguns minutos ele:
   - cria o banco e injeta a `DATABASE_URL` no backend sozinho;
   - roda `npm install && npm run build` e sobe `node dist/index.js`;
   - o backend cria as tabelas no primeiro boot (não precisa migração manual).
5. Copie a URL que o Render deu (ex.: `https://rotakids-api.onrender.com`) e
   confira: abrir `.../api/saude` deve responder `{"ok":true}`.

### Ligar o front ao backend

No `config.local.js` (o mesmo da Parte 1), preencha:
```js
window.__API_URL__ = "https://rotakids-api.onrender.com";
```
Ou, para testar rápido sem editar arquivo, abra o site com `?api=` na URL:
`https://guilherme-vss.github.io/rotakids/?api=https://rotakids-api.onrender.com`

### ⚠️ O que esperar do plano free

- O serviço **hiberna** após ~15 min sem uso e leva **~50s para acordar** na
  próxima visita (cold start). Por isso a demo padrão continua usando o motor
  local (instantâneo) — o backend é para mostrar o ao vivo quando você quiser.
- O banco free do Render expira em ~90 dias; é recriável pelo mesmo Blueprint.

---

## 🔒 Resumo de segurança

| Segredo | Onde fica | Vai para o Git? |
|---------|-----------|-----------------|
| Chave TomTom | `config.local.js` (front) | ❌ gitignorado |
| URL do backend | `config.local.js` (front) | ❌ gitignorado |
| `JWT_SECRET` | painel do Render (`generateValue`) | ❌ nunca versionado |
| `DATABASE_URL` | injetada pelo Render | ❌ nunca versionada |
