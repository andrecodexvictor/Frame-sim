# Especificação: FrameSIM com avaliações rastreáveis e exportação científica

Data: 2026-10-04 · Base auditada: `54e069d` · Estado: implementação local autorizada pelo goal ativo; gates e lacunas registrados no mapa Wayfinder.

## Objetivo

Avaliar a trajetória individual de cada persona com evidência por turno, comparar frameworks/modelos/intervenções sob condições controladas e exportar os mesmos dados usados no app para artigos LaTeX. Plausibilidade narrativa, desempenho simulado e concordância com dados observados são resultados diferentes.

## Premissas explícitas

- Manter React 19, Vite, TypeScript e backend Express/LangGraph existentes.
- Preservar a chave global Jev; usar a chave Jev específica FrameSIM no backend.
- Não foi fornecido dataset de desempenho observado nem rótulos humanos. A primeira versão usa fixtures sintéticas identificadas; a validação empírica permanece pendente até importar dados adequados.
- Papéis dos modelos abaixo são hipóteses para benchmark, não alegações de superioridade comprovada.
- Manter modos individual, comparação e batch. Acrescentar avaliação de personas dentro de cada modo.
- Não executar um benchmark grande e pago nesta preparação. As chamadas já realizadas são testes sintéticos mínimos.

## Diagnóstico da base anterior

Pesquisa: [pesquisa com referências](credible_evals_research.md). Conectividade: [resultados e tentativas](provider_probe_results.json). Mapa: [Wayfinder](../.scratch/credible-evals/map.md).

Os pontos abaixo motivaram a especificação. O estado da implementação e os gates posteriores estão no [relatório de validação](credible_evals_validation.md); não interpretar este diagnóstico histórico como inventário atual de falhas.

- `ProviderGateway` e `LLMFactory` são caminhos distintos. Ambos precisam manter credenciais server-side e registrar o modelo efetivo.
- `CriticAgent` oferece plausibilidade; `quality_per_cycle` não prova qualidade de desempenho individual.
- `EmployeeBrain` possui estado por pessoa, mas o output não preserva um registro completo e auditável de ação, contexto e consequência por turno.
- O gerador de perfis usa escolhas aleatórias. Chamar perfis de reais sem origem documentada não sustenta validação externa.
- Seeds derivadas do nome do framework/agente confundem intervenção e cenário na comparação. A memória longa também pode contaminar benchmarks.
- O ranking atual de comparação soma escalas e elimina ROI negativo da pontuação; o CSV batch não equivale a um pacote científico.

## Usuários e comportamento esperado

1. Pesquisador identifica quais pessoas, ações e evidências sustentam uma métrica.
2. Usuário vê produtividade, qualidade e colaboração separadamente; estresse não vira sinônimo de baixo desempenho.
3. Usuário filtra a trajetória por persona, turno, papel e condição experimental.
4. Pesquisador compara frameworks com mesma equipe inicial, mesmos choques exógenos e réplicas pareadas.
5. Pesquisador compara modelos com gerador e avaliador identificados e sem autoavaliação oculta.
6. Pesquisador importa observações e rótulos com origem, licença, unidade e período definidos.
7. Pesquisador distingue validação de regras, plausibilidade semântica e validação empírica.
8. Usuário exporta gráficos, tabelas, dados e metodologia para LaTeX sem recalcular valores no relatório.
9. Usuário sabe quando uma execução foi degradada, interrompida ou carece de evidências.

## Arquitetura e contratos

Decisão de apresentação (2026-10-04): a API agêntica fornece turnos, confiança e estado humano, mas não mede adoção, maturidade ou duração da implantação. Esses campos legados ficam `null`, identificados como indisponíveis; turno não é convertido em mês. A apresentação usa o resultado canônico, sem executar uma segunda simulação. Gráficos toleram lacunas, preservando o ROI econômico quando disponível.

### Registro de execução

`RunManifest`: schemaVersion, runId, experimentId, replicaId, scenarioId, scenarioSeed, interventionId, modelSeed quando suportada, configHash, datasetHash, codeRevision, timestamps, provider/model efetivos, parâmetros, status de execução, origem dos dados e hash da rubrica. Resolver aliases para o modelo efetivamente retornado; nunca alegar reprodutibilidade byte a byte de LLM remoto.

