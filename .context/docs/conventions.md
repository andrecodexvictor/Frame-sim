# Convenções do projeto

- **Idioma**: prompts e conteúdo de simulação (narrativas, personas, textos
  gerados) em pt-BR. Código, identificadores, nomes de variáveis/funções em
  inglês.
- **Imports ESM no RAG/**: sufixo `.js` obrigatório nos imports relativos
  (`tsx` + `NodeNext` moduleResolution), mesmo importando de `.ts`.
- **Chaves de API sempre via env**: frontend usa `import.meta.env.VITE_*`,
  backend usa `process.env.*`. Nunca hardcodar chave em código. Chaves serão
  rotacionadas periodicamente — não assumir uma chave fixa.
- **Fallback obrigatório em toda cadeia LLM**: frontend Gemini → GPT-4 →
  DeepSeek → mock; backend fail-open no `CriticAgent` (se a checagem de
  plausibilidade falhar, deixa passar em vez de travar a simulação) e no
  ChromaDB (indisponível → degrada, não derruba).
- **Estado de simulação clampado**: métricas de estado (moral, velocidade,
  confiança etc.) sempre 0–100, clamp aplicado nas funções de atualização.
- **ROI nunca vem do LLM**: é sempre calculado deterministicamente por
  `metricsCalculator.ts` / `roiCalculator.ts`. Ver
  [modules/simulation-model.md](./modules/simulation-model.md).
- **Não mudar padrões de design de UI existentes** sem necessidade explícita.
- **graphify-out/ é gerado** — não editar manualmente; rodar
  `graphify update .` após mudanças relevantes de código.
- **`.context/` não substitui `README.md` / `ARCHITECTURE.md`**: é contexto
  denso para agentes de IA, não documentação para humanos.
