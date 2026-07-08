# Frame-sim — índice de contexto

Simulador empresarial (React 19 + Vite 6 + TypeScript) que testa frameworks de
gestão contra 350 personas sintéticas usando Multi-LLM (Gemini / GPT-4 /
DeepSeek / Ollama), RAG (ChromaDB) e modelos matemáticos determinísticos.

## Dois modos de execução

- **Standard**: 100% browser, chama `services/geminiService.ts` direto do
  frontend.
- **Agentic**: backend Express em `RAG/` (porta 3002), com orquestração
  multi-agente e RAG real. `App.tsx` faz `checkAgenticStatus` e cai para
  standard automaticamente se o backend estiver offline.

## Onde começar a ler

1. `App.tsx` — máquina de estados da aplicação (upload → config → simulating
   → results/batch), decide standard vs agentic.
2. `services/geminiService.ts` — engine de simulação do modo standard.
3. `RAG/src/agents/orchestrator.ts` — loop de turnos do modo agentic
   (Act → Critique → Replan).

## Mapa de módulos

- [architecture.md](./architecture.md) — resumo arquitetural + diagrama de dependências
- [conventions.md](./conventions.md) — convenções do projeto
- [modules/frontend.md](./modules/frontend.md) — App.tsx, components/, types.ts
- [modules/services.md](./modules/services.md) — camada de serviços do frontend (services/)
- [modules/rag-backend.md](./modules/rag-backend.md) — backend Express + agentes (RAG/src/)
- [modules/data.md](./modules/data.md) — fontes de dados (profiles.json, cost_profiles.json etc.)
- [modules/simulation-model.md](./modules/simulation-model.md) — modelo matemático determinístico

## Comandos

| Onde | Comando | O que faz |
|---|---|---|
| raiz | `npm run dev` | Vite dev server (frontend) |
| raiz | `npm run build` | Build de produção do frontend |
| `RAG/` | `npm run server` | Express na porta 3002 (modo agentic) |
| `RAG/` | `npm run index` | Indexa `profiles.json` etc. no ChromaDB |
| `RAG/` | `npm run dev` | CLI de simulação do backend |
| raiz | `graphify update .` | Atualiza o grafo de código em `graphify-out/` |

ChromaDB (opcional, porta 8000) precisa estar rodando para RAG real; se
ausente, os serviços do backend falham de forma "fail-open" (degradam, não
derrubam a simulação).

## Variáveis de ambiente

| Variável | Onde é lida | Uso |
|---|---|---|
| `VITE_API_KEY` .. `VITE_API_KEY7` | frontend (`import.meta.env`) | Pool de chaves Gemini, rotacionadas |
| `VITE_OPENAI_API_KEY` | frontend | Fallback GPT-4 |
| `VITE_DEEPSEEK_API_KEY` | frontend | Fallback DeepSeek |
| `GOOGLE_API_KEY` .. `GOOGLE_API_KEY_3` | backend (`process.env`) | Pool Gemini round-robin no RAG/ |
| `OPENAI_API_KEY` | backend | GPT-4 no RAG/ (também usado pelo CriticAgent) |
| `DEEPSEEK_API_KEY` | backend | Fallback DeepSeek no RAG/ |
| `OLLAMA_BASE_URL` | backend | Endpoint do Ollama (SmartRouter, classificação local) |
| `CHROMA_URL` | backend | Endpoint do ChromaDB (padrão local :8000) |

Chaves nunca são hardcoded; ver [conventions.md](./conventions.md).