O SHA de HEAD sozinho não identifica mudanças locais. `codeStateHash` captura código/configurações de build selecionados no início do processo, incluindo novos módulos; exclui credenciais, artefatos, dados de perfis e documentos. Manifestos/frontend/online conservam esse hash adicional. Reiniciar o servidor após mudar fontes; o hash não garante fidelidade de respostas remotas nem substitui o datasetHash. Braços com snapshots de código distintos são excluídos do pareamento.

`PersonaTrace`: personaId estável, turnId, eventId, estado anterior/posterior, ação, tarefa/oportunidade, carga, aceitação/defeito/retrabalho, evidências vinculadas, fonte e atribuição. Nomes narrativos não são identidade. Separar eventos exógenos previamente sorteados de consequências endógenas da intervenção. Registrar origem `synthetic`, `expert_labeled` ou `observed` em cada evidência.

`IndividualEvaluation`: dimensões, numerador/denominador, unidade, evidências, cobertura, rubrica e pesos versionados, origem, incerteza/abstenção, avaliador, custo/tokens/latência e limitações. Ausência de dado resulta em null e motivo, nunca zero fabricado.

### Métricas por pessoa

| Dimensão | Medida inicial | Condição para calcular |
|---|---|---|
| Entrega | unidades aceitas / oportunidades atribuídas | tarefas e unidade de esforço explícitas; ajustar por papel e disponibilidade |
| Qualidade | unidades aceitas sem retrabalho / unidades entregues | evidência de aceite, defeito e atribuição |
| Fluxo | lead time mediano e distribuição por classe | início/fim e censura definidos |
| Colaboração | intervenções documentadas avaliadas com rubrica | eventos/pares identificados; Jev apenas julga evidência sem criar fatos |
| Adaptação | alteração de comportamentos observáveis entre turnos | baseline e oportunidades comparáveis |
| Sustentabilidade | carga/energia/estresse e recuperação | contexto separado de performance e sem diagnóstico clínico |

Métricas de equipe continuam no nível de equipe. Não dividir ROI pelo número de personas para inventar contribuição individual. Comparações de indivíduo entre papéis só são possíveis após uma normalização explícita e validada.

Decisão de implementação (bloco sintético de trabalho, 2026-10-04): cada turno registra uma amostra de trabalho, com capacidade padrão de 2 horas por pessoa ativa, esforço de 1 hora por tarefa, demanda sorteada por endereço pessoa/turno e fonte `synthetic`. Esse bloco não representa toda a produção de um mês. Papel identifica a classe da tarefa; não estabelece produtividade comparável entre profissões. As constantes de defeito (0,2), revisão (0,5) e detecção (0,9) são hipóteses contratuais, não parâmetros empiricamente calibrados. Não há bonificação implícita para um framework: todos usam a mesma política inicial; políticas alternativas precisam estar explícitas no manifesto.

Uma tarefa atribuída pode ficar pendente por falta de capacidade, entregue e rejeitada por defeito, ou aceita com/sem retrabalho. Revisão com pares identificados consome 0,25 hora do revisor; correção consome 0,25 hora do executor. Somente uma correção realmente documentada produz evidência de colaboração útil. Lead time mede o tempo dentro desse bloco até o aceite; pendentes/rejeitadas são censuradas e sua cobertura é informada. Estresse, energia, temperamento e rótulos psicológicos não entram na regra de defeito ou qualidade. Indisponibilidade altera capacidade e oportunidades, com origem e motivo registrados.

O incidente exógeno usa `incidentUniform < 0,1`: acrescenta 0,1 de pressão e 0,5 hora de indisponibilidade no bloco. O mesmo sorteio/contexto chega a todos os braços da réplica. Pressão e demanda já registradas no protocolo continuam separadas das respostas endógenas. Probabilidade, duração, custo de revisão e capacidade são versionados no manifesto. Uma mudança dessas hipóteses requer novo identificador de política e comparação exploratória; não alegar efeito real de framework a partir delas.

### Composição de avaliações

Distribuição de fluxo: cada avaliação conserva amostras por classe de tarefa com taskId, horas, evidências e censura; a mediana inclui apenas tarefas aceitas e não censuradas. Tarefas aceitas sem duração aparecem como timing ausente. Não estimar uma curva de sobrevivência com durações censuradas desconhecidas. A origem da avaliação é sintética quando há qualquer evidência sintética; rótulos de especialistas e observações não são promovidos a outra origem pelo container do traço.

