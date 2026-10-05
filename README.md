
# FrameSIM v8.1.0: Enterprise Simulation Kernel

**Frame-sim** é um simulador empresarial avançado projetado para testar a implementação de frameworks de gestão e engenharia (Scrum, SAFe, Spotify, COBIT, ITIL...) em ambientes corporativos complexos.

Ao contrário de "quizzes" simples, o Frame-sim utiliza uma engine **Multi-LLM Agentic** (Gemini, GPT-4, DeepSeek, Ollama) combinada com **RAG (Retrieval-Augmented Generation via ChromaDB)**, **Agentes Autônomos** (CriticAgent, DocumentAgent) e **Modelos Matemáticos Determinísticos** para simular reações humanas, impactos financeiros (ROI) e culturais com variabilidade controlada.

<img width="1507" height="223" alt="image" src="https://github.com/user-attachments/assets/ccdfdca0-eef5-4771-938f-b9a6b34ca23a" />

---

## 🧠 Core Features

### 1. Simulação Multi-Agente & Persona Enrichment
Representa stakeholders e equipes sintéticos com base em **arquétipos estendidos**:
- **Key Stakeholders**: CEO, CTO, Tech Leads com perfis psicológicos profundos.
- **Distribuição Realista**: o restante do time (Júniors, Plenos, QA, RH) é gerado automaticamente com base no tamanho da empresa.
- **Enriquecimento RAG**: personas ganham nomes e histórias de fundo sintéticos, extraídos do catálogo de perfis (`RAG/profiles.json`).

### 2. Roteamento de Cenário Econômico
Perfis econômicos realistas calibram custos e ROI (Brasil: PME, Startup SP/RJ, Grande Empresa, Interior; Internacional: US Big Tech, LATAM Remoto, Europa Ocidental). Salários, custo de incidentes e valor por feature variam drasticamente conforme o perfil.

### 3. Engine Financeira Determinística + Estocástica
O LLM gera a narrativa e os dados brutos do cenário, mas **todos os números financeiros são recalculados por um modelo determinístico** — o LLM nunca inventa o ROI final:
- **Curva J**: queda natural de produtividade na adoção.
- **Dívida Técnica**: juros compostos sobre decisões ruins.
- **CoNQ (Cost of Non-Quality)**: custo financeiro de bugs e incidentes.
- **Surprise Factor (~15% de chance)**: adoções excepcionais em equipes com alta adaptação.
- **Framework-Organization Fit**: compatibilidade framework vs. porte/cultura da organização.
- **Viés Responsivo**: o range de ROI se ajusta ao cenário (crítico, típico ou favorável), produzindo resultados entre **-40% e +35%**.

### 4. Métricas de Negócio e Evolução
Painéis para eficiência, redução de retrabalho, agilidade, crescimento do time, contratações, turnover, promoções e break-even point.

### 5. Cenários Dinâmicos
Tamanho (Startups a Enterprises 2000+ FTEs), cultura ("Startup Caótica" vs "Corporação Fossilizada"), contexto (Fusão & Aquisição, IPO, Corte de Custos...) e contexto econômico (país/moeda/perfil salarial).

### 6. EmployeeBrain (v8): estado humano determinístico
- Estado interno por funcionário (estresse, humor, energia, engajamento, memória de 12 eventos, reflexão), derivado do perfil real e atualizado por turno com RNG semeado.
- Catálogo de decisões humanas determinísticas: pedido de demissão, burnout→licença (com recuperação de humor no retorno), resistência passiva, confronto com liderança, fofoca com contágio social, apoiar mudança, pedir ajuda.
- `moral_time`/`velocidade_sprint` do time e `sentiment` de cada persona vêm do agregado desse estado — o LLM só narra e ajusta a confiança (±5).
- As ~350 personas reais de `RAG/profiles.json` estão conectadas ponta a ponta: hidratadas no `/api/simulate` do backend e usadas pelo `EmployeeBrain`/`PersonaAgent`.
- `CriticAgent` roda 1x por simulação e sua `plausibility_score` chega ao frontend como `quality_per_cycle` (antes fixo em 100).

---

## 🛠️ Tecnologias

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS.
- **Charts**: Recharts.
- **AI Core**: Google Gemini (via Google AI Studio), GPT-4, DeepSeek, Ollama (local).
- **RAG**: adaptador direto do ChromaDB + embeddings Google opcionais, com roteamento Self-RAG determinístico e fail-open.
- **Backend agentic**: Node/Express (`RAG/`), independente do frontend.

