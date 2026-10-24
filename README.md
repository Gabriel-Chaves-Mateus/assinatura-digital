# Despesas · Módulo de Assinatura Digital

Trabalho N2 de Segurança da Informação. O **negócio hospedeiro** é um mini-SaaS de **reembolso de despesas**: o funcionário envia um relatório com recibos, o gerente valida, **assina digitalmente** e depois verifica a autenticidade das assinaturas emitidas.

## Como a assinatura funciona

```
Navegador do gerente (Web Crypto API)                    Servidor (Node crypto)
──────────────────────────────────────                   ──────────────────────
1. Gera par ECDSA P-256 (privada NÃO extraível,
   guardada no IndexedDB)  ── chave PÚBLICA ───────────▶ registra JWK + fingerprint
2. Confirma a senha ─────────────────────────────────▶ emite token de 2 min (step-up)
3.                         ◀── payload canônico ───────  monta JSON canônico da despesa
                               (dados + SHA-256 dos recibos + validação + signatário + hora)
4. sign(ECDSA, SHA-256, payload)
5. envia {payload, assinatura} ──────────────────────▶ confere: payload == estado atual,
                                                          assinatura válida p/ chave registrada,
                                                          grava Signature imutável + carimbo + IP
```

| Garantia | Como é obtida |
|---|---|
| **Autenticidade** | A assinatura só é válida para a chave pública do gerente, cuja privada nunca sai do navegador (não extraível). Assinar exige senha (reautenticação). |
| **Integridade** | O payload inclui valores, itens, hash SHA-256 de cada recibo e dados da validação. Qualquer alteração (inclusive direto no banco) invalida a verificação. |
| **Não repúdio** | Chave pública vinculada ao usuário, com *fingerprint*, data/hora do servidor, IP e user-agent; documento `Signature` imutável (hooks bloqueiam updates); exclusão de funcionário é lógica. |

### Enquadramento na legislação brasileira
* **MP 2.200-2/2001, art. 10 §2º**: admite assinaturas fora da ICP-Brasil quando as partes aceitam o meio.
* **Lei 14.063/2020, art. 4º**: a solução implementa os requisitos de **assinatura eletrônica avançada**: vínculo único ao signatário, uso de meio sob seu controle exclusivo, e detecção de alteração posterior.
* Não é assinatura **qualificada** (que exige certificado ICP-Brasil). Para atos que a lei obriga a ser qualificada, seria preciso integrar um certificado A1/A3 e uma AC credenciada.
* Dados pessoais tratados (nome, e-mail, IP) seguem o princípio da necessidade da **LGPD**.

## Requisitos do enunciado → onde estão

| Item | Entrega |
|---|---|
| 1. Docker com políticas de segurança | `docker-compose.yml`: `no-new-privileges`, `cap_drop: ALL`, `read_only`, `tmpfs`, limites de memória/PIDs, usuário não-root, portas em `127.0.0.1`, Mongo com `--auth` sem porta publicada |
| 2. Banco em nuvem | MongoDB Atlas via `MONGO_URI` (coleções `users`, `expenses`, `signatures`); Mongo local só como perfil opcional |
| 3. Frontend Next.js + MUI + Tailwind | `frontend/` (exportação estática, responsivo) |
| 4. Backend Node/Express + JWT | `backend/` (HS256 com algoritmo fixado, `aud` separado para acesso e assinatura) |
| 5. Chaves e assinatura | Web Crypto API no navegador (`frontend/lib/crypto.js`); Node `crypto` no servidor (`backend/src/utils/signing.js`) |
| 6. Segurança | Helmet, CSP, rate limit, bloqueio de conta, `express-mongo-sanitize` (NoSQL injection), validação com Zod, XSS (React escapa + CSP + `nosniff`), CSRF (token em header `Authorization`, sem cookie), bcrypt custo 12, validação de uploads por *magic bytes* |
| 6c. GitHub Pages com HTTPS | `.github/workflows/deploy.yml` (TLS fornecido pelo GitHub Pages) |
| 7. Páginas | `login`, `dashboard`, `employees`, `submitExpense`, `pendingExpenses`, `validateExpense`, `signExpense`, `signedExpenses`, `verifySignature` em `frontend/pages/` |
| Nodemailer | `backend/src/utils/mailer.js` (nova despesa → gerentes; decisão e assinatura → funcionário) |

**Observação sobre SQL injection:** o enunciado cita SQL, mas o banco é MongoDB. O risco equivalente é **NoSQL injection** (`{"$ne": ""}`), tratado com sanitização, Zod (tipos estritos) e validação de `ObjectId`. Há teste automatizado.

## Executando

### 1. Variáveis
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # cole em JWT_SECRET
```
Preencha `MONGO_URI` (Atlas) e, para o primeiro gerente, `SEED_MANAGER_PASSWORD`.

### 2. Com Docker
```bash
docker compose --profile local-db up --build      # sem --profile local-db se usar Atlas
docker compose exec backend node scripts/seed.js  # cria o primeiro gerente
```
Frontend: http://localhost:3000 · API: http://localhost:4000

### 3. Sem Docker
```bash
cd backend  && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

### 4. Fluxo de demonstração
1. Entre como **gerente** → Dashboard → *Gerar chave de assinatura*.
2. Em **Funcionários**, cadastre um funcionário.
3. Entre como funcionário → **Nova despesa** (anexe PDF/PNG/JPEG).
4. Como gerente → **Pendentes** → *Validar* → *Aprovar* → *Assinar* (confirma a senha).
5. **Assinadas** → *Verificar*: veja os 5 testes do servidor + a conferência independente no navegador.
6. Para demonstrar a **detecção de adulteração**, altere o `total` da despesa direto no banco e verifique de novo: "Integridade dos dados" falha.

## Publicação no GitHub Pages
1. Suba o repositório; em *Settings → Pages* escolha **GitHub Actions**.
2. Em *Settings → Variables*, crie `NEXT_PUBLIC_API_URL` com a URL HTTPS da API.
3. A **API não roda no GitHub Pages** (só hospeda estático): publique `backend/` em Render, Railway, Fly.io etc. (HTTPS incluso) e coloque a origem `https://SEU_USUARIO.github.io` em `CORS_ORIGINS`.
4. Cada push em `main` roda os testes do backend, faz o build e publica.

## Testes
```bash
cd backend && npm test
```
* `signing.test.js`: assinatura feita com WebCrypto verificada no Node; adulteração, outra chave e JWK inválido são rejeitados.
* `e2e.test.js`: fluxo completo da API (login, injeção NoSQL, RBAC, upload falso, segregação de funções, assinatura, adulteração do payload, dupla assinatura, verificação, imutabilidade). Usa `mongodb-memory-server`; ou defina `TEST_MONGO_URI` para usar um Mongo existente.

## Limitações conhecidas (para citar no relatório)
* A chave privada fica no navegador (IndexedDB); se o usuário limpar os dados do site, precisa gerar nova chave (as assinaturas antigas continuam verificáveis pelo snapshot da chave pública). Em produção real, o ideal seria token/HSM ou certificado ICP-Brasil.
* O carimbo de tempo é do servidor, não de uma Autoridade de Carimbo do Tempo (ACT) credenciada.
* O token JWT fica em `sessionStorage`; a mitigação de XSS depende de CSP e do escape do React. Uma alternativa seria cookie `HttpOnly` + proteção CSRF, mas exige API e frontend no mesmo site.
* A CSP do GitHub Pages vai via `<meta>`, sem `frame-ancestors`; no Docker/nginx o cabeçalho completo é aplicado.