1. Validar tipos, invariantes, identidades, limites e conservação com código determinístico.
2. Calcular medidas observáveis com código e preservar suas unidades.
3. Enviar ao Jev perguntas independentes por evidência/dimensão em uma requisição quando couber na janela; registrar quantidade de perguntas, tokens e segmentação.
4. Usar Score com níveis comportamentais completos, Noul para condições de evidência e Choice para classificação fechada. `confidence` não é probabilidade de a avaliação estar correta. Noul próximo de 0,5 não indica intensidade média.
5. Abster/escalar casos sem evidência suficiente, discordantes ou fora da distribuição. Limiares são calibrados em desenvolvimento, congelados antes do holdout.
6. Avaliador gerativo independente pode explicar desacordos e checar relações causais; toda afirmação deve apontar para eventIds. Não altera métricas determinísticas.
7. Apresentar vetor de dimensões e cobertura primeiro. Composite opcional usa pesos explícitos por papel; não compensa violações graves nem permite julgar uma pessoa pela personalidade.

### Papéis propostos dos provedores

| Provedor / modelo confirmado | Papel proposto | Configuração / evidência inicial |
|---|---|---|
| Jev / jev-1.13.0 | julgamentos tipados, relevância de evidência e rubricas | TYPESAFE_API_KEY do FrameSIM; chamadas HTTP 200. Gateway global 0.5.0 e chave atual preservados |
| Google / gemini-3.8-flash | narrativa estruturada e digest do contexto | alias gemini-flash-latest; pool existente preservado mais duas chaves novas. Uma chave retornou 503 no retry; outra gerou resposta |
| NVIDIA / deepseek-ai/deepseek-v4.1-flash | candidato de geração/contraponto no benchmark | NVIDIA_DEEPSEEK_API_KEY; catálogo 200, geração com timeout em 30/55 segundos; conectividade de geração pendente |
| NVIDIA / z-ai/glm-5.3 | candidato a crítica causal independente | NVIDIA_GLM_API_KEY; geração HTTP 200 |
| NVIDIA / moonshotai/kimi-k3 | candidato a síntese longitudinal e revisão de evidências | NVIDIA_KIMI_API_KEY; geração HTTP 200 |

Chaves Google adicionais pertencem ao mesmo provedor e não são avaliadores independentes. Failover deve respeitar Retry-After, cooldown por chave e limite global por requisição; rotação não contorna quota do projeto. IDs são parâmetros server-side validados. Não enviar chave nvapi para api.deepseek.com. O gateway de coding agents seleciona ferramentas; o avaliador Jev do simulador chama a API TypeSafe diretamente. São integrações diferentes.

No benchmark de modelos, fixar a mesma matriz de entrada e orçamento. Separar comparação de geradores e comparação de avaliadores; usar o mesmo avaliador externo congelado para comparar geradores e registrar matriz cruzada quando os modelos trocam de papel. Escolher o default somente depois de medir qualidade, erro, custo e latência.

## Evals e comparação

### Conjuntos

- Smoke: casos sintéticos mínimos; provam contrato/conectividade, não desempenho real.
- Regressão: cenários semânticos rotulados, evidência faltante, contradição, stress alto com bom desempenho, intervenção benigna/adversa, nomes duplicados, saída truncada, mudança de schema e falhas de provedor.
- Calibração: desenvolvimento com rótulos de especialistas e revisão de desacordos; manter segregado do teste final.
- Holdout empírico: organizações/períodos inteiros separados para reduzir vazamento; origem/licença/consentimento documentados. Dados de uma mesma pessoa não atravessam splits por conveniência.

### Experimento

- Gerar previamente equipe inicial e agenda de choques para cada réplica; reaproveitar em A/B. RNG separado para política/ação endógena. Snapshot ou reset de memória/RAG a cada condição.
- Comparações: frameworks, intervenções, provedores geradores e políticas de avaliação. `personaId` persiste entre braços quando a mesma equipe é reaproveitada.
- Piloto de 10–20 réplicas para estimar variância; selecionar tamanho final por precisão/poder e orçamento. Não tratar todos os turnos/pessoas de uma execução como observações independentes.
- Calcular delta pareado por réplica, IC por bootstrap clusterizado no nível de execução/organização ou t pareado quando adequado. `n=1` gera IC indisponível. Mostrar n independente, n de eventos, dispersão e falhas.
- Para poucos cenários, restringir a inferência aos cenários testados. Para múltiplas hipóteses, indicar análise exploratória ou aplicar correção previamente definida.
- Ablações: determinístico, +Jev, +juiz externo, pipeline completo. Censurar identidade do gerador ao juiz quando possível e randomizar ordem para avaliar viés de posição.
  O harness materializa cada braço sobre o mesmo candidato congelado: verificações exatas de citações, Jev, cada juiz externo e vetor do pipeline completo. O baseline gerador extrativo cita os eventos literalmente e tem resultado próprio. O baseline de citações não decide equivalência semântica: paráfrases permanecem não verificadas. Braços incompletos conservam status/falhas; nenhum agregado oculta julgamentos discordantes. A execução remota exige tabela de tetos de custo versionada e validada pelo operador, além dos limites de chamadas, bytes de entrada e tokens de saída; sem precificação verificada permanece em dry-run.