## 📦 Instalação e Uso

Frame-sim roda em **dois modos**. O frontend detecta automaticamente se o backend agentic está pronto; sem ele, a interface permanece utilizável com o caminho offline/degradado. As credenciais dos provedores ficam exclusivamente no backend Node.

### Modo Standard (frontend, sem credenciais no browser)

O frontend pode ser iniciado sozinho para explorar a interface e os resultados offline/degradados. Chamadas a provedores passam pelo endpoint server-side `/api/generate`; sem backend ou provedor configurado, a simulação usa o fallback disponível.

```bash
git clone https://github.com/andrecodexvictor/Frame-sim.git
cd Frame-sim
npm install
```

```bash
npm run dev
```
Acesse `http://localhost:3000`. Para configurar apenas a URL do backend, copie `.env.example` para `.env` e ajuste `VITE_API_URL` se necessário. Não coloque chaves de API nesse arquivo.

### Modo Agentic (opcional, mais realista)

Sobe o backend Node em `RAG/` (Express, porta 3002), com CriticAgent, DocumentAgent, RAG e ChromaDB. É um projeto Node **independente**, com seu próprio `package.json`; as chaves dos provedores são lidas somente por esse processo.

```bash
cd RAG
npm install
```

Copie `RAG/.env.example` para `RAG/.env` e preencha as credenciais server-side necessárias:
```env
GOOGLE_API_KEY=sua_chave_api_do_gemini_aqui
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

```bash
npm run server
```

Opcional: suba o ChromaDB na porta 8000 para RAG completo (busca por similaridade) e indexe os documentos de framework:
```bash
npm run index
```

Com o backend no ar, o frontend (rodando com `npm run dev` na raiz) pode usar o modo agentic e o proxy de provedores. O backend expõe `GET /api/status`, `POST /api/generate`, `POST /api/simulate` e `POST /api/ingest`.

### Testes e build

Gate completo, na raiz:

```bash
npm run quality
```

O gate executa typecheck frontend/backend, testes offline, testes do roteador/gateway/grafo/racing, builds de produção e `npm audit` nos dois projetos. Para verificar a conectividade das credenciais configuradas sem imprimir seus valores:

```bash
npm run health:keys
```

Os testes isolados continuam disponíveis como `npm run test:offline`, `npm run test:keys` e `npm --prefix RAG test`.

## 🔑 Variáveis de Ambiente

### Raiz (`.env`) — frontend
| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Não | URL base do backend/proxy (default `http://localhost:3002/api`) |

`VITE_*` é incorporado ao bundle do navegador. Não coloque credenciais de Gemini, OpenAI ou DeepSeek no `.env` da raiz.

### `RAG/.env` — modo agentic
| Variável | Obrigatória | Descrição |
|---|---|---|
| `GOOGLE_API_KEY` | Sim | Chave Gemini para o backend |
| `GOOGLE_API_KEY_1` .. `_7` | Não | Rotação/failover de chaves Gemini adicionais |
| `OPENAI_API_KEY` | Não | Fallback GPT-4 |
| `DEEPSEEK_API_KEY` | Não | Fallback DeepSeek |
| `OLLAMA_BASE_URL` | Não | Endpoint de um Ollama local |
| `CHROMA_URL` | Não | URL do ChromaDB (default `http://localhost:8000`) |
| `CORS_ORIGINS` | Não | Origens permitidas pelo Express (default: Vite em `localhost:3000`) |

## 🔧 Estrutura do Projeto

```
Frame-sim/
├── components/          # UI Components (Dashboard, Forms)
├── services/             # Lógica do frontend (Gemini, métricas, roteamento multi-LLM)
├── App.tsx               # Entry point React
├── types.ts               # Definições TypeScript compartilhadas
├── RAG/                  # Backend agentic Node/Express — projeto independente
│   ├── src/               # DocumentAgent, CriticAgent, server, chunking...
│   ├── profiles.json      # ~350 perfis sintéticos para enriquecimento
│   └── package.json
├── data/                 # Dados estáticos de cenário/economia
├── legacy_v1/             # Versão antiga do simulador (referência histórica)
├── next_steps/            # Specs históricas de evolução do produto
├── architecture_images/   # Diagramas usados na documentação
├── graphify-out/           # Grafo do código gerado (ferramenta de análise)
├── .context/               # Contexto para agentes de IA (em construção)
├── documentacao.md         # Documentação técnica detalhada do RAG
└── roadmap.md              # Roadmap estratégico
```

