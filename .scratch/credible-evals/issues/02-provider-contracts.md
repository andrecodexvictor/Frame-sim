# Quais contratos e modelos estão disponíveis nas primeiras requisições?

Type: research
Label: wayfinder:research
Status: resolved
Assignee: coordinator
Parent: ../map.md
Blocked by: none

## Question

Qual versão Jev está instalada, como preservar a chave existente e quais IDs/modelos exatos aceitam chamadas nas credenciais específicas FrameSIM?

## Answer

Resolução apoiada nas consultas de npm/GitHub, documentação TypeSafe e primeiras chamadas reais. Detalhes no [handoff](../../../next_steps/provider_handoff.md) e [relatório sanitizado](../../../next_steps/provider_probe_results.json).

Gateway 0.5.0 já coincide com latest e chave/configuração global foram preservadas. Jev 1.13.0, GLM 5.3 e Kimi K3 retornaram conteúdo; Gemini resolveu 3.8 Flash, com instabilidade na primeira chave; DeepSeek v4.1 Flash apareceu no catálogo, mas geração teve timeout. O suporte inicial DeepSeek foi adicionado ao adaptador existente com regressão offline; geração fica pendente. Os papéis dos provedores são hipóteses de benchmark documentadas, não conclusões de qualidade.