- Não escolher somente a melhor corrida para avaliar fidelidade: registrar todas, falhas e seleção. Racing pode otimizar produção, mas avaliação usa distribuições e holdout.

### Indicadores de validação

MAE/RMSE por unidade quando há alvos numéricos; concordância/rank correlation quando há rótulos ordinais; Brier/log loss e curvas de calibração para probabilidades; agreement entre humanos com adjudicação; coverage versus error após abstenção; consistência causal e temporal; estabilidade por seed; taxa de saída válida; latência p50/p95; tokens e custo medido ou estimado com tabela versionada e explícita. ROI observado requer dados financeiros próprios, não opinião de LLM.

Não fixar metas científicas arbitrárias sem baseline. Gate técnico: nenhuma quebra de invariante, nenhuma fixture sem identificação e cada resultado reproduzível a partir do manifesto/artefatos. Gate empírico: métricas no holdout, IC e comparação com baseline publicados; se não houver dataset, status `empirical_validation_pending`.

## Exportação nativa para artigos

Uma representação canônica `ReportData` alimenta app e todos os exports. A exportação preserva sinais negativos, casas decimais, unidades, dados faltantes, ICs e número de réplicas.

O contrato inclui também alocação, sentimento, aderência por departamento, métricas de negócio, evolução da empresa, entradas financeiras, observabilidade agêntica e as coordenadas normalizadas do radar. Rótulos repetidos conservam índice de série distinto. Valores categóricos e narrativos ficam no snapshot de apresentação do relatório; números também entram na tabela/CSV/PGFPlots. Maturidade no radar usa transformação explícita ×10; não é pontuação composta. Falhas conservam protocolo mesmo quando não há manifesto concluído.

Figuras categóricas usam índices de série distintos mesmo quando diferentes execuções compartilham um turno. Figuras temporais conservam o turno/mês registrado. Cada snippet identifica a origem das suas medidas (`synthetic`, `expert_labeled` ou `observed`), sem promover dados sintéticos a observações.

Pacote ZIP proposto: `article.tex`, `figures/*.tex` (TikZ/PGFPlots), `tables/*.tex` (booktabs), `data/*.csv`, `manifest.json`, `metrics.json`, `methodology.tex`, `limitations.tex`, `references.bib`, `README.md` e, quando houver renderização disponível, PDFs vetoriais. Compilar `article.tex` sem acesso a rede ou shell-escape. Caminhos relativos, nomes de arquivo seguros, escaping de `% & _ # $ { } ~ ^ \\` e Unicode; conteúdo importado nunca vira comandos TeX.

- Gráficos: timeline/linhas, barras com IC, distribuições, deltas pareados, dimensões individuais. Não extrair números de pixels ou screenshot do Recharts.
- Flowchart acompanha o relatório e identifica evidências, cálculo, julgamentos, abstenção, comparação e exportação.
- Exportação individual, comparação e batch compartilham renderer/contrato. A legenda sempre informa fonte sintética ou observada.
- TeX nativo é o caminho independente de instalador. PDF offline pode ser opcional; indisponibilidade de compilador não bloqueia o ZIP e deve ser reportada.

Exemplo estático nesta preparação: [fluxograma LaTeX](framesim_flowchart.tex). É um modelo de documentação, não a funcionalidade de exportação já implementada no app. O compilador integrado retornou erro de ambiente `Unable to find standard directories for platform`; fonte preservado e compilação/layout não verificados.

## Stack, estrutura e estilo

Frontend: `components/`, `services/`, `types.ts`; backend: `RAG/src/agents`, `RAG/src/core`, `RAG/src/services`, `RAG/src/types`, `RAG/src/tests`. Evals propostos: `RAG/src/evals/`, `RAG/evals/fixtures/`; exports: `services/articleExport.ts`; documentação científica: `next_steps/`; plano: `docs/plans/`.

