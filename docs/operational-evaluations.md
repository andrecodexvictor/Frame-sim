# Avaliações e indicadores operacionais

O FrameSim distingue a geração de planos, o julgamento automatizado e a comparação de dados operacionais. Um plano com mecanismo plausível não comprova melhoria observada na empresa.

## Indicadores

| Indicador | Taxa por período | Variação relativa |
|---|---|---|
| Erros de processo | Unidades distintas com erro / unidades processadas | (taxa inicial − atual) / inicial × 100 |
| Produtividade | Unidades aceitas / horas totais de trabalho | (atual − inicial) / inicial × 100 |
| Parcela de retrabalho | Horas de retrabalho / horas totais | (inicial − atual) / inicial × 100 |
| Taxa de retrabalho | Unidades distintas retrabalhadas / processadas | (inicial − atual) / inicial × 100 |

Horas totais incluem retrabalho. Unidades aceitas podem ter passado por correção; a contagem de erros não é somada à de aceitas como se fossem conjuntos exclusivos. Unidade, definição, janela, fonte e proveniência são declaradas por quem fornece os dados. O sistema verifica coerência numérica, mas não autentica uma fonte operacional externa.

Dados ausentes permanecem nulos com motivo. Linha de base zero não define redução percentual. Zero atual após taxa inicial positiva pode representar 100% de redução. Pioras aparecem com sinal negativo. A diferença contra a taxa inicial normalizada ao volume atual não é quantidade causalmente evitada pelo framework.

## Painel

O painel apresenta erros, produtividade e retrabalho. A seção de dados permite informar referência e período atual ou projetado, escolher a origem dos valores e identificar a fonte. O cálculo usa a mesma função determinística no navegador e no backend. O botão de registro cria um recibo no FrameSim; a exportação JSON inclui dados, resultados e recibo. Ao alterar entradas, o recibo anterior é removido da comparação atual.

Percentuais narrativos sem denominadores não substituem esses dados. As previsões anuais de ROI e comportamento continuam sintéticas e não estabelecem eficácia organizacional.

## Rotas nativas

- `POST /api/evaluate-operational`: compara observações e, quando recebe um plano com a fonte, consulta o Jev sobre mecanismos de redução de erros, produtividade e retrabalho.
- `GET /api/evaluations/:runId`: retorna os recibos locais daquele identificador.
- `POST /api/generate`, `/api/judge-result` e `/api/persona-judgment`: gravam recibos de entrada e saída na nova instrumentação.

Um recibo contém engine `FrameSim`, rota, identificador, instante, processo servidor e hashes. Ele comprova rastreabilidade local de uma chamada, não veracidade da inferência ou validação externa. Gerações históricas não recebem recibos retrospectivos inventados. O cabeçalho opcional `X-FrameSim-Run-Id` vincula uma chamada ao caso do experimento sem alterar o estado enviado ao modelo.

`OperationalEvaluationService` classifica mecanismos propostos e preserva confiança. Não estima percentuais de benefício sem observações. `operationalMetrics.ts` calcula os indicadores; `EvaluationAudit.ts` grava os recibos em `.context/evaluation-audit/`, excluído do Git. Cabeçalhos de autenticação e chaves não são gravados.

## Execução comparativa

O primeiro painel usa sementes pareadas por caso e o modo documental, que neutraliza ajustes por nome e preenchimento de lacunas por conhecimento prévio. Isso não valida o modelo anual como previsão. A PoC do artigo utiliza planos de 30 dias pelas APIs reais do FrameSim e relata separadamente os limites dessa abordagem.

NVIDIA recebe espaçamento de início também entre tentativas com outras chaves. `NVIDIA_START_INTERVAL_MS` controla esse intervalo no backend, com padrão de cinco segundos. A configuração reduz ciclos de recusas 429; não elimina limites do provedor. Fixtures e resultados degradados não são contados como inferências válidas na PoC.
