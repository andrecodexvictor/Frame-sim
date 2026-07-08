
# Frame-sim: Deep Enterprise Simulation Kernel v7.1

**Frame-sim** é um simulador empresarial avançado projetado para testar a implementação de frameworks de gestão e engenharia (Scrum, SAFe, Spotify, COBIT, ITIL...) em ambientes corporativos complexos.

Ao contrário de "quizzes" simples, o Frame-sim utiliza uma engine **Multi-LLM Agentic** (Gemini, GPT-4, DeepSeek, Ollama) combinada com **RAG (Retrieval-Augmented Generation via ChromaDB)**, **Agentes Autônomos** (CriticAgent, DocumentAgent) e **Modelos Matemáticos Determinísticos** para simular reações humanas, impactos financeiros (ROI) e culturais com alto grau de realismo.

<img width="1507" height="223" alt="image" src="https://github.com/user-attachments/assets/ccdfdca0-eef5-4771-938f-b9a6b34ca23a" />

---

## 🧠 Core Features

### 1. Simulação Multi-Agente & Persona Enrichment
Simula stakeholders reais e um time completo com base em **arquétipos estendidos**:
- **Key Stakeholders**: CEO, CTO, Tech Leads com perfis psicológicos profundos.
- **Distribuição Realista**: o restante do time (Júniors, Plenos, QA, RH) é gerado automaticamente com base no tamanho da empresa.
- **Enriquecimento RAG**: personas ganham nomes reais, histórias de fundo e vieses cognitivos extraídos de um banco de perfis (`RAG/profiles.json`).

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

### 🔧 Em implementação (v8): EmployeeBrain
Cada funcionário simulado passará a ter estado interno individual (estresse, humor, energia, memória) e tomará decisões humanas realistas — pedido de demissão, burnout, resistência passiva, contágio social — a partir das ~350 personas reais de `RAG/profiles.json` conectadas ao backend, com sentiment determinístico derivado do perfil.

---

## 🛠️ Tecnologias

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS.
- **Charts**: Recharts.
- **AI Core**: Google Gemini (via Google AI Studio), GPT-4, DeepSeek, Ollama (local).
- **RAG**: LangChain.js + ChromaDB (vetorização local), com Self-RAG e Hierarchical Retrieval.
- **Backend agentic**: Node/Express (`RAG/`), independente do frontend.

## 📦 Instalação e Uso

Frame-sim roda em **dois modos**, do mais simples ao mais completo. O frontend detecta automaticamente se o backend agentic está no ar e cai para o modo standard caso não esteja.

### Modo Standard (browser-only, sem backend)

O jeito mais rápido de rodar: só o frontend, chamando a API do Gemini direto do browser.

```bash
git clone https://github.com/andrecodexvictor/Frame-sim.git
cd Frame-sim
npm install
```

Crie um `.env` na raiz com pelo menos:
```env
VITE_API_KEY=sua_chave_api_do_gemini_aqui
```

```bash
npm run dev
```
Acesse `http://localhost:5173`. Sem chave configurada, o app cai em resultado mock.

### Modo Agentic (opcional, mais realista)

Sobe o backend Node em `RAG/` (Express, porta 3002), com CriticAgent, DocumentAgent, RAG e ChromaDB. É um projeto Node **independente**, com seu próprio `package.json`.

```bash
cd RAG
npm install
```

Crie um `RAG/.env` com pelo menos:
```env
GOOGLE_API_KEY=sua_chave_api_do_gemini_aqui
```

```bash
npm run server
```

Opcional: suba o ChromaDB na porta 8000 para RAG completo (busca por similaridade) e indexe os documentos de framework:
```bash
npm run index
```

Com o backend no ar, o frontend (rodando normalmente com `npm run dev` na raiz) passa a usar o modo agentic automaticamente.

## 🔑 Variáveis de Ambiente

### Raiz (`.env`) — modo standard
| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_KEY` | Sim | Chave Gemini principal |
| `VITE_API_KEY_2` .. `VITE_API_KEY_7` | Não | Rotação de chaves Gemini anti-rate-limit |
| `VITE_OPENAI_API_KEY` | Não | Fallback GPT-4 |
| `VITE_DEEPSEEK_API_KEY` | Não | Fallback DeepSeek |

### `RAG/.env` — modo agentic
| Variável | Obrigatória | Descrição |
|---|---|---|
| `GOOGLE_API_KEY` | Sim | Chave Gemini para o backend |
| `GOOGLE_API_KEY_2` / `_3` | Não | Rotação de chaves |
| `OPENAI_API_KEY` | Não | Fallback GPT-4 |
| `DEEPSEEK_API_KEY` | Não | Fallback DeepSeek |
| `OLLAMA_BASE_URL` | Não | Endpoint de um Ollama local |
| `CHROMA_DB_PATH` | Não | Path do ChromaDB local (default `./chroma_db`) |

## 🔧 Estrutura do Projeto

```
Frame-sim/
├── components/          # UI Components (Dashboard, Forms)
├── services/             # Lógica do frontend (Gemini, métricas, roteamento multi-LLM)
├── App.tsx               # Entry point React
├── types.ts               # Definições TypeScript compartilhadas
├── RAG/                  # Backend agentic Node/Express — projeto independente
│   ├── src/               # DocumentAgent, CriticAgent, server, chunking...
│   ├── profiles.json      # ~350 personas reais para enriquecimento
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

Diagramas completos (fluxo de dados, componentes, agentes) em [`ARCHITECTURE.md`](./ARCHITECTURE.md) e contexto detalhado para agentes de IA em [`.context/docs/index.md`](./.context/docs/index.md).

## 📜 Histórico de versões

| Versão | Destaques |
|---|---|
| v4 | SmartRouter multi-LLM, CriticAgent (auto-reflexão), memória de longo prazo via ChromaDB, viés cognitivo nas personas, ruído estocástico no ROI |
| v5 | Self-Improvement (warmup de auto-calibração), Agent Racing (personas concorrentes + ensemble), DocumentAgent desacoplado, Smart Chunking para documentos grandes (COBIT etc.), Intervalos de Confiança (IC 95%) no batch |
| v5.1 | Viés Responsivo por tipo de cenário, Surprise Factor (~15%), Framework-Organization Fit, range de ROI realista (-40% a +35%) |
| v7 | Self-RAG, Hierarchical Retrieval, recalibração do modelo determinístico de ROI (-40% a +35%) |

## 🤝 Contribuindo

Pull requests são bem-vindos. Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## 📄 Licença

[MIT](https://choosealicense.com/licenses/mit/)