Usar ES modules, interfaces TypeScript explícitas, validação de `unknown` na fronteira, async/await e erros sanitizados como nas classes existentes. Exemplo:

```ts
interface EvidenceMetric {
    value: number | null;
    unit: string;
    evidenceIds: string[];
    missingReason?: string;
}
```

## Comandos de implementação e verificação

```text
npm ci
npm --prefix RAG ci
npm run typecheck
npm test
npm run build:all
npm run audit:all
npm run test:browser
node scripts/provider_probe.mjs
npm run dev
npm run dev:api
```

Novos scripts `eval:offline`, `eval:online` e `test:export` deverão ser criados no plano; não existem na base atual. Execução online exigirá `--budget-usd`, `--max-runs` e `--timeout-ms` explícitos, encerrando antes de exceder orçamento. Testes não leem `.env` real. Build/CI não faz inferência paga por padrão.

## Estratégia de testes

Fronteiras preferidas: `/api/simulate` → manifesto/traço/avaliação; avaliação offline a partir de trace fixture; pacote científico a partir de `ReportData`. Testar comportamento e contratos, não detalhes de funções privadas. Aproveitar testes atuais de brain, orchestrator, gateway, racing e server. Separar mock de transporte e chamada real; ambos têm relatórios distintos.

Testes obrigatórios: replay determinístico, IDs duplicados por nome sem colisão, evidência faltante/sem inventar zero, mesmo choque entre braços, memória isolada, exclusão identificada de fixtures, IC indisponível com uma réplica, preservação de ROI negativo, juiz distinto do gerador, escaping TeX/injeção, paridade numérica app/CSV/TeX e compilação do artigo em fixture controlada. TDD para mudanças comportamentais. UI verificar com navegador em desktop e viewport reduzida.

## Limites e critérios de conclusão

Contrato temporal: o cliente agêntico envia uma consulta por turno configurado (1–60); turno não equivale a mês observado. Consulta e agenda pareada devem ter o mesmo comprimento. O limite do grafo acompanha esse número. Falhas conservam ordem da condição, protocolo e unidade temporal no relatório.

Orçamento do bloco de trabalho: revisões são reservadas em ordem estável por pessoa/tarefa, até a capacidade após downtime; revisões excedentes não ocorrem. Lead time de tarefas aceitas inclui downtime e tempo reservado para revisão dentro do bloco. Pendências/rejeições são censuradas no limite desse bloco e não atravessam turnos; mediana é condicional às tarefas aceitas. Essas limitações e a política constam do painel e dos exports.

Sempre: atualizar spec antes de mudar decisão, preservar credenciais, limitar retries/custo, tornar falhas visíveis, verificar gates aplicáveis. Nunca: commitar segredos, afirmar validação real usando só sintéticos, inferir autorização de dados privados de pessoas, usar temperamento como rótulo de performance ou suprimir execuções malsucedidas.

Pedir informação apenas quando indispensável: acesso/licença de datasets e mudança material de escopo ou orçamento pago. A implementação local indicada pelo `/goal` e integrações descritas estão autorizadas pelo pedido; não exigir confirmação repetida para decisões reversíveis.

Concluído tecnicamente quando: métricas e evidências individuais atravessam API/UI, comparação pareada funciona, validação offline reproduzível é executável, os cinco provedores têm transporte suportado com estado de saúde honesto, exports nativos funcionam nos três modos, artigo fixture compila, e typecheck/test/build/audit/browser aplicáveis passam. Não marcar validado empiricamente antes do gate de dados reais.

Encerramento autorizado em 2026-10-05: após a comunicação de que a compilação/revisão PDF estava indisponível e de que faltava corrigir o nó final do Mermaid, o usuário instruiu “PODE CONCLUIR A GOAL”. A entrega local pode ser encerrada após essa correção e os checks aplicáveis, com a compilação explicitamente registrada como não verificada. Essa autorização aceita a ressalva de ambiente; não transforma fontes geradas em PDFs compilados nem autoriza validação empírica ou benchmark pago sem dados/orçamento.

## Perguntas restantes

Fonte de dados observados/rótulos humanos e orçamento final do benchmark. Valores de thresholds/pesos e escolha do melhor gerador serão definidos por calibração, não por preferência sem evidência. Gateway Jev global não é um MCP; nenhuma instalação nova de MCP foi necessária.
