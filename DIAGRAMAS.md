# Frame-sim — Diagramas de Arquitetura (mermaid)

> Compêndio visual do sistema. As explicações detalhadas de cada fluxo estão em [ARCHITECTURE.md](ARCHITECTURE.md); o relatório da reforma v8 está em [progress.md](progress.md). O grafo navegável do código (806 nós) está em `graphify-out/graph.html`.

## Índice

1. [Arquitetura completa (visão consolidada)](#1-arquitetura-completa)
2. [Visão geral dos dois modos](#2-visão-geral-dos-dois-modos)
3. [Fluxo Standard (browser-only)](#3-fluxo-standard)
4. [Fluxo Agentic (backend multi-turno)](#4-fluxo-agentic)
5. [Pipeline RAG (indexação e retrieval)](#5-pipeline-rag)
6. [Ingestão de documentos do usuário](#6-ingestão-de-documentos)
7. [Cascata de fallback Multi-LLM (frontend)](#7-cascata-de-fallback-multi-llm)
8. [SmartRouter (roteamento por intenção)](#8-smartrouter)
9. [EmployeeBrain — ciclo de vida do funcionário](#9-employeebrain--ciclo-de-vida)

---

## 1. Arquitetura completa

Todos os módulos e como se conectam — frontend, backend agêntico, EmployeeBrain, dados e serviços externos.

```mermaid
graph TB
    subgraph Browser["Frontend (React 19 + Vite)"]
        APP["App.tsx<br/>máquina de estados<br/>upload → config → simulating → results"]
        CFG["ConfigForm<br/>17 arquétipos corporativos"]
        DASH["Dashboard<br/>keyPersonas, ROI, timeline, emergentEvents"]
        AGSVC["agenticService.ts<br/>cliente HTTP :3002 + fallback legacy"]
        GEM["geminiService.ts<br/>engine standard<br/>rotação 7 chaves VITE_API_KEY"]
        ENR["personaEnricher.ts<br/>arquétipos → personas reais"]
        METR["metricsCalculator.ts<br/>ROI determinístico: Curva J,<br/>dívida técnica, CoNQ, SurpriseFactor, Fit"]
        RAGS["ragService.ts<br/>pseudo-RAG few-shot + cenários responsivos"]
        BATCH["batchService.ts<br/>Monte Carlo + Warmup + Racing"]
    end

    subgraph Data["Dados"]
        PROF["RAG/profiles.json<br/>350 personas ricas (fonte da verdade)"]
        COMPACT["data/profiles_compact.json<br/>GERADO: npm run build:profiles"]
        EXAMPLES["data/archetype_examples.json<br/>few-shots (fonte única)"]
        COSTS["data/cost_profiles.json"]
    end

    subgraph RAGSrv["Backend Agêntico (RAG/ - Express :3002)"]
        SRV["server.ts<br/>/api/status | /api/simulate | /api/ingest<br/>hidrata 350 personas por id"]
        ORCH["OrchestratorAgent<br/>loop de turnos<br/>commit determinístico via aggregate()"]
        PA["PersonaAgent<br/>voz do stakeholder<br/>estado interno no prompt + viés do perfil"]
        CRITIC["CriticAgent<br/>1 critique/simulação<br/>plausibility_score (fail-open)"]
        GOAL["GoalAgent<br/>dificuldade dinâmica a cada 3 turnos"]
        ROI["ROICalculatorAgent<br/>ROI determinístico + eventos"]
        DOCA["DocumentAgent<br/>digest + SmartChunker"]
        SR["SmartRouter<br/>Ollama classifica intenção → roteia LLM"]
        LLMP["LLMProvider<br/>geminiModel() = env GEMINI_MODEL<br/>round-robin GOOGLE_API_KEY 1-3"]
    end

    subgraph Brain["EmployeeBrain (RAG/src/core - puro, zero deps)"]
        CORE["employeeBrainCore.ts<br/>estresse | humor | energia | engajamento<br/>memória 12 eventos + reflexão<br/>RNG semeado (mulberry32)"]
        DEC["Catálogo de decisões humanas<br/>pedido_demissao | burnout→licença<br/>resistencia_passiva | confronto_lideranca<br/>fofoca (contágio social) | champion | pedir_ajuda"]
        AGG["aggregate()<br/>moral, velocidadeMod,<br/>sentiment por persona"]
        OFF["simulateTeamOffline()<br/>modo standard: zero LLM"]
    end

    subgraph External["Serviços externos"]
        GEMINI["Google Gemini 2.5<br/>flash / pro"]
        GPT["OpenAI GPT-4"]
        DS["DeepSeek"]
        OLL["Ollama local (llama3)"]
        CHROMA["ChromaDB :8000<br/>collections: profiles, metrics, events,<br/>playbooks, history, user_frameworks<br/>(fail-open se offline)"]
    end

    APP --> CFG
    APP --> DASH
    APP -->|"modo agentic"| AGSVC
    APP -->|"modo standard"| GEM
    AGSVC -->|"POST /api/simulate<br/>stakeholders [{id}] + teamSample"| SRV
    AGSVC -->|"2ª passada: contexto agêntico<br/>+ tabela de brains + eventos_rh"| GEM
    GEM --> ENR
    GEM --> RAGS
    GEM --> METR
    GEM -->|"pré-LLM"| OFF
    GEM --> GEMINI
    GEM -.->|"fallback"| GPT
    GEM -.->|"fallback"| DS
    ENR --> COMPACT
    RAGS --> EXAMPLES
    METR --> COSTS
    BATCH --> GEM

    SRV --> PROF
    SRV --> ORCH
    SRV -.->|"fail-open"| CHROMA
    ORCH --> PA
    ORCH --> GOAL
    ORCH --> ROI
    ORCH --> CRITIC
    ORCH --> SR
    ORCH -->|"1 brain por funcionário<br/>updateBrain a cada turno"| CORE
    CORE --> DEC
    DEC -->|"eventos_rh + contágio"| CORE
    CORE --> AGG
    AGG -->|"moral_time, velocidade_sprint<br/>(commit determinístico)"| ORCH
    PA --> EXAMPLES
    PA --> LLMP
    SR --> OLL
    SR --> LLMP
    LLMP --> GEMINI
    LLMP --> GPT
    LLMP --> DS
    DOCA --> CHROMA
    SRV --> DOCA

    COMPACT -->|"npm run build:profiles"| PROF
```

**Invariante central:** o LLM nunca decide números. ROI vem de `metricsCalculator.ts` / `roiCalculator.ts`; moral/velocidade vêm de `aggregate()` dos brains; `keyPersonas.sentiment` = `(humor+100)/2`.

---

## 2. Visão geral dos dois modos

Decisão standard vs agentic e o caminho de cada um ([ARCHITECTURE.md §1](ARCHITECTURE.md)).

```mermaid
graph TD
    User["Usuário"] --> Upload["UploadSection<br/>upload do framework"]
    Upload --> Config["ConfigForm<br/>define simulationMode"]
    Config -->|"simulationMode = standard"| Standard["services/geminiService.ts<br/>runSimulation()"]
    Config -->|"simulationMode = agentic"| Agentic["services/agenticService.ts<br/>runAgenticSimulation()"]

    Agentic -->|"POST /api/simulate"| Server["RAG/src/server.ts<br/>:3002"]
    Server --> Orchestrator["OrchestratorAgent<br/>runSimulation() por turnos"]

    Orchestrator --> PersonaAgent["PersonaAgent<br/>gemini-2.5-flash (GEMINI_MODEL)"]
    Orchestrator --> Brain["EmployeeBrain<br/>estado determinístico por funcionário"]
    Orchestrator --> SmartRouter["SmartRouter<br/>classifica intenção"]
    Orchestrator --> GoalAgent["GoalAgent<br/>a cada 3 turnos"]
    Orchestrator --> ROICalc["ROICalculatorAgent<br/>projeção financeira"]
    Orchestrator --> Critic["CriticAgent<br/>1x por simulação"]

    SmartRouter -->|"COMPLEX_REASONING"| GPT4["GPT-4"]
    SmartRouter -->|"CREATIVE_GENERATION"| GeminiW["Gemini"]
    SmartRouter -->|"SIMPLE_VALIDATION"| DeepSeek["DeepSeek"]
    SmartRouter -->|"classificação de intenção"| Ollama["Ollama llama3<br/>localhost:11434"]

    Orchestrator -.->|"fail-open: conecta se ChromaDB estiver de pé"| VectorStore["VectorStoreService<br/>ChromaDB :8000"]

    Server -->|"state + roi"| Agentic
    Agentic -->|"2ª chamada, injeta state como texto"| Standard
    Standard --> Dashboard["Dashboard / ComparisonDashboard"]

    Standard -->|"fallback em cascata"| Fallback["GPT-4 → DeepSeek → Mock"]

    style Agentic fill:#4a5568,color:#fff
    style Standard fill:#2b6cb0,color:#fff
    style VectorStore stroke-dasharray: 5 5
```

---

## 3. Fluxo Standard

Simulação 100% no browser: enriquecimento de personas → EmployeeBrain offline → prompt → LLM → pós-processamento determinístico ([ARCHITECTURE.md §2](ARCHITECTURE.md)).

```mermaid
sequenceDiagram
    actor Usuário
    participant App as App.tsx
    participant Gemini as geminiService.runSimulation
    participant Enricher as personaEnricher
    participant RAG as ragService
    participant Metrics as metricsCalculator
    participant API as Gemini API<br/>gemini-2.5-flash

    Usuário->>App: handleConfigSubmit(config)
    App->>Gemini: runSimulation(singleConfig)

    Gemini->>Enricher: enrichArchetypesToTeam(archetypes, companySize)
    Enricher-->>Gemini: team, keyStakeholders, archetypeDistribution
    Gemini->>Enricher: generateTeamDescription / calculateTeamResistance

    Gemini->>Gemini: simulateTeamOffline(team[0..30], meses, seed)<br/>EmployeeBrain pré-LLM, ZERO chamadas de API —<br/>eventos humanos emergentes viram fatos no prompt

    Gemini->>RAG: generateRAGContext(config)
    RAG-->>Gemini: playbooks + metrics + profiles + events (few-shot)
    Gemini->>Gemini: injectRAGContext() concatena tudo no prompt

    Gemini->>Metrics: getCostProfile(economicProfileId)
    Gemini->>Metrics: calculateFrameworkFit(framework, size, budget, categoria)

    Gemini->>API: generateContent(prompt, responseSchema=SIMULATION_SCHEMA)
    API-->>Gemini: JSON com summary, timeline 12x rawData, keyPersonas, risks

    Note over Gemini: PÓS-PROCESSAMENTO DETERMINÍSTICO —<br/>o ROI do LLM é descartado

    loop para cada mês do timeline
        Gemini->>Metrics: calculateMonthlyMetrics(rawData, config, acumulados)
        Metrics-->>Gemini: opEx, valueDelivered, conq, roi mensal, roi acumulado
        Gemini->>Gemini: month.roi = roi acumulado calculado
    end

    Gemini->>Gemini: summary.totalRoi = recalculado
    Gemini->>Gemini: keyPersonas[].sentiment = humor determinístico do brain<br/>emergentEvents = eventos do EmployeeBrain
    Gemini-->>App: SimulationOutput (roi real, narrativa do LLM, emergentEvents)
    App-->>Usuário: Dashboard
```

---

## 4. Fluxo Agentic

Loop multi-turno no backend com EmployeeBrain, seguido da 2ª passada standard para o output visual ([ARCHITECTURE.md §3](ARCHITECTURE.md)).

```mermaid
sequenceDiagram
    participant App as App.tsx
    participant Agentic as agenticService
    participant Server as RAG/src/server.ts<br/>:3002
    participant Orch as OrchestratorAgent
    participant Persona as PersonaAgent<br/>gemini-2.5-flash (GEMINI_MODEL)
    participant Router as SmartRouter
    participant LLM as LLM escolhido<br/>GPT-4 / Gemini / DeepSeek
    participant Goal as GoalAgent
    participant Critic as CriticAgent
    participant ROI as ROICalculatorAgent
    participant Std as geminiService.runSimulation<br/>(2ª chamada)

    App->>Agentic: runAgenticSimulation(config)
    Agentic->>Server: POST /api/simulate {query, stakeholders [{id}], teamSample, config}
    Server->>Server: hidrata ids → RAG/profiles.json (350 personas)<br/>fallback sintético só se o id não existir
    Server->>Orch: runSimulation([query], stakeholders, config, teamProfiles)

    Orch->>Orch: ensureBrains(stakeholders + teamProfiles)<br/>1 EmployeeBrain por persona

    loop por turno
        loop por stakeholder
            Orch->>Persona: simulateResponse(persona, situacao, config, brain)
            Persona-->>Orch: resposta_persona, emocao_detectada, impacto_moral
            Orch->>Orch: updateBrain(brain, impacto_moral, pressão, clima)
        end
        Orch->>Orch: updateBrain() nas personas de fundo (sem LLM)
        Orch->>Orch: evaluateDecisions() por brain ativo (RNG semeado)<br/>+ applyContagion() em decisões com contágio social
        Orch->>Orch: moral_time / velocidade_sprint = aggregate(brains)<br/>(determinístico — não vem do LLM)
        Orch->>Router: route(prompt de consolidação)
        Router-->>Orch: LLMProvider por intenção
        Orch->>LLM: generate(narrativa do turno)
        LLM-->>Orch: confianca_delta ±5, scratchpad, resumo, eventos

        alt turno % 3 == 0
            Orch->>Goal: evaluate(state) → difficulty_scalar + diretiva
            Orch->>Orch: reflect() em todos os brains
        end
    end

    Orch->>Critic: critique(resumo final) — 1x por simulação
    Critic-->>Orch: plausibility_score, replan_required (fail-open)
    Orch->>ROI: calculateROI(config)
    ROI-->>Orch: projeção mensal, roi_final, break-even
    Orch-->>Server: state (funcionarios[], eventos_rh[], plausibility_score) + roi
    Server-->>Agentic: {success, state, roi}

    Agentic->>Std: runSimulation(config + contexto agêntico + tabela de brains)
    Std-->>Agentic: SimulationOutput rico
    Agentic->>Agentic: keyPersonas.sentiment = humor dos brains<br/>emergentEvents = eventos_rh + decisões graves<br/>quality_per_cycle = plausibility_score real
    Agentic-->>App: SimulationOutput + agenticMetrics
```

---

## 5. Pipeline RAG

Indexação dos dados estáticos e retrieval Self-RAG ([ARCHITECTURE.md §4](ARCHITECTURE.md)).

```mermaid
flowchart LR
    subgraph Fontes["Fontes de Dados (RAG/)"]
        P["profiles.json<br/>350 personas"]
        M["business_metrics_model.md"]
        E["simulation_events.json"]
        PB["framework_playbooks.json"]
    end

    subgraph Loader["documentLoader.ts"]
        LP["loadProfiles()<br/>1 doc/persona"]
        LM["loadMetrics()<br/>split por seção"]
        LE["loadEvents()<br/>1 doc/evento"]
        LPB["loadPlaybooks()<br/>1 doc/framework"]
    end

    P --> LP
    M --> LM
    E --> LE
    PB --> LPB

    LP --> Emb["GoogleGenerativeAIEmbeddings<br/>text-embedding-004"]
    LM --> Emb
    LE --> Emb
    LPB --> Emb

    Emb --> Chroma["ChromaDB :8000<br/>collections: profiles / metrics / events / playbooks / history"]

    Query["Query do usuário/agente"] --> QR["QueryRouter (Self-RAG)<br/>geminiModel() + Zod schema"]
    QR -->|"PERSONA_PURA"| NoRAG["sem retrieval<br/>few-shot direto no PersonaAgent"]
    QR -->|"CALCULO_ROI / COMPARATIVO / EVENTO / HIBRIDO"| HS["hybridSearch(query, collections, topK=5)"]
    HS --> Chroma
    Chroma --> Ctx["contexto injetado no prompt"]
```

---

## 6. Ingestão de documentos

`POST /api/ingest` → DocumentAgent ([ARCHITECTURE.md §4](ARCHITECTURE.md)).

```mermaid
flowchart TD
    Raw["rawText (documento do usuário)"] --> Size{"length > 50.000 chars?"}
    Size -->|"não (documento pequeno)"| Digest["digest()<br/>geminiModel() extrai<br/>Manifesto Estruturado Denso (JSON)"]
    Size -->|"sim (documento grande)"| Chunk["SmartChunker.chunk()<br/>~2000 chars/chunk, overlap 200<br/>detecta seções (markdown, COBIT, capítulos)"]
    Chunk --> Summary["buildSummaryForDigest()<br/>intro + 1 chunk/seção + conclusão"]
    Summary --> Digest2["digest() sobre o resumo"]
    Chunk --> Index["UserFrameworkStore.indexDocument()<br/>collection user_frameworks"]
    Index --> ChromaU["ChromaDB :8000"]
    Digest --> Out["DocumentDigest<br/>manifesto + coreValues + roles + ceremonies + artifacts"]
    Digest2 --> Out
```

---

## 7. Cascata de fallback Multi-LLM

Resiliência do frontend a quota/erros ([ARCHITECTURE.md §5](ARCHITECTURE.md)).

```mermaid
flowchart TD
    Start["runSimulation(config)"] --> Key["API Key atual do pool de 7"]
    Key --> Call["Gemini gemini-2.5-flash"]
    Call -->|"sucesso"| PostProc["Pós-processamento determinístico do ROI"]
    Call -->|"erro 429/quota e retryCount < 7"| Rotate["getNextApiKey() → próxima chave do pool"]
    Rotate --> Call
    Call -->|"7 tentativas esgotadas OU erro não-quota"| OpenAI["runSimulationWithOpenAI()<br/>GPT-4, prompt simplificado"]
    OpenAI -->|"sucesso"| Result["SimulationOutput (sem pós-proc. de ROI)"]
    OpenAI -->|"falha ou sem chave"| DeepSeek["runSimulationWithDeepSeek()"]
    DeepSeek -->|"sucesso"| Result
    DeepSeek -->|"falha ou sem chave"| Mock["MOCK_SIMULATION_RESULT"]
    PostProc --> Result2["SimulationOutput (ROI real)"]
```

---

## 8. SmartRouter

Ollama local classifica a intenção e roteia para o LLM adequado — gratuito e fail-open ([ARCHITECTURE.md §5](ARCHITECTURE.md)).

```mermaid
flowchart TD
    Prompt["prompt a rotear"] --> Ollama["Ollama llama3<br/>classifyIntent()"]
    Ollama -->|"falha (Ollama offline)"| Unknown["IntentType.UNKNOWN"]
    Ollama -->|"COMPLEX"| Complex["COMPLEX_REASONING"]
    Ollama -->|"CREATIVE"| Creative["CREATIVE_GENERATION"]
    Ollama -->|"SIMPLE"| Simple["SIMPLE_VALIDATION"]

    Complex --> GPT4["primaryLLM = GPT-4"]
    Creative --> GeminiW["workerLLM = Gemini (geminiModel())"]
    Simple --> DS["LLMFactory.getDeepSeek()"]
    Unknown --> GeminiW
```

---

## 9. EmployeeBrain — ciclo de vida

Estados alcançáveis de um funcionário simulado e as decisões humanas que os movem ([ARCHITECTURE.md §7](ARCHITECTURE.md) tem o catálogo completo com gatilhos numéricos).

```mermaid
stateDiagram-v2
    [*] --> ativo

    ativo --> pediu_demissao: turnosEstresseAlto>=2 & humor<-40<br/>(sorteio 35%, RNG semeado por persona+turno) — terminal
    ativo --> licenca: estresse>90 ou energia<15<br/>(decisão tipo "burnout"; turnosAfastado=2)
    licenca --> licenca: turnosAfastado--<br/>humor recupera +10/turno rumo ao neutro
    licenca --> ativo: turnosAfastado chega a 0<br/>estresse=45, energia=60, humor+40, turnosEstresseAlto=0

    ativo --> ativo: resistencia_passiva (humor<-30 & adaptabilidade<45)<br/>confronto_lideranca (humor<-50 & influencia>70, avaliado ANTES de fofoca)<br/>fofoca (humor<-40 & influencia>60, contágio social)<br/>— no máx. 1 decisão grave destas por turno, ordem fixa
    ativo --> ativo: apoiar_mudanca / pedir_ajuda<br/>(não-graves, independentes, podem coexistir com 1 grave)
```

E a dinâmica interna a cada turno:

```mermaid
flowchart LR
    IN["TurnContext<br/>pressãoBase (GoalAgent)<br/>impactoPessoal (LLM, coergido)<br/>moralGlobal (clima)"] --> UB["updateBrain()<br/>estresse += pressão × (100−resiliência)/100<br/>humor += impacto×2 + arrasto do clima<br/>energia drena sob estresse (workaholic 1.5×)<br/>+recuperação passiva se estresse<40"]
    UB --> MEM["memória FIFO 12 eventos<br/>reflect() a cada 3 turnos"]
    UB --> ED["evaluateDecisions()<br/>catálogo com RNG semeado"]
    ED --> CONT["applyContagion()<br/>fofoca: −3 humor / +4 estresse em 3 colegas<br/>champion: +2 humor em 2 colegas"]
    ED --> EV["eventos_rh + decisões graves<br/>→ narrativa da simulação"]
    UB --> AGGR["aggregate()<br/>moral = média (humor+100)/2<br/>velocidadeMod penaliza afastados/desistentes<br/>sentiment por persona"]
    AGGR --> STATE["state.moral_time<br/>state.velocidade_sprint<br/>(commit determinístico)"]
```

---

*Gerado na reforma v8 (jul/2026). Para regenerar o grafo do código: `graphify update .` → `graphify-out/graph.html`.*