## 🏗️ Arquitetura

Diagramas completos (fluxo de dados, componentes, agentes) em [`ARCHITECTURE.md`](./ARCHITECTURE.md) e [`DIAGRAMAS.md`](./DIAGRAMAS.md). O estado auditado das especificações históricas está em [`next_steps/completion_audit.md`](./next_steps/completion_audit.md). O contexto detalhado para agentes de IA está em [`.context/docs/index.md`](./.context/docs/index.md).

## 📜 Histórico de versões

| Versão | Destaques |
|---|---|
| v8.1.0 | Avaliações individuais rastreáveis, comparações pareadas, harness de evals offline/online, Jev tipado e exportações nativas de artigo com fluxogramas SVG/Mermaid/TikZ |
| v4 | SmartRouter multi-LLM, CriticAgent (auto-reflexão), memória de longo prazo via ChromaDB, viés cognitivo nas personas, ruído estocástico no ROI |
| v5 | Self-Improvement (warmup de auto-calibração), Agent Racing (personas concorrentes + ensemble), DocumentAgent desacoplado, Smart Chunking para documentos grandes (COBIT etc.), Intervalos de Confiança (IC 95%) no batch |
| v5.1 | Viés Responsivo por tipo de cenário, Surprise Factor (~15%), Framework-Organization Fit, range de ROI realista (-40% a +35%) |
| v7 | Self-RAG, Hierarchical Retrieval, recalibração do modelo determinístico de ROI (-40% a +35%) |
| v8.0 | EmployeeBrain (estado humano determinístico por funcionário), personas reais (350) conectadas ponta a ponta no backend, CriticAgent ativo no loop principal, modelos Gemini migrados para `gemini-2.5-flash`/`GEMINI_MODEL` |

## 🤝 Contribuindo

O desenvolvimento de avaliações rastreáveis está descrito na [especificação](next_steps/credible_evals_spec.md) e no [checkpoint de execução](.scratch/credible-evals/issues/03-implementation-checkpoint.md). Os dados das simulações são sintéticos; plausibilidade de um modelo não comprova desempenho observado.

Os painéis individual, comparativo e de lote oferecem exportação para artigo: pacote ZIP completo, fonte única `.tex`, snippets PGFPlots/TikZ/booktabs e dados. `metrics.json` registra os mesmos valores canônicos utilizados pelas medidas do painel. Valores ausentes permanecem ausentes; falhas e exclusões são registradas.

Na área de exportação, abra “Fluxograma da simulação e das avaliações” para ver etapas, decisões Sim/Não e caminhos de abstenção. O diagrama também acompanha o pacote em SVG, Mermaid e TikZ, a partir do mesmo grafo. `npm run export:flowchart` regenera as fontes de documentação em `next_steps/`.

Verificações adicionais: `npm run test:export`, `npm run test:article-compile`, `npm --prefix RAG run eval:offline` e `npm --prefix RAG run eval:online -- --dry-run`. O compilador de artigo pode registrar `unavailable`; isso não significa que o PDF foi verificado. Não instalar TeX como efeito colateral deste comando.

O online runner só executa inferência com `--execute`, orçamento explícito (`--budget-usd`, `--max-runs`, `--max-calls`, `--timeout-ms`, `--reservation-usd`) e `--pricing-file` com tetos de custo verificados por provedor/modelo. O modelo inicial está em `RAG/evals/pricing-template.json` e é deliberadamente inválido para execução. Limites adicionais: `--max-input-bytes` (48.000) e `--max-output-tokens` (512). Reservas não são um medidor de cobrança; custo real permanece indisponível. Jev usa resposta tipada de tamanho declarado na precificação, sem alegação de limite de tokens aplicado por sua API. Sem orçamento, usar dry-run. Credenciais ficam exclusivamente em `RAG/.env`.

O harness registra braços determinístico, Jev, cada juiz externo e pipeline completo para o mesmo candidato congelado, preservando discordâncias e falhas. O baseline extrativo executa sem inferência. A fixture `RAG/evals/fixtures/trace-replay-v1.json` permite replay das métricas a partir de traços persistidos: `npm --prefix RAG run eval:offline -- --dataset evals/fixtures/trace-replay-v1.json --output evals/results/trace-replay-v1.json`. O alvo é uma contagem contratual de aceites sintéticos, não um rótulo humano ou medida real.

Pull requests são bem-vindos. Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## 📄 Licença

[MIT](https://choosealicense.com/licenses/mit/)
