# Checkpoint de implementação — 2026-10-05

Estado: entrega local encerrada por autorização expressa do usuário (“PODE CONCLUIR A GOAL”), com compilação/revisão PDF não verificadas. A evidência por requisito e a ressalva aceita são mantidas no [relatório de validação](../../../next_steps/credible_evals_validation.md).

Fechamento: fluxogramas visíveis nos três modos com símbolos convencionais e decisões Sim/Não; SVG/Mermaid/TikZ gerados pelo mesmo grafo. Corrigido o identificador reservado `end` para `finish` com regressão red/green. Exports, typecheck e build frontend finais passaram. A aprovação de encerramento não equivale a PDF compilado, validação empírica ou autorização de inferência paga. Os parágrafos abaixo registram o checkpoint anterior a essa autorização.

Implementado e verificado por testes de contrato: provedores e preferências explícitas, manifesto, traços completos, métricas individuais baseadas em evidência, Jev com abstenção, protocolo pareado e estatística por execução, registros de todas as tentativas do lote/racing, preservação de falhas interativas, harness offline e matriz online em dry-run, ReportData e exports nativos.

Os três modos possuem controles de pacote completo ZIP, fonte única TeX, snippets e dados. O pacote contém article.tex, booktabs, PGFPlots, TikZ, CSV, manifesto, traços, metodologia, limitações e BibTeX. JSZip 3.10.1, já presente transitivamente, passou a dependência direta fixada.

O modo padrão deixou de fabricar meses, adoção e entradas financeiras quando faltam no retorno. Lacunas financeiras invalidam ROI acumulado posterior; o resultado registra degradação. Racing preserva valores da trajetória selecionada, e conserva ensemble como agregado separado.

Gates encerrados após a última correção: typecheck, npm test, build:all, audit:all, exports e navegador terminaram com exit 0. Audit encontrou zero vulnerabilidades em frontend/backend. Exportações preservam precisão, negativos, lacunas, escaping, índices categóricos distintos, origem das legendas, nomes fixos e ZIPs válidos. Replay de traços: duas coortes holdout sintéticas, MAE=0 por construção contratual, baselineMAE=0,08333; isto não mede fidelidade real. Dry-run online regenerado com codeStateHash: 18 trials, zero chamadas e zero reservas. QA de navegador passou nos três painéis com downloads, desktop/390px, classe/censura visíveis, sem overflow e zero tentativas de inferência. Imagem mobile da distribuição inspecionada. Varredura após o build: 228 arquivos versionáveis/bundle sem padrões reconhecidos de credenciais. Nenhum gate amplo continua em execução.

Compilação: fontes geradas em artifacts/qa/article-fixtures; article_compile_check reportou unavailable porque não há LuaLaTeX/pdfLaTeX local. A tentativa anterior integrada falhou na inicialização. Não declarar compilação ou layout PDF aprovados.

Avanços desde o checkpoint anterior:

- Política synthetic-work-v1 registra oportunidades, aceites, rejeições, retrabalho, pares e censura. Capacidade e qualidade independem de estresse/personalidade. Revisões respeitam capacidade; o bloco não representa produção mensal total.
- incidentUniform aplica pressão e downtime nos dois motores; testes verificam efeito no estado e evidências em todas as personas/turnos.
- Batch seleciona o motor configurado. Cliente agêntico envia 1–60 turnos; não inventa meses. Primeira condição inteiramente falha continua como referência; falhas conservam protocolo e unidade.
- Harness offline recebe previsões sem o target, valida proveniência importada/splits e reamostra coortes completas. Fixture de replay vem do orquestrador offline.
- Online materializa braços determinístico, Jev, cada juiz externo e pipeline completo sobre candidatos congelados. Baseline extrativo tem resultado próprio. Execução remota exige orçamento e precificação versionada verificada. Reservas não medem cobrança real.
- Gráficos complementares, distribuições por classe, taskIds, dados financeiros e workloadPolicy entraram no contrato de relatório/exports. Origens mistas conservam presença sintética; labels repetidos não colapsam identidades.
- codeStateHash identifica fontes locais no início do processo, além do HEAD. Comparação rejeita snapshots divergentes. Reiniciar backend depois de mudar fontes.
- Regressão de exportação confirmou que turnos repetidos entre execuções não podem ser usados como índice categórico. Figuras categóricas usam índices distintos, linhas mantêm o turno/mês e cada snippet identifica a origem canônica.

Pendência técnica para conclusão estrita: compilação/layout do artigo fixture. Gates amplos e auditoria do relatório foram fechados. Sem compilador disponível, preservar fontes e não instalar TeX como contorno. Benchmark pago e calibração empírica dependem de orçamento/dados externos e não foram executados. A indisponibilidade do compilador foi confirmada nas três últimas continuações do goal; conclusão não pode ser declarada apenas com fontes editáveis.

Sem dataset observado nem rótulos independentes: validação empírica permanece pendente. Credenciais são exclusivamente server-side e não fazem parte deste tracker.
